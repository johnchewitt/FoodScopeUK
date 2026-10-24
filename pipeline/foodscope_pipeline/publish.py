"""Build and validate public/data/manifest.json (architecture §6.1 'publish').

The manifest lists every dataset described by a `*.provenance.json` sidecar — reference layers
under public/data/reference/ and statistical datasets under public/data/snapshots/<date>/<family>/
— plus the catalogue entries for the sources they cite.

Each dataset family (a folder directly under a snapshot: `trade`, `local`, …) is taken from the
newest snapshot that contains it, so families refresh on their own schedules (John's decision,
24 Oct 2026; ADR-0021): a new HMRC trade snapshot does not drop the store data, and a new store
snapshot does not drop the trade data. `snapshots` maps each family to its snapshot date;
`snapshotId` is the newest of them, or null when nothing has been published.
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


def _snapshot_dirs(data_dir: Path) -> list[Path]:
    root = data_dir / "snapshots"
    if not root.is_dir():
        return []
    return sorted(p for p in root.iterdir() if p.is_dir() and len(p.name) == 10 and p.name[4] == "-")


def latest_snapshot_id(data_dir: Path) -> str | None:
    dirs = _snapshot_dirs(data_dir)
    return dirs[-1].name if dirs else None


def snapshot_families(data_dir: Path) -> dict[str, str]:
    """Family → the newest snapshot date holding it (a family is a folder inside a snapshot)."""
    families: dict[str, str] = {}
    for snap in _snapshot_dirs(data_dir):
        for family in sorted(p.name for p in snap.iterdir() if p.is_dir()):
            families[family] = snap.name  # later snapshots overwrite earlier ones
    return dict(sorted(families.items()))


def _sidecars(data_dir: Path, families: dict[str, str]) -> list[Path]:
    found = sorted((data_dir / "reference").glob("*.provenance.json"))
    for family, snapshot_id in families.items():
        found += sorted((data_dir / "snapshots" / snapshot_id / family).rglob("*.provenance.json"))
    return found


def load_reference_datasets(data_dir: Path, families: dict[str, str] | None = None) -> list[dict[str, Any]]:
    """Read provenance sidecars and verify each referenced file's checksum and size."""
    datasets: list[dict[str, Any]] = []
    for sidecar in _sidecars(data_dir, families or {}):
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


def build_manifest(data_dir: Path, catalogue: list[dict[str, Any]], families: dict[str, str] | None = None,
                   snapshot_id: str | None = None) -> dict[str, Any]:
    """Assemble the manifest from the reference layers and each family's newest snapshot.

    `generatedAt` is the latest dataset retrieval time (not the wall clock) so that re-running
    the step on unchanged inputs produces byte-identical output. `snapshot_id` defaults to the
    newest family snapshot.
    """
    families = families or {}
    if snapshot_id is None and families:
        snapshot_id = max(families.values())
    datasets = load_reference_datasets(data_dir, families)
    ids = [d["id"] for d in datasets]
    if len(set(ids)) != len(ids):
        raise ManifestError(f"duplicate dataset ids: {sorted(i for i in ids if ids.count(i) > 1)}")
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
        "snapshots": families,
        "datasets": datasets,
        "catalogue": sorted(catalogue, key=lambda c: c["id"]),
    }


def validate_manifest(manifest: dict[str, Any], schema_path: Path = SCHEMA_PATH) -> None:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    jsonschema.validate(manifest, schema, format_checker=jsonschema.FormatChecker())


def publish(data_dir: Path = DATA_DIR, catalogue_path: Path = CATALOGUE_PATH) -> Path:
    catalogue = json.loads(catalogue_path.read_text(encoding="utf-8"))
    manifest = build_manifest(data_dir, catalogue, snapshot_families(data_dir))
    validate_manifest(manifest)
    out = data_dir / "manifest.json"
    out.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    logger.info("wrote %s (%d datasets, %d catalogue entries)", out, len(manifest["datasets"]), len(catalogue))
    return out
