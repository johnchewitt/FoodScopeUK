"""Defra annual production statistics for the Stage 5 national context (S09, S10) — online download.

John asked on 25 Oct 2026 for domestic production context in the council profiles. Two Defra
accredited official statistics publications, both OGL v3.0, read on gov.uk on 25 Oct 2026:

- S09: "Horticulture statistics 2025" (published 25 June 2026), accompanying dataset
  `hort-dataset-25-20260625.ods`: area, production and value of individual crops, including
  tomatoes (protected vegetables) and strawberries (soft fruit), 1985–2025. Supply and the
  home-production share are published only for all vegetables and all fruit, not per crop.
- S10: "Agriculture in the United Kingdom 2025", chapter 7 (crops) (published 9 July 2026, updated
  3 September 2026), dataset `AUK-chapter7-20260709.ods`: production, imports, exports, total new
  supply and production as a percentage of total new supply for wheat and potatoes.

These are annual national figures, shown side by side with annual HMRC imports and labelled as
national context. They are never combined with monthly trade to estimate a domestic share (spec
SS-07). Cached in `pipeline/raw/defra/<snapshot>/`; runs on GitHub Actions through
`fetch-reference --set context`.
"""

from __future__ import annotations

import math
import re
from pathlib import Path

from foodscope_pipeline.sources.ods import read_sheet
from foodscope_pipeline.sources.ons_files import OGL, OnsFile

HORTICULTURE_2025_URL = (
    "https://assets.publishing.service.gov.uk/media/6a327c196422bec01b1176a1/hort-dataset-25-20260625.ods"
)
AUK_2025_CHAPTER7_URL = (
    "https://assets.publishing.service.gov.uk/media/6a3d141feaee00074150f4db/AUK-chapter7-20260709.ods"
)

FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="defra.horticulture_2025",
        filename="hort-dataset-25-20260625.ods",
        url=HORTICULTURE_2025_URL,
        source_id="S09",
        licence=OGL,
        description="Horticulture statistics 2025: accompanying dataset (area, production and value by crop)",
    ),
    OnsFile(
        id="defra.auk_2025_chapter7",
        filename="AUK-chapter7-20260709.ods",
        url=AUK_2025_CHAPTER7_URL,
        source_id="S10",
        licence=OGL,
        description="Agriculture in the United Kingdom 2025, chapter 7 (crops): full crops dataset",
    ),
)


class DefraTableError(RuntimeError):
    """A Defra table does not have the structure verified on 25 Oct 2026."""


# One year of a crop's supply balance (thousand tonnes) and the production share (%), as published.
Measures = dict[str, float | None]

HORTICULTURE_MEASURES = {
    "Home Production Marketed (HPM)": "production",
    "Imports": "imports",
    "Exports": "exports",
    "Total Supply:": "totalSupply",
    "HPM as % of Total Supply": "productionShare",
}


def _label(cell: object) -> str:
    """Row label without footnote markers such as "(a)", "(d)(e)" or "**"."""
    text = str(cell or "").strip()
    text = re.sub(r"(\([a-z]\))+$", "", text).strip()
    return text.rstrip("*").strip()


def _number(cell: object, where: str) -> float | None:
    if cell is None or cell == "[x]":
        return None
    if isinstance(cell, float) and math.isfinite(cell):
        return cell
    raise DefraTableError(f"{where}: expected a number or [x], found {cell!r}")


def read_horticulture_supply(path: Path, sheet: str, crop: str) -> dict[int, Measures]:
    """Year → supply balance of one crop from Horticulture statistics Table 12 (fruit) or 23 (vegetables).

    The sheet has a header row with "CALENDAR YEAR" in its second cell and the years after it; each
    crop is a heading in the first cell ("Strawberries:", "Tomatoes") followed by its five measure
    rows, labelled in the second cell.
    """
    rows = read_sheet(path, sheet)
    header = next((r for r in rows if len(r) > 2 and r[1] == "CALENDAR YEAR"), None)
    if header is None:
        raise DefraTableError(f"{path.name}/{sheet}: no CALENDAR YEAR header row")
    years = {i: int(v) for i, v in enumerate(header) if isinstance(v, float)}
    out: dict[int, Measures] = {}
    in_crop = False
    for r in rows[rows.index(header) + 1:]:
        heading = _label(r[0]).rstrip(":").strip() if r and isinstance(r[0], str) else ""
        if heading:
            if in_crop:
                break
            in_crop = heading == crop
            continue
        if not in_crop or len(r) < 2 or not isinstance(r[1], str):
            continue
        key = HORTICULTURE_MEASURES.get(_label(r[1]))
        if key is None:
            raise DefraTableError(f"{path.name}/{sheet}: unexpected row {r[1]!r} under {crop}")
        for i, year in years.items():
            out.setdefault(year, {})[key] = _number(r[i] if i < len(r) else None, f"{sheet} {crop} {key} {year}")
    if not out:
        raise DefraTableError(f"{path.name}/{sheet}: no crop {crop!r}")
    incomplete = [y for y, m in out.items() if set(m) != set(HORTICULTURE_MEASURES.values())]
    if incomplete:
        raise DefraTableError(f"{path.name}/{sheet}: {crop} lacks measures in {incomplete[:3]}")
    return out


def read_auk_table(path: Path, sheet: str, title: str) -> tuple[dict[int, dict[str, float | None]], set[int]]:
    """(year → {row label → value}, provisional years) for one sub-table of an AUK chapter 7 sheet.

    A sub-table starts with a title row ("Table 7.2c Wheat supply and use ..."), then a header row
    of years ("2025 (provisional)") and an optional "Notes" column, then data rows until a blank row.
    """
    rows = read_sheet(path, sheet)
    start = next((i for i, r in enumerate(rows) if r and isinstance(r[0], str) and r[0].startswith(title + " ")), None)
    if start is None:
        raise DefraTableError(f"{path.name}/{sheet}: no sub-table {title!r}")
    header = rows[start + 1]
    years: dict[int, int] = {}
    provisional: set[int] = set()
    for i, cell in enumerate(header[1:], start=1):
        m = re.fullmatch(r"(\d{4})( \(provisional\))?", str(cell).strip())
        if m:
            years[i] = int(m.group(1))
            if m.group(2):
                provisional.add(int(m.group(1)))
        elif str(cell).strip() != "Notes":
            raise DefraTableError(f"{path.name}/{sheet}: unexpected header cell {cell!r} in {title}")
    out: dict[int, dict[str, float | None]] = {y: {} for y in years.values()}
    for r in rows[start + 2:]:
        if not r:
            break
        label = str(r[0]).strip()
        for i, year in years.items():
            if label in out[year]:
                raise DefraTableError(f"{path.name}/{sheet}: row {label!r} appears twice in {title}")
            out[year][label] = _number(r[i] if i < len(r) else None, f"{sheet} {title} {label} {year}")
    return out, provisional
