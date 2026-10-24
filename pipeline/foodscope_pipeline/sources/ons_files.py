"""ONS files needed before Stage 4 (S18 population, LAD 2022→2023 lookup) — online download.

The sandbox used to build this app cannot reach ONS, so this step runs on GitHub Actions
(`.github/workflows/refresh-reference-data.yml`), like the HMRC ingest (ADR-0016). Each file is
stored byte-for-byte in `pipeline/raw/ons/<snapshot>/` with its URL, retrieval time, HTTP status,
size and SHA-256 in `index.json`. Everything after this step runs offline from the cache.

Sources (URLs verified on the publisher pages, 24 Oct 2026; docs/03-DATA-SOURCES.md):
- S18: ONS "Estimates of the population for the UK, England, Wales, Scotland and Northern
  Ireland", mid-2025 edition (`mye25tablesuk.xlsx`, released 1 Oct 2026, OGL v3.0).
- S14 lookup: ONS "Local Authority District (2022) to Local Authority District (2023) Lookup in
  the UK" (feature service LAD22_LAD23_UK_LU_v1; fields LAD22CD, LAD22NM, LAD22NMW, LAD23CD,
  LAD23NM, LAD23NMW), used to compare the ONS chain-supermarket counts (S12, older councils)
  with May 2025 councils.
"""

from __future__ import annotations

import hashlib
import json
import logging
import urllib.error
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

logger = logging.getLogger(__name__)

USER_AGENT = "foodscope-pipeline (+https://github.com/johnchewitt/FoodScopeUK)"

Transport = Callable[[str], tuple[int, bytes]]


@dataclass(frozen=True)
class OnsFile:
    id: str
    filename: str
    url: str
    source_id: str
    licence: str
    description: str


MYE25_URL = (
    "https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/populationandmigration/"
    "populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland/"
    "mid2025/mye25tablesuk.xlsx"
)
LAD22_LAD23_URL = (
    "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD22_LAD23_UK_LU_v1/"
    "FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&orderByFields=LAD22CD"
    "&resultRecordCount=2000&f=json"
)

FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="ons.mye25",
        filename="mye25tablesuk.xlsx",
        url=MYE25_URL,
        source_id="S18",
        licence="Open Government Licence v3.0",
        description="Population estimates for the UK, England, Wales, Scotland and Northern Ireland: mid-2025",
    ),
    OnsFile(
        id="ons.lad22_lad23_lookup",
        filename="lad22-lad23-lookup.json",
        url=LAD22_LAD23_URL,
        source_id="S14",
        licence="Open Government Licence v3.0",
        description="Local Authority District (2022) to Local Authority District (2023) Lookup in the UK",
    ),
)


class OnsFetchError(RuntimeError):
    """A download failed or returned something other than the expected file."""


def urllib_transport(url: str, timeout: float = 120.0) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:  # noqa: S310 (fixed https hosts)
            return res.status, res.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def _check(file: OnsFile, status: int, body: bytes) -> None:
    if status != 200:
        raise OnsFetchError(f"{file.id}: HTTP {status} from {file.url}")
    if file.filename.endswith(".xlsx") and not body.startswith(b"PK"):
        raise OnsFetchError(f"{file.id}: response is not an .xlsx file ({body[:40]!r})")
    if file.filename.endswith(".json"):
        try:
            doc = json.loads(body)
        except ValueError as exc:
            raise OnsFetchError(f"{file.id}: response is not JSON") from exc
        if "error" in doc or not isinstance(doc.get("features"), list):
            raise OnsFetchError(f"{file.id}: unexpected response {str(doc)[:200]}")
        if doc.get("exceededTransferLimit"):
            raise OnsFetchError(f"{file.id}: more records than one page; paging is not implemented")


def fetch(snapshot: str, raw_root: Path, transport: Transport = urllib_transport,
          now: Callable[[], datetime] = lambda: datetime.now(UTC)) -> Path:
    """Download every file into raw_root/<snapshot>/ and write index.json. Returns the folder."""
    folder = raw_root / snapshot
    folder.mkdir(parents=True, exist_ok=True)
    entries = []
    for file in FILES:
        status, body = transport(file.url)
        _check(file, status, body)
        (folder / file.filename).write_bytes(body)
        entries.append({
            "id": file.id,
            "file": file.filename,
            "url": file.url,
            "sourceId": file.source_id,
            "licence": file.licence,
            "description": file.description,
            "httpStatus": status,
            "bytes": len(body),
            "sha256": hashlib.sha256(body).hexdigest(),
            "retrievedAt": now().strftime("%Y-%m-%dT%H:%M:%SZ"),
        })
        logger.info("%s: %d bytes from %s", file.id, len(body), file.url)
    index = {"schemaVersion": 1, "snapshot": snapshot, "files": entries}
    (folder / "index.json").write_text(json.dumps(index, indent=2) + "\n", encoding="utf-8")
    return folder


def load_index(folder: Path) -> dict:
    """Read index.json and verify every cached file against its recorded checksum."""
    index = json.loads((folder / "index.json").read_text(encoding="utf-8"))
    for entry in index["files"]:
        data = (folder / entry["file"]).read_bytes()
        if hashlib.sha256(data).hexdigest() != entry["sha256"] or len(data) != entry["bytes"]:
            raise OnsFetchError(f"{entry['file']}: does not match index.json (edited or truncated?)")
    return index
