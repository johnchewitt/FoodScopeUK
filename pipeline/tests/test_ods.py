"""The standard-library .ods reader (pure function; synthetic spreadsheet)."""

from __future__ import annotations

import zipfile
from pathlib import Path

import pytest

from foodscope_pipeline.sources.ods import OdsError, read_sheet, sheet_names

CONTENT = """<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
 <office:body><office:spreadsheet>
  <table:table table:name="Cover">
   <table:table-row><table:table-cell office:value-type="string"><text:p>Synthetic</text:p></table:table-cell></table:table-row>
  </table:table>
  <table:table table:name="T1">
   <table:table-header-rows>
    <table:table-row>
     <table:table-cell office:value-type="string"><text:p>Crop<text:s text:c="2"/>name</text:p></table:table-cell>
     <table:table-cell table:number-columns-repeated="2"/>
     <table:table-cell office:value-type="string"><text:p>Value</text:p></table:table-cell>
    </table:table-row>
   </table:table-header-rows>
   <table:table-row table:number-rows-repeated="2">
    <table:table-cell office:value-type="string"><text:p>A</text:p></table:table-cell>
    <table:table-cell office:value-type="float" office:value="1.5" table:number-columns-repeated="2"/>
    <table:table-cell office:value-type="percentage" office:value="0.83"/>
    <table:table-cell table:number-columns-repeated="1000"/>
   </table:table-row>
   <table:table-row table:number-rows-repeated="3"><table:table-cell table:number-columns-repeated="5"/></table:table-row>
   <table:table-row>
    <table:table-cell office:value-type="date" office:date-value="2025-06-01"/>
    <table:table-cell office:value-type="string"><text:p>[x]</text:p></table:table-cell>
   </table:table-row>
   <table:table-row table:number-rows-repeated="1048000"><table:table-cell table:number-columns-repeated="1024"/></table:table-row>
  </table:table>
 </office:spreadsheet></office:body>
</office:document-content>
"""


def make_ods(path: Path, content: str = CONTENT) -> Path:
    with zipfile.ZipFile(path, "w") as z:
        z.writestr("mimetype", "application/vnd.oasis.opendocument.spreadsheet")
        z.writestr("content.xml", content)
    return path


def test_reads_values_and_expands_repeats(tmp_path: Path) -> None:
    path = make_ods(tmp_path / "s.ods")
    assert sheet_names(path) == ["Cover", "T1"]
    rows = read_sheet(path, "T1")
    assert rows[0] == ["Crop  name", None, None, "Value"]
    assert rows[1] == rows[2] == ["A", 1.5, 1.5, 0.83]
    # Empty rows between data are kept; trailing empty rows and cells are dropped.
    assert rows[3:6] == [[], [], []]
    assert rows[6] == ["2025-06-01", "[x]"]
    assert len(rows) == 7


def test_missing_sheet_and_bad_file(tmp_path: Path) -> None:
    path = make_ods(tmp_path / "s.ods")
    with pytest.raises(OdsError, match="no sheet named 'T9'"):
        read_sheet(path, "T9")
    bad = tmp_path / "bad.ods"
    bad.write_bytes(b"<!DOCTYPE html>")
    with pytest.raises(OdsError, match="not a readable .ods"):
        sheet_names(bad)
