"""Minimal reader for OpenDocument spreadsheets (.ods), standard library only.

Defra publishes its statistics datasets as .ods (S09, S10). Reading them needs only the cell
values of a few sheets, so this reads `content.xml` with `zipfile` and `xml.etree` rather than
adding a spreadsheet dependency. Each sheet is returned as rows of cells: a float for numeric
cells (float, percentage, currency), the ISO text for dates, the text for strings, None for empty
cells. Repeated rows and columns are expanded, except trailing empty ones.
"""

from __future__ import annotations

import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

Cell = float | str | None

_TABLE = "urn:oasis:names:tc:opendocument:xmlns:table:1.0"
_OFFICE = "urn:oasis:names:tc:opendocument:xmlns:office:1.0"
_TEXT = "urn:oasis:names:tc:opendocument:xmlns:text:1.0"


def _q(ns: str, name: str) -> str:
    return f"{{{ns}}}{name}"


T_TABLE, T_ROW, T_CELL, T_COVERED = (_q(_TABLE, n) for n in ("table", "table-row", "table-cell", "covered-table-cell"))
T_ROWS = (_q(_TABLE, "table-header-rows"), _q(_TABLE, "table-row-group"), _q(_TABLE, "table-rows"))
T_NAME, T_ROWS_REP, T_COLS_REP = (_q(_TABLE, n) for n in ("name", "number-rows-repeated", "number-columns-repeated"))
O_TYPE, O_VALUE, O_DATE = (_q(_OFFICE, n) for n in ("value-type", "value", "date-value"))
X_P, X_S, X_TAB, X_BREAK = (_q(_TEXT, n) for n in ("p", "s", "tab", "line-break"))


class OdsError(RuntimeError):
    """The file is not a readable spreadsheet or lacks the requested sheet."""


def _text(el: ET.Element) -> str:
    """Text of a paragraph, with <text:s/> spaces, tabs and line breaks."""
    parts = [el.text or ""]
    for child in el:
        if child.tag == X_S:
            parts.append(" " * int(child.get(_q(_TEXT, "c"), "1")))
        elif child.tag == X_TAB:
            parts.append("\t")
        elif child.tag == X_BREAK:
            parts.append("\n")
        else:
            parts.append(_text(child))
        parts.append(child.tail or "")
    return "".join(parts)


def _value(cell: ET.Element) -> Cell:
    kind = cell.get(O_TYPE)
    if kind in ("float", "percentage", "currency"):
        return float(cell.get(O_VALUE, "nan"))
    if kind == "date":
        return cell.get(O_DATE)
    if kind is None:
        return None
    text = "\n".join(_text(p) for p in cell.iter(X_P))
    return text if text != "" else None


def _rows(table: ET.Element):
    for child in table:
        if child.tag == T_ROW:
            yield child
        elif child.tag in T_ROWS:
            yield from _rows(child)


def _parse_row(row: ET.Element) -> list[Cell]:
    cells: list[Cell] = []
    pending = 0  # empty cells not yet written (dropped if nothing follows them)
    for cell in row:
        if cell.tag not in (T_CELL, T_COVERED):
            continue
        repeat = int(cell.get(T_COLS_REP, "1"))
        value = _value(cell) if cell.tag == T_CELL else None
        if value is None:
            pending += repeat
            continue
        cells.extend([None] * pending)
        pending = 0
        cells.extend([value] * repeat)
    return cells


def _content(path: Path) -> ET.Element:
    try:
        with zipfile.ZipFile(path) as z:
            return ET.fromstring(z.read("content.xml"))
    except (zipfile.BadZipFile, KeyError, ET.ParseError) as exc:
        raise OdsError(f"{path.name}: not a readable .ods file ({exc})") from exc


def _tables(root: ET.Element) -> list[ET.Element]:
    return list(root.iter(T_TABLE))


def sheet_names(path: Path) -> list[str]:
    return [t.get(T_NAME, "") for t in _tables(_content(path))]


def read_sheet(path: Path, name: str) -> list[list[Cell]]:
    """All rows of one sheet; trailing empty rows and cells are dropped."""
    for table in _tables(_content(path)):
        if table.get(T_NAME) != name:
            continue
        rows: list[list[Cell]] = []
        pending = 0  # empty rows not yet written
        for row in _rows(table):
            repeat = int(row.get(T_ROWS_REP, "1"))
            cells = _parse_row(row)
            if not cells:
                pending += repeat
                continue
            rows.extend([[] for _ in range(pending)])
            pending = 0
            rows.extend([list(cells) for _ in range(repeat)])
        return rows
    raise OdsError(f"{path.name}: no sheet named {name!r} (sheets: {sheet_names(path)})")
