"""OS Open Roads extraction (S35) on an obviously synthetic GeoPackage: roads "A", "B", "M"."""

from __future__ import annotations

import hashlib
import json
import shutil
import zipfile
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import pyogrio
import pytest
from shapely import LineString, to_wkb

from foodscope_pipeline.sources.ons_files import OnsFetchError
from foodscope_pipeline.sources.os_open_roads import EXTRACT_FILE, SCHEMA_FILE, fetch_open_roads, pick_download

FIXED = datetime(2026, 10, 25, 12, 0, 0, tzinfo=UTC)

# (class, number, primary, trunk, line in BNG metres)
LINKS = [
    ("Motorway", "M0", 1, 1, [(400000, 300000), (401000, 300000)]),
    ("Motorway", "M0", 1, 1, [(401000, 300000), (402000, 300500)]),
    ("A Road", "A0", 1, 0, [(410000, 310000), (411000, 310000)]),  # primary, not trunk
    ("A Road", "A9", 0, 1, [(420000, 320000), (421000, 320000)]),  # trunk, not primary
    ("A Road", "A5", 0, 0, [(430000, 330000), (431000, 330000)]),  # neither: dropped
    ("B Road", "B1", 0, 0, [(440000, 340000), (441000, 340000)]),  # dropped
]


def make_zip(tmp: Path) -> Path:
    gpkg = tmp / "oproad_gb.gpkg"
    geoms = np.array([to_wkb(LineString(c)) for *_, c in LINKS], dtype=object)
    fields = ["road_classification", "road_classification_number", "primary_route", "trunk_road"]
    data = [
        np.array([r[0] for r in LINKS], dtype=object),
        np.array([r[1] for r in LINKS], dtype=object),
        np.array([bool(r[2]) for r in LINKS]),
        np.array([bool(r[3]) for r in LINKS]),
    ]
    pyogrio.raw.write(gpkg, geoms, data, fields, layer="road_link", driver="GPKG", crs="EPSG:27700",
                      geometry_type="LineString")
    zpath = tmp / "src" / "oproad_gpkg_gb.zip"
    zpath.parent.mkdir()
    with zipfile.ZipFile(zpath, "w") as z:
        z.write(gpkg, "Data/oproad_gb.gpkg")
    return zpath


def setup_folder(raw: Path, zpath: Path, md5: str | None = None) -> None:
    folder = raw / "os" / "2026-10-25"
    folder.mkdir(parents=True)
    body = zpath.read_bytes()
    listing = [{"md5": md5 or hashlib.md5(body).hexdigest(), "size": len(body), "url": "https://example.invalid/gpkg",  # noqa: S324
                "format": "GeoPackage", "area": "GB", "fileName": "oproad_gpkg_gb.zip"}]
    (folder / "os-open-roads-downloads.json").write_text(json.dumps(listing))
    (folder / "index.json").write_text(json.dumps({"schemaVersion": 1, "snapshot": "2026-10-25", "files": [
        {"id": "os.open_roads_downloads", "file": "os-open-roads-downloads.json"}]}))


def test_extracts_strategic_and_primary_roads(tmp_path: Path) -> None:
    zpath = make_zip(tmp_path)
    raw = tmp_path / "raw"
    setup_folder(raw, zpath)
    folder = fetch_open_roads("2026-10-25", raw, download=lambda url, target: shutil.copy(zpath, target),
                              now=lambda: FIXED)
    schema = json.loads((folder / SCHEMA_FILE).read_text())
    assert schema["linkLayer"] == "road_link"
    assert schema["fieldsUsed"]["trunk"] == "trunk_road"
    assert schema["valueCounts"]["class"] == {"A Road": 3, "B Road": 1, "Motorway": 2}
    fc = json.loads((folder / EXTRACT_FILE).read_text())
    props = sorted((f["properties"]["category"], f["properties"]["road"]) for f in fc["features"])
    assert props == [("primary", "A0"), ("strategic", "A9"), ("strategic", "M0")]
    assert fc["metadata"]["links"] == 4
    m0 = next(f for f in fc["features"] if f["properties"]["road"] == "M0")
    assert m0["geometry"]["type"] == "LineString"  # the two motorway links merged
    lon, lat = m0["geometry"]["coordinates"][0]
    assert -3 < lon < 0 and 51 < lat < 54  # WGS84, near the synthetic BNG coordinates
    index = json.loads((folder / "index.json").read_text())
    entries = {e["id"]: e for e in index["files"]}
    assert entries["os.open_roads_strategic"]["sourceMd5"] == hashlib.md5(zpath.read_bytes()).hexdigest()  # noqa: S324
    assert entries["os.open_roads_strategic"]["derived"] is True
    # Incremental: a second run downloads nothing.
    fetch_open_roads("2026-10-25", raw, download=lambda url, target: pytest.fail("downloaded again"))


def test_checksum_mismatch_stops(tmp_path: Path) -> None:
    zpath = make_zip(tmp_path)
    raw = tmp_path / "raw"
    setup_folder(raw, zpath, md5="0" * 32)
    with pytest.raises(OnsFetchError, match="md5"):
        fetch_open_roads("2026-10-25", raw, download=lambda url, target: shutil.copy(zpath, target))
    assert not (raw / "os" / "2026-10-25" / EXTRACT_FILE).exists()


def test_pick_download_needs_the_gb_geopackage() -> None:
    with pytest.raises(OnsFetchError):
        pick_download([{"format": "GML", "area": "GB"}])
