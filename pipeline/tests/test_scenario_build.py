"""Stage 7 Scenario Lab inputs: small areas, supermarkets and each area's nearest supermarkets (S11, S15–S19, S32)."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np
import pytest

from foodscope_pipeline.scenario import (
    EXPECTED,
    ScenarioBuildError,
    build_scenario,
    default_inputs,
    nearest_k,
    read_dz22_councils,
    read_scotland_centroids,
)

PIPELINE = Path(__file__).resolve().parents[1]
REPO = PIPELINE.parent
RAW = PIPELINE / "raw"
DATA = REPO / "public" / "data"
SNAPSHOT, RAW_SNAPSHOT, STAGE6, REFERENCE, LOCAL = "2026-10-26", "2026-10-26", "2026-10-25", "2026-10-24", "2026-10-24"


def _inputs(**overrides):
    inputs = default_inputs(RAW, DATA, RAW_SNAPSHOT, STAGE6, REFERENCE, LOCAL)
    return inputs.__class__(**{**inputs.__dict__, **overrides})


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    out = tmp_path_factory.mktemp("data")
    reports = tmp_path_factory.mktemp("reports")
    build_scenario(SNAPSHOT, _inputs(), out, reports, REPO / "schemas")
    return out / "snapshots" / SNAPSHOT / "scenario", reports


@pytest.fixture(scope="module")
def gb(built) -> dict:
    return json.loads((built[0] / "closure-gb.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def ni(built) -> dict:
    return json.loads((built[0] / "closure-ni.json").read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------------------------
# nearest_k (pure; synthetic points)


def _brute(area_xy, store_xy, k):
    out = []
    for a in area_xy:
        d = np.hypot(store_xy[:, 0] - a[0], store_xy[:, 1] - a[1])
        order = sorted(range(len(store_xy)), key=lambda j: (d[j], j))[:k]
        out.append((order, [d[j] for j in order]))
    return out


def test_nearest_k_matches_brute_force_on_random_points():
    rng = np.random.default_rng(1)
    areas = rng.uniform(0, 10_000, (1_234, 2))  # more than one block
    stores = rng.uniform(0, 10_000, (97, 2))
    idx, dist = nearest_k(areas, stores, 3)
    for i, (order, d) in enumerate(_brute(areas, stores, 3)):
        assert idx[i].tolist() == order
        assert np.allclose(dist[i], d)


def test_nearest_k_orders_equal_distances_by_store_index():
    # Stores 0, 1 and 2 at the same point; store 3 the same distance away on the other side.
    stores = np.array([[10.0, 0.0], [10.0, 0.0], [-10.0, 0.0], [10.0, 0.0], [50.0, 0.0]])
    idx, dist = nearest_k(np.array([[0.0, 0.0]]), stores, 3)
    assert idx[0].tolist() == [0, 1, 2]
    assert dist[0].tolist() == [10.0, 10.0, 10.0]


def test_nearest_k_with_fewer_stores_than_k_and_empty_inputs():
    idx, dist = nearest_k(np.array([[0.0, 0.0]]), np.array([[3.0, 4.0]]), 3)
    assert idx[0].tolist() == [0, -1, -1]
    assert dist[0, 0] == 5.0 and np.isnan(dist[0, 1:]).all()
    idx, dist = nearest_k(np.array([[0.0, 0.0]]), np.empty((0, 2)), 3)
    assert idx[0].tolist() == [-1, -1, -1]
    idx, dist = nearest_k(np.empty((0, 2)), np.array([[1.0, 1.0]]), 3)
    assert idx.shape == (0, 3)


def test_nearest_k_zero_distance_when_a_store_is_on_the_centroid():
    idx, dist = nearest_k(np.array([[5.0, 5.0]]), np.array([[9.0, 5.0], [5.0, 5.0]]), 2)
    assert idx[0].tolist() == [1, 0] and dist[0].tolist() == [0.0, 4.0]


# ---------------------------------------------------------------------------------------------
# Readers (real cached files)


def test_scotland_centroids_are_the_7392_data_zones_of_2022_with_census_population():
    sc = read_scotland_centroids(RAW / "scotgov" / RAW_SNAPSHOT / "SG_DataZoneCent_2022.zip")
    assert len(sc) == EXPECTED["S"]
    assert all(code.startswith("S01") for code in sc)
    assert sc["S01013482"]["population"] == 969  # Culter - 01, the first row
    assert sum(a["population"] for a in sc.values()) == 5_439_565


def test_scotland_lookup_gives_every_2022_data_zone_one_current_council():
    lookup = read_dz22_councils(RAW / "scotgov" / STAGE6 / "dz2022-lookup.csv")
    assert len(lookup) == EXPECTED["S"]
    assert len({lad for lad, _ in lookup.values()}) == 32
    assert lookup["S01013482"] == ("S12000033", "Culter - 01")


# ---------------------------------------------------------------------------------------------
# Build


def test_build_matches_the_committed_files(built):
    for name in ("closure-gb.json", "closure-ni.json", "closure-gb.provenance.json", "closure-ni.provenance.json"):
        committed = DATA / "snapshots" / SNAPSHOT / "scenario" / name
        assert hashlib.sha256((built[0] / name).read_bytes()).hexdigest() == \
            hashlib.sha256(committed.read_bytes()).hexdigest(), name


def test_every_small_area_of_the_uk_once_with_its_councils_nation(gb, ni):
    codes = gb["areas"]["code"] + ni["areas"]["code"]
    assert len(codes) == len(set(codes)) == sum(EXPECTED.values())
    for doc in (gb, ni):
        for code, c in zip(doc["areas"]["code"], doc["areas"]["council"], strict=True):
            assert doc["councils"][c][0] == code[0]
    assert {c[0] for c in ni["councils"]} == {"N"}
    assert len(gb["councils"]) == 350 and len(ni["councils"]) == 11


def test_columns_have_one_entry_per_store_and_per_area(gb, ni):
    for doc in (gb, ni):
        n_stores = len(doc["stores"]["id"])
        n_areas = len(doc["areas"]["code"])
        assert all(len(v) == n_stores for v in doc["stores"].values())
        assert all(len(v) == n_areas for v in doc["areas"].values())
        assert all(len(r) == doc["k"] for r in doc["areas"]["nearest"])


def test_supermarkets_are_class_supermarket_in_a_uk_council(gb, ni):
    stores = json.loads((DATA / "snapshots" / LOCAL / "local" / "stores.geojson").read_text(encoding="utf-8"))
    expected = {f["properties"]["id"] for f in stores["features"]
                if f["properties"]["storeClass"] == "supermarket" and f["properties"]["lad"]}
    assert set(gb["stores"]["id"]) | set(ni["stores"]["id"]) == expected
    assert len(gb["stores"]["id"]) == 6_987 and len(ni["stores"]["id"]) == 186


def test_nearest_supermarkets_are_exact_in_the_national_grid(gb, ni):
    # Recompute for every area from the published grid coordinates (rounded to the metre).
    for doc in (gb, ni):
        sx, sy = np.array(doc["stores"]["x"], float), np.array(doc["stores"]["y"], float)
        for i in range(0, len(doc["areas"]["code"]), 97):
            d = np.hypot(sx - doc["areas"]["x"][i], sy - doc["areas"]["y"][i])
            listed = doc["areas"]["nearest"][i]
            assert np.allclose(d[listed], doc["areas"]["distance"][i], atol=1.5)
            assert doc["areas"]["distance"][i] == sorted(doc["areas"]["distance"][i])
            assert d.min() >= d[listed[0]] - 1.5


def test_nearest_can_be_beyond_the_council_boundary(gb):
    areas, stores = gb["areas"], gb["stores"]
    beyond = sum(1 for i, j in enumerate(r[0] for r in areas["nearest"])
                 if stores["council"][j] != areas["council"][i])
    assert beyond == 3_096


def test_population_as_published_and_deciles_only_in_england(gb, ni, built):
    qa = json.loads((built[1] / f"scenario-qa-{SNAPSHOT}.json").read_text(encoding="utf-8"))
    assert qa["populationAgainstPublished"] == {
        "E": {"smallAreas": 56_490_056, "published": 56_490_048, "difference": 8},
        "W": {"smallAreas": 3_107_545, "published": 3_107_494, "difference": 51},
        "N": {"smallAreas": 1_903_168, "published": 1_903_175, "difference": -7},
    }
    assert qa["population"]["S"] == 5_439_565
    assert gb["census"] == {"E": 2021, "S": 2022, "W": 2021} and ni["census"] == {"N": 2021}
    deciles = dict(zip(gb["areas"]["code"], gb["areas"]["decile"], strict=True))
    assert all((d is not None) == code.startswith("E") for code, d in deciles.items())
    assert all(d is None for d in ni["areas"]["decile"])


def test_provenance_names_the_sources_and_says_straight_line(built):
    for part, sources in (("gb", ["S11", "S15", "S17", "S18", "S19", "S32"]), ("ni", ["S11", "S16", "S18"])):
        prov = json.loads((built[0] / f"closure-{part}.provenance.json").read_text(encoding="utf-8"))
        assert prov["sourceIds"] == sources
        assert prov["provenance"] == "derived"
        assert "straight-line" in prov["retrieval"]["notes"] and "not travel times" in prov["retrieval"]["notes"]
        assert "GEOLYTIX" in prov["attribution"]


def test_a_missing_lookup_row_stops_the_build(tmp_path):
    src = RAW / "scotgov" / STAGE6
    dst = tmp_path / "scotgov"
    dst.mkdir()
    lines = (src / "dz2022-lookup.csv").read_bytes().splitlines(keepends=True)
    (dst / "dz2022-lookup.csv").write_bytes(b"".join(lines[:-1]))  # drop the last Data Zone
    index = json.loads((src / "index.json").read_text(encoding="utf-8"))
    for e in index["files"]:
        if e["file"] == "dz2022-lookup.csv":
            data = (dst / e["file"]).read_bytes()
            e["sha256"], e["bytes"] = hashlib.sha256(data).hexdigest(), len(data)
        else:
            (dst / e["file"]).write_bytes((src / e["file"]).read_bytes())
    (dst / "index.json").write_text(json.dumps(index), encoding="utf-8")
    with pytest.raises(ScenarioBuildError, match="Scottish Data Zones differ"):
        build_scenario(SNAPSHOT, _inputs(scotgov_lookup=dst), tmp_path / "out", tmp_path / "reports",
                       REPO / "schemas")
