"""S12 comparison: council code mapping and aggregation, on obviously synthetic councils."""

from __future__ import annotations

import pytest

from foodscope_pipeline.benchmark import BenchmarkMappingError, compare, map_codes
from foodscope_pipeline.sources.ons_supermarkets import SIZE_BANDS, TYPES, S12Row


def row(code: str, total: int, per_10k: float | None = 1.0) -> S12Row:
    return S12Row(code=code, name=f"Council {code}", total=total, per_10k=per_10k, people_per_store=None,
                  by_size_band={b: (total if i == 0 else 0) for i, b in enumerate(SIZE_BANDS)},
                  by_type={t: (total if i == 0 else 0) for i, t in enumerate(TYPES)})


LAD25 = {"A", "M", "N"}
LOOKUP = {"A": "A", "X1": "M", "X2": "M"}  # 2023 merger: X1 + X2 → M
CHANGES = {"OLD": "N"}  # 2025 code change: OLD → N


def test_map_codes_handles_same_merger_change_and_no_council() -> None:
    m = map_codes(["A", "X1", "X2", "OLD", "L99999999", "M99999999"], LAD25, LOOKUP, CHANGES)
    assert m.to_lad25 == {"A": "A", "X1": "M", "X2": "M", "OLD": "N"}
    assert m.how == {"A": "same code", "X1": "2023 merger", "X2": "2023 merger", "OLD": "2025 code change"}


def test_map_codes_refuses_an_unknown_council() -> None:
    with pytest.raises(BenchmarkMappingError, match="Q9 has no May 2025 council"):
        map_codes(["Q9"], LAD25, LOOKUP, CHANGES)


def test_compare_adds_merged_councils_and_counts_every_store() -> None:
    s12 = {"A": row("A", 4), "X1": row("X1", 2), "X2": row("X2", 3), "OLD": row("OLD", 5), "L99999999": row("L99999999", 7)}
    code_map = map_codes(list(s12), LAD25, LOOKUP, CHANGES)
    stores = ["A", "A", "A", "A", "A", "M", "M", "M", "M", "M", None]  # the last store is outside UK councils
    out = compare(s12, code_map, {"A": "A", "M": "M", "N": "N"}, store_lad=stores,
                  store_band_value=[SIZE_BANDS[0]] * len(stores), store_fascia=["Aldi"] * len(stores),
                  crown_by_area={"JE": 1}, population={"A": 10_000, "M": 20_000, "N": None})
    by = {r["code"]: r for r in out["councils"]}
    assert (by["A"]["ours"], by["A"]["s12"], by["A"]["differencePct"]) == (5, 4, 25.0)
    assert (by["M"]["ours"], by["M"]["s12"], by["M"]["s12Codes"]) == (5, 5, ["X1", "X2"])
    assert by["M"]["s12Per10k"] is None  # not comparable for merged councils
    assert by["A"]["oursPer10k"] == 5.0 and by["A"]["s12Per10k"] == 1.0
    assert (by["N"]["ours"], by["N"]["s12"], by["N"]["oursPer10k"]) == (0, 5, None)
    assert out["summary"]["ours"] == 10 and out["summary"]["s12"] == 14
    assert out["crownDependencies"][0] == {"s12Code": "L99999999", "name": "Channel Islands", "s12": 7,
                                           "oursRejected": 1, "postcodeAreas": ["GY", "JE"]}
    assert {t["type"]: t["ours"] for t in out["byRetailerType"]}["Discounter"] == 10
