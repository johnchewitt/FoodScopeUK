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
    assert ids == ["reference.world_countries_110m"]
    ds = manifest["datasets"][0]
    body = (data_dir / ds["path"]).read_bytes()
    assert hashlib.sha256(body).hexdigest() == ds["sha256"]
    assert ds["featureCount"] == len(json.loads(body)["features"])


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
    assert committed == build_manifest(DATA_DIR, CATALOGUE)
