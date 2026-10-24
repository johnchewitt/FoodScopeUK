"""Display boundaries: simplify a boundary coverage for the web (councils; Stage 5 small areas).

Steps, all in the input's projected CRS (EPSG:27700 for councils) until the last one:
1. `shapely.coverage_clean` with 1 cm node snapping (no measurable area change; recorded), then
   `shapely.coverage_simplify` at `TOLERANCE_M`: neighbours keep one shared, simplified edge, so
   the map has no slivers or gaps (the coverage is checked valid before and after).
2. Island parts smaller than `MIN_ISLAND_M2` that touch no other council are dropped. They are
   below the display resolution; every one is counted in the report. Stores are assigned with the
   full-resolution BFE edition, so no store depends on them.
3. Transform to WGS84 (EPSG:4326), round to `DECIMALS` places (about 0.1 m), orient rings per
   RFC 7946. A council made invalid by rounding is repaired on the same grid and listed.
   Projection and rounding can leave neighbours overlapping by slivers of a few square metres
   where simplified edges are almost collinear; each overlap is measured (m²) and reported.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import shapely
from pyproj import Transformer

SNAP_M = 0.01
TOLERANCE_M = 150.0
MIN_ISLAND_M2 = 10_000.0
DECIMALS = 6


class DisplayBoundaryError(RuntimeError):
    """The input is not a valid coverage."""


@dataclass(frozen=True)
class DisplayResult:
    geoms: np.ndarray  # WGS84, same order as the input
    stats: dict


def _drop_small_islands(geoms: np.ndarray, min_island_m2: float) -> tuple[np.ndarray, int, float]:
    tree = shapely.STRtree(geoms)
    out, dropped, dropped_area = [], 0, 0.0
    for i, geom in enumerate(geoms):
        keep = []
        for part in shapely.get_parts(geom):
            if part.area < min_island_m2 and not any(j != i for j in tree.query(part, predicate="intersects")):
                dropped += 1
                dropped_area += part.area
                continue
            keep.append(part)
        if not keep:
            raise DisplayBoundaryError(f"council {i} would lose every part")
        out.append(keep[0] if len(keep) == 1 else shapely.multipolygons(keep))
    return np.array(out, dtype=object), dropped, dropped_area


def _overlaps_m2(wgs: np.ndarray, crs: int) -> list[dict]:
    """Pairs of areas that overlap after projection and rounding, with the overlap in m²."""
    to_bng = Transformer.from_crs(4326, crs, always_xy=True)
    tree = shapely.STRtree(wgs)
    out = []
    for i in np.flatnonzero(~shapely.is_empty(shapely.coverage_invalid_edges(wgs))):
        for j in tree.query(wgs[i], predicate="intersects"):
            if j <= i:
                continue
            inter = shapely.intersection(wgs[i], wgs[j])
            parts = [p for p in shapely.get_parts(inter) if p.geom_type == "Polygon"]
            if parts:
                area = sum(shapely.area(shapely.transform(p, lambda xy: np.column_stack(to_bng.transform(xy[:, 0], xy[:, 1]))))
                           for p in parts)
                out.append({"a": int(i), "b": int(j), "areaM2": round(float(area), 2)})
    return out


def display_geometry(geoms: np.ndarray, crs: int = 27700, tolerance_m: float = TOLERANCE_M,
                     min_island_m2: float = MIN_ISLAND_M2, require_valid_input: bool = True) -> DisplayResult:
    """Simplified WGS84 polygons for the map, with a record of every change.

    Defaults are the council settings (EPSG:27700, 150 m, islands under 1 ha dropped). `crs` is the
    input's projected CRS in metres (e.g. 29902 for NISRA's Irish Grid files). With
    `require_valid_input=False` an input whose neighbours do not share identical edges (NISRA's
    Data Zones: overlaps and gaps of a few square centimetres) is accepted: `coverage_clean`
    resolves them, and the number of mismatched areas and the area moved are reported.
    """
    invalid_in = int((~shapely.is_empty(shapely.coverage_invalid_edges(geoms))).sum())
    if invalid_in and require_valid_input:
        raise DisplayBoundaryError("the boundary edition is not a valid coverage")
    cleaned = shapely.coverage_clean(geoms, snapping_distance=SNAP_M)
    if not shapely.coverage_is_valid(cleaned) or not shapely.is_valid(cleaned).all():
        raise DisplayBoundaryError("coverage_clean produced an invalid coverage")
    clean_change = float(np.abs(shapely.area(cleaned) - shapely.area(geoms)).sum())
    simplified = shapely.coverage_simplify(cleaned, tolerance_m)
    if not shapely.coverage_is_valid(simplified):
        raise DisplayBoundaryError("coverage_simplify produced an invalid coverage")
    kept, dropped, dropped_area = _drop_small_islands(simplified, min_island_m2)

    to_wgs84 = Transformer.from_crs(crs, 4326, always_xy=True)

    def project(xy: np.ndarray) -> np.ndarray:
        lon, lat = to_wgs84.transform(xy[:, 0], xy[:, 1])
        return np.round(np.column_stack([lon, lat]), DECIMALS)

    wgs = shapely.transform(kept, project)
    repaired = [int(i) for i in np.flatnonzero(~shapely.is_valid(wgs))]
    for i in repaired:
        wgs[i] = shapely.set_precision(wgs[i], 10.0 ** -DECIMALS)
    if not shapely.is_valid(wgs).all():
        raise DisplayBoundaryError("rounded boundaries are still invalid after repair")
    wgs = shapely.orient_polygons(wgs, exterior_cw=False)
    overlaps = _overlaps_m2(wgs, crs)

    stats = {
        **({"inputAreasWithMismatchedEdges": invalid_in} if not require_valid_input else {}),
        "cleanSnapM": SNAP_M,
        "cleanAreaChangeM2": round(clean_change, 3),
        "toleranceM": tolerance_m,
        "minIslandM2": min_island_m2,
        "decimals": DECIMALS,
        "verticesIn": int(shapely.get_num_coordinates(geoms).sum()),
        "verticesOut": int(shapely.get_num_coordinates(wgs).sum()),
        "partsIn": int(len(shapely.get_parts(geoms))),
        "partsOut": int(len(shapely.get_parts(wgs))),
        "islandPartsDropped": dropped,
        "islandAreaDroppedHa": round(dropped_area / 10_000, 1),
        "repairedAfterRounding": repaired,
        "coverageValidAfterRounding": bool(shapely.coverage_is_valid(wgs)),
        "overlapsAfterRounding": overlaps,
    }
    return DisplayResult(geoms=wgs, stats=stats)
