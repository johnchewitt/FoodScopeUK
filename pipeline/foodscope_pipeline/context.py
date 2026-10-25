"""OFFLINE build of the Stage 5 context datasets (LP-02, LP-04, LP-05; John, 25 Oct 2026).

Inputs (committed under pipeline/raw/, each checked against its SHA-256):
- S21 ONS 2021 Rural Urban Classification of councils (LAD 2024) in England and Wales
  (`fetch-reference --set context`, snapshot 2026-10-25);
- S20 Census 2021 households by car or van availability: Nomis TS045 for councils in England and
  Wales (2022 council codes) and NISRA's table builder for the 11 Northern Ireland councils
  (provided by John); the ONS LAD 2022 → LAD 2023 lookup turns the 2021 councils into today's;
- S09 / S10 Defra Horticulture statistics 2025 and Agriculture in the UK 2025, chapter 7;
- the council list of the published `local` family (May 2025 councils) and the council code
  changes in `config/lad_code_changes.json`.

Outputs go to `<out_root>/snapshots/<snapshot>/context/` (the `context` family, ADR-0021), each with
a `*.provenance.json` sidecar:
- `council-context.json`: per council, the urban/rural class (England and Wales) and Census 2021
  households with and without a car or van (England, Wales, Northern Ireland). Scotland and the
  Northern Ireland urban/rural class are absent with a stated reason, never filled in.
- `uk-production.json`: Defra's latest annual supply balance for each Food Origins basket, as
  published; national context only.

Boundary changes are handled explicitly: a council created in 2023 from whole councils gets the sum
of their Census 2021 counts (counts add up; the merged councils are listed); a council whose code
changed in 2025 for a small boundary change keeps its classification and counts on the earlier
boundary, with a note. Shares are computed in the app (src/analysis), not here.
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from pathlib import Path

import jsonschema

from foodscope_pipeline.sources.defra_stats import read_auk_table, read_horticulture_supply
from foodscope_pipeline.sources.ons_files import files_for, load_index
from foodscope_pipeline.sources.provided import load_provided
from foodscope_pipeline.sources.ruc21 import LAD_CODES, read_ruc21
from foodscope_pipeline.sources.small_areas import TS045_NO_CAR, TS045_TOTAL, read_car_van_lgd, read_census_lsoa

logger = logging.getLogger(__name__)

FAMILY = "context"
NISRA_CARS_EDITION = "census2021-car-van-2026-10-25"
CENSUS_DAY = "2021-03-21"
SUPPLY_TOLERANCE = 0.5  # thousand tonnes: total supply = production + imports - exports
SHARE_TOLERANCE = 0.05  # percentage points: share = 100 * production / total supply
SERIES_YEARS = 10

OGL_ONS = "Source: Office for National Statistics licensed under the Open Government Licence v.3.0"
NISRA_SOURCE = "Source: NISRA, licensed under the Open Government Licence v3.0"
DEFRA_SOURCE = "Source: Department for Environment, Food & Rural Affairs, licensed under the Open Government Licence v3.0"
OGL = "Open Government Licence v3.0"

URBAN_RURAL_NOT_COVERED = {
    "Scotland": ("The Scottish Government Urban Rural Classification is published for Data Zones, not councils; "
                 "it is not yet included."),
    "Northern Ireland": ("NISRA publishes no council-level urban/rural class. Its 2015 settlement-based class is "
                         "shown for small areas in the neighbourhood analysis where available."),
}
CARS_NOT_COVERED = {
    "Scotland": "Scotland's census was held in 2022; its car or van availability tables are not yet included.",
}


class ContextBuildError(RuntimeError):
    """Inputs disagree with each other or with the verified structure."""


@dataclass(frozen=True)
class ContextInputs:
    ons_context: Path  # pipeline/raw/ons/<context snapshot>/ (urban/rural classification)
    ons: Path  # pipeline/raw/ons/<stage5 snapshot>/ (LAD 2022 → 2023 lookup)
    nomis: Path  # pipeline/raw/nomis/<stage5 snapshot>/ (TS045)
    nisra_cars: Path  # pipeline/raw/nisra-provided/<edition>/ (NI councils, from John)
    defra: Path  # pipeline/raw/defra/<context snapshot>/
    local: Path  # public/data/snapshots/<local snapshot>/local/ (council list)
    code_changes: Path  # config/lad_code_changes.json
    production: Path  # config/national_production.json


def default_inputs(raw_root: Path, config_dir: Path, data_dir: Path, snapshot: str, reference_snapshot: str,
                   local_snapshot: str) -> ContextInputs:
    return ContextInputs(
        ons_context=raw_root / "ons" / snapshot,
        ons=raw_root / "ons" / reference_snapshot,
        nomis=raw_root / "nomis" / reference_snapshot,
        nisra_cars=raw_root / "nisra-provided" / NISRA_CARS_EDITION,
        defra=raw_root / "defra" / snapshot,
        local=data_dir / "snapshots" / local_snapshot / "local",
        code_changes=config_dir / "lad_code_changes.json",
        production=config_dir / "national_production.json",
    )


def _compact(obj: object) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _validate(doc: object, schema_dir: Path, name: str) -> None:
    jsonschema.validate(doc, json.loads((schema_dir / f"{name}.schema.json").read_text(encoding="utf-8")))


def _combined(entries: list[dict]) -> str:
    return hashlib.sha256("".join(e["sha256"] for e in entries).encode()).hexdigest()[:12]


# ---------------------------------------------------------------------------------------------
# Councils


def _code_changes(path: Path) -> dict[str, dict]:
    """May 2025 code → change record, for small boundary changes only (mergers would need sums)."""
    changes = json.loads(path.read_text(encoding="utf-8"))["changes"]
    unknown = [c for c in changes if c["kind"] != "boundary change"]
    if unknown:
        raise ContextBuildError(f"lad_code_changes.json: kinds not handled here: {unknown}")
    return {c["to"]: c for c in changes}


def _merge_census(counts: dict[str, dict[str, int]], lookup: list[dict]) -> tuple[dict[str, dict], list[dict]]:
    """Census 2021 councils (2022 codes) → 2023 councils; merged councils get the sum of their parts."""
    to23 = {r["LAD22CD"]: (r["LAD23CD"], r["LAD23NM"], r["LAD22NM"]) for r in lookup}
    missing = sorted(set(counts) - set(to23))
    if missing:
        raise ContextBuildError(f"TS045 councils not in the LAD 2022 → 2023 lookup: {missing}")
    out: dict[str, dict] = {}
    for code22, c in sorted(counts.items()):
        code23, _, name22 = to23[code22]
        agg = out.setdefault(code23, {"households": 0, "noCar": 0, "parts": []})
        agg["households"] += c[TS045_TOTAL]
        agg["noCar"] += c[TS045_NO_CAR]
        agg["parts"].append((code22, name22))
    merged = [{"to": code, "from": [p[0] for p in v["parts"]], "names": [p[1] for p in v["parts"]]}
              for code, v in sorted(out.items()) if len(v["parts"]) > 1]
    return out, merged


def _council_rows(councils: list[dict], ruc: dict[str, dict], cars_ew: dict[str, dict], cars_ni: dict[str, dict],
                  changes: dict[str, dict], qa: dict) -> list[dict]:
    rows = []
    for c in sorted(councils, key=lambda c: c["code"]):
        code, nation = c["code"], c["nation"]
        change = changes.get(code)
        earlier = change["from"] if change else code
        basis_change = (f"On the boundary before the 2025 change (code {change['from']}): {change['detail']}"
                        if change else None)
        urban_rural = cars = None
        if nation in ("England", "Wales"):
            r = ruc.get(earlier)
            if r is None:
                raise ContextBuildError(f"{code} {c['name']}: no urban/rural class (looked up {earlier})")
            urban_rural = {**r, "basis": basis_change}
            e = cars_ew.get(earlier)
            if e is None:
                raise ContextBuildError(f"{code} {c['name']}: no Census 2021 car availability (looked up {earlier})")
            parts = e["parts"]
            basis = basis_change
            if len(parts) > 1:
                basis = ("Sum of the Census 2021 councils it replaced in April 2023: "
                         + ", ".join(f"{name} ({c22})" for c22, name in parts) + ".")
            cars = {"households": e["households"], "noCar": e["noCar"], "basis": basis}
        elif nation == "Northern Ireland":
            n = cars_ni.get(code)
            if n is None:
                raise ContextBuildError(f"{code} {c['name']}: no NISRA car availability")
            cars = {"households": n["households"], "noCar": n["noCar"], "basis": None}
        elif nation != "Scotland":
            raise ContextBuildError(f"{code}: unknown nation {nation!r}")
        rows.append({"code": code, "name": c["name"], "nation": nation, "urbanRural": urban_rural,
                     "carAvailability": cars})
        if change:
            qa["boundaryChanges"].append({"code": code, "name": c["name"], "earlierCode": change["from"]})
    return rows


# ---------------------------------------------------------------------------------------------
# National production


def _measures_horticulture(path: Path, spec: dict) -> tuple[dict[int, dict], set[int]]:
    return read_horticulture_supply(path, spec["sheet"], spec["crop"]), set()


def _measures_auk(path: Path, spec: dict) -> tuple[dict[int, dict], set[int]]:
    table, provisional = read_auk_table(path, spec["sheet"], spec["title"])
    out: dict[int, dict] = {}
    for year, values in table.items():
        m: dict[str, float | None] = {}
        for key, labels in spec["rows"].items():
            missing = [label for label in labels if label not in values]
            if missing:
                raise ContextBuildError(f"{spec['table']}: rows {missing} not found")
            parts = [values[label] for label in labels]
            m[key] = None if any(p is None for p in parts) else sum(parts)  # type: ignore[arg-type]
        if m["productionShare"] is not None:
            m["productionShare"] *= 100  # stored as a fraction in a cell formatted as a percentage
        out[year] = m
    return out, provisional


def _commodity(spec: dict, defra: Path, index: dict, qa: dict) -> dict:
    if spec.get("status") == "not_published":
        return {"basket": spec["basket"], "status": "not_published", "note": spec["note"]}
    entry = files_for(index, spec["item"])[0]
    path = defra / entry["file"]
    reader = _measures_horticulture if spec["kind"] == "horticulture" else _measures_auk
    by_year, provisional = reader(path, spec)
    complete = [y for y, m in by_year.items() if all(v is not None for v in m.values())]
    if not complete:
        raise ContextBuildError(f"{spec['basket']}: no complete year in {spec['table']}")
    year = max(complete)
    m = by_year[year]
    supply_gap = m["totalSupply"] - (m["production"] + m["imports"] - m["exports"])
    share_gap = m["productionShare"] - 100 * m["production"] / m["totalSupply"]
    qa["production"].append({"basket": spec["basket"], "year": year, "supplyIdentityGap": round(supply_gap, 4),
                             "shareGap": round(share_gap, 4)})
    if abs(supply_gap) > SUPPLY_TOLERANCE or abs(share_gap) > SHARE_TOLERANCE:
        raise ContextBuildError(f"{spec['basket']} {year}: supply identity off by {supply_gap:.3f} or share off by "
                                f"{share_gap:.3f} — is the table read as published?")
    series = sorted((y, v["productionShare"]) for y, v in by_year.items() if v["productionShare"] is not None)
    return {
        "basket": spec["basket"], "status": "published", "sourceId": spec["sourceId"], "table": spec["table"],
        "year": year, "provisional": year in provisional, "file": entry["file"],
        "measures": [
            {"key": key, "label": spec["labels"][key],
             "value": round(m[key], 2 if key == "productionShare" else 3),
             "unit": "%" if key == "productionShare" else "thousand tonnes"}
            for key in ("production", "imports", "exports", "totalSupply", "productionShare")
        ],
        "shareSeries": [{"year": y, "value": round(v, 2)} for y, v in series[-SERIES_YEARS:]],
        "notes": spec.get("notes", []),
    }


# ---------------------------------------------------------------------------------------------
# Build


def build_context(snapshot: str, inputs: ContextInputs, out_root: Path, reports_dir: Path,
                  schema_dir: Path) -> list[Path]:
    qa: dict = {"snapshot": snapshot, "boundaryChanges": [], "production": []}

    # Councils (the published May 2025 list).
    local = json.loads((inputs.local / "lad-indicators.json").read_text(encoding="utf-8"))
    councils = local["councils"]

    ctx_index = load_index(inputs.ons_context)
    ruc_entries = [e for e in files_for(ctx_index, "ons.ruc21_lad24") if e.get("role") == "page"]
    ruc = read_ruc21([inputs.ons_context / e["file"] for e in ruc_entries], "LAD24CD", LAD_CODES)

    ons_index = load_index(inputs.ons)
    lookup_e = files_for(ons_index, "ons.lad22_lad23_lookup")[0]
    lookup = [f["attributes"] for f in json.loads((inputs.ons / lookup_e["file"]).read_text(encoding="utf-8"))["features"]]
    nomis_index = load_index(inputs.nomis)
    ts045_e = files_for(nomis_index, "nomis.census2021_ts045")[0]
    ts045 = read_census_lsoa(inputs.nomis / ts045_e["file"], "census2021-ts045-ltla.csv", [TS045_TOTAL, TS045_NO_CAR])
    cars_ew, merged = _merge_census(ts045, lookup)
    cars_lgd_path, cars_lgd_e = load_provided(inputs.nisra_cars, "nisra.lgd14_car_van_tc5")
    cars_ni = read_car_van_lgd(cars_lgd_path)

    changes = _code_changes(inputs.code_changes)
    rows = _council_rows(councils, ruc, cars_ew, cars_ni, changes, qa)

    ew_households = sum(c[TS045_TOTAL] for c in ts045.values())
    used = {r["code"] for r in rows if r["nation"] in ("England", "Wales")}
    used_earlier = {changes[c]["from"] if c in changes else c for c in used}
    unused = sorted(set(cars_ew) - used_earlier)
    if unused:
        raise ContextBuildError(f"Census councils with no May 2025 council: {unused}")
    qa["carAvailability"] = {
        "censusCouncilsEnglandWales": len(ts045), "councilsEnglandWales": len(used),
        "householdsEnglandWales": ew_households,
        "householdsAfterMapping": sum(r["carAvailability"]["households"] for r in rows
                                      if r["nation"] in ("England", "Wales")),
        "merged2023": merged,
        "councilsNorthernIreland": len(cars_ni),
    }
    if qa["carAvailability"]["householdsAfterMapping"] != ew_households:
        raise ContextBuildError("households changed while mapping 2021 councils to 2025 councils")
    qa["urbanRural"] = {"classifiedCouncils": len(ruc), "councilsEnglandWales": len(used),
                        "unusedCodes": sorted(set(ruc) - used_earlier)}
    if qa["urbanRural"]["unusedCodes"]:
        raise ContextBuildError(f"urban/rural classes with no May 2025 council: {qa['urbanRural']['unusedCodes']}")

    classes = sorted({(r["code"], r["name"], r["flag"]) for r in ruc.values()},
                     key=lambda t: LAD_CODES.index(t[0]))
    council_doc = {
        "schemaVersion": 1,
        "urbanRural": {
            "sourceIds": ["S21"],
            "classification": "ONS 2021 Rural Urban Classification of Local Authority Districts (2024)",
            "referencePeriod": "Census 2021 populations; council boundaries of 2024 (published 9 March 2025)",
            "method": ("A council's class reflects where most of its population lives: urban (20 % or less in rural "
                       "Output Areas), intermediate urban (more than 20 % to 35 %), intermediate rural (more than 35 % "
                       "to 50 %) or majority rural (more than 50 %), split by whether most of the population is nearer "
                       "to or further from a major town or city. It describes settlement form, not landscape or economy."),
            "classes": [{"code": c, "name": n, "flag": f} for c, n, f in classes],
            "coverage": "England and Wales",
            "notCovered": URBAN_RURAL_NOT_COVERED,
        },
        "carAvailability": {
            "sourceIds": ["S20"],
            "referenceDate": CENSUS_DAY,
            "measure": "Households with no car or van available, of all households",
            "coverage": "England, Wales and Northern Ireland",
            "notCovered": CARS_NOT_COVERED,
            "comparability": ("England and Wales (ONS) and Northern Ireland (NISRA) asked about cars or vans available "
                              "to household members on the same census day, 21 March 2021. Scotland's census was a year "
                              "later and is not included."),
        },
        "councils": rows,
    }
    _validate(council_doc, schema_dir, "council-context")

    # National production context.
    defra_index = load_index(inputs.defra)
    config = json.loads(inputs.production.read_text(encoding="utf-8"))
    commodities = [_commodity(spec, inputs.defra, defra_index, qa) for spec in config["baskets"]]
    production_doc = {"schemaVersion": 1, "scope": "United Kingdom", "commodities": commodities}
    _validate(production_doc, schema_dir, "uk-production")

    out_dir = out_root / "snapshots" / snapshot / FAMILY
    out_dir.mkdir(parents=True, exist_ok=True)
    defra_files = defra_index["files"]
    datasets = [
        ("council-context.json", _compact(council_doc) + "\n", {
            "id": "context.council_context",
            "title": "Council context: urban/rural class (England and Wales) and Census 2021 car or van availability",
            "role": "statistical", "format": "json", "schemaId": "council-context",
            "sourceIds": ["S20", "S21"],
            "referencePeriod": "Census 2021 (21 March 2021); 2021 Rural Urban Classification of councils (2024 boundaries)",
            "coverage": (f"{len(rows)} councils (May 2025): urban/rural for England and Wales; car availability for "
                         "England, Wales and Northern Ireland; none for Scotland"),
            "provenance": "measured", "licence": OGL,
            "attribution": f"{OGL_ONS}. {NISRA_SOURCE}",
            "expectedCadence": "irregular",
            "retrieval": {
                "method": "Derived offline from the committed raw files (fetch-reference --set context, fetch-reference)",
                "source": (f"{ruc_entries[0]['url'].split('/query')[0]} ({len(ruc_entries)} page, combined sha256 "
                           f"{_combined(ruc_entries)}…); {ts045_e['file']} (sha256 {ts045_e['sha256'][:12]}…); "
                           f"{lookup_e['file']} (sha256 {lookup_e['sha256'][:12]}…); {cars_lgd_e['file']} (provided, "
                           f"sha256 {cars_lgd_e['sha256'][:12]}…)"),
                "retrievedAt": max(ruc_entries[-1]["retrievedAt"], ts045_e["retrievedAt"], lookup_e["retrievedAt"],
                                   cars_lgd_e["receivedAt"]),
                "notes": ("Counts as published. Councils formed in April 2023 carry the sum of the Census 2021 councils "
                          "they replaced; Barnsley and Sheffield carry their pre-2025 boundary figures (a small boundary "
                          "change). Northern Ireland: NISRA table builder, downloaded by John."),
            },
        }),
        ("uk-production.json", _compact(production_doc) + "\n", {
            "id": "context.uk_production",
            "title": "UK production and supply of the Food Origins baskets (Defra, annual; national context)",
            "role": "statistical", "format": "json", "schemaId": "uk-production",
            "sourceIds": sorted({c["sourceId"] for c in commodities if c["status"] == "published"}),
            "referencePeriod": ", ".join(f"{c['basket']} {c['year']}{' (provisional)' if c['provisional'] else ''}"
                                         for c in commodities if c["status"] == "published"),
            "coverage": "United Kingdom; tomatoes, strawberries, potatoes, wheat (bananas: no Defra production series)",
            "provenance": "official_estimate", "licence": OGL,
            "attribution": DEFRA_SOURCE,
            "expectedCadence": "annual",
            "retrieval": {
                "method": "Read offline from the committed Defra datasets (fetch-reference --set context)",
                "source": "; ".join(f"{e['url']} (sha256 {e['sha256'][:12]}…)" for e in defra_files),
                "retrievedAt": max(e["retrievedAt"] for e in defra_files),
                "notes": ("Values as published (potato and wheat shares converted from fractions to per cent; wheat "
                          "imports and exports are the sums of the EU and rest-of-the-world rows). Annual and national: "
                          "never combined with HMRC monthly trade."),
            },
        }),
    ]
    manifest_schema = json.loads((schema_dir / "manifest.schema.json").read_text(encoding="utf-8"))
    dataset_schema = {"$schema": manifest_schema["$schema"], "definitions": manifest_schema["definitions"],
                      "$ref": "#/definitions/Dataset"}
    written: list[Path] = []
    for filename, text, record in datasets:
        path = out_dir / filename
        path.write_text(text, encoding="utf-8")
        sidecar = {
            "id": record["id"], "title": record["title"], "role": record["role"],
            "path": f"snapshots/{snapshot}/{FAMILY}/{filename}",
            "format": record["format"], "schemaId": record["schemaId"], "sha256": _sha256(text),
            "bytes": len(text.encode("utf-8")),
            **{k: record[k] for k in ("sourceIds", "referencePeriod", "coverage", "provenance", "licence",
                                      "attribution", "expectedCadence", "retrieval")},
        }
        jsonschema.validate(sidecar, dataset_schema, format_checker=jsonschema.FormatChecker())
        prov = path.with_name(filename.rsplit(".", 1)[0] + ".provenance.json")
        prov.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        written += [path, prov]

    reports_dir.mkdir(parents=True, exist_ok=True)
    report = reports_dir / f"context-qa-{snapshot}.json"
    report.write_text(json.dumps(qa, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    written.append(report)
    logger.info("context build %s: %d councils, %d commodities", snapshot, len(rows), len(commodities))
    return written


__all__ = ["ContextBuildError", "ContextInputs", "build_context", "default_inputs"]
