"""S11 GEOLYTIX Grocery Retail Points: read the delivered workbook (offline).

Version 46 (June 2026) arrives as one .xlsx sheet with 17 columns, verified 24 Oct 2026
(docs/03-DATA-SOURCES.md S11). The reader checks the header exactly, so a schema change in a
later release stops the build instead of being read wrongly. Values are kept as delivered.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from openpyxl import load_workbook

COLUMNS: tuple[str, ...] = (
    "id", "retailer", "fascia", "store_name", "add_one", "add_two", "town", "suburb", "postcode",
    "long_wgs", "lat_wgs", "bng_e", "bng_n", "pqi", "open_date", "size_band", "county",
)


class GeolytixError(RuntimeError):
    """The workbook does not have the verified structure."""


@dataclass(frozen=True)
class RetailPoint:
    id: int
    retailer: str
    fascia: str
    store_name: str
    add_one: str | None
    add_two: str | None
    town: str | None
    suburb: str | None
    postcode: str | None
    long_wgs: float | None
    lat_wgs: float | None
    bng_e: float | None
    bng_n: float | None
    pqi: str | None
    size_band: str | None


def _text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _number(value: object, column: str, row: int) -> float | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise GeolytixError(f"row {row}: {column} is not a number ({value!r})")
    return float(value)


def read_retail_points(path: Path) -> list[RetailPoint]:
    """Read every row of the first sheet. Raises GeolytixError on a header or id problem."""
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        rows = workbook.worksheets[0].iter_rows(values_only=True)
        header = tuple(next(rows))
        if header != COLUMNS:
            raise GeolytixError(f"unexpected columns {header}; verified columns are {COLUMNS}")
        points: list[RetailPoint] = []
        for n, values in enumerate(rows, start=2):
            if all(v is None for v in values):
                continue
            rec = dict(zip(COLUMNS, values, strict=True))
            if not isinstance(rec["id"], int) or isinstance(rec["id"], bool):
                raise GeolytixError(f"row {n}: id is not an integer ({rec['id']!r})")
            retailer, fascia, name = _text(rec["retailer"]), _text(rec["fascia"]), _text(rec["store_name"])
            if not (retailer and fascia and name):
                raise GeolytixError(f"row {n}: retailer, fascia and store_name are required")
            points.append(RetailPoint(
                id=rec["id"], retailer=retailer, fascia=fascia, store_name=name,
                add_one=_text(rec["add_one"]), add_two=_text(rec["add_two"]), town=_text(rec["town"]),
                suburb=_text(rec["suburb"]), postcode=_text(rec["postcode"]),
                long_wgs=_number(rec["long_wgs"], "long_wgs", n), lat_wgs=_number(rec["lat_wgs"], "lat_wgs", n),
                bng_e=_number(rec["bng_e"], "bng_e", n), bng_n=_number(rec["bng_n"], "bng_n", n),
                pqi=_text(rec["pqi"]), size_band=_text(rec["size_band"]),
            ))
    finally:
        workbook.close()
    ids = [p.id for p in points]
    if len(set(ids)) != len(ids):
        raise GeolytixError("store ids are not unique")
    return points
