"""Display boundaries: coverage simplification keeps shared edges; small islands are dropped and counted."""

from __future__ import annotations

import numpy as np
import pytest
import shapely

from foodscope_pipeline.boundaries import DisplayBoundaryError, display_geometry


def wiggly_square(x0: float, y0: float, size: float = 20_000) -> shapely.Polygon:
    """A square whose edges carry many small zig-zags (obviously synthetic councils)."""
    pts = []
    for k in range(101):
        pts.append((x0 + size * k / 100, y0 + (5 if k % 2 else 0)))
    for k in range(1, 101):
        pts.append((x0 + size + (5 if k % 2 else 0), y0 + size * k / 100))
    for k in range(1, 101):
        pts.append((x0 + size - size * k / 100, y0 + size + (5 if k % 2 else 0)))
    for k in range(1, 100):
        pts.append((x0 + (5 if k % 2 else 0), y0 + size - size * k / 100))
    return shapely.Polygon(pts)


def coverage() -> np.ndarray:
    a = wiggly_square(400_000, 300_000)
    b = shapely.difference(shapely.box(420_000, 300_000, 440_000, 320_000), a)  # shares a's eastern edge exactly
    island = shapely.box(450_000, 300_000, 450_050, 300_050)  # 0.25 ha, touches nothing
    big_island = shapely.box(450_000, 310_000, 450_500, 310_500)  # 25 ha
    return np.array([shapely.multipolygons([a, island]), shapely.multipolygons(shapely.get_parts(b).tolist() + [big_island])],
                    dtype=object)


def test_simplified_neighbours_still_share_their_edge() -> None:
    result = display_geometry(coverage())
    a, b = result.geoms
    assert shapely.is_valid(result.geoms).all()
    assert result.stats["verticesOut"] < result.stats["verticesIn"]
    shared = shapely.intersection(shapely.boundary(a), shapely.boundary(b))
    assert shapely.length(shared) > 0.15  # degrees: most of the 20 km edge (~0.18°) is shared exactly
    assert shapely.area(shapely.intersection(a, b)) == pytest.approx(0, abs=1e-12)


def test_small_islands_are_dropped_and_counted_large_ones_kept() -> None:
    result = display_geometry(coverage())
    assert result.stats["islandPartsDropped"] == 1
    assert result.stats["islandAreaDroppedHa"] == pytest.approx(0.2, abs=0.1)
    assert len(shapely.get_parts(result.geoms[1])) == 2


def test_output_is_wgs84_with_counter_clockwise_exteriors() -> None:
    result = display_geometry(coverage())
    minx, miny, maxx, maxy = shapely.total_bounds(result.geoms)
    assert -3 < minx < maxx < 0 and 50 < miny < maxy < 56
    for part in shapely.get_parts(result.geoms):
        assert part.exterior.is_ccw
    coords = shapely.get_coordinates(result.geoms)
    assert np.allclose(coords, np.round(coords, 6))


def test_rejects_overlapping_input() -> None:
    overlapping = np.array([shapely.box(0, 0, 10, 10), shapely.box(5, 0, 15, 10)], dtype=object)
    with pytest.raises(DisplayBoundaryError, match="not a valid coverage"):
        display_geometry(overlapping)
