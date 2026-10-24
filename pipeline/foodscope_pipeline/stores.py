"""Store classes (decision D5), coordinates and council assignment for GEOLYTIX retail points.

- **Class** comes from the delivered `size_band` only (config/store_classes.json); a band the
  config does not list stops the build.
- **Format** comes from the delivered `fascia` (forecourt, motorway, travel, hospital, wholesale,
  non-food); any other fascia is "standard".
- **Coordinates**: the delivered WGS84 `long_wgs`/`lat_wgs`. When they are missing, the point is
  derived from British National Grid `bng_e`/`bng_n` (EPSG:27700 → 4326) and flagged.
- **Council**: point-in-polygon on the full-extent May 2025 boundaries in EPSG:27700. Stores in
  the Crown Dependencies (postcode areas GY, JE, IM) are outside every UK council and are
  rejected with that reason. Any other store that falls just outside every council (a harbour
  or shore-front store a few metres beyond the boundary line) is given the nearest council if
  that is within `NEAREST_MAX_M`, and flagged `nearest`; beyond that it is rejected.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import shapely
from pyproj import Transformer

from foodscope_pipeline.sources.geolytix import RetailPoint

CROWN_DEPENDENCY_AREAS = {"GY": "Guernsey", "JE": "Jersey", "IM": "Isle of Man"}
REJECT_CROWN = "Crown Dependency (Guernsey, Jersey or Isle of Man): outside UK councils"
REJECT_OUTSIDE = "outside every May 2025 council boundary by more than 50 m"
REJECT_NO_LOCATION = "no WGS84 or British National Grid coordinates"
NEAR_BOUNDARY_M = 10.0
NEAREST_MAX_M = 50.0

_POSTCODE_AREA = re.compile(r"^([A-Z]{1,2})[0-9]")


class StoreClassError(RuntimeError):
    """The store-class configuration is inconsistent, or a delivered value is not covered."""


@dataclass(frozen=True)
class StoreClasses:
    size_bands: list[dict]
    store_classes: list[dict]
    formats: list[dict]
    band_by_value: dict[str, dict]
    format_by_fascia: dict[str, str]

    @property
    def groups(self) -> list[tuple[str, str]]:
        """Every (size band id, format id) pair, in config order: the LAD count columns."""
        return [(b["id"], f["id"]) for b in self.size_bands for f in self.formats]


def load_store_classes(path: Path) -> StoreClasses:
    cfg = json.loads(path.read_text(encoding="utf-8"))
    bands, classes, formats = cfg["sizeBands"], cfg["storeClasses"], cfg["formats"]
    class_ids = {c["id"] for c in classes}
    for kind, items in (("size band", bands), ("store class", classes), ("format", formats)):
        ids = [i["id"] for i in items]
        if len(set(ids)) != len(ids):
            raise StoreClassError(f"duplicate {kind} ids: {ids}")
    if any(b["storeClass"] not in class_ids for b in bands):
        raise StoreClassError("a size band names an unknown store class")
    if formats[0]["id"] != "standard" or formats[0]["fascias"]:
        raise StoreClassError("the first format must be 'standard' with no fascias")
    by_fascia: dict[str, str] = {}
    for fmt in formats:
        for fascia in fmt["fascias"]:
            if fascia in by_fascia:
                raise StoreClassError(f"fascia '{fascia}' is in two formats")
            by_fascia[fascia] = fmt["id"]
    return StoreClasses(size_bands=bands, store_classes=classes, formats=formats,
                        band_by_value={b["value"]: b for b in bands}, format_by_fascia=by_fascia)


def classify(point: RetailPoint, classes: StoreClasses) -> tuple[str, str, str]:
    """(size band id, store class, format) for one store. Raises on an unknown size band."""
    band = classes.band_by_value.get(point.size_band or "")
    if band is None:
        raise StoreClassError(f"store {point.id}: size_band {point.size_band!r} is not in the D5 mapping")
    return band["id"], band["storeClass"], classes.format_by_fascia.get(point.fascia, "standard")


def postcode_area(postcode: str | None) -> str | None:
    if not postcode:
        return None
    match = _POSTCODE_AREA.match(postcode.strip().upper())
    return match.group(1) if match else None


@dataclass(frozen=True)
class Located:
    point: RetailPoint
    lon: float
    lat: float
    source: str  # "wgs84" (as delivered) or "bng" (derived from bng_e/bng_n)


def locate(points: Iterable[RetailPoint]) -> tuple[list[Located], list[RetailPoint]]:
    """Coordinates for every store, deriving WGS84 from BNG when only BNG is delivered."""
    to_wgs84 = Transformer.from_crs(27700, 4326, always_xy=True)
    located: list[Located] = []
    missing: list[RetailPoint] = []
    for p in points:
        if p.long_wgs is not None and p.lat_wgs is not None:
            located.append(Located(p, p.long_wgs, p.lat_wgs, "wgs84"))
        elif p.bng_e is not None and p.bng_n is not None:
            lon, lat = to_wgs84.transform(p.bng_e, p.bng_n)
            located.append(Located(p, float(lon), float(lat), "bng"))
        else:
            missing.append(p)
    return located, missing


@dataclass(frozen=True)
class Assignment:
    council: list[str | None]  # per located store: LAD25 code, or None when rejected
    match: list[str | None]  # per located store: "inside" or "nearest", or None when rejected
    reasons: list[str | None]  # per located store: reject reason, or None
    nearest: list[dict]  # stores given the nearest council: id, council, distance (m)
    ties: int  # stores inside more than one council (lowest code kept)
    near_boundary: int  # assigned stores within NEAR_BOUNDARY_M of another council
    crown_inside: int  # GY/JE/IM postcodes that nevertheless fell inside a council (expect 0)


def to_bng(located: list[Located]) -> np.ndarray:
    """Store points in EPSG:27700."""
    to_bng = Transformer.from_crs(4326, 27700, always_xy=True)
    lon = np.array([s.lon for s in located])
    lat = np.array([s.lat for s in located])
    x, y = to_bng.transform(lon, lat)
    return shapely.points(np.column_stack([x, y]))


def assign(located: list[Located], codes: list[str], councils: np.ndarray) -> Assignment:
    """Assign stores to councils (EPSG:27700 polygons, same order as `codes`)."""
    pts = to_bng(located)
    shapely.prepare(councils)
    tree = shapely.STRtree(councils)
    pt_idx, poly_idx = tree.query(pts)
    hit = shapely.intersects(councils[poly_idx], pts[pt_idx])
    matches: dict[int, list[int]] = {}
    for i, j in zip(pt_idx[hit], poly_idx[hit], strict=True):
        matches.setdefault(int(i), []).append(int(j))

    council: list[str | None] = []
    match: list[str | None] = []
    reasons: list[str | None] = []
    nearest: list[dict] = []
    ties = crown_inside = 0
    for i, store in enumerate(located):
        found = sorted(matches.get(i, []), key=lambda j: codes[j])
        crown = postcode_area(store.point.postcode) in CROWN_DEPENDENCY_AREAS
        if found:
            ties += len(found) > 1
            crown_inside += crown
            council.append(codes[found[0]])
            match.append("inside")
            reasons.append(None)
            continue
        near = [] if crown else tree.query(pts[i], predicate="dwithin", distance=NEAREST_MAX_M)
        if len(near):
            dist = shapely.distance(councils[near], pts[i])
            best = min(range(len(near)), key=lambda k: (dist[k], codes[near[k]]))
            council.append(codes[near[best]])
            match.append("nearest")
            reasons.append(None)
            nearest.append({"id": store.point.id, "name": store.point.store_name, "postcode": store.point.postcode,
                            "council": codes[near[best]], "distanceM": round(float(dist[best]), 1)})
        else:
            council.append(None)
            match.append(None)
            reasons.append(REJECT_CROWN if crown else REJECT_OUTSIDE)

    near = 0
    assigned = [i for i, c in enumerate(council) if c is not None]
    if assigned:
        rings = shapely.buffer(pts[assigned], NEAR_BOUNDARY_M, quad_segs=4)
        b_idx, p_idx = tree.query(rings)
        touch = shapely.intersects(councils[p_idx], rings[b_idx])
        position = {code: k for k, code in enumerate(codes)}
        own = np.array([position[council[assigned[k]]] for k in b_idx])
        near = len({int(k) for k, t, j, o in zip(b_idx, touch, p_idx, own, strict=True) if t and j != o})
    return Assignment(council=council, match=match, reasons=reasons, nearest=nearest, ties=ties,
                      near_boundary=near, crown_inside=crown_inside)


def bng_residuals(located: list[Located], council: list[str | None]) -> dict[str, dict[str, float | int]]:
    """Distance (m) between delivered BNG and the delivered WGS84 point projected to BNG.

    Grouped by where the store was assigned: Great Britain, Northern Ireland (council codes N…),
    and stores outside UK councils. Answers gate G7's question on what `bng_e`/`bng_n` mean in
    Northern Ireland, and bounds the error of deriving a point from BNG when WGS84 is missing.
    """
    keep = [i for i, s in enumerate(located)
            if s.source == "wgs84" and s.point.bng_e is not None and s.point.bng_n is not None]
    if not keep:
        return {}
    rows = [located[i] for i in keep]
    pts = to_bng(rows)
    dx = shapely.get_x(pts) - np.array([s.point.bng_e for s in rows])
    dy = shapely.get_y(pts) - np.array([s.point.bng_n for s in rows])
    dist = np.hypot(dx, dy)
    where = np.array([
        "outside UK councils" if council[i] is None
        else "Northern Ireland" if council[i].startswith("N") else "Great Britain"
        for i in keep
    ])
    out: dict[str, dict[str, float | int]] = {}
    for label in ("Great Britain", "Northern Ireland", "outside UK councils"):
        d = dist[where == label]
        if len(d):
            out[label] = {
                "stores": int(len(d)),
                "medianM": round(float(np.median(d)), 2),
                "p95M": round(float(np.percentile(d, 95)), 2),
                "maxM": round(float(d.max()), 2),
            }
    return out
