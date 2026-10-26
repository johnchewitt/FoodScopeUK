"""OFFLINE build of the Stage 6 Risk Explorer datasets (the `risk` family; John's brief, 25 Oct 2026).

Inputs (committed under pipeline/raw/, each checked against its SHA-256; `fetch-reference --set
stage6`, snapshot 2026-10-25, unless stated):
- S30 FAO AQUASTAT level of water stress through the World Bank API, and its country list;
- S23 DfT port freight statistics 2025: PORT0499 (port level, 2000-2025), PORT0304 (2025 check)
  and the major and minor port list (UN/LOCODEs, nations, map points for 27 of 53 ports);
- S36 EMODnet main-port locations (for ports without a DfT map point);
- S03 UK Food Security Report 2024, theme 3 chart data (port of entry, Short Straits, SRN delay);
- S31 Defra June survey: England regions and UK countries, 2025; S33 ONS ITL1 regions (Jan 2025);
- S35 OS Open Roads extract (motorways, trunk and primary A roads; GB);
- S13 Priority Places for Food Index v2.1 (provided by John), with S15 the ONS LSOA 2021 -> LAD
  2025 lookup, S32 the Scottish 2011 Data Zone lookup and S19 NIMDM 2017 (SOA -> council), for
  every UK council of the published `local` family.

Outputs go to `<out_root>/snapshots/<snapshot>/risk/`, each with a `*.provenance.json` sidecar:
`water-stress.json`, `ports.json`, `port-entry.json`, `roads.geojson`, `farming.json`,
`farming-regions.geojson` and `council-ppfi.json`; the QA report goes to
`<reports_dir>/risk-qa-<snapshot>.json`.

Nothing here scores or combines indicators: concentration, exposure and ranks are computed in the
app (src/analysis/), from these values as published. Gaps stay gaps: a country without a water-
stress value, a port without a location, a domain without data for Northern Ireland are listed
with a reason, never filled in.
"""

from __future__ import annotations

import hashlib
import json
import logging
import warnings
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import jsonschema
import numpy as np
import shapely
from pyogrio.raw import read
from pyproj import Geod, Transformer

from foodscope_pipeline.boundaries import display_geometry
from foodscope_pipeline.sources.ons_files import files_for, load_index
from foodscope_pipeline.sources.provided import load_provided
from foodscope_pipeline.sources.risk_inputs import (
    read_dz11_lookup,
    read_emodnet_ports,
    read_port0304,
    read_port0499,
    read_port0499_notes,
    read_port_list,
    read_structure_countries,
    read_structure_regions,
    read_ukfsr_ports,
    read_ukfsr_srn_delay,
    read_water_stress,
    stress_class,
)
from foodscope_pipeline.sources.small_areas import PPFI_DOMAINS, read_nimdm2017, read_ppfi

logger = logging.getLogger(__name__)

FAMILY = "risk"
PPFI_EDITION = "ppfi-v2.1-lsoa-1.0.24"
OGL = "Open Government Licence v3.0"
CC_BY = "Creative Commons Attribution 4.0 International (CC BY 4.0)"
DFT_SOURCE = "Source: Department for Transport, Port freight statistics, licensed under the Open Government Licence v3.0"
DEFRA_SOURCE = "Source: Department for Environment, Food & Rural Affairs, licensed under the Open Government Licence v3.0"
ONS_SOURCE = "Source: Office for National Statistics licensed under the Open Government Licence v.3.0"
OS_SOURCE = "Contains OS data © Crown copyright and database right 2026"
TRANSLINK_SOURCE = ("Contains public sector information licensed under the Open Government Licence v3.0. "
                    "Source: Translink (NI Railways), OpenDataNI")
RAIL_SHAPEFILE = "NIR_shp/Rail Line NI_polyline.shp"
RAIL_SIMPLIFY_M = 10.0
WB_SOURCE = "FAO AQUASTAT, via World Bank World Development Indicators (ER.H2O.FWST.ZS), CC BY 4.0"
EMODNET_SOURCE = ("EMODnet Human Activities, Main ports (originators Eurofish International Organisation and "
                  "Cogea Srl), CC BY 4.0")
PPFI_SOURCE = ("Priority Places for Food Index v2.1, Healthy & Sustainable Places Data Service (HASP) / CDRC, "
               "DOI 10.82147/003 (OGL v3.0)")
NATIONS = ("England", "Wales", "Scotland", "Northern Ireland")
PPFI_NATION = {"E": "England", "W": "Wales", "S": "Scotland", "NI": "Northern Ireland"}
PPFI_AREA_TYPE = {
    "England": "LSOA (2021)", "Wales": "LSOA (2021)", "Scotland": "Data Zone (2011)",
    "Northern Ireland": "Super Output Area (2011)",
}
PPFI_ASSIGNMENT = {
    "England": "ONS LSOA (2021) to LAD (2025) best-fit lookup (S15)",
    "Wales": "ONS LSOA (2021) to LAD (2025) best-fit lookup (S15)",
    "Scotland": "Scottish Government 2011 Data Zone lookup, current councils (S32)",
    "Northern Ireland": "NIMDM 2017 council (LGD 2014) of each SOA (S19)",
}
NI_DOMAIN_REASON = ("Not available in Northern Ireland: the Priority Places index has no data for this domain there "
                    "(the publisher's user guide); Northern Ireland's combined index rests on four domains.")
REGION_TOLERANCE = 0.5  # unit of the measure: England regional rows must add up to the England row
PORT0304_TOLERANCE = 0.01  # thousand tonnes
UKFSR_SUM_TOLERANCE = 0.1  # percentage points
GEOD = Geod(ellps="WGS84")


class RiskBuildError(RuntimeError):
    """Inputs disagree with each other or with the verified structure."""


@dataclass(frozen=True)
class RiskInputs:
    worldbank: Path
    dft: Path
    defra: Path
    scotgov: Path
    emodnet: Path
    ons: Path  # ITL1 pages and the LSOA -> LAD 2025 lookup
    os: Path  # OS Open Roads extract
    translink: Path  # NIR railway network (S37)
    nisra: Path  # NIMDM 2017 (stage5 snapshot)
    ppfi: Path  # provided by John
    local: Path  # public/data/snapshots/<local snapshot>/local/ (council list)
    config: Path  # config/risk.json


def default_inputs(raw_root: Path, config_dir: Path, data_dir: Path, snapshot: str, reference_snapshot: str,
                   local_snapshot: str) -> RiskInputs:
    return RiskInputs(
        worldbank=raw_root / "worldbank" / snapshot,
        dft=raw_root / "dft" / snapshot,
        defra=raw_root / "defra" / snapshot,
        scotgov=raw_root / "scotgov" / snapshot,
        emodnet=raw_root / "emodnet" / snapshot,
        ons=raw_root / "ons" / snapshot,
        os=raw_root / "os" / snapshot,
        translink=raw_root / "translink" / snapshot,
        nisra=raw_root / "nisra" / reference_snapshot,
        ppfi=raw_root / "hasp-provided" / PPFI_EDITION,
        local=data_dir / "snapshots" / local_snapshot / "local",
        config=config_dir / "risk.json",
    )


def _compact(obj: object) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _feature_collection(features: list[dict]) -> str:
    """One feature per line: valid GeoJSON whose git diffs stay readable."""
    body = ",\n".join(_compact(f) for f in features)
    return '{"type":"FeatureCollection","features":[\n' + body + "\n]}\n"


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _validate(doc: object, schema_dir: Path, name: str) -> None:
    jsonschema.validate(doc, json.loads((schema_dir / f"{name}.schema.json").read_text(encoding="utf-8")))


def _round(value: float, places: int) -> float:
    out = round(value, places)
    return 0.0 if out == 0 else out


def _entry(index: dict, item_id: str) -> dict:
    return files_for(index, item_id)[0]


def _src(entry: dict) -> str:
    return f"{entry['url']} (sha256 {entry['sha256'][:12]}…)"


# ---------------------------------------------------------------------------------------------
# Water stress (S30)


def _water_stress(inputs: RiskInputs, config: dict, qa: dict) -> tuple[dict, list[dict]]:
    spec = config["waterStress"]
    index = load_index(inputs.worldbank)
    data_e, countries_e = _entry(index, spec["item"]), _entry(index, spec["countries"])
    header, economies = read_water_stress(inputs.worldbank / data_e["file"], inputs.worldbank / countries_e["file"],
                                          spec["indicator"])
    classes = spec["classes"]
    rows, missing = [], []
    for e in economies:
        if not e["series"]:
            missing.append({"iso2": e["iso2"], "iso3": e["iso3"], "name": e["name"]})
            continue
        year, value = e["series"][-1]
        rows.append({
            "iso2": e["iso2"], "iso3": e["iso3"], "name": e["name"], "year": year, "value": _round(value, 3),
            "class": stress_class(value, classes),
            "series": [[y, _round(v, 3)] for y, v in e["series"]],
        })
    by_class = defaultdict(int)
    by_year = defaultdict(int)
    for r in rows:
        by_class[r["class"]] += 1
        by_year[str(r["year"])] += 1
    qa["waterStress"] = {
        "apiRows": header["total"], "lastUpdated": header["lastupdated"], "economies": len(economies),
        "withValue": len(rows), "withoutValue": len(missing), "byClass": dict(sorted(by_class.items())),
        "latestYear": dict(sorted(by_year.items())),
        "duplicateIso2": sorted({r["iso2"] for r in rows if sum(x["iso2"] == r["iso2"] for x in rows) > 1}),
    }
    if qa["waterStress"]["duplicateIso2"]:
        raise RiskBuildError(f"water stress: duplicate ISO codes {qa['waterStress']['duplicateIso2']}")
    doc = {
        "schemaVersion": 1,
        "indicator": {
            "id": spec["indicator"],
            "label": "Level of water stress: freshwater withdrawal as a proportion of available freshwater resources",
            "unit": "%",
            "sdg": "6.4.2",
            "sourceId": spec["sourceId"],
            "source": "FAO AQUASTAT, through the World Bank API (World Development Indicators)",
            "lastUpdated": header["lastupdated"],
            "classSource": spec["classSource"],
            "classRule": spec["classRule"],
            "classes": classes,
            "scope": ("A national figure: it describes total freshwater withdrawals against renewable resources for "
                      "the whole country. It says nothing about the region where a crop is grown, the season, or "
                      "whether the produce the UK imports is irrigated."),
        },
        "countries": rows,
        "missing": missing,
    }
    return doc, [data_e, countries_e]


# ---------------------------------------------------------------------------------------------
# Ports (S23, S36)


def _ports(inputs: RiskInputs, config: dict, qa: dict) -> tuple[dict, list[dict], list[dict]]:
    spec = config["ports"]
    dft_index = load_index(inputs.dft)
    list_e = _entry(dft_index, "dft.port_list")
    p0499_e = _entry(dft_index, "dft.port0499")
    p0304_e = _entry(dft_index, "dft.port0304")
    em_index = load_index(inputs.emodnet)
    em_e = _entry(em_index, "emodnet.port_locations")

    port_list = read_port_list(inputs.dft / list_e["file"])
    rows = read_port0499(inputs.dft / p0499_e["file"])
    notes = read_port0499_notes(inputs.dft / p0499_e["file"])
    p0304 = read_port0304(inputs.dft / p0304_e["file"])
    emodnet = read_emodnet_ports(inputs.emodnet / em_e["file"])

    latest = max(r[0] for r in rows)
    years = list(range(spec["firstYear"], latest + 1))
    groups, regions = spec["cargoGroups"], spec["regions"]
    unknown_groups = sorted({r[5] for r in rows} - set(groups))
    unknown_regions = sorted({r[2] for r in rows} - set(regions))
    if unknown_groups or unknown_regions:
        raise RiskBuildError(f"PORT0499: unexpected cargo groups {unknown_groups} or regions {unknown_regions}")
    agri = {(r[6], r[7]) for r in rows if r[6] == spec["agriculturalCategory"]}
    if agri != {(spec["agriculturalCategory"], spec["agriculturalLabel"])}:
        raise RiskBuildError(f"PORT0499: agricultural products category reads {sorted(agri)}")

    current = sorted({r[1] for r in rows if r[0] == latest})
    unlisted = [p for p in current if p not in port_list]
    if unlisted:
        raise RiskBuildError(f"ports with {latest} data that are not in DfT's port list: {unlisted}")

    yi = {y: i for i, y in enumerate(years)}
    present: dict[str, set[int]] = defaultdict(set)
    inwards_region: dict[str, dict[str, list[float]]] = {}
    inwards_group: dict[str, dict[str, list[float]]] = {}
    agri_region: dict[str, dict[str, list[float]]] = {}
    outwards: dict[str, list[float]] = {}
    totals_latest: dict[str, float] = defaultdict(float)
    for p in current:
        inwards_region[p] = {g: [0.0] * len(years) for g in regions}
        inwards_group[p] = {g: [0.0] * len(years) for g in groups}
        agri_region[p] = {g: [0.0] * len(years) for g in regions}
        outwards[p] = [0.0] * len(years)
    for year, port, region, _country, direction, group, category, _desc, kt in rows:
        if port not in inwards_region or year not in yi:
            continue
        i = yi[year]
        present[port].add(year)
        if year == latest:
            totals_latest[port] += kt
        if direction == "Inwards":
            inwards_region[port][region][i] += kt
            inwards_group[port][group][i] += kt
            if category == spec["agriculturalCategory"]:
                agri_region[port][region][i] += kt
        elif direction == "Outwards":
            outwards[port][i] += kt
        else:
            raise RiskBuildError(f"PORT0499: direction {direction!r}")

    # Reconcile with PORT0304 (2025, major ports over 2 million tonnes, both directions).
    checked = []
    for name, by_group in p0304.items():
        total = by_group["Total"]
        built = totals_latest.get(name)
        if built is None or abs(built - total) > PORT0304_TOLERANCE:
            raise RiskBuildError(f"{name}: PORT0499 {latest} total {built} differs from PORT0304 {total}")
        checked.append(name)

    def series(values: list[float], port: str) -> list[float | None]:
        return [_round(v, 3) if years[i] in present[port] else None for i, v in enumerate(values)]

    ports, located, distances = [], defaultdict(int), []
    for name in current:
        meta = port_list[name]
        em = emodnet.get(meta["locode"])
        if meta["dftPoint"]:
            point, location = meta["dftPoint"], {"source": "dft", "detail": "DfT port list: rough location for mapping"}
            if em:
                _, _, dist = GEOD.inv(point[0], point[1], em["point"][0], em["point"][1])
                distances.append({"port": name, "km": round(dist / 1000, 1)})
        elif em:
            point = em["point"]
            location = {"source": "emodnet", "detail": f"EMODnet main ports (georeferenced from {em['source']})"}
        else:
            point, location = None, {"source": "none", "detail": "No open map location found"}
        located[location["source"]] += 1
        ports.append({
            "locode": meta["locode"], "name": name, "nation": meta["nation"],
            "point": None if point is None else [_round(point[0], 5), _round(point[1], 5)],
            "location": location,
            "years": sorted(present[name] & set(years)),
            "inwardsByRegion": {g: series(v, name) for g, v in inwards_region[name].items()},
            "inwardsByGroup": {g: series(v, name) for g, v in inwards_group[name].items()},
            "agriculturalInwardsByRegion": {g: series(v, name) for g, v in agri_region[name].items()},
            "outwards": series(outwards[name], name),
        })
    ports.sort(key=lambda p: (-sum(v[-1] or 0 for v in p["inwardsByRegion"].values()), p["name"]))
    qa["ports"] = {
        "port0499Rows": len(rows), "latestYear": latest, "years": [years[0], years[-1]],
        "portsWithLatestData": len(current), "reconciledWithPort0304": len(checked),
        "located": dict(sorted(located.items())),
        "dftVersusEmodnetKm": sorted(distances, key=lambda d: -d["km"]),
        "portsWithMissingYears": {p["name"]: [y for y in years if y not in p["years"]] for p in ports
                                  if len(p["years"]) < len(years)},
    }
    doc = {
        "schemaVersion": 1,
        "unit": "thousand tonnes",
        "years": years,
        "latestYear": latest,
        "cargoGroups": groups,
        "regions": regions,
        "domesticRegion": spec["domesticRegion"],
        "unspecifiedRegion": spec["unspecifiedRegion"],
        "agricultural": {"category": spec["agriculturalCategory"], "label": spec["agriculturalLabel"],
                         "group": "Dry Bulk"},
        "notes": [f"{k}: {v}" for k, v in sorted(notes.items()) if k != "Note 1"],
        "method": ("DfT PORT0499 (major ports, port level) summed by port, year, direction, cargo group and region "
                   "of the port of load (inwards). A year in which a port reported nothing to DfT's major-port "
                   f"statistics is null, not zero. Ports included: the {len(current)} major ports with data in "
                   f"{latest}. Locations: DfT's rough location where it gives one, otherwise EMODnet's main-port "
                   "location for the same UN/LOCODE."),
        "ports": ports,
    }
    return doc, [list_e, p0499_e, p0304_e], [em_e]


# ---------------------------------------------------------------------------------------------
# Port of entry and road evidence (S03)


def _port_entry(inputs: RiskInputs, config: dict, qa: dict) -> tuple[dict, dict]:
    spec = config["portOfEntry"]
    index = load_index(inputs.defra)
    e = _entry(index, "defra.ukfsr_2024_theme3")
    path = inputs.defra / e["file"]
    rows_a, rows_b = read_ukfsr_ports(path)
    srn = read_ukfsr_srn_delay(path)

    years = sorted({y for _, y, _ in rows_a})
    labels = list(dict.fromkeys(label for label, _, _ in rows_a))
    if labels != [g["label"] for g in spec["groups"]]:
        raise RiskBuildError(f"UKFSR 3_2_2a port groups {labels} differ from config/risk.json")
    value = {(lbl, y): v for lbl, y, v in rows_a}
    sums = {str(y): round(sum(value[(lbl, y)] for lbl in labels), 2) for y in years}
    if any(abs(s - 100) > UKFSR_SUM_TOLERANCE for s in sums.values()):
        raise RiskBuildError(f"UKFSR 3_2_2a shares do not add up to 100 %: {sums}")
    groups = [{**g, "values": [value[(g["label"], y)] for y in years]} for g in spec["groups"]]

    years_b = sorted({y for _, y, _, _ in rows_b})
    order = {food: o for food, y, _, o in rows_b if y == years_b[-1]}
    vb = {(f, y): v for f, y, v, _ in rows_b}
    foods = [{"food": f, "values": [vb[(f, y)] for y in years_b]} for f in sorted(order, key=order.get)]

    months = sorted({m for m, _, _ in srn})
    sv = {(m, k): v for m, k, v in srn}
    doc = {
        "schemaVersion": 1,
        "portOfEntry": {
            "sourceId": "S03", "table": "UKFSR 2024 theme 3, chart data 3_2_2a",
            "title": "Percentage of imports of food, feed and drink (FFD) by volume in the UK by port of entry",
            "unit": "% of UK food, feed and drink imports by volume", "years": years,
            "note": spec["note"], "groups": groups,
        },
        "shortStraits": {
            "sourceId": "S03", "table": "UKFSR 2024 theme 3, chart data 3_2_2b",
            "title": ("Proportion of the volume of UK food, feed and drink imports recorded as entering the UK at Dover, "
                      "Dover/Eurotunnel or Eurotunnel (Folkestone), by food group"),
            "unit": "% of the food group's import volume", "years": years_b, "foods": foods,
        },
        "srnDelay": {
            "sourceId": "S03", "table": "UKFSR 2024 theme 3, chart data 3_2_1a",
            "title": "Average delay on the Strategic Road Network in England",
            "unit": "seconds per vehicle per mile", "coverage": "England (National Highways' network)",
            "months": months,
            "monthly": [sv.get((m, "Monthly")) for m in months],
            "yearEnding": [sv.get((m, "Year ending")) for m in months],
        },
    }
    qa["portOfEntry"] = {"years": years, "sums": sums, "groups": len(groups), "foodGroups": len(foods),
                         "srnMonths": [months[0], months[-1]],
                         "srnYearEndingWithoutValue": sum(1 for m in months if sv.get((m, "Year ending")) is None)}
    return doc, e


# ---------------------------------------------------------------------------------------------
# Roads (S35)


def _roads(inputs: RiskInputs, qa: dict) -> tuple[list[dict], dict, dict]:
    index = load_index(inputs.os)
    e = _entry(index, "os.open_roads_strategic")
    doc = json.loads((inputs.os / e["file"]).read_text(encoding="utf-8"))
    features = []
    counts = defaultdict(int)
    for f in doc["features"]:
        p = f["properties"]
        if p.get("category") not in ("strategic", "primary") or not p.get("road"):
            raise RiskBuildError(f"OS Open Roads extract: unexpected properties {p}")
        if f["geometry"]["type"] not in ("LineString", "MultiLineString"):
            raise RiskBuildError(f"OS Open Roads extract: geometry {f['geometry']['type']}")
        counts[p["category"]] += 1
        features.append({"type": "Feature", "properties": {"road": p["road"], "category": p["category"]},
                         "geometry": f["geometry"]})
    features.sort(key=lambda f: (f["properties"]["category"] != "strategic", f["properties"]["road"]))
    qa["roads"] = {"features": len(features), "byCategory": dict(sorted(counts.items())), "source": doc.get("metadata")}
    return features, e, doc.get("metadata", {})


# ---------------------------------------------------------------------------------------------
# Railway lines in Northern Ireland (S37)


def _rail(inputs: RiskInputs, qa: dict) -> tuple[list[dict], dict]:
    """The NIR network's route lines (sidings left out), simplified in the Irish Grid, WGS84."""
    index = load_index(inputs.translink)
    e = _entry(index, "translink.nir_railway_network")
    path = f"/vsizip/{inputs.translink / e['file']}/{RAIL_SHAPEFILE}"
    meta, _, wkb, fields = read(path, columns=["ELR_CODE", "DESCRIPTIO", "ROUTE_TYPE"])
    if meta["crs"] != "EPSG:29903":  # TM75 Irish Grid, as the publisher says ("Irish Grid projection")
        raise RiskBuildError(f"NIR railway network: CRS {meta['crs']}")
    to_wgs84 = Transformer.from_crs(29903, 4326, always_xy=True)
    features, dropped, km = [], defaultdict(int), 0.0
    for code, line, route, geom in zip(*fields, shapely.from_wkb(wkb), strict=True):
        if route != "Passenger":
            dropped[str(route)] += 1
            continue
        if not code or not line or geom is None or geom.geom_type != "LineString":
            raise RiskBuildError(f"NIR railway network: unexpected record {code!r} {line!r} {geom}")
        flat = shapely.simplify(shapely.force_2d(geom), RAIL_SIMPLIFY_M, preserve_topology=False)
        km += geom.length / 1000

        def project(xy: np.ndarray) -> np.ndarray:
            lon, lat = to_wgs84.transform(xy[:, 0], xy[:, 1])
            return np.round(np.column_stack([lon, lat]), 5)

        wgs = shapely.transform(flat, project)
        features.append({"type": "Feature", "properties": {"line": str(line), "elr": str(code)},
                         "geometry": json.loads(shapely.to_geojson(wgs))})
    features.sort(key=lambda f: (f["properties"]["elr"], f["properties"]["line"]))
    if not features:
        raise RiskBuildError("NIR railway network: no route lines")
    qa["rail"] = {"features": len(features), "routeKm": _round(km, 1), "leftOut": dict(sorted(dropped.items())),
                  "crs": meta["crs"], "simplifyMetres": RAIL_SIMPLIFY_M, "source": _src(e)}
    return features, e


# ---------------------------------------------------------------------------------------------
# Farming regions (S31, S33)


def _itl1(inputs: RiskInputs) -> tuple[dict[str, dict], list[dict]]:
    index = load_index(inputs.ons)
    entries = [x for x in files_for(index, "ons.itl1_jan2025_bgc") if x.get("role") == "page"]
    out = {}
    for x in entries:
        path = inputs.ons / x["file"]
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="organizePolygons", category=RuntimeWarning)
            meta, _, wkb, fields = read(path, columns=["ITL125CD", "ITL125NM", "LAT", "LONG", "Shape__Area"])
        if meta["crs"] != "EPSG:27700":
            raise RiskBuildError(f"{path.name}: CRS {meta['crs']}")
        for code, name, lat, lon, area, geom in zip(*fields, shapely.from_wkb(wkb), strict=True):
            # Shape__Area: the service's area of the BGC polygon (EPSG:27700, m²), clipped to the coastline.
            out[str(code)] = {"name": str(name), "point": [float(lon), float(lat)], "areaM2": float(area),
                              "geom": geom}
    if len(out) != 12:
        raise RiskBuildError(f"ITL1: {len(out)} regions, expected 12")
    return out, entries


def _farming(inputs: RiskInputs, config: dict, qa: dict) -> tuple[dict, list[dict], list[dict], list[dict]]:
    spec = config["farming"]
    year = spec["year"]
    index = load_index(inputs.defra)
    reg_e = _entry(index, "defra.structure_england_regions")
    ctry_e = _entry(index, "defra.structure_uk_by_country")
    measures = spec["measures"]
    regional = read_structure_regions(inputs.defra / reg_e["file"], year, [m["regionColumn"] for m in measures])
    countries = {m["id"]: read_structure_countries(inputs.defra / ctry_e["file"], m["countrySheet"], year)
                 for m in measures}
    itl1, itl_entries = _itl1(inputs)

    england_names = [r["defraName"] for r in spec["englandRegions"]]
    if sorted(n for n in regional if n != "England") != sorted(england_names):
        raise RiskBuildError(f"Defra regions {sorted(regional)} differ from config/risk.json")
    checks = {}
    for m in measures:
        col = m["regionColumn"]
        regional_sum = sum(regional[n][col] for n in england_names)
        england_row = regional["England"][col]
        national = countries[m["id"]]["England"] * m["countryScale"]
        checks[m["id"]] = {"regionsSum": round(regional_sum, 1), "englandRow": round(england_row, 1),
                           "countryTableEngland": round(national, 1)}
        if abs(regional_sum - england_row) > REGION_TOLERANCE * max(1, len(england_names)):
            raise RiskBuildError(f"{m['id']}: England regions add up to {regional_sum}, the England row is {england_row}")
        uk = sum(countries[m["id"]][n] for n in ("England", "Wales", "Scotland", "Northern Ireland"))
        if abs(uk - countries[m["id"]]["United Kingdom"]) > 0.01:  # sheet units
            raise RiskBuildError(f"{m['id']}: UK countries add up to {uk}, the UK row is {countries[m['id']]['United Kingdom']}")

    regions, geoms = [], []
    for r in spec["englandRegions"]:
        parts = [itl1[c]["geom"] for c in r["itl1"]]
        point = itl1[r.get("pointFrom", r["itl1"][0])]["point"]
        regions.append({
            "id": "+".join(r["itl1"]), "name": r["defraName"], "nation": "England", "itl1": r["itl1"],
            "basis": "England region: commercial holdings (Defra June Survey; cattle from the Cattle Tracing System)",
            "point": [_round(point[0], 5), _round(point[1], 5)],
            "areaKm2": round(sum(itl1[c]["areaM2"] for c in r["itl1"]) / 1e6, 1),
            "values": {m["id"]: round(regional[r["defraName"]][m["regionColumn"]]) for m in measures},
        })
        geoms.append(shapely.union_all(parts) if len(parts) > 1 else parts[0])
    for n in spec["nations"]:
        point = itl1[n["itl1"]]["point"]
        regions.append({
            "id": n["itl1"], "name": n["nation"], "nation": n["nation"], "itl1": [n["itl1"]],
            "basis": f"{n['nation']}: the country's own June survey or census of agriculture, as compiled by Defra",
            "point": [_round(point[0], 5), _round(point[1], 5)],
            "areaKm2": round(itl1[n["itl1"]]["areaM2"] / 1e6, 1),
            "values": {m["id"]: round(countries[m["id"]][n["column"]] * m["countryScale"]) for m in measures},
        })
        geoms.append(itl1[n["itl1"]]["geom"])
    display = display_geometry(np.array(geoms, dtype=object), tolerance_m=500.0, min_island_m2=1_000_000.0)
    features = [{"type": "Feature", "properties": {"id": r["id"], "name": r["name"], "nation": r["nation"]},
                 "geometry": json.loads(shapely.to_geojson(g))} for r, g in zip(regions, display.geoms, strict=True)]

    doc = {
        "schemaVersion": 1,
        "year": year,
        "referenceDate": f"{year}-06-01",
        "measures": [{"id": m["id"], "label": m["label"], "unit": m["unit"]} for m in measures],
        "regions": regions,
        "comparability": [
            ("England is shown by Defra region (London is counted with the South East), Wales, Scotland and Northern "
             "Ireland as whole countries: the regions are drawn on ONS ITL1 boundaries."),
            ("England's results relate to commercial holdings only (holdings above Defra's size thresholds); each "
             "devolved country's results come from its own survey or census, compiled by Defra."),
            (f"Cattle: England's regional figures count commercial holdings ({checks['cattle']['regionsSum']:,.0f} head in "
             f"{year}); Defra's all-holdings England total is {checks['cattle']['countryTableEngland']:,.0f}. The "
             "England regions therefore add up to less than England in the UK table."),
            "Survey estimates are rounded to whole hectares, head or birds; they are subject to sampling error.",
            ("Region areas are those of the ONS ITL1 boundaries clipped to the coastline (they include inland "
             "water), for densities per km²; a density describes the whole region, not where farms are."),
            "Livestock numbers are on holdings on 1 June; poultry numbers vary with production cycles.",
        ],
        "notes": [
            ("Defra's 'UK key results by country' sheets label cattle, sheep and pigs 'thousand head', but the values are "
             "head: England's sheep and pigs equal the regional table's totals exactly. The values are used as head."),
        ],
    }
    qa["farming"] = {"year": year, "regions": len(regions), "checks": checks,
                     "boundaries": {k: v for k, v in display.stats.items() if k != "repairedAfterRounding"}}
    return doc, features, [reg_e, ctry_e], itl_entries


# ---------------------------------------------------------------------------------------------
# Priority Places for Food Index by council (S13, S15, S32, S19)


def _lsoa_lookup(inputs: RiskInputs) -> tuple[dict[str, str], list[dict]]:
    index = load_index(inputs.ons)
    entries = [x for x in files_for(index, "ons.lsoa21_lad25_all") if x.get("role") == "page"]
    count_e = [x for x in files_for(index, "ons.lsoa21_lad25_all") if x.get("role") == "count"][0]
    expected = json.loads((inputs.ons / count_e["file"]).read_text(encoding="utf-8"))["count"]
    out: dict[str, str] = {}
    for x in entries:
        for f in json.loads((inputs.ons / x["file"]).read_text(encoding="utf-8"))["features"]:
            a = f["attributes"]
            if a["LSOA21CD"] in out:
                raise RiskBuildError(f"LSOA lookup: {a['LSOA21CD']} listed twice")
            out[a["LSOA21CD"]] = a["LAD25CD"]
    if len(out) != expected:
        raise RiskBuildError(f"LSOA lookup: {len(out)} LSOAs read, the service counted {expected}")
    return out, entries


def _council_ppfi(inputs: RiskInputs, config: dict, qa: dict) -> tuple[dict, list[dict], list[dict]]:
    priority = set(config["ppfi"]["priorityDeciles"])
    councils = json.loads((inputs.local / "lad-indicators.json").read_text(encoding="utf-8"))["councils"]
    by_code = {c["code"]: c for c in councils}
    ppfi_path, ppfi_e = load_provided(inputs.ppfi, "hasp.ppfi_v21_lsoa")
    ppfi = read_ppfi(ppfi_path)
    lsoa, lsoa_entries = _lsoa_lookup(inputs)
    scot_index = load_index(inputs.scotgov)
    dz_e = _entry(scot_index, "scotgov.dz11_lookup")
    dz = read_dz11_lookup(inputs.scotgov / dz_e["file"])
    nisra_index = load_index(inputs.nisra)
    nimdm_e = _entry(nisra_index, "nisra.nimdm2017_soa")
    nimdm = read_nimdm2017(inputs.nisra / nimdm_e["file"])
    ni_names = {c["name"]: c["code"] for c in councils if c["nation"] == "Northern Ireland"}

    council_of: dict[str, str] = {}
    unassigned: dict[str, list[str]] = defaultdict(list)
    for code, area in ppfi.items():
        nation = PPFI_NATION[area["country"]]
        if nation in ("England", "Wales"):
            lad = lsoa.get(code)
        elif nation == "Scotland":
            lad = dz.get(code, (None, None))[0]
        else:
            lad = None
        if lad is not None:
            council_of[code] = lad
        elif nation != "Northern Ireland":
            unassigned[nation].append(code)
    for row in nimdm:
        lad = ni_names.get(row["lgdName"])
        if lad is None:
            raise RiskBuildError(f"NIMDM: council name {row['lgdName']!r} is not a May 2025 council")
        if row["code"] not in ppfi:
            raise RiskBuildError(f"NIMDM SOA {row['code']} is not in the Priority Places index")
        council_of[row["code"]] = lad
    for code, area in ppfi.items():
        if area["country"] == "NI" and code not in council_of:
            unassigned["Northern Ireland"].append(code)
    if any(unassigned.values()):
        raise RiskBuildError(f"small areas without a council: { {k: v[:5] for k, v in unassigned.items()} }")
    wrong_nation = [c for c, lad in council_of.items() if lad not in by_code
                    or by_code[lad]["nation"] != PPFI_NATION[ppfi[c]["country"]]]
    if wrong_nation:
        raise RiskBuildError(f"small areas assigned to a council outside their nation or unknown: {wrong_nation[:5]}")

    measures = ["combined", *PPFI_DOMAINS]
    acc: dict[str, dict] = {c["code"]: {"areas": 0, "deciles": [0] * 10, **{m: 0 for m in measures},
                                       **{f"{m}_n": 0 for m in measures}} for c in councils}
    for code, area in ppfi.items():
        a = acc[council_of[code]]
        a["areas"] += 1
        a["deciles"][area["decile"] - 1] += 1
        a["combined_n"] += 1
        a["combined"] += area["decile"] in priority
        for d in PPFI_DOMAINS:
            dom = area["domains"][d]
            if dom is not None:
                a[f"{d}_n"] += 1
                a[d] += dom["decile"] in priority
    rows, partial = [], []
    for c in councils:
        a = acc[c["code"]]
        if a["areas"] == 0:
            raise RiskBuildError(f"{c['code']} {c['name']}: no small areas")
        values = {}
        for m in measures:
            n = a[f"{m}_n"]
            if n == 0:
                values[m] = None
            elif n != a["areas"]:
                partial.append(f"{c['code']}:{m}")
                values[m] = {"priority": a[m], "areas": n}
            else:
                values[m] = {"priority": a[m], "areas": n}
        rows.append({"code": c["code"], "name": c["name"], "nation": c["nation"], "areas": a["areas"],
                     "combinedDeciles": a["deciles"], "values": values})
    if partial:
        raise RiskBuildError(f"domains with data for only some of a council's areas: {partial[:5]}")

    nations = []
    for nation in NATIONS:
        in_nation = [r for r in rows if r["nation"] == nation]
        total = sum(r["areas"] for r in in_nation)
        expected = sum(1 for a in ppfi.values() if PPFI_NATION[a["country"]] == nation)
        if total != expected:
            raise RiskBuildError(f"{nation}: councils hold {total} small areas, the index has {expected}")
        prio = sum(r["values"]["combined"]["priority"] for r in in_nation)
        nations.append({
            "nation": nation, "councils": len(in_nation), "areas": total, "areaType": PPFI_AREA_TYPE[nation],
            "assignment": PPFI_ASSIGNMENT[nation], "priorityAreas": prio,
            "domainsWithoutData": [d for d in PPFI_DOMAINS if all(r["values"][d] is None for r in in_nation)],
        })
    ni_missing = next(n for n in nations if n["nation"] == "Northern Ireland")["domainsWithoutData"]
    doc = {
        "schemaVersion": 1,
        "index": {
            "name": "Priority Places for Food Index", "version": "v2.1", "sourceId": "S13",
            "orientation": "Decile 1 = highest priority (most vulnerable to food insecurity) within each nation.",
            "priorityDeciles": sorted(priority),
            "measure": ("Share of the council's small areas in their nation's two highest-priority deciles (1-2). "
                        "Small areas, not people: areas have broadly similar populations within each nation."),
            "comparability": ("Deciles are set within each nation (about 20 % of a nation's areas are in deciles "
                              "1-2), so a council can be compared only with councils in the same nation. Rank "
                              "councils within their nation; never across nations."),
            "domainsWithoutDataNote": NI_DOMAIN_REASON if ni_missing else None,
        },
        "measures": [
            {"id": "combined", "label": "Combined index"},
            {"id": "supermarket_proximity", "label": "Proximity to supermarkets"},
            {"id": "supermarket_accessibility", "label": "Accessibility of supermarkets"},
            {"id": "ecommerce_access", "label": "Access to online deliveries"},
            {"id": "socio_demographic", "label": "Socio-demographic barriers"},
            {"id": "nonsupermarket_proximity", "label": "Proximity to non-supermarket food provision"},
            {"id": "food_for_families", "label": "Need for family food support"},
            {"id": "fuel_poverty", "label": "Fuel poverty"},
        ],
        "nations": nations,
        "councils": rows,
    }
    qa["councilPpfi"] = {
        "smallAreas": len(ppfi), "councils": len(rows),
        "byNation": {n["nation"]: {"councils": n["councils"], "areas": n["areas"], "priorityAreas": n["priorityAreas"],
                                   "priorityShare": round(100 * n["priorityAreas"] / n["areas"], 2)}
                     for n in nations},
        "domainsWithoutData": {n["nation"]: n["domainsWithoutData"] for n in nations},
        "fewestAreas": sorted(((r["areas"], r["code"], r["name"]) for r in rows))[:5],
    }
    return doc, [ppfi_e, dz_e, nimdm_e], lsoa_entries


# ---------------------------------------------------------------------------------------------
# Build


def _combined(entries: list[dict]) -> str:
    return hashlib.sha256("".join(e["sha256"] for e in entries).encode()).hexdigest()[:12]


def build_risk(snapshot: str, inputs: RiskInputs, out_root: Path, reports_dir: Path, schema_dir: Path) -> list[Path]:
    config = json.loads(inputs.config.read_text(encoding="utf-8"))
    qa: dict = {"snapshot": snapshot}

    water_doc, water_es = _water_stress(inputs, config, qa)
    _validate(water_doc, schema_dir, "risk-water-stress")
    ports_doc, dft_es, em_es = _ports(inputs, config, qa)
    _validate(ports_doc, schema_dir, "risk-ports")
    entry_doc, fsr_e = _port_entry(inputs, config, qa)
    _validate(entry_doc, schema_dir, "risk-port-entry")
    road_features, roads_e, roads_meta = _roads(inputs, qa)
    roads_text = _feature_collection(road_features)
    _validate(json.loads(roads_text), schema_dir, "risk-roads")
    rail_features, rail_e = _rail(inputs, qa)
    rail_text = _feature_collection(rail_features)
    _validate(json.loads(rail_text), schema_dir, "risk-rail")
    farming_doc, farming_features, farming_es, itl_es = _farming(inputs, config, qa)
    _validate(farming_doc, schema_dir, "risk-farming")
    regions_text = _feature_collection(farming_features)
    _validate(json.loads(regions_text), schema_dir, "farming-regions")
    ppfi_doc, ppfi_es, lsoa_es = _council_ppfi(inputs, config, qa)
    _validate(ppfi_doc, schema_dir, "council-ppfi")

    ports_latest = ports_doc["latestYear"]
    datasets = [
        ("water-stress.json", _compact(water_doc) + "\n", {
            "id": "risk.water_stress",
            "title": "Level of water stress by country (SDG 6.4.2, FAO AQUASTAT)",
            "role": "statistical", "format": "json", "schemaId": "risk-water-stress", "sourceIds": ["S30"],
            "referencePeriod": (f"Latest year per country, {min(int(y) for y in qa['waterStress']['latestYear'])}–"
                                f"{max(int(y) for y in qa['waterStress']['latestYear'])}; series from 2000"),
            "coverage": (f"{qa['waterStress']['withValue']} countries with a value; "
                         f"{qa['waterStress']['withoutValue']} World Bank economies without one (listed)"),
            "provenance": "official_estimate", "licence": CC_BY, "attribution": WB_SOURCE, "expectedCadence": "annual",
            "retrieval": {"method": "World Bank API v2 (fetch-reference --set stage6, GitHub Actions)",
                          "source": "; ".join(_src(e) for e in water_es),
                          "retrievedAt": max(e["retrievedAt"] for e in water_es),
                          "notes": (f"API last updated {water_doc['indicator']['lastUpdated']}. Values as published "
                                    "(rounded to 3 decimals); classes from FAO's SDG 6.4.2 thresholds. A national "
                                    "figure for the whole country.")},
        }),
        ("ports.json", _compact(ports_doc) + "\n", {
            "id": "risk.ports",
            "title": "UK major ports: freight tonnage by direction, cargo group and region of loading (DfT)",
            "role": "statistical", "format": "json", "schemaId": "risk-ports", "sourceIds": ["S23", "S36"],
            "referencePeriod": f"Calendar years {ports_doc['years'][0]}–{ports_latest}",
            "coverage": (f"The {qa['ports']['portsWithLatestData']} major ports with data in {ports_latest} "
                         f"(located: {qa['ports']['located']})"),
            "provenance": "measured", "licence": f"{OGL} (DfT); {CC_BY} (EMODnet locations)",
            "attribution": f"{DFT_SOURCE}. Port locations without a DfT map point: {EMODNET_SOURCE}",
            "expectedCadence": "annual",
            "retrieval": {"method": "Read offline from the committed DfT and EMODnet files (fetch-reference --set stage6)",
                          "source": "; ".join(_src(e) for e in dft_es + em_es),
                          "retrievedAt": max(e["retrievedAt"] for e in dft_es + em_es),
                          "notes": (f"PORT0499 summed by port and year; {ports_latest} totals reconcile with PORT0304 "
                                    f"for {qa['ports']['reconciledWithPort0304']} ports. Tonnage of all cargo, not "
                                    "food: only the agricultural products category is food- or feed-related.")},
        }),
        ("port-entry.json", _compact(entry_doc) + "\n", {
            "id": "risk.port_entry",
            "title": "Food, feed and drink imports by port of entry; Short Straits share by food group; SRN delay (UKFSR 2024)",
            "role": "statistical", "format": "json", "schemaId": "risk-port-entry", "sourceIds": ["S03"],
            "referencePeriod": (f"Port of entry {entry_doc['portOfEntry']['years'][0]} and "
                                f"{entry_doc['portOfEntry']['years'][-1]}; SRN delay "
                                f"{entry_doc['srnDelay']['months'][0]} to {entry_doc['srnDelay']['months'][-1]}"),
            "coverage": "United Kingdom (port of entry); England (Strategic Road Network)",
            "provenance": "official_estimate", "licence": OGL, "attribution": DEFRA_SOURCE, "expectedCadence": "irregular",
            "retrieval": {"method": "Read offline from the committed UKFSR 2024 theme 3 chart data (fetch-reference --set stage6)",
                          "source": _src(fsr_e), "retrievedAt": fsr_e["retrievedAt"],
                          "notes": "Values as published in the UK Food Security Report 2024 (next report due December 2027)."},
        }),
        ("roads.geojson", roads_text, {
            "id": "risk.roads",
            "title": "Strategic road corridors in Great Britain: motorways, trunk roads and primary A roads (OS Open Roads)",
            "role": "reference", "format": "geojson", "schemaId": "risk-roads", "sourceIds": ["S35"],
            "referencePeriod": f"OS Open Roads as downloaded {roads_e['retrievedAt'][:10]}",
            "coverage": ("Great Britain. Northern Ireland: not included (OSNI's open transport service could not be "
                         "reached from the data pipeline)"),
            "provenance": "measured", "licence": OGL, "attribution": OS_SOURCE, "expectedCadence": "irregular",
            "featureCount": len(road_features),
            "retrieval": {"method": "Extracted on GitHub Actions (fetch-open-roads) from the OS Open Roads GeoPackage",
                          "source": f"{roads_e['sourceUrl']} ({roads_e['sourceFile']}, md5 {roads_e['sourceMd5']})",
                          "retrievedAt": roads_e["retrievedAt"],
                          "notes": (f"Links merged by road number and category, simplified at "
                                    f"{roads_meta.get('simplifyMetres')} m in EPSG:27700: 'strategic' = motorways and "
                                    "trunk roads (the national highway authorities' networks), 'primary' = other "
                                    "primary-route A roads. Lines show road corridors, not freight flows.")},
        }),
        ("rail.geojson", rail_text, {
            "id": "risk.rail",
            "title": "Railway lines in Northern Ireland: the NIR network (Translink)",
            "role": "reference", "format": "geojson", "schemaId": "risk-rail", "sourceIds": ["S37"],
            "referencePeriod": "NIR railway network as published on OpenDataNI, 21 September 2015",
            "coverage": ("Northern Ireland: the NIR network's route lines (sidings left out). Great Britain: not "
                         "included (no open, official railway line dataset in this build)"),
            "provenance": "measured", "licence": OGL, "attribution": TRANSLINK_SOURCE, "expectedCadence": "irregular",
            "featureCount": len(rail_features),
            "retrieval": {"method": "Read offline from the committed shapefile (fetch-reference --set stage6)",
                          "source": _src(rail_e), "retrievedAt": rail_e["retrievedAt"],
                          "notes": (f"Route lines (ROUTE_TYPE 'Passenger'), heights dropped, simplified at "
                                    f"{RAIL_SIMPLIFY_M:g} m in TM75 Irish Grid (EPSG:29903), WGS84 to 5 decimals. "
                                    "Lines show where the railway runs, not services or freight.")},
        }),
        ("farming.json", _compact(farming_doc) + "\n", {
            "id": "risk.farming",
            "title": f"Agricultural production regions: crop area and livestock, June {farming_doc['year']} (Defra)",
            "role": "statistical", "format": "json", "schemaId": "risk-farming", "sourceIds": ["S31", "S33"],
            "referencePeriod": f"1 June {farming_doc['year']}",
            "coverage": "England by Defra region (commercial holdings); Wales, Scotland and Northern Ireland as countries",
            "provenance": "official_estimate", "licence": OGL, "attribution": f"{DEFRA_SOURCE}. {ONS_SOURCE}",
            "expectedCadence": "annual",
            "retrieval": {"method": "Read offline from the committed Defra June survey datasets (fetch-reference --set stage6)",
                          "source": "; ".join(_src(e) for e in farming_es),
                          "retrievedAt": max(e["retrievedAt"] for e in farming_es),
                          "notes": "Survey estimates rounded to whole units; England's regions add up to the England row."},
        }),
        ("farming-regions.geojson", regions_text, {
            "id": "risk.farming_regions",
            "title": "Agricultural statistics regions: Defra regions of England and the devolved countries (ONS ITL1)",
            "role": "reference", "format": "geojson", "schemaId": "farming-regions", "sourceIds": ["S33"],
            "referencePeriod": "International Territorial Levels (January 2025)",
            "coverage": "United Kingdom: 8 regions of England (London with the South East) and 3 countries",
            "provenance": "measured", "licence": OGL,
            "attribution": f"{ONS_SOURCE}. Contains OS data © Crown copyright and database right 2025",
            "expectedCadence": "irregular", "featureCount": len(farming_features),
            "retrieval": {"method": "ONS feature service (fetch-reference --set stage6), coverage-simplified offline",
                          "source": (f"{itl_es[0]['url'].split('/query')[0]} ({len(itl_es)} page, sha256 "
                                     f"{_combined(itl_es)}…)"),
                          "retrievedAt": itl_es[-1]["retrievedAt"],
                          "notes": ("ITL1 BGC regions in EPSG:27700, London and the South East merged, coverage-"
                                    "simplified at 500 m, islands under 1 km² dropped, WGS84 to 6 decimals.")},
        }),
        ("council-ppfi.json", _compact(ppfi_doc) + "\n", {
            "id": "risk.council_ppfi",
            "title": "Priority Places for Food Index by council: small areas in each nation's highest-priority deciles",
            "role": "statistical", "format": "json", "schemaId": "council-ppfi",
            "sourceIds": ["S13", "S15", "S19", "S32"],
            "referencePeriod": "Index v2.1 (2024); May 2025 councils",
            "coverage": (f"All {len(ppfi_doc['councils'])} UK councils: {qa['councilPpfi']['smallAreas']} small areas "
                         "(three domains without data in Northern Ireland)"),
            "provenance": "derived", "licence": OGL, "attribution": f"{PPFI_SOURCE}. {ONS_SOURCE}",
            "expectedCadence": "irregular",
            "retrieval": {"method": "Derived offline from the committed index (provided by John) and the official lookups",
                          "source": (f"{ppfi_es[0]['file']} (provided, sha256 {ppfi_es[0]['sha256'][:12]}…); "
                                     f"{lsoa_es[0]['url'].split('/query')[0]} ({len(lsoa_es)} pages, sha256 "
                                     f"{_combined(lsoa_es)}…); {_src(ppfi_es[1])}; {_src(ppfi_es[2])}"),
                          "retrievedAt": max(ppfi_es[0]["receivedAt"], ppfi_es[1]["retrievedAt"],
                                             ppfi_es[2]["retrievedAt"], lsoa_es[-1]["retrievedAt"]),
                          "notes": ("Counts of small areas per council, as published deciles; shares and within-nation "
                                    "ranks are computed in the app. Scotland's index uses 2011 Data Zones.")},
        }),
    ]

    out_dir = out_root / "snapshots" / snapshot / FAMILY
    out_dir.mkdir(parents=True, exist_ok=True)
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
            **({"featureCount": record["featureCount"]} if "featureCount" in record else {}),
            **{k: record[k] for k in ("sourceIds", "referencePeriod", "coverage", "provenance", "licence",
                                      "attribution", "expectedCadence", "retrieval")},
        }
        jsonschema.validate(sidecar, dataset_schema, format_checker=jsonschema.FormatChecker())
        prov = path.with_name(filename.rsplit(".", 1)[0] + ".provenance.json")
        prov.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        written += [path, prov]

    reports_dir.mkdir(parents=True, exist_ok=True)
    report = reports_dir / f"risk-qa-{snapshot}.json"
    report.write_text(json.dumps(qa, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    written.append(report)
    logger.info("risk build %s: %d countries, %d ports, %d councils", snapshot, len(water_doc["countries"]),
                len(ports_doc["ports"]), len(ppfi_doc["councils"]))
    return written


__all__ = ["RiskBuildError", "RiskInputs", "build_risk", "default_inputs"]
