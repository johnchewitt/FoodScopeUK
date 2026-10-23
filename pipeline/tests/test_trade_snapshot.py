"""Checks on the committed HMRC trade snapshot, rebuilt from the committed raw responses.

The raw cache in pipeline/raw/hmrc/<snapshot>/ holds the real API responses retrieved on
23 Oct 2026 (see its index.json for URLs and timestamps), so these tests need no network.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from foodscope_pipeline.cli import CONFIG, POINTS, RAW_HMRC
from foodscope_pipeline.publish import DATA_DIR
from foodscope_pipeline.sources.hmrc_ots import RawCache, load_baskets
from foodscope_pipeline.trade import build_trade

SNAPSHOT = "2026-10-23"
BASKETS = load_baskets(CONFIG / "trade_baskets.json")


@pytest.fixture(scope="module")
def rebuilt(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    out = tmp_path_factory.mktemp("rebuild")
    build_trade(SNAPSHOT, RAW_HMRC, out / "data", out / "reports", BASKETS, POINTS, CONFIG / "hmrc_country_crosswalk.json")
    return out / "data", out / "reports"


def test_raw_cache_checksums_hold() -> None:
    cache = RawCache(RAW_HMRC / SNAPSHOT)
    assert cache.meta["latestMonthId"] == 202608
    for name in cache.entries:
        cache.body(name)  # raises if a cached response no longer matches its recorded SHA-256


@pytest.mark.parametrize("basket", [b.id for b in BASKETS])
def test_committed_snapshot_rebuilds_byte_identically(rebuilt: tuple[Path, Path], basket: str) -> None:
    data_dir, _ = rebuilt
    rel = Path("snapshots") / SNAPSHOT / "trade"
    for name in (f"{basket}.json", f"{basket}.provenance.json", "index.json"):
        assert (data_dir / rel / name).read_bytes() == (DATA_DIR / rel / name).read_bytes(), name


def test_reconciliation_against_raw_rows_matches_exactly(rebuilt: tuple[Path, Path]) -> None:
    _, reports = rebuilt
    report = json.loads((reports / f"hmrc-reconciliation-{SNAPSHOT}.json").read_text())
    assert report["allMatch"] is True
    assert {c["basket"] for c in report["checks"]} == {b.id for b in BASKETS}
    tomatoes = next(c for c in report["checks"] if c["basket"] == "tomatoes")
    # January 2025, all partners, EU + non-EU flows (HMRC API, retrieved 23 Oct 2026).
    assert tomatoes["month"] == "2025-01"
    assert tomatoes["netMassKg"] == {"aggregate": 33_060_038, "raw": 33_060_038}
    assert tomatoes["valueGbp"] == {"aggregate": 57_382_707, "raw": 57_382_707}


def test_snapshot_totals_equal_the_raw_aggregation() -> None:
    """Row accounting end to end: every kg in the API aggregate appears in the snapshot."""
    cache = RawCache(RAW_HMRC / SNAPSHOT)
    for basket in BASKETS:
        raw = cache.items(f"ots-aggregate-{basket.id}")
        snap = json.loads((DATA_DIR / "snapshots" / SNAPSHOT / "trade" / f"{basket.id}.json").read_text())
        raw_kg = sum(int(r["SumNetMass"]) for r in raw if int(r["SuppressionIndex"]) == 0)
        raw_gbp = sum(int(r["SumValue"]) for r in raw if int(r["SuppressionIndex"]) == 0)
        assert sum(r[2] for r in snap["rows"]) == raw_kg, basket.id
        assert sum(r[3] for r in snap["rows"]) == raw_gbp, basket.id
        suppressed_rows = [r for r in raw if int(r["SuppressionIndex"]) > 0]
        assert len(snap["suppressed"]) <= len(suppressed_rows)


def test_every_partner_is_crosswalked_or_explicitly_unmapped() -> None:
    for basket in BASKETS:
        snap = json.loads((DATA_DIR / "snapshots" / SNAPSHOT / "trade" / f"{basket.id}.json").read_text())
        for p in snap["partners"]:
            if p["kind"] == "country":
                assert p["iso2"] == p["key"]
                assert (p["point"] is None) == (p["geometry"] == "none")
            else:
                assert p["key"].startswith("hmrc-") and p["geometry"] == "none"
