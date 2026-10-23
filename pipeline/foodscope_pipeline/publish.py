"""Build and validate public/data/manifest.json (architecture §6.1 'publish').

Stage 1: the manifest lists the static reference layer(s) described by `*.provenance.json`
sidecars under public/data/reference/, plus the catalogue entries for the sources in use.
No statistical snapshot exists yet, so `snapshotId` is null.
"""

from __future__ import annotations

import hashlib
import json
import logging
from pathlib import Path
from typing import Any

import jsonschema

from foodscope_pipeline import __version__

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "public" / "data"
SCHEMA_PATH = REPO_ROOT / "schemas" / "manifest.schema.json"
CATALOGUE_PATH = Path(__file__).resolve().parent / "catalogue.json"


class ManifestError(RuntimeError):
    """Raised when published data and its provenance disagree."""


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_reference_datasets(data_dir: Path) -> list[dict[str, Any]]:
    """Read provenance sidecars and verify each referenced file's checksum and size."""
    datasets: list[dict[str, Any]] = []
    for sidecar in sorted((data_dir / "reference").glob("*.provenance.json")):
        record = json.loads(sidecar.read_text(encoding="utf-8"))
        target = data_dir / record["path"]
        if not target.is_file():
            raise ManifestError(f"{sidecar.name}: data file {record['path']} is missing")
        actual = _sha256(target)
        if actual != record["sha256"]:
            raise ManifestError(f"{sidecar.name}: checksum mismatch for {record['path']}")
        if target.stat().st_size != record["bytes"]:
            raise ManifestError(f"{sidecar.name}: size mismatch for {record['path']}")
        datasets.append(record)
    return sorted(datasets, key=lambda d: d["id"])


def build_manifest(data_dir: Path, catalogue: list[dict[str, Any]], snapshot_id: str | None = None) -> dict[str, Any]:
    """Assemble the manifest.

    `generatedAt` is the latest dataset retrieval time (not the wall clock) so that re-running
    the step on unchanged inputs produces byte-identical output.
    """
    datasets = load_reference_datasets(data_dir)
    used_sources = {sid for d in datasets for sid in d["sourceIds"]}
    missing = used_sources - {c["id"] for c in catalogue}
    if missing:
        raise ManifestError(f"datasets cite sources absent from the catalogue: {sorted(missing)}")
    generated_at = max((d["retrieval"]["retrievedAt"] for d in datasets), default="1970-01-01T00:00:00Z")
    return {
        "schemaVersion": 1,
        "generatedAt": generated_at,
        "generator": f"foodscope-pipeline {__version__}",
        "snapshotId": snapshot_id,
        "datasets": datasets,
        "catalogue": sorted(catalogue, key=lambda c: c["id"]),
    }


def validate_manifest(manifest: dict[str, Any], schema_path: Path = SCHEMA_PATH) -> None:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    jsonschema.validate(manifest, schema, format_checker=jsonschema.FormatChecker())


def publish(data_dir: Path = DATA_DIR, catalogue_path: Path = CATALOGUE_PATH) -> Path:
    catalogue = json.loads(catalogue_path.read_text(encoding="utf-8"))
    manifest = build_manifest(data_dir, catalogue)
    validate_manifest(manifest)
    out = data_dir / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    logger.info("wrote %s (%d datasets, %d catalogue entries)", out, len(manifest["datasets"]), len(catalogue))
    return out
