"""OFFLINE build of the small-area datasets for the deep profiles (pre-Stage 5 data step; LP-04, LP-06, FA-01–FA-03).

Inputs (all committed under pipeline/raw/ by `fetch-reference`, each checked against its SHA-256):
- S15 ONS: LSOA (2021) → Ward (2025) → LAD (2025) lookup for Manchester; LSOA BGC V5 boundaries
  and V4 population-weighted centroids in a box around Manchester;
- S18 / S20 Nomis Census 2021: TS001 usual residents and TS045 households by car or van availability;
- S19 MHCLG English Indices of Deprivation 2025 (File 7);
- S16 / S18 / S19 NISRA: Data Zone 2021 boundaries and population-weighted centroids, Census 2021
  MS-A01 usual residents, SOA 2011 boundaries and NIMDM 2017.

Outputs go to `<out_root>/snapshots/<out_snapshot>/areas/<council code>/` (the `areas` family,
ADR-0021), one folder per deep-profile council so the app loads only the council it shows (Stage
5, ADR-0023), each file with a `*.provenance.json` sidecar:
- `small-areas.geojson`: the council's indicator geography (Manchester: LSOAs 2021; Belfast: Data
  Zones 2021) and, for Belfast, the 2011 SOAs that NIMDM 2017 and PPFI are published on (John's
  decision, 24 Oct 2026: shown on their own areas, never reallocated);
- `small-area-indicators.json`: per small area, Census 2021 usual residents, households and
  households without a car or van, the population-weighted centroid, the urban/rural class
  (England and Wales: ONS 2021; Northern Ireland: NISRA 2015 on the SOAs), deprivation within its
  own nation (England: IoD 2025 rank and decile; Northern Ireland: NIMDM 2017 rank, and a decile
  derived from it, on the SOAs) and the Priority Places for Food Index v2.1.

Values are as published. Small-area census counts are not adjusted to council totals: the ONS and
NISRA protect confidentiality by perturbing counts, so small areas need not sum exactly to the
council figure; the QA report records every difference. Northern Ireland households by car or van
availability come from NISRA's flexible table builder (Data Zones, HH_CAR_VAN_TC5), downloaded by
John because the builder does not allow automated access (`pipeline/raw/nisra-provided/`).

Everything is deterministic: the same raw files give byte-identical outputs.
"""

from __future__ import annotations

import hashlib
import json
import logging
import statistics
from dataclasses import dataclass
from pathlib import Path

import jsonschema
import numpy as np
import shapely
from pyproj import Transformer

from foodscope_pipeline.boundaries import display_geometry
from foodscope_pipeline.sources.ons_files import files_for, load_index
from foodscope_pipeline.sources.provided import load_provided
from foodscope_pipeline.sources.ruc21 import LSOA_CODES, read_ruc21
from foodscope_pipeline.sources.small_areas import (
    TS001_TOTAL, TS045_NO_CAR, TS045_TOTAL, read_census_lsoa, read_data_zones, read_dz_centroids,
    read_car_van_dz, read_car_van_lgd, read_iod_file7, read_ppfi, read_lsoa_boundaries, read_lsoa_centroids, read_lsoa_lookup, read_ms_a01, read_nimdm2017,
    read_super_output_areas,
)

logger = logging.getLogger(__name__)

FAMILY = "areas"  # public/data/snapshots/<snapshot>/areas/ (ADR-0021)
COORD_DECIMALS = 6
LSOA_TOLERANCE_M = 5.0  # the BGC edition is already generalised to 20 m by ONS
NI_TOLERANCE_M = 10.0  # NISRA's boundaries are full resolution
IOD_LSOAS = 33_755  # English LSOAs ranked by IoD 2025
NIMDM_SOAS = 890  # Northern Ireland SOAs ranked by NIMDM 2017
CENSUS_DATE = "2021-03-21"

OGL_ONS = "Source: Office for National Statistics licensed under the Open Government Licence v.3.0"
OS_NOTICE = "Contains OS data © Crown copyright and database right 2025"
NISRA_SOURCE = "Source: NISRA, licensed under the Open Government Licence v3.0"
OSNI_NOTICE = "Contains Ordnance Survey of Northern Ireland information licensed under the Open Government Licence v3.0"
MHCLG_SOURCE = "Source: Ministry of Housing, Communities and Local Government, English Indices of Deprivation 2025 (OGL v3.0)"

NISRA_CARS_EDITION = "census2021-car-van-2026-10-25"
PPFI_EDITION = "ppfi-v2.1-lsoa-1.0.24"
PPFI_SOURCE = ("Priority Places for Food Index v2.1, Healthy & Sustainable Places Data Service (HASP) / CDRC, "
               "DOI 10.82147/003 (OGL v3.0)")
PPFI_NOT_IN_NI = ["ecommerce_access", "fuel_poverty", "supermarket_accessibility"]
PPFI_META = {
    "index": "Priority Places for Food Index v2.1", "sourceId": "S13", "decile": "published",
    "orientation": ("Rank 1 and decile 1 = highest priority. The publisher's documentation (HASP data dictionary, "
                    "CDRC pages, IJPDS article; checked 25 Oct 2026) does not state the direction; the data shows "
                    "it: the socio-economic barriers domain ranks with IoD 2025 and NIMDM 2017, where 1 = most "
                    "deprived"),
    "referencePeriod": "v2.1, released July 2024 (indicators 2016–2023)",
}
OGL = "Open Government Licence v3.0"


def _ppfi_value(row: dict) -> dict:
    return {"rank": row["rank"], "decile": row["decile"], "domains": row["domains"]}


class AreasBuildError(RuntimeError):
    """Inputs disagree with each other or with the verified structure."""


@dataclass(frozen=True)
class AreasInputs:
    ons: Path  # pipeline/raw/ons/<snapshot>/
    ons_context: Path  # pipeline/raw/ons/<context snapshot>/ (2021 urban/rural classification of LSOAs)
    nomis: Path  # pipeline/raw/nomis/<snapshot>/
    mhclg: Path  # pipeline/raw/mhclg/<snapshot>/
    nisra: Path  # pipeline/raw/nisra/<snapshot>/
    nisra_cars: Path  # pipeline/raw/nisra-provided/<edition>/ (car or van availability, from John)
    hasp: Path  # pipeline/raw/hasp-provided/<edition>/ (PPFI v2.1, from John)
    profiles: Path  # config/deep_profiles.json


def default_inputs(raw_root: Path, config_dir: Path, snapshot: str, context_snapshot: str) -> AreasInputs:
    return AreasInputs(
        ons=raw_root / "ons" / snapshot,
        ons_context=raw_root / "ons" / context_snapshot,
        nomis=raw_root / "nomis" / snapshot,
        mhclg=raw_root / "mhclg" / snapshot,
        nisra=raw_root / "nisra" / snapshot,
        nisra_cars=raw_root / "nisra-provided" / NISRA_CARS_EDITION,
        hasp=raw_root / "hasp-provided" / PPFI_EDITION,
        profiles=config_dir / "deep_profiles.json",
    )


def nimdm_decile(rank: int, total: int = NIMDM_SOAS) -> int:
    """Decile within Northern Ireland from an NIMDM rank (1 = most deprived 10 %).

    NISRA publishes ranks only; with 890 SOAs each decile holds exactly 89 (ranks 1–89 → 1, …,
    802–890 → 10). Derived here, labelled as derived in the output.
    """
    if total % 10 or not 1 <= rank <= total:
        raise AreasBuildError(f"rank {rank} of {total} cannot be put into equal deciles")
    return (rank - 1) // (total // 10) + 1


# ---------------------------------------------------------------------------------------------
# Serialisation (deterministic)


def _compact(obj: object) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _feature_collection(features: list[dict]) -> str:
    body = ",\n".join(_compact(f) for f in features)
    return '{"type":"FeatureCollection","features":[\n' + body + "\n]}\n"


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _validate(doc: object, schema_dir: Path, name: str) -> None:
    schema = json.loads((schema_dir / f"{name}.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(doc, schema)


def _lonlat(transformer: Transformer, x: float, y: float) -> list[float]:
    lon, lat = transformer.transform(x, y)
    return [round(float(lon), COORD_DECIMALS), round(float(lat), COORD_DECIMALS)]


def _entry(index: dict, item_id: str) -> dict:
    return files_for(index, item_id)[0]


def _pages(folder: Path, index: dict, item_id: str) -> tuple[list[Path], list[dict]]:
    entries = [e for e in files_for(index, item_id) if e.get("role") == "page"]
    return [folder / e["file"] for e in entries], entries


# ---------------------------------------------------------------------------------------------
# Build


def build_areas(snapshot: str, inputs: AreasInputs, out_root: Path, reports_dir: Path,
                schema_dir: Path, out_snapshot: str | None = None) -> list[Path]:
    """Build the deep-profile small areas from raw snapshot `snapshot` (and the context set in
    `inputs.ons_context`) into `snapshots/<out_snapshot>/areas/` (default: `snapshot`)."""
    out_snapshot = out_snapshot or snapshot
    profiles = json.loads(inputs.profiles.read_text(encoding="utf-8"))["profiles"]
    by_kind = {p["smallAreas"]: p for p in profiles}
    if set(by_kind) != {"lsoa21", "dz21"}:
        raise AreasBuildError(f"expected one LSOA and one Data Zone deep profile, found {sorted(by_kind)}")
    man, bel = by_kind["lsoa21"], by_kind["dz21"]

    # Inputs, each verified against its recorded checksum.
    ons_index, nomis_index = load_index(inputs.ons), load_index(inputs.nomis)
    mhclg_index, nisra_index = load_index(inputs.mhclg), load_index(inputs.nisra)
    lookup_paths, lookup_entries = _pages(inputs.ons, ons_index, "ons.lsoa21_lad25_manchester")
    bgc_paths, bgc_entries = _pages(inputs.ons, ons_index, "ons.lsoa21_bgc_manchester_box")
    pwc_paths, pwc_entries = _pages(inputs.ons, ons_index, "ons.lsoa21_pwc_manchester_box")
    ts001_e = _entry(nomis_index, "nomis.census2021_ts001")
    ts045_e = _entry(nomis_index, "nomis.census2021_ts045")
    iod_e = _entry(mhclg_index, "mhclg.iod2025_file7")
    dz_e = _entry(nisra_index, "nisra.dz2021_boundaries")
    dzc_e = _entry(nisra_index, "nisra.dz2021_pwc")
    msa01_e = _entry(nisra_index, "nisra.census2021_ms_a01")
    soa_e = _entry(nisra_index, "nisra.soa2011_boundaries")
    nimdm_e = _entry(nisra_index, "nisra.nimdm2017_soa")
    cars_dz_path, cars_dz_e = load_provided(inputs.nisra_cars, "nisra.dz21_car_van_tc5")
    cars_lgd_path, cars_lgd_e = load_provided(inputs.nisra_cars, "nisra.lgd14_car_van_tc5")
    ppfi_path, ppfi_e = load_provided(inputs.hasp, "hasp.ppfi_v21_lsoa")
    ppfi = read_ppfi(ppfi_path)
    ctx_index = load_index(inputs.ons_context)
    ruc_paths, ruc_entries = _pages(inputs.ons_context, ctx_index, "ons.ruc21_lsoa21")
    ruc = read_ruc21(ruc_paths, "LSOA21CD", LSOA_CODES)

    qa: dict = {"snapshot": out_snapshot, "rawSnapshots": {"stage5": snapshot, "context": inputs.ons_context.name},
                "manchester": {}, "belfast": {}}

    # --- Manchester: LSOAs (2021) -----------------------------------------------------------
    lookup = read_lsoa_lookup(lookup_paths)
    if {v["lad"] for v in lookup.values()} != {man["lad"]}:
        raise AreasBuildError("the Manchester lookup holds another council")
    box = read_lsoa_boundaries(bgc_paths)
    centroids_bng = read_lsoa_centroids(pwc_paths)
    lsoa_codes = sorted(lookup)
    missing = {"boundaries": sorted(set(lsoa_codes) - set(box.codes)),
               "centroids": sorted(set(lsoa_codes) - set(centroids_bng))}
    if any(missing.values()):
        raise AreasBuildError(f"Manchester LSOAs not fetched: {missing}")
    at = {c: i for i, c in enumerate(box.codes)}
    lsoa_geoms = np.array([box.geoms[at[c]] for c in lsoa_codes], dtype=object)
    for c, i in zip(lsoa_codes, (at[c] for c in lsoa_codes), strict=True):
        if box.names[i] != lookup[c]["name"]:
            raise AreasBuildError(f"{c}: boundary name {box.names[i]!r} ≠ lookup name {lookup[c]['name']!r}")

    ts001 = read_census_lsoa(inputs.nomis / ts001_e["file"], "census2021-ts001-lsoa.csv", [TS001_TOTAL])
    ts045 = read_census_lsoa(inputs.nomis / ts045_e["file"], "census2021-ts045-lsoa.csv", [TS045_TOTAL, TS045_NO_CAR])
    ts001_lad = read_census_lsoa(inputs.nomis / ts001_e["file"], "census2021-ts001-ltla.csv", [TS001_TOTAL])
    ts045_lad = read_census_lsoa(inputs.nomis / ts045_e["file"], "census2021-ts045-ltla.csv",
                                 [TS045_TOTAL, TS045_NO_CAR])
    iod = read_iod_file7(inputs.mhclg / iod_e["file"])
    if len(iod) != IOD_LSOAS or sorted(v["rank"] for v in iod.values()) != list(range(1, IOD_LSOAS + 1)):
        raise AreasBuildError(f"IoD 2025 File 7 does not rank {IOD_LSOAS} LSOAs 1…{IOD_LSOAS}")
    for name, table in (("TS001", ts001), ("TS045", ts045), ("IoD 2025", iod), ("RUC 2021", ruc)):
        absent = sorted(set(lsoa_codes) - set(table))
        if absent:
            raise AreasBuildError(f"{name} has no row for Manchester LSOAs {absent[:5]}")

    bng_to_wgs = Transformer.from_crs(27700, 4326, always_xy=True)
    lsoa_display = display_geometry(lsoa_geoms, crs=27700, tolerance_m=LSOA_TOLERANCE_M, min_island_m2=0.0)
    gi = dict(zip(lsoa_codes, lsoa_geoms, strict=True))
    pwc_outside = {c: round(float(shapely.distance(gi[c], shapely.Point(centroids_bng[c]))), 1)
                   for c in lsoa_codes if not shapely.contains(gi[c], shapely.Point(centroids_bng[c]))}

    man_areas = []
    for c in lsoa_codes:
        man_areas.append({
            "code": c, "name": lookup[c]["name"], "ward": lookup[c]["ward"], "wardName": lookup[c]["wardName"],
            "population": ts001[c][TS001_TOTAL], "households": ts045[c][TS045_TOTAL],
            "noCarHouseholds": ts045[c][TS045_NO_CAR],
            "centroid": _lonlat(bng_to_wgs, *centroids_bng[c]),
            "urbanRural": ruc[c],
            "deprivation": {"rank": iod[c]["rank"], "decile": iod[c]["decile"]},
            "ppfi": _ppfi_value(ppfi[c]),
        })
    man_sum = {"population": sum(a["population"] for a in man_areas),
               "households": sum(a["households"] for a in man_areas),
               "noCarHouseholds": sum(a["noCarHouseholds"] for a in man_areas)}
    man_lad = {"population": ts001_lad[man["lad"]][TS001_TOTAL], "households": ts045_lad[man["lad"]][TS045_TOTAL],
               "noCarHouseholds": ts045_lad[man["lad"]][TS045_NO_CAR]}
    qa["manchester"] = {
        "lsoas": len(lsoa_codes), "lsoasInFetchBox": len(box.codes), "centroidsInFetchBox": len(centroids_bng),
        "centroidsOutsideTheirGeneralisedLsoa": pwc_outside,
        "sumOfSmallAreas": man_sum, "councilTable": man_lad,
        "difference": {k: man_sum[k] - man_lad[k] for k in man_sum},
        "iodLad2024": sorted({iod[c]["lad2024"] for c in lsoa_codes}),
        "iodDeciles": {str(d): sum(a["deprivation"]["decile"] == d for a in man_areas) for d in range(1, 11)},
        "urbanRural2021": {k: sum(a["urbanRural"]["code"] == k for a in man_areas)
                           for k in LSOA_CODES if any(a["urbanRural"]["code"] == k for a in man_areas)},
        "boundaries": {k: v for k, v in lsoa_display.stats.items() if k not in ("repairedAfterRounding",)},
    }

    # --- Belfast: Data Zones (2021) -----------------------------------------------------------
    dz = read_data_zones(inputs.nisra / dz_e["file"])
    if len(dz.codes) != 3780:
        raise AreasBuildError(f"expected 3,780 Data Zones, found {len(dz.codes)}")
    dz_centroids = read_dz_centroids(inputs.nisra / dzc_e["file"])
    dz_pop = read_ms_a01(inputs.nisra / msa01_e["file"], "DZ")
    lgd_pop = read_ms_a01(inputs.nisra / msa01_e["file"], "LGD")
    dz_cars = read_car_van_dz(cars_dz_path)
    lgd_cars = read_car_van_lgd(cars_lgd_path)
    if set(dz_centroids) != set(dz.codes) or set(dz_pop) != set(dz.codes) or set(dz_cars) != set(dz.codes):
        raise AreasBuildError("Data Zone centroids, MS-A01 or car availability do not list the same 3,780 Data Zones")
    outside = [c for c, g in zip(dz.codes, dz.geoms, strict=True) if not shapely.contains(g, shapely.Point(dz_centroids[c]))]
    if outside:
        # Every published centroid lies in its Data Zone in the Irish Grid: this is the check that
        # the centroid CSV uses the boundaries' grid (it states no CRS).
        raise AreasBuildError(f"{len(outside)} Data Zone centroids fall outside their Data Zone: {outside[:5]}")
    bel_idx = sorted((i for i, l in enumerate(dz.extra["lgd"]) if l == bel["lad"]), key=lambda i: dz.codes[i])
    bel_codes = [dz.codes[i] for i in bel_idx]
    dz_geoms = np.array([dz.geoms[i] for i in bel_idx], dtype=object)
    ig_to_wgs = Transformer.from_crs(29902, 4326, always_xy=True)
    dz_display = display_geometry(dz_geoms, crs=29902, tolerance_m=NI_TOLERANCE_M, min_island_m2=0.0,
                                  require_valid_input=False)
    bel_areas = [{
        "code": c, "name": dz.names[i],
        "population": dz_pop[c], "households": dz_cars[c]["households"], "noCarHouseholds": dz_cars[c]["noCar"],
        "centroid": _lonlat(ig_to_wgs, *dz_centroids[c]),
        "urbanRural": None, "deprivation": None, "ppfi": None,
    } for c, i in zip(bel_codes, bel_idx, strict=True)]

    # Belfast: SOAs (2011) with NIMDM 2017.
    soa = read_super_output_areas(inputs.nisra / soa_e["file"])
    nimdm = read_nimdm2017(inputs.nisra / nimdm_e["file"])
    if len(nimdm) != NIMDM_SOAS or sorted(r["mdmRank"] for r in nimdm) != list(range(1, NIMDM_SOAS + 1)):
        raise AreasBuildError(f"NIMDM 2017 does not rank {NIMDM_SOAS} SOAs 1…{NIMDM_SOAS}")
    if set(soa.codes) != {r["code"] for r in nimdm}:
        raise AreasBuildError("the SOA boundaries and NIMDM 2017 list different SOAs")
    bel_soa = sorted((r for r in nimdm if r["lgdName"] == bel["nimdmLgdName"]), key=lambda r: r["code"])
    soa_at = {c: i for i, c in enumerate(soa.codes)}
    soa_geoms = np.array([soa.geoms[soa_at[r["code"]]] for r in bel_soa], dtype=object)
    soa_display = display_geometry(soa_geoms, crs=29902, tolerance_m=NI_TOLERANCE_M, min_island_m2=0.0,
                                   require_valid_input=False)
    soa_areas = [{
        "code": r["code"], "name": r["name"], "urbanRural2015": r["urbanRural2015"],
        "rank": r["mdmRank"], "decile": nimdm_decile(r["mdmRank"]), "domainRanks": r["domainRanks"],
        "ppfi": _ppfi_value(ppfi[r["code"]]),
    } for r in bel_soa]

    # How far the 2011 SOAs and the 2021 Data Zones of Belfast agree (they are different geographies).
    dz_union = shapely.union_all(dz_geoms)
    soa_union = shapely.union_all(soa_geoms)
    # PPFI: which end is highest priority is not stated in the publisher's text; the data shows it.
    # Rank 1 of the socio-demographic domain goes with the most deprived areas in both nations.
    eng = [c for c, v in ppfi.items() if v["country"] == "E"]
    ni_codes = [r["code"] for r in nimdm]
    nimdm_rank = {r["code"]: r["mdmRank"] for r in nimdm}
    qa["ppfi"] = {
        "areasPerCountry": {c: sum(v["country"] == c for v in ppfi.values()) for c in ("E", "W", "S", "NI")},
        "northernIrelandDomainsWithoutData": sorted(
            d for d in ppfi[ni_codes[0]]["domains"] if all(ppfi[c]["domains"][d] is None for c in ni_codes)),
        "orientation": {
            "englandImdDecileVsSocioDemographicDecile": round(statistics.correlation(
                [iod[c]["decile"] for c in eng], [ppfi[c]["domains"]["socio_demographic"]["decile"] for c in eng]), 3),
            "northernIrelandNimdmRankVsSocioDemographicRank": round(statistics.correlation(
                [nimdm_rank[c] for c in ni_codes], [ppfi[c]["domains"]["socio_demographic"]["rank"] for c in ni_codes]), 3),
            "reading": "positive: rank 1 / decile 1 = highest priority, as for IoD and NIMDM (1 = most deprived)",
        },
        "manchesterDeciles": {str(d): sum(a["ppfi"]["decile"] == d for a in man_areas) for d in range(1, 11)},
        "belfastSoaDeciles": {str(d): sum(a["ppfi"]["decile"] == d for a in soa_areas) for d in range(1, 11)},
    }
    if qa["ppfi"]["northernIrelandDomainsWithoutData"] != PPFI_NOT_IN_NI:
        raise AreasBuildError(f"PPFI domains without NI data: {qa['ppfi']['northernIrelandDomainsWithoutData']}")
    if min(qa["ppfi"]["orientation"][k] for k in ("englandImdDecileVsSocioDemographicDecile",
                                                    "northernIrelandNimdmRankVsSocioDemographicRank")) < 0.5:
        raise AreasBuildError(f"PPFI orientation is not what was verified: {qa['ppfi']['orientation']}")

    qa["belfast"] = {
        "dataZones": len(bel_codes), "dataZoneCentroidsOutsideTheirZone": 0,
        "sumOfDataZonePopulation": sum(a["population"] for a in bel_areas),
        "differenceFromCouncilTable": sum(a["population"] for a in bel_areas) - lgd_pop[bel["lad"]],
        "councilTableMsA01": lgd_pop[bel["lad"]],
        "households": {
            "sumOfDataZones": {"households": sum(a["households"] for a in bel_areas),
                               "noCarHouseholds": sum(a["noCarHouseholds"] for a in bel_areas)},
            "councilTable": {"households": lgd_cars[bel["lad"]]["households"],
                             "noCarHouseholds": lgd_cars[bel["lad"]]["noCar"]},
            "northernIrelandDataZones": {"households": sum(v["households"] for v in dz_cars.values()),
                                         "noCarHouseholds": sum(v["noCar"] for v in dz_cars.values())},
            "northernIrelandCouncils": {"households": sum(v["households"] for v in lgd_cars.values()),
                                        "noCarHouseholds": sum(v["noCar"] for v in lgd_cars.values())},
        },
        "soas": len(bel_soa),
        "soaUrbanRural2015": {k: sum(r["urbanRural2015"] == k for r in bel_soa)
                              for k in sorted({r["urbanRural2015"] for r in bel_soa})},
        "nimdmDeciles": {str(d): sum(a["decile"] == d for a in soa_areas) for d in range(1, 11)},
        "areaKm2": {"dataZones": round(float(dz_union.area) / 1e6, 2), "soas2011": round(float(soa_union.area) / 1e6, 2),
                    "symmetricDifference": round(float(shapely.symmetric_difference(dz_union, soa_union).area) / 1e6, 3)},
        "boundaries": {"dataZones": {k: v for k, v in dz_display.stats.items() if k != "repairedAfterRounding"},
                       "soas2011": {k: v for k, v in soa_display.stats.items() if k != "repairedAfterRounding"}},
        "irishGridToWgs84": ig_to_wgs.description,
    }

    # --- Outputs: one folder per council -------------------------------------------------------
    census_meta = {
        "sourceIds": ["S18", "S20"], "referenceDate": CENSUS_DATE,
        "population": "Usual residents (Census 2021: ONS TS001; NISRA MS-A01)",
        "households": "Households (Census 2021: ONS TS045; NISRA HH_CAR_VAN_TC5, sum of its six categories)",
        "noCarHouseholds": ("Households with no cars or vans available (Census 2021: ONS TS045; NISRA "
                            "HH_CAR_VAN_TC5 category 0)"),
        "note": "Census counts for small areas are perturbed for confidentiality and need not add up to council totals.",
    }
    centroid_meta = {"sourceIds": ["S15", "S16"],
                     "definition": ("Census 2021 population-weighted centroid (ONS LSOA V4; NISRA Data Zones), "
                                    "WGS84; straight-line distances are measured from these points")}
    man_profile = {
        "lad": man["lad"], "name": man["name"], "nation": man["nation"],
        "geography": {"kind": "lsoa21", "label": "Lower layer Super Output Areas (2021)", "count": len(man_areas)},
        "urbanRural": {"sourceId": "S21", "geography": "lsoa21",
                       "classification": "ONS 2021 Rural Urban Classification of LSOAs (England and Wales)",
                       "referencePeriod": "Census 2021 populations (published 9 March 2025)"},
        "deprivation": {"index": "English Indices of Deprivation 2025", "sourceId": "S19",
                        "measure": "Index of Multiple Deprivation", "geography": "lsoa21",
                        "ranked": IOD_LSOAS, "within": "England", "decile": "published",
                        "referencePeriod": "IoD 2025 (most indicators 2022/23)"},
        "ppfi": {**PPFI_META, "geography": "lsoa21", "ranked": 33_755, "within": "England", "domainsWithoutData": []},
        "areas": man_areas, "deprivationAreas": None, "missing": [],
    }
    bel_profile = {
        "lad": bel["lad"], "name": bel["name"], "nation": bel["nation"],
        "geography": {"kind": "dz21", "label": "Data Zones (2021)", "count": len(bel_areas)},
        "urbanRural": {"sourceId": "S21", "geography": "soa2011",
                       "classification": "NISRA 2015 default urban/rural classification (as in the NIMDM 2017 file)",
                       "referencePeriod": "Settlement Development Limits 2015 (2011 Census counts); the latest NISRA edition"},
        "deprivation": {"index": "Northern Ireland Multiple Deprivation Measure 2017", "sourceId": "S19",
                        "measure": "Multiple Deprivation Measure", "geography": "soa2011",
                        "ranked": NIMDM_SOAS, "within": "Northern Ireland",
                        "decile": "derived from the rank: 89 SOAs per decile",
                        "referencePeriod": "NIMDM 2017 (most indicators 2015/16)"},
        "ppfi": {**PPFI_META, "geography": "soa2011", "ranked": 890, "within": "Northern Ireland",
                 "domainsWithoutData": PPFI_NOT_IN_NI},
        "areas": bel_areas, "deprivationAreas": soa_areas, "missing": [],
    }

    def combined(entries: list[dict]) -> str:
        return hashlib.sha256("".join(e["sha256"] for e in entries).encode()).hexdigest()[:12]

    manifest_schema = json.loads((schema_dir / "manifest.schema.json").read_text(encoding="utf-8"))
    dataset_schema = {"$schema": manifest_schema["$schema"], "definitions": manifest_schema["definitions"],
                      "$ref": "#/definitions/Dataset"}
    census_files = (f"{ts001_e['file']} (sha256 {ts001_e['sha256'][:12]}…); {ts045_e['file']} (sha256 "
                    f"{ts045_e['sha256'][:12]}…); {ppfi_e['file']} (provided, sha256 {ppfi_e['sha256'][:12]}…)")
    councils = [
        {
            "profile": man_profile,
            "layers": [("lsoa21", lsoa_codes, lsoa_display.geoms)],
            "title": f"{man['name']}: LSOAs (2021)",
            "sourceIds": ["S15", "S21"],
            "boundaryPeriod": "LSOAs of Census 2021 (December 2021 boundaries)",
            "coverage": f"{man['name']} ({len(man_areas)} LSOAs)",
            "attribution": f"{OGL_ONS}. {OS_NOTICE}",
            "boundarySource": (f"{bgc_entries[0]['url'].split('/query')[0]} ({len(bgc_entries)} pages, combined sha256 "
                               f"{combined(bgc_entries)}…)"),
            "boundaryRetrieved": bgc_entries[-1]["retrievedAt"],
            "boundaryNotes": (f"LSOA BGC (20 m) coverage-simplified at {LSOA_TOLERANCE_M:.0f} m in EPSG:27700; WGS84 to "
                              f"{COORD_DECIMALS} decimal places."),
            "indicatorSources": ["S13", "S15", "S18", "S19", "S20", "S21"],
            "indicatorPeriod": "Census 2021 (21 March 2021); IoD 2025; PPFI v2.1 (July 2024); RUC 2021",
            "indicatorAttribution": f"{OGL_ONS}. {MHCLG_SOURCE}. {PPFI_SOURCE}",
            "indicatorSource": (f"{census_files}; {iod_e['file']} (sha256 {iod_e['sha256'][:12]}…); LSOA centroids "
                                f"({len(pwc_entries)} page, combined sha256 {combined(pwc_entries)}…); LSOA lookup "
                                f"({len(lookup_entries)} page, combined sha256 {combined(lookup_entries)}…); urban/rural "
                                f"({len(ruc_entries)} pages, combined sha256 {combined(ruc_entries)}…)"),
            "indicatorRetrieved": max(ts001_e["retrievedAt"], ts045_e["retrievedAt"], iod_e["retrievedAt"],
                                      pwc_entries[-1]["retrievedAt"], lookup_entries[-1]["retrievedAt"],
                                      ruc_entries[-1]["retrievedAt"], ppfi_e["receivedAt"]),
            "indicatorNotes": ("Values as published. IoD 2025 deciles as published, within England only. PPFI v2.1 from "
                               "Leeds HASP (downloaded by John): ranks and deciles within England as published."),
        },
        {
            "profile": bel_profile,
            "layers": [("dz21", bel_codes, dz_display.geoms),
                       ("soa2011", [a["code"] for a in soa_areas], soa_display.geoms)],
            "title": f"{bel['name']}: Data Zones (2021) and Super Output Areas (2011)",
            "sourceIds": ["S16", "S19"],
            "boundaryPeriod": "Data Zones of Census 2021; SOAs of Census 2011",
            "coverage": f"{bel['name']} ({len(bel_areas)} Data Zones, {len(soa_areas)} SOAs)",
            "attribution": f"{NISRA_SOURCE}. {OSNI_NOTICE}",
            "boundarySource": (f"{dz_e['url']} (sha256 {dz_e['sha256'][:12]}…); {soa_e['url']} (sha256 "
                               f"{soa_e['sha256'][:12]}…)"),
            "boundaryRetrieved": max(dz_e["retrievedAt"], soa_e["retrievedAt"]),
            "boundaryNotes": (f"NISRA Data Zones and SOAs (Irish Grid, EPSG:29902) coverage-simplified at "
                              f"{NI_TOLERANCE_M:.0f} m; WGS84 to {COORD_DECIMALS} decimal places. SOAs (2011) carry "
                              "NIMDM 2017, PPFI v2.1 and NISRA's 2015 urban/rural class."),
            "indicatorSources": ["S13", "S16", "S18", "S19", "S20", "S21"],
            "indicatorPeriod": "Census 2021 (21 March 2021); NIMDM 2017; PPFI v2.1 (July 2024); NISRA urban/rural 2015",
            "indicatorAttribution": f"{NISRA_SOURCE}. {PPFI_SOURCE}",
            "indicatorSource": (f"{msa01_e['file']} (sha256 {msa01_e['sha256'][:12]}…); {cars_dz_e['file']} (provided, "
                                f"sha256 {cars_dz_e['sha256'][:12]}…); {nimdm_e['file']} (sha256 "
                                f"{nimdm_e['sha256'][:12]}…); {dzc_e['file']} (sha256 {dzc_e['sha256'][:12]}…); "
                                f"{ppfi_e['file']} (provided, sha256 {ppfi_e['sha256'][:12]}…)"),
            "indicatorRetrieved": max(msa01_e["retrievedAt"], nimdm_e["retrievedAt"], dzc_e["retrievedAt"],
                                      cars_dz_e["receivedAt"], ppfi_e["receivedAt"]),
            "indicatorNotes": ("Values as published. NIMDM 2017 deciles are derived from the ranks (89 SOAs per decile), "
                               "within Northern Ireland only. Households and car availability: NISRA's flexible table "
                               "builder (HH_CAR_VAN_TC5 by Data Zone), downloaded by John. PPFI v2.1 from Leeds HASP "
                               "(downloaded by John): ranks and deciles within Northern Ireland; three domains have no "
                               "Northern Ireland data."),
        },
    ]

    written: list[Path] = []
    for c in councils:
        profile = c["profile"]
        lad = profile["lad"]
        features = [{"type": "Feature", "geometry": json.loads(shapely.to_geojson(geom)),
                     "properties": {"code": code, "kind": kind, "lad": lad}}
                    for kind, codes, geoms in c["layers"] for code, geom in zip(codes, geoms, strict=True)]
        geo_doc = {"type": "FeatureCollection", "features": features}
        _validate(geo_doc, schema_dir, "small-areas")
        indicators = {"schemaVersion": 1, "census": census_meta, "centroids": centroid_meta, "profiles": [profile]}
        _validate(indicators, schema_dir, "small-area-indicators")
        out_dir = out_root / "snapshots" / out_snapshot / FAMILY / lad
        out_dir.mkdir(parents=True, exist_ok=True)
        key = lad.lower()
        datasets = [
            ("small-areas.geojson", _feature_collection(features), {
                "id": f"areas.{key}.boundaries", "title": f"Small areas of the deep profile — {c['title']}",
                "role": "reference", "format": "geojson", "schemaId": "small-areas", "featureCount": len(features),
                "sourceIds": c["sourceIds"], "referencePeriod": c["boundaryPeriod"], "coverage": c["coverage"],
                "provenance": "measured", "licence": OGL, "attribution": c["attribution"], "expectedCadence": "irregular",
                "retrieval": {"method": "ONS feature services and NISRA shapefiles (fetch-ons, fetch-reference), cached in pipeline/raw/",
                              "source": c["boundarySource"], "retrievedAt": c["boundaryRetrieved"],
                              "notes": c["boundaryNotes"]},
            }),
            ("small-area-indicators.json", _compact(indicators) + "\n", {
                "id": f"areas.{key}.indicators",
                "title": (f"Small-area indicators of the deep profile — {profile['name']}: Census 2021 population, households "
                          "and car availability; urban/rural class; deprivation and the Priority Places for Food Index "
                          "within the nation"),
                "role": "statistical", "format": "json", "schemaId": "small-area-indicators",
                "sourceIds": c["indicatorSources"], "referencePeriod": c["indicatorPeriod"], "coverage": c["coverage"],
                "provenance": "measured", "licence": OGL, "attribution": c["indicatorAttribution"],
                "expectedCadence": "irregular",
                "retrieval": {"method": "Derived offline from the committed raw files (fetch-reference)",
                              "source": c["indicatorSource"], "retrievedAt": c["indicatorRetrieved"],
                              "notes": c["indicatorNotes"]},
            }),
        ]
        for filename, text, record in datasets:
            path = out_dir / filename
            path.write_text(text, encoding="utf-8")
            sidecar = {
                "id": record["id"], "title": record["title"], "role": record["role"],
                "path": f"snapshots/{out_snapshot}/{FAMILY}/{lad}/{filename}",
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
    report = reports_dir / f"areas-qa-{out_snapshot}.json"
    report.write_text(json.dumps(qa, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    written.append(report)
    logger.info("areas build %s: %d Manchester LSOAs, %d Belfast Data Zones, %d Belfast SOAs",
                out_snapshot, len(man_areas), len(bel_areas), len(soa_areas))
    return written


__all__ = ["AreasBuildError", "AreasInputs", "build_areas", "default_inputs", "nimdm_decile"]
