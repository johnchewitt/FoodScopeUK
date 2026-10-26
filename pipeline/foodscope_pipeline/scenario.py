"""OFFLINE build of the Stage 7 Scenario Lab inputs: the `scenario` family (John's Stage 7 brief and his
decision of 26 Oct 2026: UK-wide small areas for the supermarket-closure scenario, data step first,
straight-line distances only).

Inputs (committed under pipeline/raw/ and checked against index.json, plus the published local family):
- England and Wales (S15, S18, S19): every LSOA (December 2021) population-weighted centroid (stage7
  set, EPSG:27700), Census 2021 usual residents by LSOA (Nomis TS001, stage5 set), the LSOA to council
  (May 2025) lookup for every LSOA (stage6 set) and England's IoD 2025 decile (File 7, stage5 set);
- Northern Ireland (S16, S18): Data Zone 2021 population-weighted centroids (Irish Grid, EPSG:29902),
  Census 2021 usual residents (MS-A01, sheet DZ) and each Data Zone's council (LGD2014 on the Data
  Zone boundaries), stage5 set;
- Scotland (S17, S32): the Scottish Government's Data Zone Centroids 2022 (population-weighted, with
  Census 2022 total population, EPSG:27700; stage7 set) and the 2022 Data Zone lookup for councils
  (stage6 set);
- supermarkets (S11): the published local family's GEOLYTIX stores of class `supermarket` (280 m² and
  over, D5) that lie in a UK council; Crown Dependency stores are left out.

Outputs in `<out_root>/snapshots/<snapshot>/scenario/`, each with a provenance sidecar:
- `closure-gb.json`, `closure-ni.json`: the supermarkets and every small area of Great Britain or of
  Northern Ireland (code, name, council, WGS84 point, national-grid point, Census population, England's
  deprivation decile) and each area's three nearest supermarkets with straight-line distances in metres.
  Distances are measured in the national grid (British National Grid for Great Britain, Irish
  Transverse Mercator for Northern Ireland) over every supermarket of that part of the UK, so stores
  beyond a council boundary count. They are never measured across the Irish Sea and are not travel
  times. Stores in the Republic of Ireland are not in GEOLYTIX's UK file.

Columnar JSON keeps the files small; the app reads one only when the closure scenario opens.
"""

from __future__ import annotations

import csv
import hashlib
import json
import logging
from dataclasses import dataclass
from pathlib import Path

import jsonschema
import numpy as np
import pyogrio
from pyproj import Transformer

from foodscope_pipeline.sources.ons_files import files_for, load_index
from foodscope_pipeline.sources.small_areas import (
    TS001_TOTAL,
    read_census_lsoa,
    read_data_zones,
    read_dz_centroids,
    read_iod_file7,
    read_lsoa_centroids,
    read_ms_a01,
)

logger = logging.getLogger(__name__)

FAMILY = "scenario"
K_NEAREST = 3
CHUNK = 500  # small areas per distance block: CHUNK × stores float64 values at a time
OGL = "Open Government Licence v3.0"
OGL_ONS = "Source: Office for National Statistics licensed under the Open Government Licence v.3.0"
OS_NOTICE = "Contains OS data © Crown copyright and database right 2025"
NISRA_SOURCE = "Source: NISRA, licensed under the Open Government Licence v3.0"
OSNI_NOTICE = "Contains Ordnance Survey of Northern Ireland information licensed under the Open Government Licence v3.0"
# The record's own attribution statement (spatialdata.gov.scot, record 6755b5a3…, read 26 Oct 2026).
SCOTGOV_SOURCE = ("Copyright Scottish Government, contains Ordnance Survey data © Crown copyright and database "
                  "right 2024 (Open Government Licence v3.0)")
MHCLG_SOURCE = "Source: Ministry of Housing, Communities and Local Government, English Indices of Deprivation 2025 (OGL v3.0)"

# Small areas per nation, from the verified sources (docs/03-DATA-SOURCES.md S15, S16, S17).
EXPECTED = {"E": 33_755, "W": 1_917, "S": 7_392, "N": 3_780}
# Census of each nation's population figures (Scotland's census was in 2022).
CENSUS_YEAR = {"E": 2021, "W": 2021, "S": 2022, "N": 2021}
POPULATION_TOLERANCE = 0.0001  # small areas may differ from the national total by perturbation, not more
NATION_NAMES = {"E": "England", "W": "Wales", "S": "Scotland", "N": "Northern Ireland"}


class ScenarioBuildError(RuntimeError):
    """Inputs disagree with each other or with the verified structure."""


@dataclass(frozen=True)
class ScenarioInputs:
    ons_pwc: Path  # pipeline/raw/ons/<stage7 snapshot>/ (every LSOA centroid)
    ons_lookup: Path  # pipeline/raw/ons/<stage6 snapshot>/ (LSOA → council, every LSOA)
    nomis: Path  # pipeline/raw/nomis/<stage5 snapshot>/ (TS001)
    mhclg: Path  # pipeline/raw/mhclg/<stage5 snapshot>/ (IoD 2025 File 7)
    nisra: Path  # pipeline/raw/nisra/<stage5 snapshot>/ (DZ 2021 centroids, boundaries, MS-A01)
    scotgov_centroids: Path  # pipeline/raw/scotgov/<stage7 snapshot>/
    scotgov_lookup: Path  # pipeline/raw/scotgov/<stage6 snapshot>/ (2022 Data Zone lookup)
    local: Path  # public/data/snapshots/<local snapshot>/local/ (stores, councils)


def default_inputs(raw_root: Path, data_dir: Path, raw_snapshot: str, stage6_snapshot: str,
                   reference_snapshot: str, local_snapshot: str) -> ScenarioInputs:
    return ScenarioInputs(
        ons_pwc=raw_root / "ons" / raw_snapshot,
        ons_lookup=raw_root / "ons" / stage6_snapshot,
        nomis=raw_root / "nomis" / reference_snapshot,
        mhclg=raw_root / "mhclg" / reference_snapshot,
        nisra=raw_root / "nisra" / reference_snapshot,
        scotgov_centroids=raw_root / "scotgov" / raw_snapshot,
        scotgov_lookup=raw_root / "scotgov" / stage6_snapshot,
        local=data_dir / "snapshots" / local_snapshot / "local",
    )


# ---------------------------------------------------------------------------------------------
# Readers


def _entries(folder: Path, item: str) -> list[dict]:
    return files_for(load_index(folder), item)


def _pages(folder: Path, item: str) -> list[Path]:
    paths = [folder / e["file"] for e in _entries(folder, item) if e.get("role", "page") == "page"]
    if not paths:
        raise ScenarioBuildError(f"{folder}: no pages for {item}")
    return paths


def _file(folder: Path, item: str) -> Path:
    return folder / _entries(folder, item)[0]["file"]


def _count(folder: Path, item: str) -> int:
    entry = [e for e in _entries(folder, item) if e.get("role") == "count"][0]
    return int(json.loads((folder / entry["file"]).read_text(encoding="utf-8"))["count"])


def read_lsoa_councils(paths: list[Path]) -> dict[str, dict[str, str]]:
    """LSOA21CD → {name, lad} from the every-LSOA pages of the LSOA → council (May 2025) lookup (stage6 set,
    fields LSOA21CD, LSOA21NM, LAD25CD, LAD25NM)."""
    out: dict[str, dict[str, str]] = {}
    for path in paths:
        doc = json.loads(path.read_text(encoding="utf-8"))
        names = [f["name"] for f in doc["fields"]]
        if not {"LSOA21CD", "LSOA21NM", "LAD25CD"} <= set(names):
            raise ScenarioBuildError(f"{path.name}: fields {names}")
        for f in doc["features"]:
            a = f["attributes"]
            if a["LSOA21CD"] in out:
                raise ScenarioBuildError(f"LSOA lookup: {a['LSOA21CD']} listed twice")
            out[a["LSOA21CD"]] = {"name": a["LSOA21NM"], "lad": a["LAD25CD"]}
    return out


SG_CENTROIDS_LAYER = "SG_DataZone_Cent_2022.shp"
SG_CENTROID_FIELDS = ["dzcode", "dzname", "totpop2022", "easting", "northing"]


def read_scotland_centroids(zip_path: Path) -> dict[str, dict]:
    """DZ22 code → {name, x, y, population} from the Scottish Government's Data Zone Centroids 2022."""
    path = f"/vsizip/{zip_path}/{SG_CENTROIDS_LAYER}"
    info = pyogrio.read_info(path)
    if info["crs"] != "EPSG:27700":
        raise ScenarioBuildError(f"{zip_path.name}: CRS {info['crs']}, expected EPSG:27700")
    missing = [c for c in SG_CENTROID_FIELDS if c not in list(info["fields"])]
    if missing:
        raise ScenarioBuildError(f"{zip_path.name}: fields {missing} not found; found {list(info['fields'])}")
    meta, _fids, _geoms, fields = pyogrio.raw.read(path, columns=SG_CENTROID_FIELDS)
    cols = dict(zip(meta["fields"], fields, strict=True))
    out: dict[str, dict] = {}
    for i, code in enumerate(cols["dzcode"]):
        pop = float(cols["totpop2022"][i])
        if not pop.is_integer() or pop < 0:
            raise ScenarioBuildError(f"{code}: population {pop} is not a count")
        if code in out:
            raise ScenarioBuildError(f"{zip_path.name}: {code} listed twice")
        out[str(code)] = {"name": str(cols["dzname"][i]), "x": float(cols["easting"][i]),
                          "y": float(cols["northing"][i]), "population": int(pop)}
    return out


def read_dz22_councils(csv_path: Path) -> dict[str, tuple[str, str]]:
    """2022 Data Zone → (council code, Data Zone name) from the Scottish Government lookup (Windows-1252)."""
    with csv_path.open(encoding="cp1252", newline="") as fh:
        reader = csv.DictReader(fh)
        needed = {"DZ22_Code", "DZ22_Name", "LA_Code", "Country_Name"}
        if not needed <= set(reader.fieldnames or []):
            raise ScenarioBuildError(f"{csv_path.name}: columns {reader.fieldnames}")
        out: dict[str, tuple[str, str]] = {}
        for r in reader:
            if r["Country_Name"] != "Scotland" or not r["LA_Code"].startswith("S12"):
                raise ScenarioBuildError(f"{csv_path.name}: {r['DZ22_Code']} country {r['Country_Name']!r} council {r['LA_Code']!r}")
            if r["DZ22_Code"] in out:
                raise ScenarioBuildError(f"{csv_path.name}: {r['DZ22_Code']} listed twice")
            out[r["DZ22_Code"]] = (r["LA_Code"], r["DZ22_Name"].strip())
    return out


# ---------------------------------------------------------------------------------------------
# Nearest supermarkets


def nearest_k(area_xy: np.ndarray, store_xy: np.ndarray, k: int = K_NEAREST) -> tuple[np.ndarray, np.ndarray]:
    """Each area's k nearest stores: indices and straight-line distances (same units as the inputs).

    Exact: every pair is measured, block by block. Equal distances are ordered by store index, so the
    result does not depend on the sort algorithm. With fewer than k stores, the missing entries are -1
    and NaN. Returns two arrays of shape (areas, k).
    """
    area_xy = np.asarray(area_xy, dtype=float).reshape(-1, 2)
    store_xy = np.asarray(store_xy, dtype=float).reshape(-1, 2)
    n, m = len(area_xy), len(store_xy)
    kk = min(k, m)
    idx = np.full((n, k), -1, dtype=np.int64)
    dist = np.full((n, k), np.nan)
    if kk == 0 or n == 0:
        return idx, dist
    for start in range(0, n, CHUNK):
        block = area_xy[start:start + CHUNK]
        d = np.hypot(block[:, None, 0] - store_xy[None, :, 0], block[:, None, 1] - store_xy[None, :, 1])
        # The k-th smallest distance of each row; every store at or within it is a candidate (more than
        # k only when distances tie at the boundary), then candidates are ordered by distance, index.
        kth = np.partition(d, kk - 1, axis=1)[:, kk - 1]
        for r in range(len(block)):
            cand = np.flatnonzero(d[r] <= kth[r])
            order = cand[np.lexsort((cand, d[r, cand]))][:kk]
            idx[start + r, :kk] = order
            dist[start + r, :kk] = d[r, order]
    return idx, dist


# ---------------------------------------------------------------------------------------------
# Build


def _compact(obj: object) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _validate(doc: object, schema_dir: Path, name: str) -> None:
    schema = json.loads((schema_dir / f"{name}.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(doc, schema, format_checker=jsonschema.FormatChecker())


def build_scenario(snapshot: str, inputs: ScenarioInputs, out_root: Path, reports_dir: Path,
                   schema_dir: Path) -> list[Path]:
    qa: dict = {"snapshot": snapshot}
    councils = {c["code"]: c for c in
                json.loads((inputs.local / "lad-indicators.json").read_text(encoding="utf-8"))["councils"]}
    stores_prov = json.loads((inputs.local / "stores.provenance.json").read_text(encoding="utf-8"))

    # England and Wales.
    pwc = read_lsoa_centroids(_pages(inputs.ons_pwc, "ons.lsoa21_pwc_all"))
    lookup = read_lsoa_councils(_pages(inputs.ons_lookup, "ons.lsoa21_lad25_all"))
    for folder, item, found in ((inputs.ons_pwc, "ons.lsoa21_pwc_all", len(pwc)),
                                (inputs.ons_lookup, "ons.lsoa21_lad25_all", len(lookup))):
        if _count(folder, item) != found:
            raise ScenarioBuildError(f"{item}: {found} features, the count query said {_count(folder, item)}")
    census = read_census_lsoa(_file(inputs.nomis, "nomis.census2021_ts001"), "census2021-ts001-lsoa.csv",
                              [TS001_TOTAL])
    iod = read_iod_file7(_file(inputs.mhclg, "mhclg.iod2025_file7"))
    if set(pwc) != set(lookup) or set(pwc) != set(census):
        raise ScenarioBuildError(f"LSOA sets differ: {len(pwc)} centroids, {len(lookup)} in the lookup, "
                                 f"{len(census)} with population")
    english = {c for c in pwc if c.startswith("E")}
    if set(iod) != english:
        raise ScenarioBuildError(f"IoD 2025 covers {len(iod)} LSOAs; England has {len(english)}")

    # Northern Ireland.
    dz = read_data_zones(_file(inputs.nisra, "nisra.dz2021_boundaries"))
    dz_lgd = dict(zip(dz.codes, dz.extra["lgd"], strict=True))
    dz_name = dict(zip(dz.codes, dz.names, strict=True))
    dz_pwc = read_dz_centroids(_file(inputs.nisra, "nisra.dz2021_pwc"))
    dz_pop_all = read_ms_a01(_file(inputs.nisra, "nisra.census2021_ms_a01"), "DZ")
    dz_pop = {k: v for k, v in dz_pop_all.items() if k in dz_lgd}
    if set(dz_pwc) != set(dz_lgd) or set(dz_pop) != set(dz_lgd):
        raise ScenarioBuildError(f"Data Zone sets differ: {len(dz_pwc)} centroids, {len(dz_lgd)} zones, "
                                 f"{len(dz_pop)} populations")

    # Scotland.
    sc = read_scotland_centroids(_file(inputs.scotgov_centroids, "scotgov.dz2022_centroids"))
    sc_lookup = read_dz22_councils(_file(inputs.scotgov_lookup, "scotgov.dz22_lookup"))
    if set(sc) != set(sc_lookup):
        raise ScenarioBuildError(f"Scottish Data Zones differ: {len(sc)} centroids, {len(sc_lookup)} in the lookup")
    # Names come from the lookup; the centroid file's differ only in stray spaces (reported).
    qa["scotlandNameDifferences"] = [{"code": c, "centroidFile": sc[c]["name"], "lookup": sc_lookup[c][1]}
                                     for c in sorted(sc) if sc[c]["name"] != sc_lookup[c][1]]
    for d in qa["scotlandNameDifferences"]:
        if " ".join(d["centroidFile"].replace("\xa0", " ").split()) != d["lookup"]:
            raise ScenarioBuildError(f"{d['code']}: named {d['centroidFile']!r} and {d['lookup']!r}")

    # Areas in a fixed order: by code (E, N, S, W), Great Britain and Northern Ireland separately.
    to_wgs_gb = Transformer.from_crs("EPSG:27700", "EPSG:4326", always_xy=True)
    to_wgs_ni = Transformer.from_crs("EPSG:29902", "EPSG:4326", always_xy=True)
    ni_to_itm = Transformer.from_crs("EPSG:29902", "EPSG:2157", always_xy=True)
    gb_areas: list[dict] = []
    for code in sorted(pwc):
        x, y = pwc[code]
        gb_areas.append({"code": code, "name": lookup[code]["name"], "lad": lookup[code]["lad"], "x": x, "y": y,
                         "lonlat": to_wgs_gb.transform(x, y), "population": census[code][TS001_TOTAL],
                         "decile": int(iod[code]["decile"]) if code in iod else None})
    for code in sorted(sc):
        a = sc[code]
        gb_areas.append({"code": code, "name": sc_lookup[code][1], "lad": sc_lookup[code][0], "x": a["x"],
                         "y": a["y"], "lonlat": to_wgs_gb.transform(a["x"], a["y"]),
                         "population": a["population"], "decile": None})
    gb_areas.sort(key=lambda a: a["code"])
    ni_areas: list[dict] = []
    for code in sorted(dz_pwc):
        ix, iy = ni_to_itm.transform(*dz_pwc[code])
        ni_areas.append({"code": code, "name": dz_name[code], "lad": dz_lgd[code], "x": ix, "y": iy,
                         "lonlat": to_wgs_ni.transform(*dz_pwc[code]), "population": dz_pop[code],
                         "decile": None})
    every = gb_areas + ni_areas
    counts = {n: sum(1 for a in every if a["code"][0] == n) for n in EXPECTED}
    if counts != EXPECTED:
        raise ScenarioBuildError(f"small areas per nation {counts}, expected {EXPECTED}")
    unknown = sorted({a["lad"] for a in every} - set(councils))
    if unknown:
        raise ScenarioBuildError(f"councils not in the local family: {unknown[:10]}")
    wrong_nation = [a["code"] for a in every if councils[a["lad"]]["code"][0] != a["code"][0]]
    if wrong_nation:
        raise ScenarioBuildError(f"small areas in another nation's council: {wrong_nation[:10]}")
    without = sorted(set(councils) - {a["lad"] for a in every})
    if without:
        raise ScenarioBuildError(f"councils without small areas: {without}")
    qa["smallAreas"] = counts
    qa["population"] = {n: sum(a["population"] for a in every if a["code"][0] == n) for n in EXPECTED}
    qa["populationCensusYear"] = CENSUS_YEAR
    # Small areas against each office's published national total (both perturb small counts).
    countries = read_census_lsoa(_file(inputs.nomis, "nomis.census2021_ts001"), "census2021-ts001-ctry.csv",
                                 [TS001_TOTAL])
    ni_total = read_ms_a01(_file(inputs.nisra, "nisra.census2021_ms_a01"), "NI")
    published = {"E": countries["E92000001"][TS001_TOTAL], "W": countries["W92000004"][TS001_TOTAL],
                 "N": ni_total["N92000002"]}
    qa["populationAgainstPublished"] = {}
    for n, total in published.items():
        diff = qa["population"][n] - total
        qa["populationAgainstPublished"][n] = {"smallAreas": qa["population"][n], "published": total, "difference": diff}
        if abs(diff) > POPULATION_TOLERANCE * total:
            raise ScenarioBuildError(f"{NATION_NAMES[n]}: small areas sum to {qa['population'][n]:,}, published {total:,}")
    qa["deprivationDeciles"] = {"england": sum(1 for a in every if a["decile"] is not None)}

    # Supermarkets (D5), in a UK council; Great Britain in BNG, Northern Ireland in ITM.
    stores_doc = json.loads((inputs.local / "stores.geojson").read_text(encoding="utf-8"))
    to_bng = Transformer.from_crs("EPSG:4326", "EPSG:27700", always_xy=True)
    to_itm = Transformer.from_crs("EPSG:4326", "EPSG:2157", always_xy=True)
    stores: dict[str, list[dict]] = {"gb": [], "ni": []}
    left_out = 0
    for f in sorted(stores_doc["features"], key=lambda f: f["properties"]["id"]):
        p = f["properties"]
        if p["storeClass"] != "supermarket":
            continue
        if p["crownDependency"] or not p["lad"]:
            left_out += 1
            continue
        if p["lad"] not in councils:
            raise ScenarioBuildError(f"store {p['id']}: council {p['lad']} not in the local family")
        lon, lat = f["geometry"]["coordinates"]
        part = "ni" if p["lad"].startswith("N") else "gb"
        x, y = (to_itm if part == "ni" else to_bng).transform(lon, lat)
        stores[part].append({"id": p["id"], "name": p["name"], "retailer": p["retailer"], "format": p["format"],
                             "sizeBand": p["sizeBand"], "lad": p["lad"], "lon": lon, "lat": lat, "x": x, "y": y})
    qa["supermarkets"] = {"gb": len(stores["gb"]), "ni": len(stores["ni"]),
                          "leftOutCrownDependencies": left_out}

    out_dir = out_root / "snapshots" / snapshot / FAMILY
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_schema = json.loads((schema_dir / "manifest.schema.json").read_text(encoding="utf-8"))
    dataset_schema = {"$schema": manifest_schema["$schema"], "definitions": manifest_schema["definitions"],
                      "$ref": "#/definitions/Dataset"}
    pwc_entries = [e for e in _entries(inputs.ons_pwc, "ons.lsoa21_pwc_all") if e.get("role") == "page"]
    sg_entry = _entries(inputs.scotgov_centroids, "scotgov.dz2022_centroids")[0]
    written: list[Path] = []
    for part, a_list, grid in (("gb", gb_areas, "EPSG:27700"), ("ni", ni_areas, "EPSG:2157")):
        s_list = stores[part]
        idx, dist = nearest_k(np.array([[a["x"], a["y"]] for a in a_list]),
                              np.array([[s["x"], s["y"]] for s in s_list]))
        if np.any(idx[:, 0] < 0):
            raise ScenarioBuildError(f"{part}: an area has no supermarket")
        lad_codes = sorted({a["lad"] for a in a_list} | {s["lad"] for s in s_list})
        lad_index = {c: i for i, c in enumerate(lad_codes)}
        nations = sorted({a["code"][0] for a in a_list})
        doc = {
            "schemaVersion": 1,
            "part": part,
            "grid": grid,
            "k": K_NEAREST,
            "census": {n: CENSUS_YEAR[n] for n in nations},
            "councils": lad_codes,
            "stores": {
                "id": [s["id"] for s in s_list],
                "name": [s["name"] for s in s_list],
                "retailer": [s["retailer"] for s in s_list],
                "format": [s["format"] for s in s_list],
                "sizeBand": [s["sizeBand"] for s in s_list],
                "council": [lad_index[s["lad"]] for s in s_list],
                "lon": [round(s["lon"], 6) for s in s_list],
                "lat": [round(s["lat"], 6) for s in s_list],
                "x": [round(s["x"]) for s in s_list],
                "y": [round(s["y"]) for s in s_list],
            },
            "areas": {
                "code": [a["code"] for a in a_list],
                "name": [a["name"] for a in a_list],
                "council": [lad_index[a["lad"]] for a in a_list],
                "lon": [round(a["lonlat"][0], 5) for a in a_list],
                "lat": [round(a["lonlat"][1], 5) for a in a_list],
                "x": [round(a["x"]) for a in a_list],
                "y": [round(a["y"]) for a in a_list],
                "population": [a["population"] for a in a_list],
                "decile": [a["decile"] for a in a_list],
                "nearest": idx.tolist(),
                "distance": np.rint(dist).astype(int).tolist(),
            },
        }
        _validate(doc, schema_dir, "scenario-closure")
        first = dist[:, 0]
        pops = np.array([a["population"] for a in a_list])
        qa[f"nearest_{part}"] = {
            "areas": len(a_list),
            "supermarkets": len(s_list),
            "medianNearestMetres": int(round(float(np.median(first)))),
            "maxNearestMetres": int(round(float(first.max()))),
            "maxNearestArea": a_list[int(first.argmax())]["code"],
            "populationNearestOver2km": int(pops[first > 2000].sum()),
            "populationNearestOver5km": int(pops[first > 5000].sum()),
            "areasNearestInAnotherCouncil": int(sum(
                1 for i, a in enumerate(a_list) if s_list[idx[i, 0]]["lad"] != a["lad"])),
        }
        text = _compact(doc) + "\n"
        filename = f"closure-{part}.json"
        if part == "gb":
            title = "Supermarket closure inputs, Great Britain: small areas, supermarkets and nearest distances"
            coverage = (f"Great Britain: {len(a_list):,} small areas (England and Wales: LSOAs 2021; Scotland: Data "
                        f"Zones 2022) and {len(s_list):,} supermarkets (280 m² and over)")
            source_ids = ["S11", "S15", "S17", "S18", "S19", "S32"]
            period = ("Census 2021 (England and Wales), Census 2022 (Scotland); IoD 2025 (England); "
                      f"{stores_prov['referencePeriod']}")
            attribution = (f"{OGL_ONS}. {OS_NOTICE}. {SCOTGOV_SOURCE}. {MHCLG_SOURCE}. {stores_prov['attribution']}")
            sources = [f"{pwc_entries[0]['url'].split('/query')[0]} ({len(pwc_entries)} pages)", sg_entry["url"],
                       "census2021-ts001.zip (Nomis)", "LSOA21_WD25_LAD25_EW_LU_v2 (ONS)", "dz2022-lookup.csv",
                       "IoD 2025 File 7", "stores.geojson (local family)"]
            retrieved = max([e["retrievedAt"] for e in pwc_entries] + [sg_entry["retrievedAt"]])
        else:
            title = "Supermarket closure inputs, Northern Ireland: small areas, supermarkets and nearest distances"
            coverage = (f"Northern Ireland: {len(a_list):,} Data Zones (2021) and {len(s_list):,} supermarkets "
                        "(280 m² and over)")
            source_ids = ["S11", "S16", "S18"]
            period = f"Census 2021; {stores_prov['referencePeriod']}"
            attribution = f"{NISRA_SOURCE}. {OSNI_NOTICE}. {stores_prov['attribution']}"
            nisra = [_entries(inputs.nisra, i)[0] for i in ("nisra.dz2021_pwc", "nisra.dz2021_boundaries",
                                                            "nisra.census2021_ms_a01")]
            sources = [e["url"] for e in nisra] + ["stores.geojson (local family)"]
            retrieved = max(e["retrievedAt"] for e in nisra)
        record = {
            "id": f"scenario.closure_{part}",
            "title": title,
            "role": "statistical",
            "path": f"snapshots/{snapshot}/{FAMILY}/{filename}",
            "format": "json",
            "schemaId": "scenario-closure",
            "sha256": _sha256(text),
            "bytes": len(text.encode("utf-8")),
            "sourceIds": source_ids,
            "referencePeriod": period,
            "coverage": coverage,
            "provenance": "derived",
            "licence": OGL,
            "attribution": attribution,
            "expectedCadence": "irregular",
            "retrieval": {
                "method": "Derived offline (build-scenario) from the committed raw files and the published local family",
                "source": "; ".join(sources),
                "retrievedAt": retrieved,
                "notes": ("Each small area is represented by its population-weighted centroid. Distances are "
                          f"straight-line, in metres, in the national grid ({grid}); they are not travel times. "
                          "Each area's three nearest supermarkets are found among all supermarkets of its part of "
                          "the UK, so stores beyond a council boundary count; Crown Dependency stores are left "
                          "out, and stores in the Republic of Ireland are not in the data. Deprivation decile: "
                          "England only (IoD 2025, ranked within England)."),
            },
        }
        jsonschema.validate(record, dataset_schema, format_checker=jsonschema.FormatChecker())
        path = out_dir / filename
        path.write_text(text, encoding="utf-8")
        prov = out_dir / f"closure-{part}.provenance.json"
        prov.write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        written += [path, prov]
        logger.info("%s: %d areas, %d supermarkets, %d bytes", filename, len(a_list), len(s_list), record["bytes"])

    reports_dir.mkdir(parents=True, exist_ok=True)
    report = reports_dir / f"scenario-qa-{snapshot}.json"
    report.write_text(json.dumps(qa, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    written.append(report)
    return written
