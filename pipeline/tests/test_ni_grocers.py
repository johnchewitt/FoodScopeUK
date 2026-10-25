"""Northern Ireland grocers missing from GEOLYTIX, from the FSA register (S29): rules, determinism, QA."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from foodscope_pipeline.ni_grocers import NiGrocersError, build_ni_grocers, default_inputs, read_register

PIPELINE = Path(__file__).resolve().parents[1]
REPO = PIPELINE.parent
SNAPSHOT = "2026-10-24"
CONFIG = PIPELINE / "foodscope_pipeline" / "config"


def _build(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    out = tmp_path_factory.mktemp("data")
    reports = tmp_path_factory.mktemp("reports")
    build_ni_grocers(SNAPSHOT, default_inputs(PIPELINE / "raw", CONFIG, REPO / "public" / "data", SNAPSHOT, SNAPSHOT),
                     out, reports, REPO / "schemas")
    return out / "snapshots" / SNAPSHOT / "register", reports


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    return _build(tmp_path_factory)


@pytest.fixture(scope="module")
def grocers(built) -> list[dict]:
    return json.loads((built[0] / "ni-other-grocers.geojson").read_text(encoding="utf-8"))["features"]


def test_two_builds_are_identical_and_the_report_is_committed(built, tmp_path_factory) -> None:
    out, reports = built
    again, reports_again = _build(tmp_path_factory)
    for path in sorted(out.iterdir()):
        assert path.read_bytes() == (again / path.name).read_bytes(), path.name
    report = reports / f"ni-grocers-qa-{SNAPSHOT}.json"
    assert report.read_bytes() == (reports_again / report.name).read_bytes()
    assert report.read_bytes() == (PIPELINE / "reports" / report.name).read_bytes()


def test_counts(built, grocers) -> None:
    qa = json.loads((built[1] / f"ni-grocers-qa-{SNAPSHOT}.json").read_text(encoding="utf-8"))
    assert qa["establishments"] == 16_983
    assert qa["published"] == len(grocers) == 285
    assert qa["kept"] == {"costcutter": 24, "independent": 64, "mace": 55, "nisa": 25, "premier": 11,
                          "supervalu": 30, "vivo": 76}
    assert qa["byCouncil"]["N09000003"] == 41  # Belfast
    assert sum(qa["byCouncil"].values()) == 285 and len(qa["byCouncil"]) == 11


def test_no_chain_that_geolytix_maps_is_added_twice(grocers) -> None:
    rules = json.loads((CONFIG / "ni_grocers.json").read_text(encoding="utf-8"))
    chains = re.compile("|".join(r"(?<![a-z])" + re.escape(c) + r"(?![a-z])" for c in rules["chainsCarriedByGeolytix"]))
    for g in grocers:
        p = g["properties"]
        if p["kind"] == "independent":
            assert not chains.search(p["name"].lower()), p["name"]
            assert p["fsaType"] == "Retailers - supermarkets/hypermarkets"
            assert p["group"] is None
        else:
            assert p["group"] in {"SuperValu", "Mace", "Vivo", "Costcutter", "Nisa", "Premier"}


def test_every_grocer_is_in_northern_ireland(grocers) -> None:
    for g in grocers:
        lon, lat = g["geometry"]["coordinates"]
        assert -8.3 < lon < -5.3 and 54.0 < lat < 55.4, g["properties"]["name"]
        assert g["properties"]["lad"].startswith("N09")


def test_the_register_reader_checks_each_file(tmp_path: Path) -> None:
    folder = tmp_path / "fsa"
    folder.mkdir()
    (folder / "index.json").write_text(json.dumps({"schemaVersion": 1, "files": []}), encoding="utf-8")
    with pytest.raises(NiGrocersError, match="not in"):
        read_register(folder)
