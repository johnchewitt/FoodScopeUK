"""Files the project owner provided for the build (S11 GEOLYTIX, S12 ONS supermarkets, S14 BFE).

Each folder under `pipeline/raw/<source>/<edition>/` holds the file byte-for-byte as received and
an `index.json` with its original name, size, SHA-256, licence, attribution and when it reached
the build session. The build reads only through `load_provided`, which refuses a file that no
longer matches its recorded checksum.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


class ProvidedFileError(RuntimeError):
    """A provided file is missing or does not match its index entry."""


def load_provided(folder: Path, item_id: str) -> tuple[Path, dict]:
    """Return the path of the provided file `item_id` in `folder` and its index entry."""
    index_path = folder / "index.json"
    if not index_path.is_file():
        raise ProvidedFileError(f"{folder}: index.json is missing")
    index = json.loads(index_path.read_text(encoding="utf-8"))
    entries = [e for e in index["files"] if e["id"] == item_id]
    if len(entries) != 1:
        raise ProvidedFileError(f"{folder}: expected one entry '{item_id}', found {len(entries)}")
    entry = entries[0]
    path = folder / entry["file"]
    if not path.is_file():
        raise ProvidedFileError(f"{path}: file is missing")
    data = path.read_bytes()
    if len(data) != entry["bytes"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
        raise ProvidedFileError(f"{path}: does not match index.json (edited or truncated?)")
    return path, entry
