"""Gate G3: the sixteen baskets against Defra's trade codes (S05), on the committed files."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from foodscope_pipeline.basket_codes import BasketCodesError, _code9, check_baskets, read_defra_codes
from foodscope_pipeline.cli import CONFIG, RAW, REPORTS
from foodscope_pipeline.publish import DATA_DIR
from foodscope_pipeline.sources.hmrc_ots import load_baskets

SNAPSHOT, DEFRA = "2026-10-26", "2026-10-26"
ODS = RAW / "defra" / DEFRA / "Defra-trade-codes-and-descriptions-15nov22.ods"


@pytest.fixture(scope="module")
def report(tmp_path_factory: pytest.TempPathFactory) -> dict:
    out = tmp_path_factory.mktemp("reports")
    doc = check_baskets(SNAPSHOT, load_baskets(CONFIG / "trade_baskets.json"), ODS,
                        DATA_DIR / "snapshots" / SNAPSHOT / "trade", out)
    # The committed report is this run's output.
    assert (out / f"basket-codes-{SNAPSHOT}.json").read_bytes() == (REPORTS / f"basket-codes-{SNAPSHOT}.json").read_bytes()
    return {b["basket"]: b for b in doc["baskets"]} | {"_doc": doc}


def test_codes_keep_their_leading_zeros() -> None:
    assert _code9(70200000.0) == "070200000"
    assert _code9("010110100") == "010110100"
    with pytest.raises(BasketCodesError):
        _code9(1.5)
    with pytest.raises(BasketCodesError):
        _code9("07a")


def test_defra_table_structure() -> None:
    codes = read_defra_codes(ODS)
    assert len(codes) == 8031
    assert all(len(c.code9) == 9 and c.cn8 == c.code9[:8] for c in codes)


def test_every_basket_is_one_sitc_division(report) -> None:
    assert report["_doc"]["oneSitcDivisionEach"] is True
    divisions = {b: report[b]["defra"]["sitcDivisions"][0]["code"] for b in report if b != "_doc"}
    assert divisions["beef"] == divisions["sheep-goat"] == divisions["poultry"] == "01"
    assert divisions["milk-products"] == divisions["cheese"] == "02"
    assert divisions["wheat"] == divisions["rice"] == "04"
    assert divisions["sugar"] == "06" and divisions["coffee"] == divisions["cocoa"] == "07"


def test_definitional_differences_are_the_known_ones(report) -> None:
    def outside(basket: str) -> set[str]:
        return {o["hs4"] for g in report[basket]["defra"]["groups"] for o in g["outsideBasket"]}

    # Stated in the basket definitions: instant coffee, cocoa shells and chocolate are left out.
    assert outside("coffee") == {"2101"}
    assert outside("cocoa") == {"1802", "1806"}
    # Defra groups goat meat with other meat (horse, offal, game), not with lamb and mutton.
    assert outside("sheep-goat") == {"0205", "0206", "0208"}
    assert outside("potatoes") == {"1108", "1903"}  # potatoes for starch
    for b in ("tomatoes", "strawberries", "apples", "oranges", "bananas", "wheat", "rice", "beef", "poultry",
              "milk-products", "cheese", "sugar"):
        assert outside(b) == set(), b


def test_non_indigenous_baskets_back_the_apps_statement(report) -> None:
    # src/content/domesticProduction.ts and national_production.json say Defra classes every code in these
    # baskets as non-indigenous.
    for b in ("oranges", "rice", "coffee", "cocoa", "bananas"):
        assert set(report[b]["defra"]["indigeneity"]) == {"Non-indigenous"}, b
    for b in ("beef", "sheep-goat", "poultry", "milk-products", "cheese", "sugar", "potatoes", "strawberries"):
        assert set(report[b]["defra"]["indigeneity"]) == {"Indigenous"}, b


def test_new_hmrc_codes_postdate_defras_table(report) -> None:
    new = {b: [c["firstMonth"] for c in report[b]["hmrcCodesWithImportsNotInDefra"]] for b in report if b != "_doc"}
    assert all(m >= "2023-01" for months in new.values() for m in months)
    assert new["tomatoes"] == ["2025-01", "2025-01"] and new["bananas"] == ["2024-01", "2024-01"]


def test_the_national_production_notes_match(report) -> None:
    production = json.loads((CONFIG / "national_production.json").read_text(encoding="utf-8"))
    notes = {b["basket"]: b.get("note", "") for b in production["baskets"]}
    for b in ("oranges", "rice", "coffee", "cocoa"):
        assert "non-indigenous" in notes[b]
