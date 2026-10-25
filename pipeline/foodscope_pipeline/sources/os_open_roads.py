"""S35 OS Open Roads (GB): strategic road corridors for the Risk Explorer (online, GitHub Actions).

OS Open Roads is Ordnance Survey's open road network for Great Britain (OGL v3.0). The OS
Downloads API lists the files (cached as `os-open-roads-downloads.json`, 25 Oct 2026): the GB
GeoPackage is about 1.0 GB, too large to commit. So the online step downloads it to a temporary
folder, checks its size and MD5 against the list, and commits only:

- `open-roads-schema.json`: the layers, fields and counts of the road classes (read from the file
  itself, so the extraction below can be checked against what OS actually publishes);
- `open-roads-strategic.geojson`: motorways, trunk roads and other primary A roads, merged by road
  number, simplified and projected to WGS84 (the app's corridor layer).

Definitions (stated in the app): trunk roads are the roads the national highway authorities run
(England: National Highways' Strategic Road Network; Scotland: Transport Scotland; Wales: the
Welsh Government); the primary route network adds the other A roads signed as primary routes.
The extraction is deterministic: same input file, same output bytes.
"""

from __future__ import annotations

import hashlib
import json
import logging
import shutil
import tempfile
import urllib.request
import zipfile
from collections import defaultdict
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

from foodscope_pipeline.sources.ons_files import OGL, USER_AGENT, OnsFetchError

logger = logging.getLogger(__name__)

DOWNLOADS_LIST = "os-open-roads-downloads.json"
SCHEMA_FILE = "open-roads-schema.json"
EXTRACT_FILE = "open-roads-strategic.geojson"
FORMAT = "GeoPackage"
AREA = "GB"
SOURCE_ID = "S35"
# Douglas-Peucker tolerance in metres (EPSG:27700): about a pixel at zoom 11.
SIMPLIFY_M = 60.0
# Field names expected in the GeoPackage road link layer; the schema file records what was found.
LINK_LAYER_CANDIDATES = ("road_link", "RoadLink")
CLASS_FIELDS = ("road_classification", "class", "roadClassification")
NUMBER_FIELDS = ("road_classification_number", "roadClassificationNumber", "road_number", "roadNumber")
PRIMARY_FIELDS = ("primary_route", "primaryRoute", "primary")
TRUNK_FIELDS = ("trunk_road", "trunkRoad")

Downloader = Callable[[str, Path], None]


def _download(url: str, target: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=600) as res, target.open("wb") as out:  # noqa: S310
        shutil.copyfileobj(res, out, length=1 << 20)


def _md5(path: Path) -> str:
    h = hashlib.md5()  # noqa: S324 (OS publishes MD5 checksums)
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def pick_download(listing: list[dict]) -> dict:
    """The GB GeoPackage entry of the OS Downloads list."""
    for item in listing:
        if item.get("format") == FORMAT and item.get("area") == AREA:
            for key in ("url", "md5", "size", "fileName"):
                if key not in item:
                    raise OnsFetchError(f"OS Open Roads download list: entry without {key}: {item}")
            return item
    raise OnsFetchError(f"OS Open Roads download list has no {AREA} {FORMAT} entry")


def _first(names: list[str], candidates: tuple[str, ...]) -> str | None:
    lower = {n.lower(): n for n in names}
    for c in candidates:
        if c.lower() in lower:
            return lower[c.lower()]
    return None


def probe(gpkg: str) -> dict:
    """Layers, fields (name and type) and counts of the classification fields of the link layer."""
    import pyogrio

    layers = [str(name) for name, _ in pyogrio.list_layers(gpkg)]
    out: dict = {"layers": {}, "linkLayer": None}
    for layer in layers:
        info = pyogrio.read_info(gpkg, layer=layer)
        out["layers"][layer] = {
            "features": int(info["features"]),
            "crs": str(info["crs"]),
            "geometryType": str(info["geometry_type"]),
            "fields": [{"name": str(n), "type": str(t)} for n, t in zip(info["fields"], info["dtypes"], strict=True)],
        }
    link = next((name for name in layers if name in LINK_LAYER_CANDIDATES), None)
    out["linkLayer"] = link
    if link is None:
        return out
    fields = [f["name"] for f in out["layers"][link]["fields"]]
    found = {
        "class": _first(fields, CLASS_FIELDS),
        "number": _first(fields, NUMBER_FIELDS),
        "primary": _first(fields, PRIMARY_FIELDS),
        "trunk": _first(fields, TRUNK_FIELDS),
    }
    out["fieldsUsed"] = found
    counts: dict[str, dict[str, int]] = {}
    for role in ("class", "primary", "trunk"):
        name = found[role]
        if name is None:
            continue
        _, _, _, (values,) = pyogrio.raw.read(gpkg, layer=link, columns=[name], read_geometry=False)
        tally: dict[str, int] = defaultdict(int)
        for v in values:
            tally[str(v)] += 1
        counts[role] = dict(sorted(tally.items()))
    out["valueCounts"] = counts
    return out


def where_clause(schema: dict) -> str:
    """OGR SQL filter for motorways, trunk roads and primary A roads (read only what is kept)."""
    used = schema["fieldsUsed"]
    types = {f["name"]: f["type"] for f in schema["layers"][schema["linkLayer"]]["fields"]}

    def true(name: str) -> str:
        if types.get(name, "").startswith(("bool", "int", "uint")):
            return f'"{name}" = 1'
        return f"lower(\"{name}\") = 'true'"

    cls = used["class"]
    return f"\"{cls}\" = 'Motorway' OR {true(used['trunk'])} OR (\"{cls}\" = 'A Road' AND {true(used['primary'])})"


def _truthy(value: object) -> bool:
    return value is True or value == 1 or str(value).strip().lower() in {"true", "1", "y", "yes"}


def extract(gpkg: str, schema: dict, tolerance_m: float = SIMPLIFY_M) -> dict:
    """Motorways, trunk roads and primary A roads merged by road number, simplified, WGS84."""
    import pyogrio
    from pyproj import Transformer
    import numpy as np
    from shapely import from_wkb, line_merge, simplify, union_all
    from shapely import transform as transform_coords
    from shapely.geometry import mapping

    link = schema.get("linkLayer")
    used = schema.get("fieldsUsed") or {}
    missing = [role for role in ("class", "number", "primary", "trunk") if not used.get(role)]
    if link is None or missing:
        raise OnsFetchError(f"OS Open Roads: link layer {link!r} lacks fields for {missing}; see {SCHEMA_FILE}")
    crs = schema["layers"][link]["crs"]
    if "27700" not in crs:
        raise OnsFetchError(f"OS Open Roads: expected EPSG:27700, found {crs}")
    cols = [used["class"], used["number"], used["primary"], used["trunk"]]
    _, _, geoms, (classes, numbers, primary, trunk) = pyogrio.raw.read(
        gpkg, layer=link, columns=cols, where=where_clause(schema)
    )

    groups: dict[tuple[str, str], list] = defaultdict(list)
    kept = 0
    for g, cls, num, prim, trk in zip(geoms, classes, numbers, primary, trunk, strict=True):
        cls = str(cls)
        motorway = cls == "Motorway"
        strategic = motorway or _truthy(trk)
        primary_a = cls == "A Road" and _truthy(prim)
        if not (strategic or primary_a) or g is None:
            continue
        category = "strategic" if strategic else "primary"
        groups[(category, str(num or "").strip() or "unnumbered")].append(from_wkb(g))
        kept += 1

    bng_to_wgs = Transformer.from_crs(27700, 4326, always_xy=True)

    def to_wgs(xy):  # noqa: ANN001, ANN202
        lon, lat = bng_to_wgs.transform(xy[:, 0], xy[:, 1])
        return np.column_stack([lon, lat])
    features = []
    for (category, number), parts in sorted(groups.items()):
        merged = simplify(line_merge(union_all(parts)), tolerance_m, preserve_topology=False)
        if merged.is_empty:
            continue
        geom = mapping(transform_coords(merged, to_wgs))
        features.append({
            "type": "Feature",
            "properties": {"category": category, "road": number},
            "geometry": _round(geom),
        })
    return {
        "type": "FeatureCollection",
        "metadata": {"links": kept, "roads": len(features), "simplifyMetres": tolerance_m},
        "features": features,
    }


def _round(geom: dict, digits: int = 5) -> dict:
    def r(c):  # noqa: ANN001, ANN202
        return [round(c[0], digits), round(c[1], digits)] if isinstance(c[0], float) else [r(x) for x in c]

    return {"type": geom["type"], "coordinates": r(geom["coordinates"])}


def _entry(item_id: str, filename: str, body: bytes, url: str, description: str, now: datetime,
           **extra: object) -> dict:
    return {
        "id": item_id,
        "file": filename,
        "url": url,
        "sourceId": SOURCE_ID,
        "licence": OGL,
        "description": description,
        **extra,
        "httpStatus": 200,
        "bytes": len(body),
        "sha256": hashlib.sha256(body).hexdigest(),
        "retrievedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def fetch_open_roads(snapshot: str, raw_root: Path, download: Downloader = _download,
                     now: Callable[[], datetime] = lambda: datetime.now(UTC)) -> Path:
    """Download the GB GeoPackage, record its schema, extract the corridors; incremental."""
    folder = raw_root / "os" / snapshot
    index_path = folder / "index.json"
    if not index_path.is_file() or not (folder / DOWNLOADS_LIST).is_file():
        raise OnsFetchError(f"{folder}: run fetch-reference --set stage6 first (needs {DOWNLOADS_LIST})")
    index = json.loads(index_path.read_text(encoding="utf-8"))
    done = {e["id"] for e in index["files"]}
    if {"os.open_roads_schema", "os.open_roads_strategic"} <= done:
        logger.info("OS Open Roads extract already cached in %s", folder)
        return folder
    item = pick_download(json.loads((folder / DOWNLOADS_LIST).read_text(encoding="utf-8")))
    source = {"sourceFile": item["fileName"], "sourceBytes": item["size"], "sourceMd5": item["md5"],
              "sourceUrl": item["url"]}
    with tempfile.TemporaryDirectory() as tmp:
        zpath = Path(tmp) / item["fileName"]
        download(item["url"], zpath)
        size, md5 = zpath.stat().st_size, _md5(zpath)
        if size != item["size"] or md5 != item["md5"]:
            raise OnsFetchError(f"OS Open Roads: downloaded {size} bytes, md5 {md5}; the list says "
                                f"{item['size']} bytes, md5 {item['md5']}")
        with zipfile.ZipFile(zpath) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".gpkg")]
        if len(names) != 1:
            raise OnsFetchError(f"OS Open Roads: expected one .gpkg in the zip, found {names}")
        gpkg = f"/vsizip/{zpath}/{names[0]}"
        schema = probe(gpkg)
        schema_body = (json.dumps(schema, indent=2, sort_keys=True) + "\n").encode()
        new = [e for e in index["files"] if e["id"] not in {"os.open_roads_schema", "os.open_roads_strategic"}]
        new.append(_entry("os.open_roads_schema", SCHEMA_FILE, schema_body, item["url"],
                          "OS Open Roads GB GeoPackage: layers, fields and road class counts (read from the file)",
                          now(), derived=True, **source))
        (folder / SCHEMA_FILE).write_bytes(schema_body)
        try:
            geojson = extract(gpkg, schema)
        finally:
            # The schema is kept even if the extraction fails, so the fields can be checked.
            index["files"] = new
            index_path.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
        body = (json.dumps(geojson, separators=(",", ":"), sort_keys=True) + "\n").encode()
        (folder / EXTRACT_FILE).write_bytes(body)
        new.append(_entry("os.open_roads_strategic", EXTRACT_FILE, body, item["url"],
                          "OS Open Roads: motorways, trunk roads and primary A roads merged by road number, "
                          f"simplified ({SIMPLIFY_M:.0f} m), WGS84",
                          now(), derived=True, **source))
        index["files"] = new
        index_path.write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    logger.info("OS Open Roads: %s", geojson["metadata"])
    return folder
