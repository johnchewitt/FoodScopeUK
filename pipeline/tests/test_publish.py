import hashlib
import json
import shutil
from pathlib import Path

import jsonschema
import pytest

from foodscope_pipeline.publish import (
    CATALOGUE_PATH,
    DATA_DIR,
    ManifestError,
    build_manifest,
    latest_snapshot_id,
    publish,
    validate_manifest,
)

CATALOGUE = json.loads(CATALOGUE_PATH.read_text(encoding="utf-8"))


@pytest.fixture()
def data_dir(tmp_path: Path) -> Path:
    """Copy of the real committed reference data (not synthetic)."""
    dst = tmp_path / "data"
    shutil.copytree(DATA_DIR / "reference", dst / "reference")
    return dst


def test_manifest_from_committed_reference_data_is_valid(data_dir: Path) -> None:
    manifest = build_manifest(data_dir, CATALOGUE)
    validate_manifest(manifest)
    assert manifest["snapshotId"] is None
    ids = [d["id"] for d in manifest["datasets"]]
    assert ids == ["reference.world_countries_110m", "reference.world_country_points"]
    outlines, points = manifest["datasets"]
    body = (data_dir / outlines["path"]).read_bytes()
    assert hashlib.sha256(body).hexdigest() == outlines["sha256"]
    assert outlines["featureCount"] == len(json.loads(body)["features"])
    assert points["featureCount"] == len(json.loads((data_dir / points["path"]).read_bytes())["points"])


def test_snapshot_datasets_are_listed_with_the_latest_snapshot_id(data_dir: Path) -> None:
    snap = data_dir / "snapshots" / "2026-10-23" / "trade"
    snap.mkdir(parents=True)
    body = b'{"synthetic": true}\n'
    (snap / "x.json").write_bytes(body)
    sidecar = {
        "id": "trade.synthetic", "title": "Synthetic", "role": "statistical",
        "path": "snapshots/2026-10-23/trade/x.json", "format": "json", "schemaId": None,
        "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body), "sourceIds": ["S24"],
        "referencePeriod": "n/a", "coverage": "n/a", "provenance": "measured", "licence": "n/a",
        "attribution": "n/a", "expectedCadence": "monthly",
        "retrieval": {"method": "test", "source": "test", "retrievedAt": "2026-10-23T12:00:00Z"},
    }
    (snap / "x.provenance.json").write_text(json.dumps(sidecar))
    (data_dir / "snapshots" / "2026-01-01").mkdir()  # older snapshot is ignored
    assert latest_snapshot_id(data_dir) == "2026-10-23"
    manifest = build_manifest(data_dir, CATALOGUE, latest_snapshot_id(data_dir))
    validate_manifest(manifest)
    assert manifest["snapshotId"] == "2026-10-23"
    assert "trade.synthetic" in [d["id"] for d in manifest["datasets"]]
    assert manifest["generatedAt"] == "2026-10-23T12:00:00Z"


def test_publish_is_idempotent(data_dir: Path, tmp_path: Path) -> None:
    out1 = publish(data_dir, CATALOGUE_PATH).read_bytes()
    out2 = publish(data_dir, CATALOGUE_PATH).read_bytes()
    assert out1 == out2


def test_checksum_mismatch_is_rejected(data_dir: Path) -> None:
    with (data_dir / "reference" / "world-countries-110m.geojson").open("ab") as fh:
        fh.write(b" ")
    with pytest.raises(ManifestError, match="checksum"):
        build_manifest(data_dir, CATALOGUE)


def test_uncatalogued_source_is_rejected(data_dir: Path) -> None:
    with pytest.raises(ManifestError, match="catalogue"):
        build_manifest(data_dir, [c for c in CATALOGUE if c["id"] != "S24"])


def test_schema_rejects_bad_snapshot_id(data_dir: Path) -> None:
    manifest = build_manifest(data_dir, CATALOGUE, snapshot_id="23/10/2026")
    with pytest.raises(jsonschema.ValidationError):
        validate_manifest(manifest)


def test_empty_data_dir_gives_empty_manifest(tmp_path: Path) -> None:
    (tmp_path / "reference").mkdir()
    manifest = build_manifest(tmp_path, CATALOGUE)
    validate_manifest(manifest)
    assert manifest["datasets"] == []


def test_committed_manifest_is_current() -> None:
    """public/data/manifest.json must match what `publish` would write now."""
    committed = json.loads((DATA_DIR / "manifest.json").read_text(encoding="utf-8"))
    assert committed == build_manifest(DATA_DIR, CATALOGUE, latest_snapshot_id(DATA_DIR))
