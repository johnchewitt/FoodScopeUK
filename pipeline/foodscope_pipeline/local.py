"""OFFLINE build of the local datasets Stage 4 needs (pre-Stage 4 data step; roadmap §5.3).

Inputs (all committed under pipeline/raw/, each checked against its recorded SHA-256):
- S11 GEOLYTIX Grocery Retail Points v46 (June 2026), provided by John;
- S14 May 2025 council boundaries: BFE FileGDB (provided by John) to assign stores, and the
  clipped BGC edition (fetched by `fetch-ons`) to draw councils;
- S18 ONS mid-2025 population estimates and land areas (fetched by `fetch-ons`);
- S12 ONS chain-supermarket counts (provided by John) and the ONS LAD 2022→2023 lookup, for the
  validation comparison only.

Outputs go to `public/data/snapshots/<snapshot>/local/` (the `local` dataset family, ADR-0021),
each with a `*.provenance.json` sidecar that `publish` lists in the manifest (Stage 4). Reports go
to `pipeline/reports/`.

Everything is deterministic: the same raw files give byte-identical outputs.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import logging
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import jsonschema
import shapely

from foodscope_pipeline.accounting import Accounting
from foodscope_pipeline.benchmark import NO_COUNCIL, compare, map_codes
from foodscope_pipeline.boundaries import display_geometry
from foodscope_pipeline.sources.geolytix import read_retail_points
from foodscope_pipeline.sources.ons_files import files_for, load_index
from foodscope_pipeline.sources.ons_lad import read_bfe, read_bgc_pages
from foodscope_pipeline.sources.ons_mye import read_population
from foodscope_pipeline.sources.ons_supermarkets import NOTES_GROUP_LABELS, RETAILER_TYPES, read_s12
from foodscope_pipeline.sources.provided import load_provided
from foodscope_pipeline.stores import (
    CROWN_DEPENDENCY_AREAS, REJECT_CROWN, REJECT_NO_LOCATION, assign, bng_residuals, classify, load_store_classes,
    locate, postcode_area,
)

logger = logging.getLogger(__name__)

NATIONS = {"E": "England", "W": "Wales", "S": "Scotland", "N": "Northern Ireland"}
FAMILY = "local"  # public/data/snapshots/<snapshot>/local/ (one dataset family; ADR-0021)
UK_BOUNDS = (-9.0, 49.0, 2.0, 61.0)  # lon/lat box around the UK and the Crown Dependencies (Jersey is at 49.2° N)
COORD_DECIMALS = 6
GEOLYTIX_EDITION = "v46 (June 2026)"
OGL_ONS = "Source: Office for National Statistics licensed under the Open Government Licence v.3.0"
OS_NOTICE = "Contains OS data © Crown copyright and database right 2025"


class LocalBuildError(RuntimeError):
    """Inputs disagree with each other or with the verified structure."""


@dataclass(frozen=True)
class LocalInputs:
    ons: Path  # pipeline/raw/ons/<snapshot>/
    geolytix: Path  # pipeline/raw/geolytix/<edition>/
    bfe: Path  # pipeline/raw/ons-lad-boundaries/<edition>/
    s12: Path  # pipeline/raw/ons-supermarkets/<edition>/
    store_classes: Path
    code_changes: Path


def default_inputs(raw_root: Path, config_dir: Path, snapshot: str) -> LocalInputs:
    return LocalInputs(
        ons=raw_root / "ons" / snapshot,
        geolytix=raw_root / "geolytix" / "v46-202606",
        bfe=raw_root / "ons-lad-boundaries" / "may-2025-uk-bfe-v2",
        s12=raw_root / "ons-supermarkets" / "2024-03-07",
        store_classes=config_dir / "store_classes.json",
        code_changes=config_dir / "lad_code_changes.json",
    )


# ---------------------------------------------------------------------------------------------
# Serialisation (deterministic)


def _compact(obj: object) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _feature_collection(features: list[dict]) -> str:
    """One feature per line: valid GeoJSON whose git diffs stay readable."""
    body = ",\n".join(_compact(f) for f in features)
    return '{"type":"FeatureCollection","features":[\n' + body + "\n]}\n"


def _geometry(geom) -> dict:
    return json.loads(shapely.to_geojson(geom))


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _validate(doc: object, schema_dir: Path, name: str) -> None:
    schema = json.loads((schema_dir / f"{name}.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(doc, schema)


# ---------------------------------------------------------------------------------------------
# Build


def build_local(snapshot: str, inputs: LocalInputs, out_root: Path, reports_dir: Path,
                schema_dir: Path) -> list[Path]:
    acc = Accounting()

    # Inputs, each verified against its recorded checksum.
    ons_index = load_index(inputs.ons)
    mye_entry = files_for(ons_index, "ons.mye25")[0]
    lookup_entry = files_for(ons_index, "ons.lad22_lad23_lookup")[0]
    bgc_entries = [e for e in files_for(ons_index, "ons.lad25_bgc") if e.get("role") == "page"]
    geolytix_path, geolytix_entry = load_provided(inputs.geolytix, "geolytix.retail_points_v46")
    bfe_path, bfe_entry = load_provided(inputs.bfe, "ons.lad25_bfe")
    s12_path, s12_entry = load_provided(inputs.s12, "ons.chain_supermarkets_2024")

    # Boundaries: BFE assigns stores, BGC is drawn. Both must hold the same councils.
    bfe = read_bfe(bfe_path)
    acc.record("boundaries.read_bfe", len(bfe), len(bfe))
    bgc = read_bgc_pages([inputs.ons / e["file"] for e in bgc_entries])
    acc.record("boundaries.read_bgc", len(bgc), len(bgc))
    if bgc.codes != bfe.codes:
        raise LocalBuildError("BGC and BFE editions hold different council codes")
    if bgc.names != bfe.names or bgc.names_welsh != bfe.names_welsh:
        raise LocalBuildError("BGC and BFE editions name councils differently")
    codes = bfe.codes
    display = display_geometry(bgc.geoms)
    acc.record("boundaries.display", len(bgc), len(display.geoms))

    # Stores: read, classify (D5), locate, assign to councils.
    classes = load_store_classes(inputs.store_classes)
    points = read_retail_points(geolytix_path)
    acc.record("stores.read", len(points), len(points))
    klass = {p.id: classify(p, classes) for p in points}
    acc.record("stores.classify", len(points), len(klass))
    located, no_location = locate(points)
    acc.record("stores.locate", len(points), len(located),
               {REJECT_NO_LOCATION: len(no_location)} if no_location else None)
    outside_bounds = [s.point.id for s in located
                      if not (UK_BOUNDS[0] <= s.lon <= UK_BOUNDS[2] and UK_BOUNDS[1] <= s.lat <= UK_BOUNDS[3])]
    if outside_bounds:
        raise LocalBuildError(f"stores outside the UK box {UK_BOUNDS}: {outside_bounds[:10]}")
    assignment = assign(located, codes, bfe.geoms)
    # Crown Dependency stores stay on the map without a council (John, 24 Oct 2026); any other store
    # outside every council is rejected.
    on_map = []  # (store, council or None, councilMatch, Crown Dependency or None)
    for s, lad, m, reason in zip(located, assignment.council, assignment.match, assignment.reasons, strict=True):
        if lad is not None:
            on_map.append((s, lad, m, None))
        elif reason == REJECT_CROWN:
            on_map.append((s, None, "none", CROWN_DEPENDENCY_AREAS[postcode_area(s.point.postcode)]))
    rejects = Counter(r for r in assignment.reasons if r is not None and r != REJECT_CROWN)
    acc.record("stores.assign_council", len(located), len(on_map), dict(rejects))
    # Formats left out of the app (decision D5): wholesale and mainly non-food.
    left_out = classes.left_out
    published = [x for x in on_map if klass[x[0].point.id][2] not in left_out]
    acc.record("stores.leave_out_formats", len(on_map), len(published),
               dict(Counter(left_out[klass[x[0].point.id][2]] for x in on_map if klass[x[0].point.id][2] in left_out)))
    assigned = [(s, lad, m) for s, lad, m, _ in published if lad is not None]
    crown_on_map = Counter(cd for _, _, _, cd in published if cd is not None)

    # Population and land area (mid-2025, April 2024 boundaries) for May 2025 councils.
    population, uk_total = read_population(inputs.ons / mye_entry["file"])
    changes = json.loads(inputs.code_changes.read_text(encoding="utf-8"))["changes"]
    successor = {c["to"]: c for c in changes}
    council_pop: dict[str, tuple[int | None, float | None, str | None]] = {}
    used: set[str] = set()
    for code in codes:
        if code in population:
            row, note = population[code], None
        elif code in successor and successor[code]["from"] in population:
            change = successor[code]
            row = population[change["from"]]
            note = (f"Population and land area are ONS figures for {row.name} before the 2025 boundary "
                    f"change (code {change['from']}): {change['detail']} Store counts use the May 2025 "
                    "boundary.")
        else:
            council_pop[code] = (None, None, "No mid-2025 population estimate for this council.")
            continue
        used.add(row.code)
        council_pop[code] = (row.population, row.land_area_km2, note)
    unused = sorted(set(population) - used)
    if unused:
        raise LocalBuildError(f"population rows with no May 2025 council: {unused}")
    missing_pop = [c for c, v in council_pop.items() if v[0] is None]
    acc.record("population.councils", len(population), len(used))

    # Store counts per council by size band × format.
    group_index = {g: i for i, g in enumerate(classes.groups)}
    counts = {code: [0] * len(group_index) for code in codes}
    for store, lad, _ in assigned:
        band, _, fmt = klass[store.point.id]
        counts[lad][group_index[(band, fmt)]] += 1
    if sum(sum(v) for v in counts.values()) != len(assigned):
        raise LocalBuildError("council store counts do not add up to the assigned stores")

    # S12 benchmark.
    s12, notes = read_s12(s12_path)
    missing_names = [f for kind, fascias in RETAILER_TYPES.items() for f in fascias
                     if f not in notes or NOTES_GROUP_LABELS.get(kind, kind) not in notes]
    if missing_names:
        raise LocalBuildError(f"RETAILER_TYPES names not found in the S12 Notes worksheet: {missing_names}")
    lookup = json.loads((inputs.ons / lookup_entry["file"]).read_text(encoding="utf-8"))
    lookup_22_23 = {f["attributes"]["LAD22CD"]: f["attributes"]["LAD23CD"] for f in lookup["features"]}
    code_map = map_codes(list(s12), set(codes), lookup_22_23, {c["from"]: c["to"] for c in changes})
    acc.record("benchmark.s12_councils", len(s12), len(code_map.to_lad25),
               {"Channel Islands and Isle of Man: no UK council": sum(c in s12 for c in NO_COUNCIL)})
    crown_by_area = Counter(postcode_area(s.point.postcode) for s, r in zip(located, assignment.reasons, strict=True)
                            if r is not None and postcode_area(s.point.postcode) in ("GY", "JE", "IM"))
    band_value = {b["id"]: b["value"] for b in classes.size_bands}
    comparison = compare(
        s12, code_map, dict(zip(codes, bfe.names, strict=True)),
        store_lad=assignment.council,
        store_band_value=[band_value[klass[s.point.id][0]] for s in located],
        store_fascia=[s.point.fascia for s in located],
        crown_by_area=dict(crown_by_area),
        population={c: v[0] for c, v in council_pop.items()},
    )

    # ------------------------------------------------------------------------------------------
    # Outputs
    out_dir = out_root / "snapshots" / snapshot / FAMILY
    out_dir.mkdir(parents=True, exist_ok=True)
    reports_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []

    boundary_features = [
        {"type": "Feature", "geometry": _geometry(geom),
         "properties": {"code": code, "name": name, "nameWelsh": welsh, "nation": NATIONS[code[0]]}}
        for code, name, welsh, geom in zip(codes, bfe.names, bfe.names_welsh, display.geoms, strict=True)
    ]
    boundaries_doc = {"type": "FeatureCollection", "features": boundary_features}
    _validate(boundaries_doc, schema_dir, "lad-boundaries")
    boundaries_text = _feature_collection(boundary_features)

    store_features = []
    for store, lad, match, crown in sorted(published, key=lambda x: x[0].point.id):
        p = store.point
        band, store_class, fmt = klass[p.id]
        store_features.append({
            "type": "Feature",
            "id": p.id,
            "geometry": {"type": "Point", "coordinates": [round(store.lon, COORD_DECIMALS), round(store.lat, COORD_DECIMALS)]},
            "properties": {
                "id": p.id, "retailer": p.retailer, "fascia": p.fascia, "name": p.store_name,
                "address": p.add_one, "town": p.town, "postcode": p.postcode,
                "sizeBand": band, "storeClass": store_class, "format": fmt, "lad": lad,
                "councilMatch": match, "crownDependency": crown, "coordinateSource": store.source,
            },
        })
    stores_doc = {"type": "FeatureCollection", "features": store_features}
    _validate(stores_doc, schema_dir, "stores")
    stores_text = _feature_collection(store_features)

    indicators_doc = {
        "schemaVersion": 1,
        "population": {
            "sourceId": "S18",
            "label": "mid-2025",
            "referenceDate": "2025-06-30",
            "boundaries": "ONS estimates on council boundaries of April 2024 (MYE note 10); the same year for all four nations",
        },
        "landArea": {
            "sourceId": "S18",
            "definition": ("Land area excluding inland water, km²: Standard Area Measurements (January 2025) for "
                           "England, Wales and Scotland; NISRA's estimate for Northern Ireland (ONS MYE5, notes 18-19)"),
        },
        "stores": {
            "sourceId": "S11",
            "edition": GEOLYTIX_EDITION,
            "sizeBands": [{k: b[k] for k in ("id", "label", "value", "storeClass")} for b in classes.size_bands],
            "storeClasses": classes.store_classes,
            "formats": [{k: f[k] for k in ("id", "label", "inDefaultView", "fascias")} for f in classes.published_formats],
            "groups": [{"sizeBand": b, "format": f} for b, f in classes.groups],
        },
        "councils": [
            {"code": code, "name": name, "nation": NATIONS[code[0]], "population": council_pop[code][0],
             "landAreaKm2": council_pop[code][1], "note": council_pop[code][2], "stores": counts[code]}
            for code, name in zip(codes, bfe.names, strict=True)
        ],
        "outsideCouncils": [{"reason": f"{name}: Crown Dependency, on the map with no UK council", "stores": n}
                            for name, n in sorted(crown_on_map.items())],
    }
    _validate(indicators_doc, schema_dir, "lad-indicators")
    indicators_text = _compact(indicators_doc) + "\n"

    def src(path: Path, sha: str) -> str:
        return f"{path.name} (sha256 {sha[:12]}…)"

    bgc_sha = hashlib.sha256("".join(e["sha256"] for e in bgc_entries).encode()).hexdigest()
    datasets = [
        ("lad-2025-uk.geojson", boundaries_text, {
            "id": "local.lad_boundaries_2025",
            "title": "Council boundaries, May 2025 (display edition)",
            "role": "reference", "format": "geojson", "schemaId": "lad-boundaries",
            "featureCount": len(boundary_features), "sourceIds": ["S14"],
            "referencePeriod": "May 2025 boundaries", "coverage": "United Kingdom: 361 councils",
            "provenance": "measured", "licence": "Open Government Licence v3.0",
            "attribution": f"{OGL_ONS}. {OS_NOTICE}", "expectedCadence": "annual",
            "retrieval": {
                "method": "ONS feature service LAD_MAY_2025_UK_BGC_V2, paged query cached in pipeline/raw/ons/ (fetch-ons)",
                "source": f"{bgc_entries[0]['url'].split('/query')[0]} ({len(bgc_entries)} pages, combined sha256 {bgc_sha[:12]}…)",
                "retrievedAt": bgc_entries[-1]["retrievedAt"],
                "notes": (f"BGC (20 m, clipped to the coastline), coverage-simplified at {display.stats['toleranceM']:.0f} m in "
                          f"EPSG:27700, island parts under 1 ha touching no other council dropped "
                          f"({display.stats['islandPartsDropped']}), WGS84 to {display.stats['decimals']} decimal places."),
            },
        }),
        ("stores.geojson", stores_text, {
            "id": "local.stores",
            "title": f"Grocery stores, GEOLYTIX {GEOLYTIX_EDITION}",
            "role": "statistical", "format": "geojson", "schemaId": "stores",
            "featureCount": len(store_features), "sourceIds": ["S11", "S14"],
            "referencePeriod": "June 2026 (GEOLYTIX v46)",
            "coverage": "United Kingdom, plus Guernsey, Jersey and the Isle of Man (no UK council)",
            "provenance": "measured", "licence": geolytix_entry["licence"],
            "attribution": f"{geolytix_entry['attribution']}. Councils: {OGL_ONS}. {OS_NOTICE}",
            "expectedCadence": "quarterly",
            "retrieval": {
                "method": "Files provided by the project owner, committed in pipeline/raw/ with checksums",
                "source": f"{src(geolytix_path, geolytix_entry['sha256'])}; {src(bfe_path, bfe_entry['sha256'])}",
                "retrievedAt": max(geolytix_entry["receivedAt"], bfe_entry["receivedAt"]),
                "notes": ("Size band, class and format by decision D5 (pipeline config/store_classes.json); wholesale and "
                          "mainly non-food stores left out. Council by point-in-polygon on the BFE edition in "
                          "EPSG:27700; a store just outside every council (within 50 m) takes the nearest one and is "
                          "flagged; Crown Dependency stores have no council. Store positions are GEOLYTIX's; a store "
                          "without WGS84 coordinates is placed from its British National Grid reference."),
            },
        }),
        ("lad-indicators.json", indicators_text, {
            "id": "local.lad_indicators",
            "title": "Councils: population mid-2025, land area and store counts",
            "role": "statistical", "format": "json", "schemaId": "lad-indicators",
            "sourceIds": ["S11", "S14", "S18"],
            "referencePeriod": "Population mid-2025; stores June 2026", "coverage": "United Kingdom: 361 councils",
            "provenance": "derived", "licence": "Open Government Licence v3.0; GEOLYTIX open data",
            "attribution": f"{OGL_ONS}. {OS_NOTICE}. {geolytix_entry['attribution']}",
            "expectedCadence": "quarterly",
            "retrieval": {
                "method": "Derived offline from the committed raw files",
                "source": (f"{mye_entry['file']} (sha256 {mye_entry['sha256'][:12]}…); "
                           f"{src(geolytix_path, geolytix_entry['sha256'])}; {src(bfe_path, bfe_entry['sha256'])}"),
                "retrievedAt": max(mye_entry["retrievedAt"], geolytix_entry["receivedAt"], bfe_entry["receivedAt"]),
                "notes": ("Population: ONS MYE2 'All ages'; land area: ONS MYE5. Store counts per council by size band × "
                          "format, wholesale and mainly non-food stores left out. Barnsley and Sheffield population and "
                          "land area are on their boundaries before the 2025 change (see each council's note)."),
            },
        }),
    ]
    manifest_schema = json.loads((schema_dir / "manifest.schema.json").read_text(encoding="utf-8"))
    dataset_schema = {"$schema": manifest_schema["$schema"], "definitions": manifest_schema["definitions"],
                      "$ref": "#/definitions/Dataset"}
    for filename, text, record in datasets:
        path = out_dir / filename
        path.write_text(text, encoding="utf-8")
        sidecar = {
            "id": record["id"], "title": record["title"], "role": record["role"],
            "path": f"snapshots/{snapshot}/{FAMILY}/{filename}",
            "format": record["format"], "schemaId": record["schemaId"], "sha256": _sha256(text),
            "bytes": len(text.encode("utf-8")),
            **({"featureCount": record["featureCount"]} if "featureCount" in record else {}),
            **{k: record[k] for k in ("sourceIds", "referencePeriod", "coverage", "provenance", "licence",
                                      "attribution", "expectedCadence", "retrieval")},
        }
        jsonschema.validate(sidecar, dataset_schema, format_checker=jsonschema.FormatChecker())
        prov = path.with_name(filename.rsplit(".", 1)[0] + ".provenance.json")
        prov.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        written += [path, prov]

    # Reports.
    fascia_band = Counter((p.fascia, klass[p.id][0]) for p in points)
    convenience_fascias = set(RETAILER_TYPES["Convenience"])
    qa = {
        "snapshot": snapshot,
        "inputs": {
            "geolytix": {"file": geolytix_entry["file"], "sha256": geolytix_entry["sha256"], "rows": len(points)},
            "bfe": {"file": bfe_entry["file"], "sha256": bfe_entry["sha256"], "councils": len(bfe)},
            "bgc": {"pages": [e["file"] for e in bgc_entries], "councils": len(bgc)},
            "population": {"file": mye_entry["file"], "sha256": mye_entry["sha256"], "ukTotal": uk_total,
                           "councilRows": len(population)},
            "s12": {"file": s12_entry["file"], "sha256": s12_entry["sha256"], "councilRows": len(s12)},
        },
        "boundaries": {
            **display.stats,
            "repairedAfterRounding": [codes[i] for i in display.stats["repairedAfterRounding"]],
            "overlapsAfterRounding": [{"councils": [codes[o["a"]], codes[o["b"]]], "areaM2": o["areaM2"]}
                                      for o in display.stats["overlapsAfterRounding"]],
            "bfeAreaKm2": round(float(shapely.area(bfe.geoms).sum()) / 1e6),
            "bgcAreaKm2": round(float(shapely.area(bgc.geoms).sum()) / 1e6),
            "onsLandAreaKm2": round(sum(r.land_area_km2 for r in population.values())),
        },
        "stores": {
            "rows": len(points),
            "byPostcodeArea": {"BT (Northern Ireland)": sum(postcode_area(p.postcode) == "BT" for p in points),
                               **{f"{a} ({n})": sum(postcode_area(p.postcode) == a for p in points)
                                  for a, n in (("GY", "Guernsey"), ("JE", "Jersey"), ("IM", "Isle of Man"))},
                               "no postcode": sum(not p.postcode for p in points)},
            "pqi": dict(sorted(Counter(p.pqi or "(empty)" for p in points).items())),
            "coordinateSource": dict(Counter(s.source for s in located)),
            "derivedFromBng": [{"id": s.point.id, "name": s.point.store_name, "postcode": s.point.postcode}
                               for s in located if s.source == "bng"],
            "assigned": len(assigned),
            "rejected": dict(rejects),
            "published": len(published),
            "crownDependencyOnMap": dict(sorted(crown_on_map.items())),
            "leftOutByFascia": dict(sorted(Counter(x[0].point.fascia for x in on_map
                                                   if klass[x[0].point.id][2] in left_out).items())),
            "crownDependencyByPostcodeArea": dict(sorted(crown_by_area.items())),
            "crownPostcodesInsideACouncil": assignment.crown_inside,
            "nearestCouncil": assignment.nearest,
            "insideMoreThanOneCouncil": assignment.ties,
            "within10mOfAnotherCouncil": assignment.near_boundary,
            "bngVersusWgs84": bng_residuals(located, assignment.council),
            "bySizeBand": {b["id"]: sum(klass[p.id][0] == b["id"] for p in points) for b in classes.size_bands},
            "byFormat": {f["id"]: sum(klass[p.id][2] == f["id"] for p in points) for f in classes.formats},
            "defaultView": sum(1 for s, _, _, _ in published
                               if klass[s.point.id][1] == "supermarket"
                               and next(f for f in classes.formats if f["id"] == klass[s.point.id][2])["inDefaultView"]),
            "onsConvenienceFasciasIn280PlusBands": {
                f"{fascia} ({band})": n for (fascia, band), n in sorted(fascia_band.items())
                if fascia in convenience_fascias and band != "lt280"},
            "fasciasNotGroupedByOns": sorted({p.fascia for p in points if p.fascia not in
                                              {f for fs in RETAILER_TYPES.values() for f in fs}}),
        },
        "population": {
            "councilsWithEstimate": len(codes) - len(missing_pop),
            "councilsWithoutEstimate": missing_pop,
            "codeChanges": [{"from": c["from"], "to": c["to"], "name": c["name"]} for c in changes],
            "sumOfCouncils": sum(v[0] or 0 for v in council_pop.values()),
        },
    }
    report_files = {
        f"local-accounting-{snapshot}.json": json.dumps(acc.to_dict(), indent=2) + "\n",
        f"local-qa-{snapshot}.json": json.dumps(qa, indent=2, ensure_ascii=False) + "\n",
        f"ons-s12-comparison-{snapshot}.json": json.dumps(comparison, indent=2, ensure_ascii=False) + "\n",
        f"ons-s12-comparison-{snapshot}.csv": _comparison_csv(comparison),
    }
    for name, text in report_files.items():
        path = reports_dir / name
        path.write_text(text, encoding="utf-8")
        written.append(path)
    logger.info("local build %s: %d boundaries, %d stores, %d councils with population",
                snapshot, len(boundary_features), len(store_features), len(codes) - len(missing_pop))
    return written


def _comparison_csv(comparison: dict) -> str:
    buf = io.StringIO()
    writer = csv.writer(buf, lineterminator="\n")
    writer.writerow(["code", "name", "ours", "s12", "difference", "difference_pct", "s12_codes", "mapping",
                     "ours_per_10k_mid2025", "s12_per_10k_census"])
    for r in comparison["councils"]:
        writer.writerow([r["code"], r["name"], r["ours"], r["s12"], r["difference"],
                         "" if r["differencePct"] is None else r["differencePct"],
                         " ".join(r["s12Codes"]), " ".join(r["mapping"]),
                         "" if r["oursPer10k"] is None else r["oursPer10k"],
                         "" if r["s12Per10k"] is None else r["s12Per10k"]])
    return buf.getvalue()


__all__ = ["LocalBuildError", "LocalInputs", "build_local", "default_inputs"]
