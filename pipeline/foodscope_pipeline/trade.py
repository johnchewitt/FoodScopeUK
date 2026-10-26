"""Offline step: raw HMRC cache → trade snapshot for the Food Origins explorer.

Reads only the raw-response cache written by `ingest-hmrc` (and the committed Natural Earth
reference points), so it is reproducible without network access and re-runs byte-identically.

Outputs, per snapshot `<id>` (YYYY-MM-DD), under public/data/snapshots/<id>/trade/:
- `<basket>.json` — monthly recorded imports by partner (schema trade-snapshot), one file per basket
- `index.json` — the baskets available (schema trade-index)
- `*.provenance.json` sidecars for the manifest
and pipeline/reports/:
- `hmrc-reconciliation-<id>.json` — aggregation vs raw rows (gate G1); the build fails on mismatch
- `trade-accounting-<id>.json` — rows in/out/rejected per step
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import jsonschema

from foodscope_pipeline.accounting import Accounting
from foodscope_pipeline.sources.hmrc_ots import (
    FIRST_MONTH,
    IMPORT_FLOWS,
    RECONCILE_MONTHS,
    Basket,
    BasketGroup,
    RawCache,
    basket_commodity_ids,
)

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_DIR = REPO_ROOT / "schemas"
CONFIG_DIR = Path(__file__).resolve().parent / "config"
FLOW_LABELS = {1: "EU imports", 3: "Non-EU imports"}
ATTRIBUTION = (
    "Source: HMRC Overseas Trade Statistics (uktradeinfo). Contains public sector information "
    "licensed under the Open Government Licence v3.0."
)
# HMRC: "Published data is provisional for up to 18 months after it is published."
PROVISIONAL_MONTHS_AFTER_PUBLICATION = 18
# HMRC publishes a month's OTS roughly six weeks after the month ends (e.g. Aug 2026 data on
# 15 Oct 2026). Used only to estimate which months are still inside the revision window.
APPROX_PUBLICATION_LAG_DAYS = 42


class TradeBuildError(RuntimeError):
    pass


# ---------------------------------------------------------------------------------------------
# Months
# ---------------------------------------------------------------------------------------------


def month_label(month_id: int) -> str:
    y, m = divmod(month_id, 100)
    if not (1 <= m <= 12):
        raise ValueError(f"invalid MonthId {month_id}")
    return f"{y:04d}-{m:02d}"


def month_range(first: int, last: int) -> list[int]:
    out: list[int] = []
    y, m = divmod(first, 100)
    while y * 100 + m <= last:
        out.append(y * 100 + m)
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _month_end(month_id: int) -> date:
    y, m = divmod(month_id, 100)
    first_next = date(y + 1, 1, 1) if m == 12 else date(y, m + 1, 1)
    return first_next - timedelta(days=1)


def _months_before(d: date, months: int) -> date:
    y, m = d.year, d.month - months
    while m <= 0:
        y, m = y - 1, m + 12
    day = min(d.day, 28)
    return date(y, m, day)


def provisional_from(months: list[int], retrieved_at: str) -> int | None:
    """First month whose estimated publication date is within HMRC's 18-month revision window."""
    retrieved = datetime.fromisoformat(retrieved_at.replace("Z", "+00:00")).date()
    cutoff = _months_before(retrieved, PROVISIONAL_MONTHS_AFTER_PUBLICATION)
    for mid in months:
        if _month_end(mid) + timedelta(days=APPROX_PUBLICATION_LAG_DAYS) > cutoff:
            return mid
    return None


# ---------------------------------------------------------------------------------------------
# Partners and crosswalk (gate G4)
# ---------------------------------------------------------------------------------------------


@dataclass
class Partner:
    key: str
    name: str
    hmrc_names: list[str]
    hmrc_country_ids: list[int]
    kind: str  # "country" | "unallocated"
    iso2: str | None
    geometry: str  # "polygon" | "point" | "none"
    point: list[float] | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "name": self.name,
            "hmrcNames": sorted(set(self.hmrc_names)),
            "hmrcCountryIds": sorted(set(self.hmrc_country_ids)),
            "kind": self.kind,
            "iso2": self.iso2,
            "geometry": self.geometry,
            "point": self.point,
        }


def load_points(path: Path) -> dict[str, dict[str, Any]]:
    doc = json.loads(path.read_text(encoding="utf-8"))
    return {p["iso_a2"]: p for p in doc["points"]}


def build_partner_table(countries: list[dict[str, Any]], crosswalk: dict[str, Any],
                        points: dict[str, dict[str, Any]]) -> dict[int, Partner]:
    """Maps every HMRC CountryId to a partner. Several CountryIds may share a partner key."""
    overrides = crosswalk.get("alphaOverrides", {})
    non_geo = {int(k): v for k, v in crosswalk.get("nonGeographicCountryIds", {}).items()}
    by_key: dict[str, Partner] = {}
    by_id: dict[int, Partner] = {}
    for c in sorted(countries, key=lambda c: int(c["CountryId"])):
        cid = int(c["CountryId"])
        hmrc_name = str(c.get("CountryName") or "").strip()
        alpha = str(c.get("CountryCodeAlpha") or "").strip().upper()
        if cid in non_geo or not alpha:
            key = f"hmrc-{cid}"
            label = non_geo.get(cid, hmrc_name or f"HMRC country {cid}")
            partner = Partner(key, label, [hmrc_name], [cid], "unallocated", None, "none", None)
            by_key[key] = partner
            by_id[cid] = partner
            continue
        iso2 = overrides.get(alpha, {}).get("iso2", alpha)
        existing = by_key.get(iso2)
        if existing:
            existing.hmrc_country_ids.append(cid)
            existing.hmrc_names.append(hmrc_name)
            by_id[cid] = existing
            continue
        pt = points.get(iso2)
        geometry = "none" if pt is None else ("polygon" if pt["in110m"] else "point")
        name = pt["name_long"] if pt else hmrc_name
        partner = Partner(iso2, name, [hmrc_name], [cid], "country", iso2, geometry,
                          [pt["lon"], pt["lat"]] if pt else None)
        by_key[iso2] = partner
        by_id[cid] = partner
    return by_id


# ---------------------------------------------------------------------------------------------
# Basket snapshot
# ---------------------------------------------------------------------------------------------

_REQUIRED_FIELDS = ("MonthId", "FlowTypeId", "CountryId", "CommodityId", "SuppressionIndex", "SumNetMass", "SumValue")


def _as_int(value: Any, field: str) -> int:
    if value is None:
        raise TradeBuildError(f"null {field}")
    f = float(value)
    if f != int(f):
        raise TradeBuildError(f"non-integer {field}: {value}")
    return int(f)


def build_basket(basket: Basket, rows: list[dict[str, Any]], commodities: list[dict[str, Any]],
                 partners_by_id: dict[int, Partner], latest: int, retrieved_at: str,
                 accounting: Accounting) -> dict[str, Any]:
    ids = basket_commodity_ids(basket, commodities)
    allowed = set(ids)
    months = month_range(FIRST_MONTH, latest)
    index_of = {m: i for i, m in enumerate(months)}

    allocated: dict[tuple[int, str], list[int]] = defaultdict(lambda: [0, 0])
    suppressed: dict[tuple[int, int], list[int | None]] = {}
    rejects: dict[str, int] = defaultdict(int)
    kept = 0
    seen_months: set[int] = set()
    # Months in which each CN8 code has at least one kept import row (suppressed included).
    code_months: dict[int, set[int]] = defaultdict(set)
    code_kg: dict[int, list[int]] = defaultdict(lambda: [0] * 12)
    for r in rows:
        missing = [f for f in _REQUIRED_FIELDS if f not in r]
        if missing:
            raise TradeBuildError(f"{basket.id}: row missing {missing}: {r}")
        mid = int(r["MonthId"])
        flow = int(r["FlowTypeId"])
        if mid not in index_of:
            rejects["month outside snapshot range"] += 1
            continue
        if flow not in IMPORT_FLOWS:
            rejects["not an import flow"] += 1
            continue
        if int(r["CommodityId"]) not in allowed:
            rejects["CN8 code outside basket"] += 1
            continue
        cid = int(r["CountryId"])
        partner = partners_by_id.get(cid)
        if partner is None:
            raise TradeBuildError(f"{basket.id}: CountryId {cid} is not in /Country")
        kg = _as_int(r["SumNetMass"], "SumNetMass")
        gbp = _as_int(r["SumValue"], "SumValue")
        level = int(r["SuppressionIndex"])
        seen_months.add(mid)
        code_months[int(r["CommodityId"])].add(mid)
        kept += 1
        if level == 0:
            code_kg[int(r["CommodityId"])][mid % 100 - 1] += kg
        if level > 0:
            # Suppressed trade keeps its own bucket and is never redistributed (P12). Quantity is
            # published only at level 2; value is withheld only at level 1.
            slot = suppressed.setdefault((index_of[mid], level), [0, 0])
            slot[0] = None if level != 2 else (slot[0] or 0) + kg
            slot[1] = None if level == 1 else (slot[1] or 0) + gbp
            continue
        acc = allocated[(index_of[mid], partner.key)]
        acc[0] += kg
        acc[1] += gbp
    accounting.record(f"{basket.id}: aggregate rows → kept", len(rows), kept, dict(rejects))

    used = sorted({k for (_, k) in allocated}, key=lambda k: (k.startswith("hmrc-"), k))
    partner_index = {k: i for i, k in enumerate(used)}
    partner_objs = {p.key: p for p in partners_by_id.values()}
    out_rows = [
        [m, partner_index[k], v[0], v[1]]
        for (m, k), v in sorted(allocated.items(), key=lambda kv: (kv[0][0], partner_index[kv[0][1]]))
    ]
    out_suppressed = [[m, level, v[0], v[1]] for (m, level), v in sorted(suppressed.items())]
    nil_months = [index_of[m] for m in months if m not in seen_months]

    cn8 = sorted(
        (
            {
                "code": str(c["Cn8Code"]),
                "commodityId": int(c["CommodityId"]),
                "description": (c.get("Cn8LongDescription") or c.get("Hs6Description") or "").strip(),
                **code_history(code_months.get(int(c["CommodityId"]), set()),
                               code_kg.get(int(c["CommodityId"]), [0] * 12)),
            }
            for c in commodities
            if int(c["CommodityId"]) in allowed
        ),
        key=lambda c: c["code"],
    )
    prov = provisional_from(months, retrieved_at)
    return {
        "schemaVersion": 1,
        "id": f"trade.{basket.id}",
        "commodity": {
            "id": basket.id,
            "label": basket.label,
            "definition": basket.definition,
            "hsScope": basket.hs_scope,
            "cn8": cn8,
        },
        "flows": [{"id": f, "label": FLOW_LABELS[f]} for f in IMPORT_FLOWS],
        "months": {
            "first": month_label(months[0]),
            "last": month_label(months[-1]),
            "provisionalFrom": month_label(prov) if prov else None,
        },
        "units": {"mass": "kg", "value": "GBP"},
        "partners": [partner_objs[k].to_dict() for k in used],
        "rows": out_rows,
        "suppressed": out_suppressed,
        "nilMonths": nil_months,
        "codeChanges": code_changes(cn8, month_label(months[0]), month_label(months[-1])),
    }


# ---------------------------------------------------------------------------------------------
# Commodity-code history (Stage 3: explains nomenclature changes in seasonal views)
# ---------------------------------------------------------------------------------------------


def code_history(months_with_rows: set[int], kg_by_calendar_month: list[int]) -> dict[str, Any]:
    """First and last month with recorded imports under one CN8 code, how many months had any,
    which calendar months (1–12) ever had any, and unsuppressed net mass (kg) per calendar month
    summed over the snapshot. Derived from the same kept rows as the snapshot totals; a code with
    no rows in the snapshot range has null first/last months."""
    ordered = sorted(months_with_rows)
    return {
        "firstMonth": month_label(ordered[0]) if ordered else None,
        "lastMonth": month_label(ordered[-1]) if ordered else None,
        "monthsRecorded": len(ordered),
        "calendarMonths": sorted({m % 100 for m in ordered}),
        "netMassKgByCalendarMonth": list(kg_by_calendar_month),
    }


def _shift_label(label: str, delta: int) -> str:
    y, m = (int(p) for p in label.split("-"))
    n = y * 12 + (m - 1) + delta
    return f"{n // 12:04d}-{n % 12 + 1:02d}"


def code_changes(cn8: list[dict[str, Any]], first: str, last: str) -> list[dict[str, Any]]:
    """Months where the codes HMRC records under the basket change: at least one code has its last
    recorded month just before `month` and at least one other code its first recorded month at
    `month`, both strictly inside the snapshot range. Basket totals include every code, so they are
    continuous across the change; this only explains it."""
    starts: dict[str, list[str]] = defaultdict(list)
    ends: dict[str, list[str]] = defaultdict(list)
    for c in cn8:
        if c["firstMonth"] and c["firstMonth"] > first:
            starts[c["firstMonth"]].append(c["code"])
        if c["lastMonth"] and c["lastMonth"] < last:
            ends[_shift_label(c["lastMonth"], 1)].append(c["code"])
    return [
        {"month": month, "ended": sorted(ends[month]), "started": sorted(starts[month])}
        for month in sorted(set(starts) & set(ends))
    ]


# ---------------------------------------------------------------------------------------------
# Reconciliation (gate G1)
# ---------------------------------------------------------------------------------------------


def reconcile(basket: Basket, month: int, aggregate_rows: list[dict[str, Any]],
              raw_rows: list[dict[str, Any]]) -> dict[str, Any]:
    """Compares the $apply aggregation with sums of the raw rows for one month."""

    def key(r: dict[str, Any]) -> tuple[int, int, int, int]:
        return (int(r["CountryId"]), int(r["FlowTypeId"]), int(r["CommodityId"]), int(r["SuppressionIndex"]))

    agg: dict[tuple[int, int, int, int], tuple[int, int]] = {}
    for r in aggregate_rows:
        if int(r["MonthId"]) == month:
            agg[key(r)] = (_as_int(r["SumNetMass"], "SumNetMass"), _as_int(r["SumValue"], "SumValue"))
    raw: dict[tuple[int, int, int, int], list[int]] = defaultdict(lambda: [0, 0])
    for r in raw_rows:
        acc = raw[key(r)]
        acc[0] += _as_int(r.get("NetMass") or 0, "NetMass")
        acc[1] += _as_int(r.get("Value") or 0, "Value")
    mismatches = [
        {"key": list(k), "aggregate": list(agg.get(k, (None, None))), "raw": raw.get(k)}
        for k in sorted(set(agg) | set(raw))
        if agg.get(k) != (tuple(raw[k]) if k in raw else None)
    ]
    return {
        "basket": basket.id,
        "month": month_label(month),
        "rawRows": len(raw_rows),
        "aggregateGroups": len(agg),
        "netMassKg": {"aggregate": sum(v[0] for v in agg.values()), "raw": sum(v[0] for v in raw.values())},
        "valueGbp": {"aggregate": sum(v[1] for v in agg.values()), "raw": sum(v[1] for v in raw.values())},
        "mismatches": mismatches,
        "match": not mismatches,
    }


# ---------------------------------------------------------------------------------------------
# Writing
# ---------------------------------------------------------------------------------------------


def _dump(doc: Any) -> str:
    return json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n"


def _validate(doc: Any, schema_name: str) -> None:
    schema = json.loads((SCHEMA_DIR / f"{schema_name}.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(doc, schema, format_checker=jsonschema.FormatChecker())


def _provenance(dataset_id: str, title: str, rel_path: str, body: str, schema_id: str, reference_period: str,
                retrieval_source: str, retrieved_at: str, notes: str, source_ids: list[str]) -> dict[str, Any]:
    encoded = body.encode("utf-8")
    return {
        "id": dataset_id,
        "title": title,
        "role": "statistical",
        "path": rel_path,
        "format": "json",
        "schemaId": schema_id,
        "sha256": hashlib.sha256(encoded).hexdigest(),
        "bytes": len(encoded),
        "sourceIds": source_ids,
        "referencePeriod": reference_period,
        "coverage": "UK recorded imports from all partners (EU and non-EU import flows); GB and Northern Ireland",
        "provenance": "measured",
        "licence": "Open Government Licence v3.0",
        "attribution": ATTRIBUTION,
        "expectedCadence": "monthly",
        "retrieval": {
            "method": "HMRC OTS API, server-side $apply aggregation; raw responses cached in pipeline/raw/hmrc/",
            "source": retrieval_source,
            "retrievedAt": retrieved_at,
            "notes": notes,
        },
    }


def _month_text(label: str) -> str:
    y, m = label.split("-")
    return f"{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][int(m) - 1]} {y}"


def build_trade(snapshot_id: str, raw_root: Path, data_dir: Path, reports_dir: Path, baskets: list[Basket],
                points_path: Path, crosswalk_path: Path, groups: list[BasketGroup] | None = None) -> list[Path]:
    cache = RawCache(raw_root / snapshot_id)
    meta = cache.meta
    latest = int(meta["latestMonthId"])
    accounting = Accounting()

    commodities = cache.items("commodity")
    countries = cache.items("country")
    accounting.record("country list", len(countries), len(countries))
    points = load_points(points_path)
    crosswalk = json.loads(crosswalk_path.read_text(encoding="utf-8"))
    partners_by_id = build_partner_table(countries, crosswalk, points)

    probe_latest = cache.items(f"probe-{latest}")
    nxt = latest + 1 if latest % 100 < 12 else (latest // 100 + 1) * 100 + 1
    probe_next = cache.items(f"probe-{nxt}")
    if not probe_latest or probe_next:
        raise TradeBuildError(
            f"latest month check failed: {latest} has {len(probe_latest)} records, {nxt} has {len(probe_next)}"
        )

    out_dir = data_dir / "snapshots" / snapshot_id / "trade"
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    index_entries: list[dict[str, Any]] = []
    recon: list[dict[str, Any]] = []
    for basket in baskets:
        prefix = f"ots-aggregate-{basket.id}"
        parts = cache.parts(prefix)
        rows = cache.part_items(prefix)
        first_page = cache.entries[f"{parts[0]}-p001"]
        retrieval_source = first_page.url if len(parts) == 1 else (
            f"{len(parts)} queries over consecutive runs of the basket's CN8 codes (URL length), first: {first_page.url}"
        )
        snapshot = build_basket(basket, rows, commodities, partners_by_id, latest, first_page.retrieved_at,
                                accounting)
        _validate(snapshot, "trade-snapshot")
        body = _dump(snapshot)
        rel = f"snapshots/{snapshot_id}/trade/{basket.id}.json"
        (data_dir / rel).write_text(body, encoding="utf-8")
        written.append(data_dir / rel)
        period = f"{_month_text(snapshot['months']['first'])} – {_month_text(snapshot['months']['last'])} (monthly)"
        cn8_codes = ", ".join(c["code"] for c in snapshot["commodity"]["cn8"])
        prov = _provenance(
            snapshot["id"],
            f"Recorded UK imports: {basket.label.lower()} ({basket.hs_scope})",
            rel,
            body,
            "trade-snapshot",
            period,
            retrieval_source,
            first_page.retrieved_at,
            (
                f"CN8 codes: {cn8_codes}. Import flows 1 (EU) and 3 (non-EU) summed. Partner = country of "
                "dispatch recorded by HMRC. Suppressed trade kept separately. Latest month confirmed by probing "
                "the following month. Months from provisionalFrom are within HMRC's 18-month revision window "
                "(estimated from publication lag)."
            ),
            ["S01", "S24"],
        )
        (out_dir / f"{basket.id}.provenance.json").write_text(json.dumps(prov, indent=2) + "\n", encoding="utf-8")
        index_entries.append({
            "id": basket.id,
            "datasetId": snapshot["id"],
            **({"group": basket.group} if groups and basket.group else {}),
            "label": basket.label,
            "definition": basket.definition,
            "hsScope": basket.hs_scope,
            "path": rel,
            "months": snapshot["months"],
        })
        month = RECONCILE_MONTHS.get(basket.id)
        if month:
            recon.append(reconcile(basket, month, rows, cache.part_items(f"ots-raw-{basket.id}-{month}")))

    index_doc: dict[str, Any] = {"schemaVersion": 1, "snapshotId": snapshot_id}
    if groups:
        used = {b.group for b in baskets}
        index_doc["groups"] = [{"id": g.id, "label": g.label} for g in groups if g.id in used]
    index_doc["commodities"] = index_entries
    _validate(index_doc, "trade-index")
    index_body = _dump(index_doc)
    index_rel = f"snapshots/{snapshot_id}/trade/index.json"
    (data_dir / index_rel).write_text(index_body, encoding="utf-8")
    written.append(data_dir / index_rel)
    first = min(e["months"]["first"] for e in index_entries)
    last = max(e["months"]["last"] for e in index_entries)
    index_prov = _provenance(
        "trade.index",
        "Food Origins commodity baskets",
        index_rel,
        index_body,
        "trade-index",
        f"{_month_text(first)} – {_month_text(last)}",
        cache.entries["commodity-p001"].url,
        cache.entries["commodity-p001"].retrieved_at,
        "Basket definitions (pipeline/foodscope_pipeline/config/trade_baskets.json) with the CN8 codes HMRC lists under each heading.",
        ["S01"],
    )
    (out_dir / "index.provenance.json").write_text(json.dumps(index_prov, indent=2) + "\n", encoding="utf-8")

    reports_dir.mkdir(parents=True, exist_ok=True)
    recon_doc = {
        "snapshotId": snapshot_id,
        "gate": "G1",
        "description": "HMRC $apply groupby/aggregate totals compared with sums of unaggregated /OTS rows for the same month, keyed by country × flow × CN8 × suppression index.",
        "checks": recon,
        "allMatch": all(c["match"] for c in recon),
    }
    (reports_dir / f"hmrc-reconciliation-{snapshot_id}.json").write_text(
        json.dumps(recon_doc, indent=2) + "\n", encoding="utf-8")
    accounting.write(reports_dir / f"trade-accounting-{snapshot_id}.json")
    if not recon_doc["allMatch"]:
        raise TradeBuildError("reconciliation failed; see " + str(reports_dir / f"hmrc-reconciliation-{snapshot_id}.json"))
    logger.info("trade snapshot %s: %d files", snapshot_id, len(written))
    return written
