"""S14 ONS Local Authority Districts (May 2025): read the two boundary editions (offline).

- **BFE** (full resolution, extent of the realm): the FileGDB John provided, read straight from
  the zip. It runs to the low-water line, so every coastal store falls inside a council; it is
  used to assign stores to councils.
- **BGC** (generalised to 20 m, clipped to the coastline): the feature-service pages fetched by
  `fetch-ons`. It is the display geometry.

Both are in EPSG:27700 and must hold the same 361 council codes. Fields used: LAD25CD, LAD25NM,
LAD25NMW (verified in docs/03-DATA-SOURCES.md S14).
"""

from __future__ import annotations

import warnings
import zipfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from pyogrio.raw import read

CRS = "EPSG:27700"
FIELDS = ["LAD25CD", "LAD25NM", "LAD25NMW"]


class BoundaryError(RuntimeError):
    """A boundary file does not have the verified structure."""


@dataclass(frozen=True)
class Councils:
    codes: list[str]
    names: list[str]
    names_welsh: list[str | None]
    geoms: np.ndarray  # shapely geometries, EPSG:27700, same order as codes

    def __len__(self) -> int:
        return len(self.codes)


def _councils(codes, names, welsh, geoms) -> Councils:
    order = np.argsort(np.asarray(codes, dtype=object), kind="stable")
    codes = [str(codes[i]) for i in order]
    if len(set(codes)) != len(codes):
        raise BoundaryError("council codes are not unique")
    geoms = np.asarray(geoms)[order]
    if shapely.is_empty(geoms).any() or not shapely.is_valid(geoms).all():
        raise BoundaryError("empty or invalid council geometry")
    return Councils(
        codes=codes,
        names=[str(names[i]) for i in order],
        names_welsh=[(str(welsh[i]) if welsh[i] not in (None, "") else None) for i in order],
        geoms=geoms,
    )


def _gdb_path(zip_path: Path) -> str:
    with zipfile.ZipFile(zip_path) as zf:
        roots = sorted({n.split("/")[0] for n in zf.namelist() if n.split("/")[0].endswith(".gdb")})
    if len(roots) != 1:
        raise BoundaryError(f"{zip_path.name}: expected one .gdb folder, found {roots}")
    return f"/vsizip/{zip_path}/{roots[0]}"


def read_bfe(zip_path: Path) -> Councils:
    """Read the BFE FileGDB from its zip (one MultiPolygon layer, EPSG:27700)."""
    gdb = _gdb_path(zip_path)
    layers = pyogrio.list_layers(gdb)
    if len(layers) != 1:
        raise BoundaryError(f"{zip_path.name}: expected one layer, found {[l[0] for l in layers]}")
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message="organizePolygons", category=RuntimeWarning)
        meta, _, wkb, fields = read(gdb, layer=layers[0][0], columns=FIELDS)
    if meta["crs"] != CRS:
        raise BoundaryError(f"{zip_path.name}: CRS is {meta['crs']}, expected {CRS}")
    return _councils(fields[0], fields[1], fields[2], shapely.from_wkb(wkb))


def read_bgc_pages(paths: list[Path]) -> Councils:
    """Read the BGC feature-service pages (Esri JSON, EPSG:27700) as one set of councils."""
    codes, names, welsh, geoms = [], [], [], []
    for path in paths:
        with warnings.catch_warnings():
            # GDAL notes that rebuilding multi-part polygons from Esri rings is slow; it is correct.
            warnings.filterwarnings("ignore", message="organizePolygons", category=RuntimeWarning)
            meta, _, wkb, fields = read(path, columns=FIELDS)
        if meta["crs"] != CRS:
            raise BoundaryError(f"{path.name}: CRS is {meta['crs']}, expected {CRS}")
        codes += list(fields[0])
        names += list(fields[1])
        welsh += list(fields[2])
        geoms += list(shapely.from_wkb(wkb))
    return _councils(codes, names, welsh, geoms)
