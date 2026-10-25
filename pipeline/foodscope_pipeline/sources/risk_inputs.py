"""Readers for the Stage 6 Risk Explorer inputs (offline; files cached by `fetch-reference --set stage6`).

Each reader checks the structure it relies on and raises `RiskInputError` when a file differs from
what was verified on 25 Oct 2026 (docs/03-DATA-SOURCES.md: S03, S13, S15, S23, S30-S33, S35, S36).
Values are returned as published; no reader fills a gap.
"""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

from foodscope_pipeline.sources.ods import read_sheet


class RiskInputError(RuntimeError):
    """An input file differs from its verified structure."""


def _num(value: object) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)) and math.isfinite(value):
        return float(value)
    return None


# ---------------------------------------------------------------------------------------------
# S30: World Bank API, ER.H2O.FWST.ZS (FAO AQUASTAT level of water stress)


def read_water_stress(data_path: Path, countries_path: Path, indicator: str) -> tuple[dict, list[dict]]:
    """(header, countries): one entry per World Bank economy (aggregates excluded) with its series.

    Each country: iso3, iso2, name, series [(year, value)] sorted by year (years without a value
    left out). The header is the API's paging block (it carries `lastupdated`).
    """
    doc = json.loads(data_path.read_text(encoding="utf-8"))
    if not (isinstance(doc, list) and len(doc) == 2 and isinstance(doc[0], dict) and isinstance(doc[1], list)):
        raise RiskInputError(f"{data_path.name}: expected [header, rows]")
    header, rows = doc
    if header.get("pages") != 1 or header.get("total") != len(rows):
        raise RiskInputError(f"{data_path.name}: {header.get('total')} rows announced, {len(rows)} read on "
                             f"{header.get('pages')} pages (one page expected)")
    cdoc = json.loads(countries_path.read_text(encoding="utf-8"))
    if not (isinstance(cdoc, list) and len(cdoc) == 2) or cdoc[0].get("total") != len(cdoc[1]):
        raise RiskInputError(f"{countries_path.name}: country list incomplete")
    economies = {c["id"]: c for c in cdoc[1] if c["region"]["value"].strip() != "Aggregates"}
    series: dict[str, list[tuple[int, float]]] = {k: [] for k in economies}
    for r in rows:
        if r["indicator"]["id"] != indicator:
            raise RiskInputError(f"{data_path.name}: indicator {r['indicator']['id']}")
        code = r["countryiso3code"]
        value = _num(r["value"])
        if code in series and value is not None:
            if value < 0:
                raise RiskInputError(f"{data_path.name}: negative value for {code} {r['date']}")
            series[code].append((int(r["date"]), value))
    out = []
    for code in sorted(economies):
        c = economies[code]
        out.append({"iso3": code, "iso2": c["iso2Code"], "name": c["name"].strip(),
                    "series": sorted(series[code])})
    return header, out


def stress_class(value: float, classes: list[dict]) -> str:
    """FAO SDG 6.4.2 class of a water-stress value (%); 100 % exactly is high, above it critical."""
    if value < 0:
        raise ValueError("water stress cannot be negative")
    for c in classes:
        upper = c["max"]
        if upper is None:
            return c["id"]
        if c["id"] == "high" and value <= upper:
            return c["id"]
        if value < upper:
            return c["id"]
    raise ValueError(f"no class for {value}")


# ---------------------------------------------------------------------------------------------
# S23: DfT port freight statistics


def read_port_list(path: Path) -> dict[str, dict]:
    """Published statistical major ports: published name → locode, nation, DfT map point or None."""
    rows = read_sheet(path, "Major_Ports_List")
    header = [str(c).strip() if c is not None else "" for c in rows[4]]
    expected = ["Port Locode", "Port Name", "Published Port Locode", "Published Port Name", "Country of the UK",
                "Is the Published Port Major or Minor", "Statistical or Reporting Port", "Published Port Latitude",
                "Published Port Longitude"]
    if header[: len(expected)] != expected:
        raise RiskInputError(f"{path.name}: Major_Ports_List header {header}")
    out: dict[str, dict] = {}
    for r in rows[5:]:
        if not r or not r[0] or "Statistical" not in str(r[6]):
            continue
        lat, lon = _num(r[7]), _num(r[8])
        if (lat is None) != (lon is None):
            raise RiskInputError(f"{path.name}: {r[3]} has only one coordinate")
        out[str(r[3])] = {
            "locode": str(r[2]), "name": str(r[3]), "nation": str(r[4]),
            "dftPoint": None if lat is None else [lon, lat],
        }
    return out


PORT0499_HEADER = ["Year", "Major Port", "Port of Load/Unload Region", "Port of Load/Unload Country", "Direction",
                   "Cargo Group", "Cargo Category", "Cargo Description", "Tonnage (thousands)"]


def read_port0499(path: Path) -> list[tuple]:
    """Rows (year, port, region, country, direction, group, category, description, kilotonnes).

    Two rows in the 2002 data carry no port and zero tonnage; they are dropped and counted by the
    caller through the returned length. Any non-numeric tonnage stops the build.
    """
    rows = read_sheet(path, "port0499")
    header = [" ".join(str(c).split()) if c is not None else "" for c in rows[7][:9]]
    if [h.split(" [")[0] for h in header] != PORT0499_HEADER:
        raise RiskInputError(f"{path.name}: PORT0499 header {header}")
    out = []
    for r in rows[8:]:
        if not r or r[0] is None:
            continue
        tonnes = _num(r[8])
        if tonnes is None:
            raise RiskInputError(f"{path.name}: non-numeric tonnage {r[:9]}")
        if r[1] is None:
            if tonnes != 0:
                raise RiskInputError(f"{path.name}: tonnage without a port {r[:9]}")
            continue
        out.append((int(r[0]), str(r[1]), str(r[2]), str(r[3]), str(r[4]), str(r[5]), int(r[6]), str(r[7]), tonnes))
    return out


def read_port0499_notes(path: Path) -> dict[str, str]:
    rows = read_sheet(path, "Notes")
    return {str(r[0]): " ".join(str(r[1]).split()) for r in rows[4:] if r and r[0] and str(r[0]).startswith("Note")}


def read_port0304(path: Path) -> dict[str, dict[str, float]]:
    """PORT0304 (latest year, major ports over 2 million tonnes): port → cargo group → kilotonnes."""
    rows = read_sheet(path, "Data")
    header = [str(c) for c in rows[3]]
    if header != ["Port", "Liquid Bulk", "Dry bulk & other general cargo", "Ro-Ro", "Containers", "Total"]:
        raise RiskInputError(f"{path.name}: PORT0304 header {header}")
    return {str(r[0]): dict(zip(header[1:], (float(v) for v in r[1:6]), strict=True))
            for r in rows[4:] if r and r[0] and _num(r[-1]) is not None}


# ---------------------------------------------------------------------------------------------
# S36: EMODnet port locations


def read_emodnet_ports(path: Path) -> dict[str, dict]:
    """UK port locations by UN/LOCODE (or DfT's own GB2xx codes): point [lon, lat], name, source."""
    doc = json.loads(path.read_text(encoding="utf-8"))
    if doc.get("type") != "FeatureCollection" or doc.get("numberMatched") != doc.get("numberReturned"):
        raise RiskInputError(f"{path.name}: incomplete WFS response")
    crs = (doc.get("crs") or {}).get("properties", {}).get("name", "")
    if not crs.endswith("EPSG::4326"):
        raise RiskInputError(f"{path.name}: CRS {crs}")
    out: dict[str, dict] = {}
    for f in doc["features"]:
        p = f["properties"]
        if p.get("country") not in ("UK", "GB"):
            continue
        lon, lat = f["geometry"]["coordinates"]
        # The geometry is the attribute pair rounded to 8 decimals (about 1 mm).
        if abs(lon - p.get("pointx", math.inf)) > 1e-6 or abs(lat - p.get("pointy", math.inf)) > 1e-6:
            raise RiskInputError(f"{path.name}: {p['port_id']} geometry and pointx/pointy disagree")
        if not (-9 < lon < 2.5 and 49 < lat < 61.5):
            raise RiskInputError(f"{path.name}: {p['port_id']} lies outside the UK ({lon}, {lat})")
        out[p["port_id"]] = {"point": [lon, lat], "name": p["port"], "source": p["source"],
                             "sourceCode": p["data_src_c"]}
    return out


# ---------------------------------------------------------------------------------------------
# S03: UK Food Security Report 2024, theme 3 chart data


def read_ukfsr_ports(path: Path) -> tuple[list[tuple[str, int, float]], list[tuple[str, int, float, int]]]:
    """(3_2_2a rows (port group, year, %), 3_2_2b rows (food group, year, %, chart order))."""
    a = read_sheet(path, "3_2_2a")
    if [str(c) for c in a[2][:3]] != ["port", "year", "value"]:
        raise RiskInputError(f"{path.name}: 3_2_2a header {a[2]}")
    b = read_sheet(path, "3_2_2b")
    if [str(c) for c in b[2][:4]] != ["food", "year", "percentage", "food_order"]:
        raise RiskInputError(f"{path.name}: 3_2_2b header {b[2]}")
    rows_a = [(str(r[0]), int(r[1]), float(r[2])) for r in a[3:] if r and r[0]]
    rows_b = [(str(r[0]), int(r[1]), float(r[2]), int(r[3])) for r in b[3:] if r and r[0]]
    return rows_a, rows_b


def read_ukfsr_srn_delay(path: Path) -> list[tuple[str, str, float | None]]:
    """3_2_1a: (month YYYY-MM, 'Monthly' | 'Year ending', seconds per vehicle per mile or None).

    The year-ending series has no value for its first 11 months (no full year yet): None, kept.
    """
    rows = read_sheet(path, "3_2_1a")
    if [str(c) for c in rows[2][:3]] != ["month", "variable", "value"]:
        raise RiskInputError(f"{path.name}: 3_2_1a header {rows[2]}")
    out = []
    for r in rows[3:]:
        if not r or not r[0]:
            continue
        if r[1] not in ("Monthly", "Year ending"):
            raise RiskInputError(f"{path.name}: 3_2_1a variable {r[1]!r}")
        value = _num(r[2]) if len(r) > 2 else None
        if value is None and len(r) > 2 and r[2] not in (None, ""):
            raise RiskInputError(f"{path.name}: 3_2_1a value {r[2]!r}")
        out.append((str(r[0])[:7], str(r[1]), value))
    return out


# ---------------------------------------------------------------------------------------------
# S31: Defra June survey, structure of the agricultural industry


def read_structure_regions(path: Path, year: int, columns: list[str]) -> dict[str, dict[str, float]]:
    """England regions in `year` (commercial holdings): region → column → value; plus 'England'."""
    rows = read_sheet(path, str(year))
    header = [" ".join(str(c).split()) if c is not None else "" for c in rows[2]]
    if header[0] != f"England {year} Region":
        raise RiskInputError(f"{path.name}: sheet {year} header starts {header[0]!r}")
    index = {}
    for col in columns:
        hits = [i for i, h in enumerate(header) if h == col]
        if len(hits) != 1:
            raise RiskInputError(f"{path.name}: column {col!r} found {len(hits)} times in sheet {year}")
        index[col] = hits[0]
    out: dict[str, dict[str, float]] = {}
    for r in rows[3:]:
        if not r or not r[0] or str(r[0]).startswith("Data notes"):
            break
        values = {}
        for col, i in index.items():
            v = _num(r[i])
            if v is None:
                raise RiskInputError(f"{path.name}: {r[0]} {col} is {r[i]!r} (suppressed or missing)")
            values[col] = v
        out[str(r[0]).strip()] = values
    return out


def read_structure_countries(path: Path, sheet: str, year: int) -> dict[str, float]:
    """UK key results by country: column (England, Wales, Scotland, Northern Ireland, United Kingdom) → value."""
    rows = read_sheet(path, sheet)
    header = [" ".join(str(c).split()) if c is not None else "" for c in rows[2]]
    if header[0] != "Year":
        raise RiskInputError(f"{path.name}: {sheet} header {header}")
    found = [r for r in rows[3:] if r and _num(r[0]) == year]
    if len(found) != 1:
        raise RiskInputError(f"{path.name}: {sheet} has {len(found)} rows for {year}")
    out = {}
    for name, value in zip(header[1:], found[0][1:], strict=False):
        v = _num(value)
        if name and v is not None:
            out[name] = v
    return out


# ---------------------------------------------------------------------------------------------
# S32: Scottish Government 2011 Data Zone lookup (Windows-1252 text)


def read_dz11_lookup(path: Path) -> dict[str, tuple[str, str]]:
    """2011 Data Zone → (council code, council name)."""
    with path.open(encoding="cp1252", newline="") as fh:
        reader = csv.DictReader(fh)
        needed = {"DZ2011_Code", "LA_Code", "LA_Name", "Country_Name"}
        if not needed <= set(reader.fieldnames or []):
            raise RiskInputError(f"{path.name}: columns {reader.fieldnames}")
        out = {}
        for r in reader:
            if r["Country_Name"] != "Scotland" or not r["LA_Code"].startswith("S12"):
                raise RiskInputError(f"{path.name}: {r['DZ2011_Code']} country {r['Country_Name']!r} council {r['LA_Code']!r}")
            if r["DZ2011_Code"] in out:
                raise RiskInputError(f"{path.name}: {r['DZ2011_Code']} listed twice")
            out[r["DZ2011_Code"]] = (r["LA_Code"], r["LA_Name"].strip())
    return out


__all__ = [
    "RiskInputError",
    "read_dz11_lookup",
    "read_emodnet_ports",
    "read_port0304",
    "read_port0499",
    "read_port0499_notes",
    "read_port_list",
    "read_structure_countries",
    "read_structure_regions",
    "read_ukfsr_ports",
    "read_ukfsr_srn_delay",
    "read_water_stress",
    "stress_class",
]
