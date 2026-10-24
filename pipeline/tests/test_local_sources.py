"""Readers for the delivered workbooks and provided files, on obviously synthetic workbooks.

Each synthetic workbook copies only the verified layout (header rows and column names) of the
real file, with councils "A…" and made-up numbers.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest
from openpyxl import Workbook

from foodscope_pipeline.sources.geolytix import COLUMNS, GeolytixError, read_retail_points
from foodscope_pipeline.sources.ons_mye import MYE2, MYE5, PopulationError, read_population
from foodscope_pipeline.sources.ons_supermarkets import (
    RETAILER_TYPES, SIZE_BANDS, TABLE_HEADERS, TYPES, BenchmarkError, read_s12, retailer_type,
)
from foodscope_pipeline.sources.provided import ProvidedFileError, load_provided

PREAMBLE = [("Title",), ("This worksheet contains one table.",)]


def save(wb: Workbook, path: Path) -> Path:
    wb.save(path)
    return path


# GEOLYTIX ------------------------------------------------------------------------------------

def geolytix_row(id_: int, **over) -> list:
    rec = {c: None for c in COLUMNS}
    rec.update(id=id_, retailer="Retailer A", fascia="Shop A", store_name=f"Store {id_}", postcode="ZZ1 1ZZ",
               long_wgs=-1.5, lat_wgs=53.5, bng_e=430000.0, bng_n=400000.0, pqi="Rooftop",
               size_band="< 3,013 ft2 (280m2)")
    rec.update(over)
    return [rec[c] for c in COLUMNS]


def geolytix_book(tmp_path: Path, rows: list[list], header=COLUMNS) -> Path:
    wb = Workbook()
    ws = wb.active
    ws.append(list(header))
    for r in rows:
        ws.append(r)
    return save(wb, tmp_path / "retail.xlsx")


def test_geolytix_reads_rows_as_delivered(tmp_path: Path) -> None:
    path = geolytix_book(tmp_path, [geolytix_row(1), geolytix_row(2, long_wgs=None, lat_wgs=None, town=" Town A ")])
    points = read_retail_points(path)
    assert [p.id for p in points] == [1, 2]
    assert points[1].long_wgs is None and points[1].bng_e == 430000.0 and points[1].town == "Town A"


def test_geolytix_rejects_a_changed_header(tmp_path: Path) -> None:
    with pytest.raises(GeolytixError, match="unexpected columns"):
        read_retail_points(geolytix_book(tmp_path, [], header=(*COLUMNS[:-1], "region")))


@pytest.mark.parametrize(("rows", "message"), [
    ([geolytix_row(1), geolytix_row(1)], "not unique"),
    ([geolytix_row("x")], "id is not an integer"),  # type: ignore[arg-type]
    ([geolytix_row(1, long_wgs="west")], "long_wgs is not a number"),
    ([geolytix_row(1, fascia=None)], "required"),
])
def test_geolytix_rejects_bad_rows(tmp_path: Path, rows, message) -> None:
    with pytest.raises(GeolytixError, match=message):
        read_retail_points(geolytix_book(tmp_path, rows))


# ONS mid-year estimates ----------------------------------------------------------------------

def mye_book(tmp_path: Path, persons: dict[str, int], area_pop: dict[str, int] | None = None, uk: int | None = None) -> Path:
    area_pop = area_pop or persons
    wb = Workbook()
    ws2 = wb.active
    ws2.title = MYE2[0]
    for r in PREAMBLE:
        ws2.append(list(r))
    ws2.append([*MYE2[1], "0", "1"])
    ws2.append(["K02000001", "UNITED KINGDOM", "Country", uk if uk is not None else sum(persons.values()), 1, 1])
    ws2.append(["R1", "REGION A", "Region", sum(persons.values()), 1, 1])
    for code, value in persons.items():
        ws2.append([code, f"Council {code}", "Unitary Authority", value, 1, 1])
    ws5 = wb.create_sheet(MYE5[0])
    for r in PREAMBLE:
        ws5.append(list(r))
    ws5.append(list(MYE5[1]))
    for code, value in area_pop.items():
        ws5.append([code, f"Council {code}", "Unitary Authority", 12.5, value])
    return save(wb, tmp_path / "mye.xlsx")


def test_population_reads_council_rows_only(tmp_path: Path) -> None:
    rows, uk = read_population(mye_book(tmp_path, {"A1": 1000, "B1": 2500}))
    assert uk == 3500 and sorted(rows) == ["A1", "B1"]
    assert rows["B1"].population == 2500 and rows["B1"].land_area_km2 == 12.5


@pytest.mark.parametrize(("kwargs", "message"), [
    ({"area_pop": {"A1": 1000, "B1": 2499}}, "MYE2 gives 2500 but MYE5 gives 2499"),
    ({"area_pop": {"A1": 1000}}, "MYE5: B1 is missing"),
    ({"uk": 9999}, "the UK row is 9999"),
])
def test_population_checks_tables_against_each_other(tmp_path: Path, kwargs, message) -> None:
    with pytest.raises(PopulationError, match=message):
        read_population(mye_book(tmp_path, {"A1": 1000, "B1": 2500}, **kwargs))


# ONS chain supermarkets (S12) ----------------------------------------------------------------

def s12_book(tmp_path: Path, counts: dict[str, int], table3_total_override: dict[str, int] | None = None) -> Path:
    wb = Workbook()
    wb.active.title = "Notes"
    wb["Notes"].append(["Grouping", "Supermarkets included"])
    for sheet, header in TABLE_HEADERS.items():
        ws = wb.create_sheet(sheet)
        for r in PREAMBLE:
            ws.append(list(r))
        ws.append(list(header))
        for code, n in counts.items():
            if sheet == "Table 1":
                ws.append([code, f"Council {code}", n])
            elif sheet == "Table 2":
                ws.append([code, f"Council {code}", n, 1000.0, 10.0])
            elif sheet == "Table 3":
                first = (table3_total_override or {}).get(code, n)
                ws.append([code, f"Council {code}", first, 0, 0, 0])
            else:
                ws.append([code, f"Council {code}", n, *([0] * (len(TYPES) - 1))])
    return save(wb, tmp_path / "s12.xlsx")


def test_s12_reads_and_cross_checks_tables(tmp_path: Path) -> None:
    rows, _ = read_s12(s12_book(tmp_path, {"A1": 3, "B1": 0}))
    assert rows["A1"].total == 3 and rows["A1"].by_size_band[SIZE_BANDS[0]] == 3
    assert rows["A1"].by_type["Convenience"] == 3 and rows["B1"].per_10k == 10.0


def test_s12_rejects_tables_that_disagree(tmp_path: Path) -> None:
    with pytest.raises(BenchmarkError, match="different totals"):
        read_s12(s12_book(tmp_path, {"A1": 3}, table3_total_override={"A1": 2}))


def test_retailer_types_are_disjoint() -> None:
    names = [f for fs in RETAILER_TYPES.values() for f in fs]
    assert len(names) == len(set(names))
    assert set(RETAILER_TYPES) == set(TYPES)
    assert retailer_type("Marks and Spencer BP") == "Petrol Forecourt" and retailer_type("Shop A") is None


# Provided files ------------------------------------------------------------------------------

def test_provided_file_must_match_its_checksum(tmp_path: Path) -> None:
    data = b"synthetic"
    (tmp_path / "file.bin").write_bytes(data)
    entry = {"id": "x", "file": "file.bin", "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
    (tmp_path / "index.json").write_text(json.dumps({"files": [entry]}), encoding="utf-8")
    path, found = load_provided(tmp_path, "x")
    assert path.read_bytes() == data and found["id"] == "x"
    (tmp_path / "file.bin").write_bytes(data + b"!")
    with pytest.raises(ProvidedFileError, match="does not match"):
        load_provided(tmp_path, "x")
    with pytest.raises(ProvidedFileError, match="expected one entry"):
        load_provided(tmp_path, "y")
