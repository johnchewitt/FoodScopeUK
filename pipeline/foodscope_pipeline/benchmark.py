"""Compare our council store counts with ONS's own counts (S12), as a validation step.

S12 (7 March 2024) counts GEOLYTIX stores of its time plus 52 stores from retailers GEOLYTIX
did not track, on the councils of the time. To compare like with like:

- S12 councils are mapped to May 2025 councils: the 2023 mergers with the ONS LAD 2022→2023
  lookup, the 2025 Barnsley–Sheffield codes with config/lad_code_changes.json. Merged councils
  add up their counts. The Channel Islands and Isle of Man rows have no UK council and are
  compared with the Crown Dependency stores we reject.
- Our count is every store assigned to the council, in every class and format, because S12 also
  counts every format (its Table 4 includes forecourts, travel, wholesale and "other").

Differences are reported, never forced to agree (docs/03-DATA-SOURCES.md S12).
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from statistics import median

from foodscope_pipeline.sources.ons_supermarkets import SIZE_BANDS, TYPES, S12Row, retailer_type

NO_COUNCIL = {"L99999999": "Channel Islands", "M99999999": "Isle of Man"}


class BenchmarkMappingError(RuntimeError):
    """An S12 council code has no May 2025 council."""


@dataclass(frozen=True)
class CodeMap:
    to_lad25: dict[str, str]  # S12 code → May 2025 code
    how: dict[str, str]  # S12 code → "same code" | "2023 merger" | "2025 code change"


def map_codes(s12_codes: list[str], lad25: set[str], lookup_22_23: dict[str, str],
              changes: dict[str, str]) -> CodeMap:
    to, how = {}, {}
    for code in s12_codes:
        if code in NO_COUNCIL:
            continue
        if code in lad25:
            to[code], how[code] = code, "same code"
        elif lookup_22_23.get(code) in lad25:
            to[code], how[code] = lookup_22_23[code], "2023 merger"
        elif changes.get(code) in lad25:
            to[code], how[code] = changes[code], "2025 code change"
        else:
            raise BenchmarkMappingError(f"S12 council {code} has no May 2025 council")
    return CodeMap(to_lad25=to, how=how)


def _pct(ours: int, theirs: int) -> float | None:
    return round(100 * (ours - theirs) / theirs, 1) if theirs else None


def _stats(pairs: list[tuple[int, int]]) -> dict:
    """Totals and the spread of per-council differences for (ours, s12) pairs."""
    o, t = sum(a for a, _ in pairs), sum(b for _, b in pairs)
    abs_pcts = [abs(p) for p in (_pct(a, b) for a, b in pairs) if p is not None]
    return {
        "ours": o,
        "s12": t,
        "difference": o - t,
        "differencePct": _pct(o, t),
        "medianAbsDifferencePct": round(median(abs_pcts), 1) if abs_pcts else None,
        "councilsWithin5Pct": sum(p <= 5 for p in abs_pcts),
        "councilsWithin10Pct": sum(p <= 10 for p in abs_pcts),
        "councilsWithin20Pct": sum(p <= 20 for p in abs_pcts),
        "councilsMoreThan20Pct": sum(p > 20 for p in abs_pcts),
    }


#: Map layers in the app (D5): supermarket and convenience are standard-format stores by size;
#: "other" holds forecourt, motorway, travel and hospital stores of any size.
LAYERS = ("supermarket", "convenience", "other")


def compare(s12: dict[str, S12Row], code_map: CodeMap, lad25_names: dict[str, str],
            store_lad: list[str | None], store_band_value: list[str], store_fascia: list[str],
            crown_by_area: dict[str, int], population: dict[str, int | None],
            store_layer: list[str | None] | None = None) -> dict:
    """Per-council and national comparison. `store_*` lists describe every located store.

    `store_layer` gives each store's map layer in the app (None for stores left out of it). With
    it, a `displayed` section compares what the app shows with S12 (Stage 4 exit criterion):
    every layer against S12's total, supermarkets against S12's 280 m² and over bands, and
    convenience stores against S12's under 280 m² band.
    """
    theirs: Counter[str] = Counter()
    theirs_bands: dict[str, Counter[str]] = {}
    sources: dict[str, list[str]] = {}
    for code, row in s12.items():
        if code in NO_COUNCIL:
            continue
        target = code_map.to_lad25[code]
        theirs[target] += row.total
        theirs_bands.setdefault(target, Counter()).update(row.by_size_band)
        sources.setdefault(target, []).append(code)

    ours: Counter[str] = Counter()
    ours_bands: dict[str, Counter[str]] = {}
    for lad, band in zip(store_lad, store_band_value, strict=True):
        if lad is not None:
            ours[lad] += 1
            ours_bands.setdefault(lad, Counter())[band] += 1

    rows = []
    for lad in sorted(lad25_names):
        o, t = ours.get(lad, 0), theirs.get(lad, 0)
        pop = population.get(lad)
        merged = [c for c in sources.get(lad, []) if code_map.how[c] != "same code"]
        s12_per10k = s12[lad].per_10k if lad in s12 and not merged else None
        rows.append({
            "code": lad,
            "name": lad25_names[lad],
            "ours": o,
            "s12": t,
            "difference": o - t,
            "differencePct": _pct(o, t),
            "s12Codes": sorted(sources.get(lad, [])),
            "mapping": sorted({code_map.how[c] for c in sources.get(lad, [])}),
            "oursPer10k": round(o / pop * 10_000, 3) if pop else None,
            "s12Per10k": round(s12_per10k, 3) if s12_per10k is not None else None,
            "oursBySizeBand": [ours_bands.get(lad, Counter()).get(b, 0) for b in SIZE_BANDS],
            "s12BySizeBand": [theirs_bands.get(lad, Counter()).get(b, 0) for b in SIZE_BANDS],
        })

    pcts = [r["differencePct"] for r in rows if r["differencePct"] is not None]
    abs_pcts = [abs(p) for p in pcts]
    ours_total, theirs_total = sum(r["ours"] for r in rows), sum(r["s12"] for r in rows)
    by_nation = {}
    for nation, prefix in (("England", "E"), ("Wales", "W"), ("Scotland", "S"), ("Northern Ireland", "N")):
        sel = [r for r in rows if r["code"].startswith(prefix)]
        o, t = sum(r["ours"] for r in sel), sum(r["s12"] for r in sel)
        by_nation[nation] = {"councils": len(sel), "ours": o, "s12": t, "difference": o - t, "differencePct": _pct(o, t)}

    ours_types: Counter[str] = Counter()
    for lad, fascia in zip(store_lad, store_fascia, strict=True):
        if lad is not None:
            ours_types[retailer_type(fascia) or "not grouped by ONS"] += 1
    theirs_types: Counter[str] = Counter()
    for code, row in s12.items():
        if code not in NO_COUNCIL:
            theirs_types.update(row.by_type)
    by_type = [{"type": k, "ours": ours_types.get(k, 0), "s12": theirs_types.get(k, 0),
                "difference": ours_types.get(k, 0) - theirs_types.get(k, 0)}
               for k in (*TYPES, "not grouped by ONS")]

    by_band = [{"sizeBand": b, "ours": sum(r["oursBySizeBand"][i] for r in rows),
                "s12": sum(r["s12BySizeBand"][i] for r in rows)} for i, b in enumerate(SIZE_BANDS)]
    for item in by_band:
        item["difference"] = item["ours"] - item["s12"]
        item["differencePct"] = _pct(item["ours"], item["s12"])

    crown = []
    for code, label in NO_COUNCIL.items():
        areas = ["GY", "JE"] if code == "L99999999" else ["IM"]
        crown.append({"s12Code": code, "name": label, "s12": s12[code].total if code in s12 else None,
                      "oursRejected": sum(crown_by_area.get(a, 0) for a in areas), "postcodeAreas": areas})

    ranked = sorted(rows, key=lambda r: (-abs(r["difference"]), r["code"]))
    displayed = None
    if store_layer is not None:
        shown: dict[str, Counter[str]] = {}
        for lad, layer in zip(store_lad, store_layer, strict=True):
            if lad is not None and layer is not None:
                shown.setdefault(lad, Counter())[layer] += 1
        for r in rows:
            c = shown.get(r["code"], Counter())
            r["displayed"] = {layer: c.get(layer, 0) for layer in LAYERS}
            r["displayedAll"] = sum(c.values())
        all_pairs = [(r["displayedAll"], r["s12"]) for r in rows]
        displayed_ranked = sorted(rows, key=lambda r: (-abs(r["displayedAll"] - r["s12"]), r["code"]))
        displayed = {
            "note": (
                "What the app shows (wholesale and mainly non-food stores left out) against S12. "
                "Supermarkets are standard-format stores of 280 m² and over; S12's 280 m² and over "
                "bands include every format. Convenience stores are standard-format stores under "
                "280 m²; S12's under 280 m² band includes forecourt and travel stores."
            ),
            "all": _stats(all_pairs),
            "supermarkets": _stats([(r["displayed"]["supermarket"], sum(r["s12BySizeBand"][1:])) for r in rows]),
            "convenience": _stats([(r["displayed"]["convenience"], r["s12BySizeBand"][0]) for r in rows]),
            "other": sum(r["displayed"]["other"] for r in rows),
            "byNation": {
                nation: _stats([(r["displayedAll"], r["s12"]) for r in rows if r["code"].startswith(prefix)])
                for nation, prefix in (("England", "E"), ("Wales", "W"), ("Scotland", "S"), ("Northern Ireland", "N"))
            },
            "largestDifferences": [
                {"code": r["code"], "name": r["name"], "displayed": r["displayedAll"], "s12": r["s12"],
                 "difference": r["displayedAll"] - r["s12"], "differencePct": _pct(r["displayedAll"], r["s12"])}
                for r in displayed_ranked[:15]
            ],
        }
    return {
        "summary": {
            "councils": len(rows),
            "ours": ours_total,
            "s12": theirs_total,
            "difference": ours_total - theirs_total,
            "differencePct": _pct(ours_total, theirs_total),
            "medianAbsDifferencePct": round(median(abs_pcts), 1) if abs_pcts else None,
            "councilsWithin5Pct": sum(p <= 5 for p in abs_pcts),
            "councilsWithin10Pct": sum(p <= 10 for p in abs_pcts),
            "councilsWithin20Pct": sum(p <= 20 for p in abs_pcts),
            "councilsMoreThan20Pct": sum(p > 20 for p in abs_pcts),
            "mapping": dict(Counter(code_map.how.values())),
        },
        "byNation": by_nation,
        "bySizeBand": by_band,
        "byRetailerType": by_type,
        "crownDependencies": crown,
        "largestDifferences": [{k: r[k] for k in ("code", "name", "ours", "s12", "difference", "differencePct")}
                               for r in ranked[:15]],
        **({"displayed": displayed} if displayed is not None else {}),
        "councils": rows,
    }
