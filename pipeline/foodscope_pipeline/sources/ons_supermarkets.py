"""S12 ONS "Number of chain supermarkets across LADs and smaller areas in the UK" (7 March 2024).

A validation benchmark only (spec §6.3): it is never displayed as a second value. Tables used,
verified 24 Oct 2026:

- **Table 1**: `LAD code`, `LAD name`, `Counts` (376 rows, including `L99999999` Channel Islands and
  `M99999999` Isle of Man; total 18,160).
- **Table 2**: `Supermarkets`, `People per Supermarket`, `Supermarkets per 10,000 people` (Census
  2021/2022 populations, note 2).
- **Table 3**: counts by the four GEOLYTIX size bands, with the same labels as GEOLYTIX v46.
- **Table 4**: counts by ONS retailer type. The fascias in each type are listed in the Notes
  worksheet ("Grouping" table, from the GEOLYTIX blog, note 6); `RETAILER_TYPES` transcribes it and
  a test checks every name against the workbook.

Councils are those of the time (before the 2023 mergers in Cumbria, North Yorkshire and Somerset,
and before the 2025 Barnsley–Sheffield change). ONS added 52 stores from retailers not in the
GEOLYTIX data (note 1).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from openpyxl import load_workbook

SIZE_BANDS = (
    "< 3,013 ft2 (280m2)",
    "3,013 < 15,069 ft2 (280 < 1,400 m2)",
    "15,069 < 30,138 ft2 (1,400 < 2,800 m2)",
    "30,138 ft2 > (2,800 m2)",
)
TYPES = ("Convenience", "Discounter", "Freezer Centre", "Petrol Forecourt", "Specialist", "Symbol Group",
         "Traditional", "Travel", "Wholesaler", "Other")
TABLE_HEADERS = {
    "Table 1": ("LAD code", "LAD name", "Counts"),
    "Table 2": ("LAD code", "LAD name", "Supermarkets", "People per Supermarket", "Supermarkets per 10,000 people"),
    "Table 3": ("LAD code", "LAD name", *SIZE_BANDS),
    "Table 4": ("LAD code", "LAD name", *TYPES),
}
# Notes worksheet, "Grouping" table: type (as headed in Table 4) → fascias, transcribed verbatim.
RETAILER_TYPES: dict[str, tuple[str, ...]] = {
    "Convenience": ("Aldi Local", "Amazon Fresh", "Asda Express", "Asda On the Move", "Budgens",
                    "The Co-operative Food", "Little Waitrose", "Marks and Spencer Food To Go",
                    "Morrisons Daily", "Sainsburys Local", "Tesco Express", "Swift"),
    "Discounter": ("Aldi", "Lidl"),
    "Freezer Centre": ("Cooltrader", "Farmfoods", "Heron", "Iceland", "The Food Warehouse"),
    "Petrol Forecourt": ("Asda PFS", "The Co-operative Food PFS", "Eurospar PFS", "Little Waitrose Shell",
                         "Marks and Spencer BP", "Morrisons Select", "Tesco Express Esso", "Spar PFS",
                         "SuperValu PFS"),
    "Specialist": ("Booths", "Margiotta", "Marks and Spencer", "Marks and Spencer Foodhall",
                   "Marks and Spencer Simply Food", "Planet Organic", "Waitrose", "Whole Foods Market",
                   "Proudfoot"),
    "Symbol Group": ("Spar", "Eurospar", "SuperValu", "Tuffins"),
    "Traditional": ("Asda Supercentre", "Asda Supermarket", "Asda Superstore", "Morrisons", "Sainsburys",
                    "Tesco", "Tesco Extra"),
    "Travel": ("Marks and Spencer MSA", "Marks and Spencer Travel SF", "Waitrose MSA"),
    "Wholesaler": ("Costco", "Makro"),
    "Other": ("Asda Living", "Marks and Spencer Home", "Dunnes Stores", "Marks and Spencer Hospital",
              "Marks and Spencer Outlet", "Morrisons Home", "Nutmeg"),
}
NOTES_GROUP_LABELS = {"Discounter": "Discounters", "Freezer Centre": "Freezer Centres", "Symbol Group": "Symbol Groups"}


class BenchmarkError(RuntimeError):
    """The workbook does not have the verified structure, or its tables disagree."""


@dataclass(frozen=True)
class S12Row:
    code: str
    name: str
    total: int
    per_10k: float | None
    people_per_store: float | None
    by_size_band: dict[str, int]
    by_type: dict[str, int]


def _rows(workbook, sheet: str) -> list[tuple]:
    header = TABLE_HEADERS[sheet]
    rows = [r for r in workbook[sheet].iter_rows(values_only=True) if any(v is not None for v in r)]
    starts = [i for i, r in enumerate(rows) if r[0] == "LAD code"]
    if len(starts) != 1 or tuple(rows[starts[0]][: len(header)]) != header:
        raise BenchmarkError(f"{sheet}: header differs from the verified {header}")
    return [r[: len(header)] for r in rows[starts[0] + 1:]]


def _count(value: object, where: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise BenchmarkError(f"{where}: not a count ({value!r})")
    return value


def read_s12(path: Path) -> tuple[dict[str, S12Row], str]:
    """LAD rows keyed by code (tables 1–4 cross-checked), and the Notes worksheet text."""
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        tables = {sheet: {r[0]: r for r in _rows(workbook, sheet)} for sheet in TABLE_HEADERS}
        notes = "\n".join(" | ".join(str(v) for v in r if v is not None)
                          for r in workbook["Notes"].iter_rows(values_only=True))
    finally:
        workbook.close()
    codes = list(tables["Table 1"])
    for sheet, rows in tables.items():
        if list(rows) != codes:
            raise BenchmarkError(f"{sheet}: council codes differ from Table 1")
    out: dict[str, S12Row] = {}
    for code in codes:
        t1, t2, t3, t4 = (tables[s][code] for s in TABLE_HEADERS)
        total = _count(t1[2], f"Table 1 {code}")
        bands = {band: _count(v, f"Table 3 {code}") for band, v in zip(SIZE_BANDS, t3[2:], strict=True)}
        types = {kind: _count(v, f"Table 4 {code}") for kind, v in zip(TYPES, t4[2:], strict=True)}
        if _count(t2[2], f"Table 2 {code}") != total or sum(bands.values()) != total or sum(types.values()) != total:
            raise BenchmarkError(f"{code}: tables 1–4 give different totals")
        out[code] = S12Row(code=str(code), name=str(t1[1]), total=total,
                           per_10k=float(t2[4]) if t2[4] is not None else None,
                           people_per_store=float(t2[3]) if t2[3] is not None else None,
                           by_size_band=bands, by_type=types)
    return out, notes


def retailer_type(fascia: str) -> str | None:
    """ONS retailer type for a GEOLYTIX fascia, or None when the Notes do not list the fascia."""
    for kind, fascias in RETAILER_TYPES.items():
        if fascia in fascias:
            return kind
    return None
