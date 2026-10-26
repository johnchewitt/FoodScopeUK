"""Checks on the committed HMRC trade snapshots, rebuilt from the committed raw responses.

Each raw cache in pipeline/raw/hmrc/<snapshot>/ holds the real API responses (see its index.json
for URLs and timestamps), so these tests need no network. 2026-10-23 holds the five Stage 2
baskets; 2026-10-26 all sixteen of spec §6.1 (John, 26 Oct 2026). Every committed snapshot is
rebuilt for the baskets in its own cache; the index is compared only where the cache holds every
basket in the configuration.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from foodscope_pipeline.cli import CONFIG, POINTS, RAW_HMRC
from foodscope_pipeline.publish import DATA_DIR
from foodscope_pipeline.sources.hmrc_ots import HmrcError, RawCache, load_baskets, load_groups
from foodscope_pipeline.trade import build_trade

SNAPSHOT = "2026-10-23"  # Stage 2's snapshot: the figures fixed by STAGE2_FINGERPRINTS below
ALL_BASKETS = load_baskets(CONFIG / "trade_baskets.json")
GROUPS = load_groups(CONFIG / "trade_baskets.json")
SNAPSHOTS = sorted(
    d.name for d in RAW_HMRC.iterdir()
    if (d / "index.json").is_file() and (DATA_DIR / "snapshots" / d.name / "trade" / "index.json").is_file()
)


def cached_baskets(snapshot: str) -> list:
    cache = RawCache(RAW_HMRC / snapshot)
    out = []
    for b in ALL_BASKETS:
        try:
            cache.parts(f"ots-aggregate-{b.id}")
        except HmrcError:
            continue
        out.append(b)
    return out


BASKETS = cached_baskets(SNAPSHOT)
PAIRS = [(s, b.id) for s in SNAPSHOTS for b in cached_baskets(s)]


def is_complete(snapshot: str) -> bool:
    return len(cached_baskets(snapshot)) == len(ALL_BASKETS)


@pytest.fixture(scope="module")
def rebuilt_all(tmp_path_factory: pytest.TempPathFactory) -> dict[str, tuple[Path, Path]]:
    out: dict[str, tuple[Path, Path]] = {}
    for snapshot in SNAPSHOTS:
        root = tmp_path_factory.mktemp(f"rebuild-{snapshot}")
        build_trade(snapshot, RAW_HMRC, root / "data", root / "reports", cached_baskets(snapshot), POINTS,
                    CONFIG / "hmrc_country_crosswalk.json", groups=GROUPS if is_complete(snapshot) else None)
        out[snapshot] = (root / "data", root / "reports")
    return out


@pytest.fixture(scope="module")
def rebuilt(rebuilt_all: dict[str, tuple[Path, Path]]) -> tuple[Path, Path]:
    return rebuilt_all[SNAPSHOT]


def test_there_is_a_complete_snapshot_or_only_the_stage2_one() -> None:
    assert SNAPSHOT in SNAPSHOTS
    assert all(is_complete(s) for s in SNAPSHOTS if s != SNAPSHOT)


@pytest.mark.parametrize("snapshot", SNAPSHOTS)
def test_raw_cache_checksums_hold(snapshot: str) -> None:
    cache = RawCache(RAW_HMRC / snapshot)
    assert cache.meta["latestMonthId"] >= 202608
    for name in cache.entries:
        cache.body(name)  # raises if a cached response no longer matches its recorded SHA-256


@pytest.mark.parametrize(("snapshot", "basket"), PAIRS)
def test_committed_snapshot_rebuilds_byte_identically(rebuilt_all, snapshot: str, basket: str) -> None:
    data_dir, _ = rebuilt_all[snapshot]
    rel = Path("snapshots") / snapshot / "trade"
    for name in (f"{basket}.json", f"{basket}.provenance.json"):
        assert (data_dir / rel / name).read_bytes() == (DATA_DIR / rel / name).read_bytes(), name


@pytest.mark.parametrize("snapshot", SNAPSHOTS)
def test_committed_index_rebuilds_byte_identically(rebuilt_all, snapshot: str) -> None:
    if not is_complete(snapshot):
        pytest.skip(f"{snapshot} caches {len(cached_baskets(snapshot))} of {len(ALL_BASKETS)} baskets; its index predates the others")
    data_dir, _ = rebuilt_all[snapshot]
    rel = Path("snapshots") / snapshot / "trade"
    for name in ("index.json", "index.provenance.json"):
        assert (data_dir / rel / name).read_bytes() == (DATA_DIR / rel / name).read_bytes(), name


@pytest.mark.parametrize("snapshot", SNAPSHOTS)
def test_reconciliation_against_raw_rows_matches_exactly(rebuilt_all, snapshot: str) -> None:
    _, reports = rebuilt_all[snapshot]
    report = json.loads((reports / f"hmrc-reconciliation-{snapshot}.json").read_text())
    assert report["allMatch"] is True
    assert {c["basket"] for c in report["checks"]} == {b.id for b in cached_baskets(snapshot)}
    assert all(c["rawRows"] > 0 for c in report["checks"])
    if snapshot == SNAPSHOT:
        tomatoes = next(c for c in report["checks"] if c["basket"] == "tomatoes")
        # January 2025, all partners, EU + non-EU flows (HMRC API, retrieved 23 Oct 2026).
        assert tomatoes["month"] == "2025-01"
        assert tomatoes["netMassKg"] == {"aggregate": 33_060_038, "raw": 33_060_038}
        assert tomatoes["valueGbp"] == {"aggregate": 57_382_707, "raw": 57_382_707}


@pytest.mark.parametrize(("snapshot", "basket"), PAIRS)
def test_snapshot_totals_equal_the_raw_aggregation(snapshot: str, basket: str) -> None:
    """Row accounting end to end: every kg in the API aggregate appears in the snapshot."""
    cache = RawCache(RAW_HMRC / snapshot)
    raw = cache.part_items(f"ots-aggregate-{basket}")
    snap = json.loads((DATA_DIR / "snapshots" / snapshot / "trade" / f"{basket}.json").read_text())
    raw_kg = sum(int(r["SumNetMass"]) for r in raw if int(r["SuppressionIndex"]) == 0)
    raw_gbp = sum(int(r["SumValue"]) for r in raw if int(r["SuppressionIndex"]) == 0)
    assert sum(r[2] for r in snap["rows"]) == raw_kg
    assert sum(r[3] for r in snap["rows"]) == raw_gbp
    suppressed_rows = [r for r in raw if int(r["SuppressionIndex"]) > 0]
    assert len(snap["suppressed"]) <= len(suppressed_rows)


@pytest.mark.parametrize(("snapshot", "basket"), PAIRS)
def test_every_partner_is_crosswalked_or_explicitly_unmapped(snapshot: str, basket: str) -> None:
    snap = json.loads((DATA_DIR / "snapshots" / snapshot / "trade" / f"{basket}.json").read_text())
    for p in snap["partners"]:
        if p["kind"] == "country":
            assert p["iso2"] == p["key"]
            assert (p["point"] is None) == (p["geometry"] == "none")
        else:
            assert p["key"].startswith("hmrc-") and p["geometry"] == "none"


# ---------------------------------------------------------------------------------------------
# Stage 3: commodity-code history added without changing any Stage 2 figure
# ---------------------------------------------------------------------------------------------

# SHA-256 of the Stage 2 content (months, partners, rows, suppressed, nil months, flows, units and
# the commodity definition with its CN8 codes), computed from the files merged in PR #3 before the
# code history was added. If any figure changed, these fail.
STAGE2_FINGERPRINTS = {
    "tomatoes": "07e29686f81e678df0d9b5c8b46cd8a79d2b27d6072532115ec9d15ff278928a",
    "strawberries": "c1865a76fa8621cf316fa0634e601acc0456a06ceaa0284d6e6568a9a8503b66",
    "bananas": "71b00e3e34c323ffc3ab6389b9f46d87006f7909931482006db462b9f555b495",
    "potatoes": "f48fc05c0ce67d4a30b47b079cfac4b3b446e5c754a570bf02dfa36cc0466cbc",
    "wheat": "5b8ac48cf45db35d72d83728b2a03ba2b6c9a262eab4d67ed0987122d44c76eb",
}


def _stage2_fingerprint(snap: dict) -> str:
    import hashlib

    core = {k: snap[k] for k in ["months", "partners", "rows", "suppressed", "nilMonths", "flows", "units"]}
    c = snap["commodity"]
    core["commodity"] = {k: c[k] for k in ["id", "label", "definition", "hsScope"]}
    core["commodity"]["cn8"] = [{k: x[k] for k in ["code", "commodityId", "description"]} for x in c["cn8"]]
    body = json.dumps(core, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(body.encode()).hexdigest()


@pytest.mark.parametrize(("snapshot", "basket"), [(s, b) for s in SNAPSHOTS for b in sorted(STAGE2_FINGERPRINTS)])
def test_stage2_figures_unchanged(rebuilt_all, snapshot: str, basket: str) -> None:
    # Holds in the sixteen-basket snapshot too: HMRC published nothing new between 23 and 26 Oct 2026,
    # and the five baskets' definitions did not change.
    data_dir, _ = rebuilt_all[snapshot]
    snap = json.loads((data_dir / "snapshots" / snapshot / "trade" / f"{basket}.json").read_text())
    assert _stage2_fingerprint(snap) == STAGE2_FINGERPRINTS[basket]


def _snap(basket: str) -> dict:
    return json.loads((DATA_DIR / "snapshots" / SNAPSHOT / "trade" / f"{basket}.json").read_text())


def test_code_changes_found_in_the_real_data() -> None:
    # Tomatoes: one code until Dec 2024, three from Jan 2025 (HMRC /OTS records, retrieved 23 Oct 2026).
    assert _snap("tomatoes")["codeChanges"] == [
        {"month": "2025-01", "ended": ["07020000"], "started": ["07020010", "07020091", "07020099"]}
    ]
    # Bananas: fresh bananas split from Jan 2024 (Plátano de Canarias recorded separately).
    assert _snap("bananas")["codeChanges"] == [
        {"month": "2024-01", "ended": ["08039010"], "started": ["08039011", "08039019"]}
    ]
    for basket in ("strawberries", "potatoes", "wheat"):
        assert _snap(basket)["codeChanges"] == [], basket


@pytest.mark.parametrize(("snapshot", "basket_id"), PAIRS)
def test_code_history_matches_the_rows(snapshot: str, basket_id: str) -> None:
    cache = RawCache(RAW_HMRC / snapshot)
    for basket in [b for b in ALL_BASKETS if b.id == basket_id]:
        snap = json.loads((DATA_DIR / "snapshots" / snapshot / "trade" / f"{basket.id}.json").read_text())
        raw = [r for r in cache.part_items(f"ots-aggregate-{basket.id}") if int(r["FlowTypeId"]) in (1, 3)]
        total_kg = sum(int(r["SumNetMass"]) for r in raw if int(r["SuppressionIndex"]) == 0)
        assert sum(sum(c["netMassKgByCalendarMonth"]) for c in snap["commodity"]["cn8"]) == total_kg
        for c in snap["commodity"]["cn8"]:
            months = sorted({int(r["MonthId"]) for r in raw if int(r["CommodityId"]) == c["commodityId"]})
            assert c["monthsRecorded"] == len(months)
            if months:
                assert c["firstMonth"] == f"{months[0] // 100}-{months[0] % 100:02d}"
                assert c["lastMonth"] == f"{months[-1] // 100}-{months[-1] % 100:02d}"
            else:
                assert c["firstMonth"] is None and c["lastMonth"] is None


def test_new_potatoes_code_is_seasonal() -> None:
    code = next(c for c in _snap("potatoes")["commodity"]["cn8"] if c["code"] == "07019050")
    assert "1 January to 30 June" in code["description"]
    kg = code["netMassKgByCalendarMonth"]
    assert sum(kg[:6]) / sum(kg) > 0.995  # recorded almost entirely January–June
    assert code["calendarMonths"] == [1, 2, 3, 4, 5, 6, 7, 12]
