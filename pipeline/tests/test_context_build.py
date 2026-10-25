"""Stage 5 context: urban/rural class and car availability per council, Defra UK production (S09, S10, S20, S21)."""

from __future__ import annotations

import csv
import io
import json
import zipfile
from pathlib import Path

import pytest

from foodscope_pipeline.context import ContextBuildError, build_context, default_inputs
from foodscope_pipeline.sources.ruc21 import LAD_CODES, Ruc21Error, read_ruc21

PIPELINE = Path(__file__).resolve().parents[1]
REPO = PIPELINE.parent
RAW = PIPELINE / "raw"
SNAPSHOT, REFERENCE, LOCAL = "2026-10-25", "2026-10-24", "2026-10-24"
CONFIG = PIPELINE / "foodscope_pipeline" / "config"


def _inputs(**overrides):
    inputs = default_inputs(RAW, CONFIG, REPO / "public" / "data", SNAPSHOT, REFERENCE, LOCAL)
    return inputs.__class__(**{**inputs.__dict__, **overrides})


def _build(tmp_path_factory: pytest.TempPathFactory, **overrides) -> tuple[Path, Path]:
    out = tmp_path_factory.mktemp("data")
    reports = tmp_path_factory.mktemp("reports")
    build_context(SNAPSHOT, _inputs(**overrides), out, reports, REPO / "schemas")
    return out / "snapshots" / SNAPSHOT / "context", reports


@pytest.fixture(scope="module")
def built(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    return _build(tmp_path_factory)


@pytest.fixture(scope="module")
def councils(built) -> dict[str, dict]:
    doc = json.loads((built[0] / "council-context.json").read_text(encoding="utf-8"))
    return {c["code"]: c for c in doc["councils"]}


@pytest.fixture(scope="module")
def production(built) -> dict[str, dict]:
    doc = json.loads((built[0] / "uk-production.json").read_text(encoding="utf-8"))
    return {c["basket"]: c for c in doc["commodities"]}


@pytest.fixture(scope="module")
def ts045_ltla() -> dict[str, list[str]]:
    with zipfile.ZipFile(RAW / "nomis" / REFERENCE / "census2021-ts045.zip") as z:
        rows = list(csv.reader(io.TextIOWrapper(z.open("census2021-ts045-ltla.csv"), encoding="utf-8-sig")))
    return {r[2]: r for r in rows[1:]}


def test_two_builds_are_identical_and_the_report_is_committed(built, tmp_path_factory) -> None:
    out, reports = built
    again, reports_again = _build(tmp_path_factory)
    for path in sorted(out.iterdir()):
        assert path.read_bytes() == (again / path.name).read_bytes(), path.name
    report = reports / f"context-qa-{SNAPSHOT}.json"
    assert report.read_bytes() == (reports_again / report.name).read_bytes()
    assert report.read_bytes() == (PIPELINE / "reports" / report.name).read_bytes()


def test_coverage_by_nation(councils) -> None:
    by_nation: dict[str, list[dict]] = {}
    for c in councils.values():
        by_nation.setdefault(c["nation"], []).append(c)
    assert {n: len(v) for n, v in by_nation.items()} == {"England": 296, "Wales": 22, "Scotland": 32,
                                                          "Northern Ireland": 11}
    for nation in ("England", "Wales"):
        assert all(c["urbanRural"] and c["carAvailability"] for c in by_nation[nation])
    # Absent, never filled in: no NI urban/rural class, nothing for Scotland.
    assert all(c["urbanRural"] is None and c["carAvailability"] for c in by_nation["Northern Ireland"])
    assert all(c["urbanRural"] is None and c["carAvailability"] is None for c in by_nation["Scotland"])


def test_values_match_the_sources(councils, ts045_ltla) -> None:
    man = councils["E08000003"]
    assert man["urbanRural"] == {"code": "UUN", "name": "Urban: Majority nearer to a major town or city",
                                 "flag": "Urban", "basis": None}
    raw = ts045_ltla["E08000003"]
    assert raw[1] == "Manchester"
    assert man["carAvailability"] == {"households": int(raw[3]), "noCar": int(raw[4]), "basis": None}
    # Belfast: NISRA LGD table (households = all six categories).
    assert councils["N09000003"]["carAvailability"]["households"] == 149_207
    assert councils["N09000003"]["carAvailability"]["noCar"] == 50_594


def test_boundary_changes_are_explicit(councils, ts045_ltla) -> None:
    cumberland = councils["E06000063"]["carAvailability"]
    parts = [ts045_ltla[c] for c in ("E07000026", "E07000028", "E07000029")]
    assert cumberland["households"] == sum(int(p[3]) for p in parts)
    assert cumberland["noCar"] == sum(int(p[4]) for p in parts)
    assert "Allerdale (E07000026), Carlisle (E07000028), Copeland (E07000029)" in cumberland["basis"]
    barnsley = councils["E08000038"]
    assert "E08000016" in barnsley["urbanRural"]["basis"] and "E08000016" in barnsley["carAvailability"]["basis"]
    assert barnsley["carAvailability"]["households"] == int(ts045_ltla["E08000016"][3])


def test_production_as_published(production) -> None:
    assert production["bananas"] == {"basket": "bananas", "status": "not_published",
                                     "note": "Defra publishes no UK production statistics for bananas."}
    m = {b: {x["key"]: x["value"] for x in production[b]["measures"]} for b in ("tomatoes", "strawberries", "potatoes", "wheat")}
    # Wheat 2025 (provisional), Table 7.2c: imports are the EU and rest-of-the-world rows added.
    assert production["wheat"]["year"] == 2025 and production["wheat"]["provisional"] is True
    assert m["wheat"]["production"] == 11_958 and m["wheat"]["imports"] == 1_930 + 744
    assert m["wheat"]["exports"] == 200 + 7 and m["wheat"]["totalSupply"] == 14_425
    assert m["wheat"]["productionShare"] == pytest.approx(82.9, abs=0.05)
    assert m["tomatoes"]["productionShare"] == pytest.approx(16.90, abs=0.01)
    assert m["strawberries"]["production"] == pytest.approx(92.899, abs=0.001)
    assert m["potatoes"]["productionShare"] == pytest.approx(71.09, abs=0.01)
    for b, v in m.items():
        assert v["totalSupply"] == pytest.approx(v["production"] + v["imports"] - v["exports"], abs=0.01), b
    assert [p["year"] for p in production["tomatoes"]["shareSeries"]] == list(range(2016, 2026))


def test_a_merger_in_the_code_changes_is_refused(tmp_path, tmp_path_factory) -> None:
    changes = json.loads((CONFIG / "lad_code_changes.json").read_text(encoding="utf-8"))
    changes["changes"].append({"from": "E07000001", "to": "E06000099", "name": "A", "effective": "2027",
                               "kind": "merger", "detail": "synthetic", "evidence": []})
    path = tmp_path / "changes.json"
    path.write_text(json.dumps(changes), encoding="utf-8")
    with pytest.raises(ContextBuildError, match="kinds not handled"):
        _build(tmp_path_factory, code_changes=path)


def test_ruc_reader_rejects_unknown_classes_and_duplicates(tmp_path) -> None:
    def page(rows: list[dict]) -> Path:
        p = tmp_path / f"p{len(list(tmp_path.iterdir()))}.json"
        p.write_text(json.dumps({"features": [{"attributes": r} for r in rows]}), encoding="utf-8")
        return p

    a = {"LAD24CD": "A", "RUC21CD": "UUN", "RUC21NM": "Urban", "Urban_rural_flag": "Urban"}
    assert read_ruc21([page([a])], "LAD24CD", LAD_CODES)["A"]["code"] == "UUN"
    with pytest.raises(Ruc21Error, match="appears twice"):
        read_ruc21([page([a, a])], "LAD24CD", LAD_CODES)
    with pytest.raises(Ruc21Error, match="class 'ZZZ'"):
        read_ruc21([page([{**a, "RUC21CD": "ZZZ"}])], "LAD24CD", LAD_CODES)
    with pytest.raises(Ruc21Error, match="without"):
        read_ruc21([page([{**a, "Urban_rural_flag": None}])], "LAD24CD", LAD_CODES)


def test_defra_readers_keep_unavailable_years_empty() -> None:
    from foodscope_pipeline.sources.defra_stats import read_auk_table, read_horticulture_supply

    auk = RAW / "defra" / SNAPSHOT / "AUK-chapter7-20260709.ods"
    table, provisional = read_auk_table(auk, "Table_7_2", "Table 7.2c")
    assert table[1973]["Production"] is None  # "[x]": not available, never zero
    assert provisional == {2025}
    hort = read_horticulture_supply(RAW / "defra" / SNAPSHOT / "hort-dataset-25-20260625.ods",
                                    "Table_23_Veg_Supply", "Tomatoes")
    assert min(hort) == 1988 and set(hort[2025]) == {"production", "imports", "exports", "totalSupply", "productionShare"}


def test_bbox_frames_each_council(councils) -> None:
    for c in councils.values():
        w, s, e, n = c["bbox"]
        assert -9 < w < e < 2.1 and 49 < s < n < 61, c["code"]
    w, s, e, n = councils["E08000003"]["bbox"]
    assert w < -2.24 < e and s < 53.48 < n  # Manchester city centre
    w, s, e, n = councils["N09000003"]["bbox"]
    assert w < -5.93 < e and s < 54.597 < n  # Belfast City Hall
