"""Offline build of the small-area datasets (pre-Stage 5 data step) from the committed raw files.

The outputs are not published yet (Stage 5 adds them to the data index); this checks the figures
recorded in the data-step report, that two builds are byte-identical, that the committed QA report
is what the build writes, and a hand-checked sample of five small areas per council against the
raw files read independently of the pipeline's readers.
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path

import numpy as np
import openpyxl
import pytest
import shapely
import xlrd

from foodscope_pipeline.areas import AreasBuildError, build_areas, default_inputs, nimdm_decile
from foodscope_pipeline.boundaries import DisplayBoundaryError, display_geometry
from foodscope_pipeline.sources.small_areas import (
    SmallAreaInputError, read_car_van_dz, read_census_lsoa, read_iod_file7, read_ppfi,
)

PIPELINE = Path(__file__).resolve().parents[1]
REPO = PIPELINE.parent
RAW = PIPELINE / "raw"
SNAPSHOT = "2026-10-24"


def _build(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    out = tmp_path_factory.mktemp("data")
    reports = tmp_path_factory.mktemp("reports")
    build_areas(SNAPSHOT, default_inputs(RAW, PIPELINE / "foodscope_pipeline" / "config", SNAPSHOT), out, reports,
                REPO / "schemas")
    return out / "snapshots" / SNAPSHOT / "areas", reports


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    return _build(tmp_path_factory)


@pytest.fixture(scope="module")
def doc(built) -> dict:
    return json.loads((built[0] / "small-area-indicators.json").read_text(encoding="utf-8"))


def _profile(doc: dict, lad: str) -> dict:
    return next(p for p in doc["profiles"] if p["lad"] == lad)


def test_two_builds_are_byte_identical_and_the_report_is_committed(built, tmp_path_factory) -> None:
    out, reports = built
    again, reports_again = _build(tmp_path_factory)
    for path in sorted(out.iterdir()):
        assert path.read_bytes() == (again / path.name).read_bytes(), path.name
    for path in sorted(reports.iterdir()):
        assert path.read_bytes() == (reports_again / path.name).read_bytes(), path.name
        assert path.read_bytes() == (PIPELINE / "reports" / path.name).read_bytes(), path.name


def test_counts_and_council_totals(built, doc) -> None:
    man, bel = _profile(doc, "E08000003"), _profile(doc, "N09000003")
    assert len(man["areas"]) == 295 and len(bel["areas"]) == 735 and len(bel["deprivationAreas"]) == 174
    qa = json.loads((built[1] / f"areas-qa-{SNAPSHOT}.json").read_text(encoding="utf-8"))
    # Small areas are perturbed for confidentiality: they need not add up to the council tables.
    assert qa["manchester"]["sumOfSmallAreas"] == {"population": 551_919, "households": 214_712, "noCarHouseholds": 83_777}
    assert qa["manchester"]["councilTable"] == {"population": 551_938, "households": 214_732, "noCarHouseholds": 83_770}
    assert qa["belfast"]["sumOfDataZonePopulation"] == 345_423 and qa["belfast"]["councilTableMsA01"] == 345_418
    assert qa["belfast"]["dataZoneCentroidsOutsideTheirZone"] == 0
    features = json.loads((built[0] / "small-areas.geojson").read_text(encoding="utf-8"))["features"]
    kinds = [f["properties"]["kind"] for f in features]
    assert (kinds.count("lsoa21"), kinds.count("dz21"), kinds.count("soa2011")) == (295, 735, 174)


def test_belfast_car_availability_from_the_table_builder(built, doc) -> None:
    bel = _profile(doc, "N09000003")
    assert bel["missing"] == []
    assert all(0 <= a["noCarHouseholds"] <= a["households"] for a in bel["areas"])
    assert all(a["deprivation"] is None for a in bel["areas"])  # NIMDM is on the SOAs (John, 24 Oct 2026)
    qa = json.loads((built[1] / f"areas-qa-{SNAPSHOT}.json").read_text(encoding="utf-8"))["belfast"]["households"]
    # Perturbed counts: the Data Zones need not add up to the council table.
    assert qa["sumOfDataZones"] == {"households": 149_193, "noCarHouseholds": 50_595}
    assert qa["councilTable"] == {"households": 149_207, "noCarHouseholds": 50_594}
    assert qa["northernIrelandCouncils"]["households"] == 768_810


def test_deprivation_is_within_each_nation(doc) -> None:
    man, bel = _profile(doc, "E08000003"), _profile(doc, "N09000003")
    assert man["deprivation"]["within"] == "England" and man["deprivation"]["ranked"] == 33_755
    assert bel["deprivation"]["within"] == "Northern Ireland" and bel["deprivation"]["ranked"] == 890
    assert all(1 <= a["deprivation"]["rank"] <= 33_755 for a in man["areas"])
    assert sum(a["deprivation"]["decile"] == 1 for a in man["areas"]) == 120
    assert sum(a["decile"] == 1 for a in bel["deprivationAreas"]) == 47


@pytest.mark.parametrize(("rank", "decile"), [(1, 1), (89, 1), (90, 2), (445, 5), (801, 9), (802, 10), (890, 10)])
def test_nimdm_decile(rank: int, decile: int) -> None:
    assert nimdm_decile(rank) == decile


@pytest.mark.parametrize(("rank", "total"), [(0, 890), (891, 890), (5, 895)])
def test_nimdm_decile_rejects(rank: int, total: int) -> None:
    with pytest.raises(AreasBuildError):
        nimdm_decile(rank, total)


# Hand-checked sample (Stage 5 exit criterion: five small areas per council match the source),
# read from the raw files with the standard library only.
MANCHESTER_SAMPLE = ["E01005061", "E01005098", "E01005113", "E01033658", "E01005245"]
BELFAST_SAMPLE_DZ = ["N20000971", "N20000974", "N20001021", "N20001077", "N20001200"]
BELFAST_SAMPLE_SOA = ["95GG01S1", "95GG17S2", "95GG35S2", "95II02S3", "95SS29S2"]


def _nomis_lsoa(member: str) -> dict[str, list[str]]:
    with zipfile.ZipFile(RAW / "nomis" / SNAPSHOT / f"{member.split('-lsoa')[0]}.zip") as zf:
        rows = list(csv.reader(io.TextIOWrapper(zf.open(member), encoding="utf-8-sig")))
    return {r[2]: r for r in rows[1:]}


def test_manchester_sample_matches_the_raw_files(doc) -> None:
    areas = {a["code"]: a for a in _profile(doc, "E08000003")["areas"]}
    ts001 = _nomis_lsoa("census2021-ts001-lsoa.csv")
    ts045 = _nomis_lsoa("census2021-ts045-lsoa.csv")
    with (RAW / "mhclg" / SNAPSHOT / "File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv").open(
            encoding="utf-8-sig") as fh:
        iod = {r[0]: r for r in csv.reader(fh)}
    for code in MANCHESTER_SAMPLE:
        a = areas[code]
        assert a["population"] == int(ts001[code][3]), code
        assert (a["households"], a["noCarHouseholds"]) == (int(ts045[code][3]), int(ts045[code][4])), code
        assert (a["deprivation"]["rank"], a["deprivation"]["decile"]) == (int(iod[code][5]), int(iod[code][6])), code


def test_belfast_sample_matches_the_raw_files(doc) -> None:
    bel = _profile(doc, "N09000003")
    areas = {a["code"]: a for a in bel["areas"]}
    wb = openpyxl.load_workbook(RAW / "nisra" / SNAPSHOT / "census-2021-ms-a01.xlsx", read_only=True)
    pop = {r[1]: r[2] for r in wb["DZ"].iter_rows(values_only=True) if r[1] and str(r[1]).startswith("N20")}
    with (RAW / "nisra-provided" / "census2021-car-van-2026-10-25" / "ni-census21-household-dz21hh_car_van_tc5.csv").open(
            encoding="utf-8-sig") as fh:
        cars: dict[str, list[int]] = {}
        for r in list(csv.reader(fh))[1:]:
            cars.setdefault(r[0], []).append(int(r[4]))
    for code in BELFAST_SAMPLE_DZ:
        assert areas[code]["population"] == pop[code], code
        assert areas[code]["households"] == sum(cars[code]), code
        assert areas[code]["noCarHouseholds"] == cars[code][0], code
    sheet = xlrd.open_workbook(str(RAW / "nisra" / SNAPSHOT / "NIMDM17_SOAresults.xls")).sheet_by_name("MDM")
    ranks = {sheet.cell_value(i, 2): int(sheet.cell_value(i, 4)) for i in range(1, sheet.nrows)}
    soas = {a["code"]: a for a in bel["deprivationAreas"]}
    for code in BELFAST_SAMPLE_SOA:
        assert soas[code]["rank"] == ranks[code], code
        assert soas[code]["decile"] == (ranks[code] - 1) // 89 + 1, code


def test_centroids_are_in_the_councils(built, doc) -> None:
    """Each published centroid lies in (or within 2 m of, after generalisation) its own small area."""
    features = json.loads((built[0] / "small-areas.geojson").read_text(encoding="utf-8"))["features"]
    shapes = {f["properties"]["code"]: shapely.from_geojson(json.dumps(f["geometry"])) for f in features}
    for profile in doc["profiles"]:
        for a in profile["areas"]:
            point = shapely.Point(a["centroid"])
            assert shapes[a["code"]].distance(point) < 3e-5, a["code"]  # about 2 m in degrees


# Readers refuse inputs whose structure differs from what was verified (synthetic files "A").


def test_census_reader_refuses_a_changed_header(tmp_path: Path) -> None:
    path = tmp_path / "x.zip"
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("x-lsoa.csv", "date,geography,geography code,Total\n2021,A,A1,5\n")
    with pytest.raises(SmallAreaInputError, match="missing"):
        read_census_lsoa(path, "x-lsoa.csv", ["Residence type: Total; measures: Value"])
    with pytest.raises(SmallAreaInputError, match="no y-lsoa.csv"):
        read_census_lsoa(path, "y-lsoa.csv", ["Total"])


def test_iod_reader_refuses_a_changed_header(tmp_path: Path) -> None:
    path = tmp_path / "f7.csv"
    path.write_text("LSOA code (2021),IMD Rank\nA,1\n", encoding="utf-8")
    with pytest.raises(SmallAreaInputError, match="missing"):
        read_iod_file7(path)


def test_display_geometry_cleans_only_when_allowed() -> None:
    # Two synthetic squares overlapping by a sliver: not a valid coverage.
    a = shapely.box(0, 0, 100, 100)
    b = shapely.box(99.99, 0, 200, 100)
    geoms = np.array([a, b], dtype=object)
    with pytest.raises(DisplayBoundaryError):
        display_geometry(geoms, tolerance_m=1.0, min_island_m2=0.0)
    result = display_geometry(geoms, tolerance_m=1.0, min_island_m2=0.0, require_valid_input=False)
    assert result.stats["inputAreasWithMismatchedEdges"] == 2


def test_car_van_reader_needs_all_six_categories(tmp_path: Path) -> None:
    head = ("Census 2021 Data Zone Code,Census 2021 Data Zone Label,Car or Van Availability Code,"
            "Car or Van Availability Label,Count\n")
    labels = ["No cars or vans available", "1 car or van available", "2 cars or vans available",
              "3 cars or vans available", "4 cars or vans available", "5 or more cars or vans available"]
    full = "".join(f"A1,A,{i},{label},{i + 1}\n" for i, label in enumerate(labels))
    path = tmp_path / "dz.csv"
    path.write_text(head + full, encoding="utf-8")
    assert read_car_van_dz(path) == {"A1": {"households": 21, "noCar": 1}}
    path.write_text(head + full.split("\n", 1)[1], encoding="utf-8")  # category 0 missing
    with pytest.raises(SmallAreaInputError, match="all six"):
        read_car_van_dz(path)
    path.write_text(head.replace("Count", "Households") + full, encoding="utf-8")
    with pytest.raises(SmallAreaInputError, match="header"):
        read_car_van_dz(path)
    path.write_text(head + full.replace("No cars or vans available", "None"), encoding="utf-8")
    with pytest.raises(SmallAreaInputError, match="labelled"):
        read_car_van_dz(path)


PPFI_CSV = RAW / "hasp-provided" / "ppfi-v2.1-lsoa-1.0.24" / "hasp_ppfi_v2.1.csv"


def _ppfi_raw() -> dict[str, dict[str, str]]:
    with PPFI_CSV.open(encoding="utf-8-sig") as fh:
        return {r["lsoa21cd"]: r for r in csv.DictReader(fh)}


def test_ppfi_sample_matches_the_raw_file(doc) -> None:
    raw = _ppfi_raw()
    man = {a["code"]: a for a in _profile(doc, "E08000003")["areas"]}
    soas = {a["code"]: a for a in _profile(doc, "N09000003")["deprivationAreas"]}
    for code, area in [*((c, man[c]) for c in MANCHESTER_SAMPLE), *((c, soas[c]) for c in BELFAST_SAMPLE_SOA)]:
        r = raw[code]
        assert (area["ppfi"]["rank"], area["ppfi"]["decile"]) == (int(r["combined"]), int(r["pp_dec_combined"])), code
        prox = area["ppfi"]["domains"]["supermarket_proximity"]
        assert (prox["rank"], prox["decile"]) == (int(r["domain_supermarket_proximity"]),
                                                  int(r["pp_dec_domain_supermarket_proximity"])), code


def test_ppfi_in_northern_ireland_is_on_the_soas_with_three_domains_missing(built, doc) -> None:
    bel = _profile(doc, "N09000003")
    assert bel["ppfi"]["geography"] == "soa2011" and bel["ppfi"]["ranked"] == 890
    assert bel["ppfi"]["domainsWithoutData"] == ["ecommerce_access", "fuel_poverty", "supermarket_accessibility"]
    assert all(a["ppfi"] is None for a in bel["areas"])  # Data Zones carry none: PPFI is on the SOAs
    for soa in bel["deprivationAreas"]:
        missing = sorted(d for d, v in soa["ppfi"]["domains"].items() if v is None)
        assert missing == bel["ppfi"]["domainsWithoutData"], soa["code"]
    man = _profile(doc, "E08000003")
    assert man["ppfi"]["within"] == "England" and man["ppfi"]["domainsWithoutData"] == []
    assert all(v is not None for a in man["areas"] for v in a["ppfi"]["domains"].values())
    qa = json.loads((built[1] / f"areas-qa-{SNAPSHOT}.json").read_text(encoding="utf-8"))["ppfi"]
    assert qa["areasPerCountry"] == {"E": 33_755, "W": 1_917, "S": 6_976, "NI": 890}
    # Rank 1 = highest priority: the socio-demographic domain ranks with IoD and NIMDM (1 = most deprived).
    assert qa["orientation"]["englandImdDecileVsSocioDemographicDecile"] > 0.8
    assert qa["orientation"]["northernIrelandNimdmRankVsSocioDemographicRank"] > 0.9


def test_ppfi_reader_refuses_changed_columns_and_partial_files(tmp_path: Path) -> None:
    lines = PPFI_CSV.read_text(encoding="utf-8-sig").splitlines()
    path = tmp_path / "ppfi.csv"
    path.write_text(lines[0].replace("combined", "total", 1) + "\n" + "\n".join(lines[1:]) + "\n", encoding="utf-8")
    with pytest.raises(SmallAreaInputError, match="columns"):
        read_ppfi(path)
    path.write_text("\n".join(lines[:-1]) + "\n", encoding="utf-8")  # one area short
    with pytest.raises(SmallAreaInputError, match="areas per country"):
        read_ppfi(path)
