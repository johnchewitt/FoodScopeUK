"""Stage 6 Risk Explorer data: water stress, ports, port of entry, roads, farming regions, PPFI by council.

The build runs on the committed raw files (fetch-reference --set stage6, 2026-10-25). Expected
values are read independently from the raw files here, or quoted from the source tables.
"""

from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

import pytest

from foodscope_pipeline.risk import build_risk, default_inputs
from foodscope_pipeline.sources.risk_inputs import RiskInputError, read_dz11_lookup, read_port0499, stress_class

PIPELINE = Path(__file__).resolve().parents[1]
REPO = PIPELINE.parent
RAW = PIPELINE / "raw"
SNAPSHOT, REFERENCE, LOCAL = "2026-10-25", "2026-10-24", "2026-10-24"
CONFIG = PIPELINE / "foodscope_pipeline" / "config"
CLASSES = json.loads((CONFIG / "risk.json").read_text(encoding="utf-8"))["waterStress"]["classes"]


def _build(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    out = tmp_path_factory.mktemp("data")
    reports = tmp_path_factory.mktemp("reports")
    inputs = default_inputs(RAW, CONFIG, REPO / "public" / "data", SNAPSHOT, REFERENCE, LOCAL)
    build_risk(SNAPSHOT, inputs, out, reports, REPO / "schemas")
    return out / "snapshots" / SNAPSHOT / "risk", reports


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    return _build(tmp_path_factory)


def _load(built, name: str) -> dict:
    return json.loads((built[0] / name).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def port0499() -> list[tuple]:
    return read_port0499(RAW / "dft" / SNAPSHOT / "port0499.ods")


def test_two_builds_are_identical_and_the_report_is_committed(built, tmp_path_factory) -> None:
    out, reports = built
    again, reports_again = _build(tmp_path_factory)
    names = sorted(p.name for p in out.iterdir())
    assert len(names) == 14
    for name in names:
        assert (out / name).read_bytes() == (again / name).read_bytes(), name
    report = reports / f"risk-qa-{SNAPSHOT}.json"
    assert report.read_bytes() == (reports_again / report.name).read_bytes()
    assert report.read_bytes() == (PIPELINE / "reports" / report.name).read_bytes()


def test_published_snapshot_matches_a_fresh_build(built) -> None:
    published = REPO / "public" / "data" / "snapshots" / SNAPSHOT / "risk"
    for path in sorted(built[0].iterdir()):
        assert path.read_bytes() == (published / path.name).read_bytes(), path.name


# --- Water stress (S30) ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("value", "expected"),
    [(0, "none"), (24.999, "none"), (25, "low"), (49.99, "low"), (50, "medium"), (75, "high"), (100, "high"),
     (100.001, "critical"), (141.17, "critical")],
)
def test_fao_stress_classes(value: float, expected: str) -> None:
    assert stress_class(value, CLASSES) == expected


def test_negative_water_stress_is_rejected() -> None:
    with pytest.raises(ValueError):
        stress_class(-1, CLASSES)


def test_water_stress_values_match_the_api_response(built) -> None:
    doc = _load(built, "water-stress.json")
    by_iso2 = {c["iso2"]: c for c in doc["countries"]}
    # Read the raw API rows directly.
    _, rows = json.loads((RAW / "worldbank" / SNAPSHOT / "er-h2o-fwst-zs-2000-2025.json").read_text(encoding="utf-8"))
    raw = {(r["countryiso3code"], int(r["date"])): r["value"] for r in rows if r["value"] is not None}
    assert by_iso2["NL"]["year"] == 2022 and by_iso2["NL"]["value"] == round(raw[("NLD", 2022)], 3)
    assert by_iso2["NL"]["class"] == "none"
    assert by_iso2["ES"]["class"] == "low" and by_iso2["ES"]["value"] == round(raw[("ESP", 2022)], 3)
    assert by_iso2["EG"]["class"] == "critical" and by_iso2["EG"]["value"] > 100
    assert by_iso2["IL"]["year"] == 2021  # the latest value is a year earlier for two countries
    assert by_iso2["GB"]["class"] == "none"
    # Aggregates (regions, income groups) are never countries.
    assert not {"AFE", "WLD", "EUU", "HIC"} & {c["iso3"] for c in doc["countries"] + doc["missing"]}
    # Every economy is either in countries or in missing, once.
    iso3 = [c["iso3"] for c in doc["countries"]] + [m["iso3"] for m in doc["missing"]]
    assert len(iso3) == len(set(iso3)) == 217
    assert len(doc["countries"]) == 178
    assert all(c["series"][-1] == [c["year"], c["value"]] for c in doc["countries"])


# --- Ports (S23, S36) -----------------------------------------------------------------------------


def test_port_tonnage_matches_port0499(built, port0499) -> None:
    doc = _load(built, "ports.json")
    by_name = {p["name"]: p for p in doc["ports"]}
    assert len(by_name) == 51 and doc["years"] == list(range(2015, 2026))
    expected = defaultdict(float)
    for year, port, region, _c, direction, group, category, _d, kt in port0499:
        if year == 2025:
            expected[(port, direction)] += kt
            if direction == "Inwards":
                expected[(port, "group", group)] += kt
                if category == 23:
                    expected[(port, "agri", region)] += kt
    for name in ("Dover", "Felixstowe", "Belfast", "Liverpool", "London", "Holyhead"):
        p = by_name[name]
        inwards = sum(v[-1] for v in p["inwardsByRegion"].values())
        assert inwards == pytest.approx(expected[(name, "Inwards")], abs=0.01)
        assert sum(v[-1] for v in p["inwardsByGroup"].values()) == pytest.approx(inwards, abs=0.01)
        assert p["outwards"][-1] == pytest.approx(expected[(name, "Outwards")], abs=0.001)
    liverpool = by_name["Liverpool"]["agriculturalInwardsByRegion"]
    assert liverpool["America"][-1] == pytest.approx(expected[("Liverpool", "agri", "America")], abs=0.001)
    # Dover's inward freight is almost all roll-on/roll-off; DfT records no agricultural dry bulk there.
    dover = by_name["Dover"]
    assert sum(v[-1] for v in dover["agriculturalInwardsByRegion"].values()) == 0
    ro_ro = dover["inwardsByGroup"]["Ro-Ro Self Propelled"][-1] + dover["inwardsByGroup"]["Ro-Ro Non-Self Propelled"][-1]
    assert ro_ro / sum(v[-1] for v in dover["inwardsByGroup"].values()) > 0.95


def test_port_totals_reconcile_with_port0304(built) -> None:
    qa = json.loads((built[1] / f"risk-qa-{SNAPSHOT}.json").read_text(encoding="utf-8"))
    assert qa["ports"]["reconciledWithPort0304"] == 33
    doc = _load(built, "ports.json")
    felixstowe = next(p for p in doc["ports"] if p["name"] == "Felixstowe")
    total = sum(v[-1] for v in felixstowe["inwardsByRegion"].values()) + felixstowe["outwards"][-1]
    assert total == pytest.approx(22690.1329953273, abs=0.01)  # PORT0304, Felixstowe 2025


def test_port_locations_come_from_dft_or_emodnet(built) -> None:
    doc = _load(built, "ports.json")
    by_name = {p["name"]: p for p in doc["ports"]}
    assert by_name["Aberdeen"]["location"]["source"] == "dft"
    assert by_name["Aberdeen"]["point"] == [-2.06349, 57.14361]
    assert by_name["Dover"]["location"]["source"] == "emodnet"
    assert by_name["Dover"]["point"] == [1.31748, 51.12309]
    assert "GISCO" in by_name["Dover"]["location"]["detail"]
    assert by_name["Loch Ryan"]["location"]["detail"].endswith("UN/LOCODE)")
    assert all(p["point"] is not None for p in doc["ports"])
    assert {p["nation"] for p in doc["ports"]} == {"England", "Wales", "Scotland", "Northern Ireland"}


# --- Port of entry (S03) --------------------------------------------------------------------------


def test_port_of_entry_values_as_published(built) -> None:
    doc = _load(built, "port-entry.json")
    entry = doc["portOfEntry"]
    assert entry["years"] == [2022, 2023]
    groups = {g["label"]: g for g in entry["groups"]}
    assert groups["Dover/Folkestone/Eurotunnel"]["values"] == [18.09, 17.89]
    assert groups["Dover/Folkestone/Eurotunnel"]["locodes"] == ["GBDVR"]
    assert groups["No port recorded"]["values"] == [12.71, 12.75]
    for i in range(2):
        assert sum(g["values"][i] for g in entry["groups"]) == pytest.approx(100, abs=0.1)
    foods = doc["shortStraits"]["foods"]
    assert foods[0] == {"food": "Dairy", "values": [40.47, 42.2]}
    assert doc["srnDelay"]["months"][0] == "2015-04" and doc["srnDelay"]["monthly"][0] == 7.8
    assert doc["srnDelay"]["yearEnding"][:11] == [None] * 11  # no full year yet: kept as gaps


# --- Roads (S35) ----------------------------------------------------------------------------------


def test_roads_keep_every_extracted_corridor(built) -> None:
    doc = _load(built, "roads.geojson")
    raw = json.loads((RAW / "os" / SNAPSHOT / "open-roads-strategic.geojson").read_text(encoding="utf-8"))
    assert len(doc["features"]) == len(raw["features"]) == 792
    roads = {(f["properties"]["category"], f["properties"]["road"]) for f in doc["features"]}
    assert ("strategic", "M6") in roads and ("strategic", "A1(M)") in roads


# --- Farming regions (S31, S33) -------------------------------------------------------------------


def test_farming_regions_values_as_published(built) -> None:
    doc = _load(built, "farming.json")
    regions = {r["name"]: r for r in doc["regions"]}
    assert len(regions) == 11
    assert regions["Wales"]["values"]["sheep"] == 8_813_021
    assert regions["Scotland"]["values"]["wheat"] == 108_256  # 108.256 thousand hectares
    assert regions["Northern Ireland"]["values"]["poultry"] == 25_785_289  # 25.785289 million birds
    assert regions["Eastern"]["values"]["wheat"] == 429_936
    assert regions["South East (incl. London)"]["itl1"] == ["TLI", "TLJ"]
    # Areas from the ITL1 service's Shape__Area (m²): North East 8,598,631,244.9 m²; SE + London summed.
    assert regions["North East"]["areaKm2"] == 8598.6
    assert regions["South East (incl. London)"]["areaKm2"] == round((1573280703.189888 + 19087171791.6891) / 1e6, 1)
    england = [r for r in doc["regions"] if r["nation"] == "England"]
    assert sum(r["values"]["sheep"] for r in england) == pytest.approx(13_312_071, abs=8)
    outlines = _load(built, "farming-regions.geojson")
    assert [f["properties"]["id"] for f in outlines["features"]] == [r["id"] for r in doc["regions"]]


# --- Priority Places by council (S13, S15, S32, S19) ----------------------------------------------


def _ppfi_raw() -> dict[str, dict]:
    path = RAW / "hasp-provided" / "ppfi-v2.1-lsoa-1.0.24" / "hasp_ppfi_v2.1.csv"
    with path.open(encoding="utf-8-sig", newline="") as fh:
        return {r["lsoa21cd"]: r for r in csv.DictReader(fh)}


def test_council_counts_match_the_index(built) -> None:
    doc = _load(built, "council-ppfi.json")
    councils = {c["code"]: c for c in doc["councils"]}
    assert len(councils) == 361
    raw = _ppfi_raw()
    # Glasgow: every 2011 Data Zone the Scottish lookup gives to Glasgow City.
    dz = read_dz11_lookup(RAW / "scotgov" / SNAPSHOT / "dz2011-lookup.csv")
    glasgow = [c for c, (la, _) in dz.items() if la == "S12000049"]
    assert councils["S12000049"]["areas"] == len(glasgow) == 746
    assert councils["S12000049"]["values"]["combined"]["priority"] == sum(
        raw[c]["pp_dec_combined"] in ("1", "2") for c in glasgow)
    # Manchester (the Stage 5 deep profile) has 295 LSOAs; Belfast 174 SOAs, none in NI's decile 1.
    assert councils["E08000003"]["areas"] == 295
    assert councils["N09000003"]["areas"] == 174 and councils["N09000003"]["combinedDeciles"][0] == 0
    # Northern Ireland: three domains without data are null, never zero.
    for code in (c for c in councils if c.startswith("N")):
        values = councils[code]["values"]
        assert values["supermarket_accessibility"] is None and values["ecommerce_access"] is None
        assert values["fuel_poverty"] is None and values["combined"] is not None
    nations = {n["nation"]: n for n in doc["nations"]}
    assert {n: v["areas"] for n, v in nations.items()} == {"England": 33_755, "Wales": 1_917, "Scotland": 6_976,
                                                            "Northern Ireland": 890}
    assert all(sum(c["combinedDeciles"]) == c["areas"] for c in councils.values())


# --- Reader guards --------------------------------------------------------------------------------


def test_dz_lookup_rejects_a_duplicate(tmp_path: Path) -> None:
    path = tmp_path / "dz.csv"
    path.write_text("DZ2011_Code,LA_Code,LA_Name,Country_Name\nS01000001,S12000001,A,Scotland\n"
                    "S01000001,S12000002,B,Scotland\n", encoding="cp1252")
    with pytest.raises(RiskInputError, match="listed twice"):
        read_dz11_lookup(path)
