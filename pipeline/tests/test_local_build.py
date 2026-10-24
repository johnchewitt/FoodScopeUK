"""Offline rebuild of the committed local datasets from the committed raw files.

Checks the figures recorded in the data-step report and that a rebuild reproduces the committed
outputs and reports byte for byte (they are never edited by hand).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from foodscope_pipeline.local import build_local, default_inputs

PIPELINE = Path(__file__).resolve().parents[1]
REPO = PIPELINE.parent
SNAPSHOT = "2026-10-24"


@pytest.fixture(scope="module")
def rebuilt(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    out = tmp_path_factory.mktemp("derived")
    reports = tmp_path_factory.mktemp("reports")
    build_local(SNAPSHOT, default_inputs(PIPELINE / "raw", PIPELINE / "foodscope_pipeline" / "config", SNAPSHOT),
                out, reports, REPO / "schemas")
    return out / SNAPSHOT, reports


def test_rebuild_matches_the_committed_outputs(rebuilt) -> None:
    out, reports = rebuilt
    committed = PIPELINE / "derived" / SNAPSHOT
    names = sorted(p.name for p in committed.iterdir())
    assert names == sorted(p.name for p in out.iterdir())
    for name in names:
        assert (out / name).read_bytes() == (committed / name).read_bytes(), name
    for path in sorted(reports.iterdir()):
        assert path.read_bytes() == (PIPELINE / "reports" / path.name).read_bytes(), path.name


def test_store_accounting_and_rejects(rebuilt) -> None:
    _, reports = rebuilt
    steps = {s["step"]: s for s in json.loads((reports / f"local-accounting-{SNAPSHOT}.json").read_text())}
    assert steps["stores.read"]["rows_in"] == 19_299
    assign = steps["stores.assign_council"]
    assert (assign["rows_in"], assign["rows_out"]) == (19_299, 19_174)
    assert assign["rejects"] == {"Crown Dependency (Guernsey, Jersey or Isle of Man): outside UK councils": 125}
    assert steps["population.councils"]["rows_out"] == 361


def test_councils_population_and_demo_authorities(rebuilt) -> None:
    out, _ = rebuilt
    doc = json.loads((out / "lad-indicators.json").read_text())
    councils = {c["code"]: c for c in doc["councils"]}
    assert len(councils) == 361
    assert sum(c["population"] for c in councils.values()) == 69_483_939  # ONS UK total, mid-2025
    assert councils["N09000003"]["name"] == "Belfast" and sum(councils["N09000003"]["stores"]) == 142
    assert councils["E08000003"]["name"] == "Manchester" and sum(councils["E08000003"]["stores"]) == 152
    assert councils["E08000038"]["note"].startswith("Population and land area are ONS figures for Barnsley")
    assert sum(sum(c["stores"]) for c in councils.values()) == 19_174


def test_boundaries_and_stores_are_complete(rebuilt) -> None:
    out, _ = rebuilt
    boundaries = json.loads((out / "lad-2025-uk.geojson").read_text())
    assert len(boundaries["features"]) == 361
    assert {f["properties"]["nation"] for f in boundaries["features"]} == {"England", "Wales", "Scotland", "Northern Ireland"}
    stores = json.loads((out / "stores.geojson").read_text())
    assert len(stores["features"]) == 19_174
    nearest = [f["properties"]["id"] for f in stores["features"] if f["properties"]["councilMatch"] == "nearest"]
    assert nearest == [1010018039, 1010018076]
    from_bng = [f["properties"]["id"] for f in stores["features"] if f["properties"]["coordinateSource"] == "bng"]
    assert from_bng == [1010001979]
