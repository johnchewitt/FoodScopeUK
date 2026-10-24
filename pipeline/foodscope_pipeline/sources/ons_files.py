"""ONS files needed before Stage 4 (S18 population, S14 boundaries and lookup) — online download.

The sandbox used to build this app cannot reach ONS, so this step runs on GitHub Actions
(`.github/workflows/refresh-reference-data.yml`), like the HMRC ingest (ADR-0016). Each response
is stored byte-for-byte in `pipeline/raw/ons/<snapshot>/` with its URL, retrieval time, HTTP
status, size and SHA-256 in `index.json`. Everything after this step runs offline from the cache.

The step is incremental: items already in `index.json` (and matching their checksums) are not
downloaded again, so adding an item to `FILES` or `QUERIES` fetches only that item.

Sources (URLs verified on the publisher pages, 24 Oct 2026; docs/03-DATA-SOURCES.md):
- S18: ONS "Estimates of the population for the UK, England, Wales, Scotland and Northern
  Ireland", mid-2025 edition (`mye25tablesuk.xlsx`, released 1 Oct 2026, OGL v3.0).
- S14 lookup: ONS "Local Authority District (2022) to Local Authority District (2023) Lookup in
  the UK" (feature service LAD22_LAD23_UK_LU_v1; fields LAD22CD, LAD22NM, LAD22NMW, LAD23CD,
  LAD23NM, LAD23NMW), used to compare the ONS chain-supermarket counts (S12, older councils)
  with May 2025 councils.
- S14 boundaries: ONS "Local Authority Districts (May 2025) Boundaries UK BGC (V2)" (feature
  service LAD_MAY_2025_UK_BGC_V2, layer 0: maxRecordCount 2000, pagination and orderBy
  supported, spatial reference 27700). BGC is generalised to 20 m and clipped to the coastline,
  so it is the display geometry; store assignment uses the full-extent BFE file (see
  `ons_lad.py`). Fetched in pages of `page_size` features with the total checked against a
  `returnCountOnly` query.
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
MAX_PAGES = 40

Transport = Callable[[str], tuple[int, bytes]]


@dataclass(frozen=True)
class OnsFile:
    id: str
    filename: str
    url: str
    source_id: str
    licence: str
    description: str


@dataclass(frozen=True)
class OnsQuery:
    """An ArcGIS feature-service query fetched in pages (`resultOffset`/`resultRecordCount`)."""

    id: str
    stem: str
    layer_url: str
    params: str
    page_size: int
    source_id: str
    licence: str
    description: str

    def count_url(self) -> str:
        return f"{self.layer_url}/query?where=1%3D1&returnCountOnly=true&f=json"

    def page_url(self, offset: int) -> str:
        return f"{self.layer_url}/query?{self.params}&resultOffset={offset}&resultRecordCount={self.page_size}"


OGL = "Open Government Licence v3.0"
ONS_SERVICES = "https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services"

MYE25_URL = (
    "https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/populationandmigration/"
    "populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland/"
    "mid2025/mye25tablesuk.xlsx"
)
LAD22_LAD23_URL = (
    f"{ONS_SERVICES}/LAD22_LAD23_UK_LU_v1/"
    "FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&orderByFields=LAD22CD"
    "&resultRecordCount=2000&f=json"
)
LAD25_BGC_LAYER = f"{ONS_SERVICES}/LAD_MAY_2025_UK_BGC_V2/FeatureServer/0"

FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="ons.mye25",
        filename="mye25tablesuk.xlsx",
        url=MYE25_URL,
        source_id="S18",
        licence=OGL,
        description="Population estimates for the UK, England, Wales, Scotland and Northern Ireland: mid-2025",
    ),
    OnsFile(
        id="ons.lad22_lad23_lookup",
        filename="lad22-lad23-lookup.json",
        url=LAD22_LAD23_URL,
        source_id="S14",
        licence=OGL,
        description="Local Authority District (2022) to Local Authority District (2023) Lookup in the UK",
    ),
)

QUERIES: tuple[OnsQuery, ...] = (
    OnsQuery(
        id="ons.lad25_bgc",
        stem="lad-may-2025-uk-bgc-v2",
        layer_url=LAD25_BGC_LAYER,
        params=(
            "where=1%3D1&outFields=LAD25CD,LAD25NM,LAD25NMW&returnGeometry=true&outSR=27700"
            "&orderByFields=LAD25CD&f=json"
        ),
        page_size=50,
        source_id="S14",
        licence=OGL,
        description="Local Authority Districts (May 2025) Boundaries UK BGC (V2), EPSG:27700",
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


def _json_doc(item_id: str, body: bytes) -> dict:
    try:
        doc = json.loads(body)
    except ValueError as exc:
        raise OnsFetchError(f"{item_id}: response is not JSON") from exc
    if not isinstance(doc, dict) or "error" in doc:
        raise OnsFetchError(f"{item_id}: unexpected response {str(doc)[:200]}")
    return doc


def _check(file: OnsFile, status: int, body: bytes) -> None:
    if status != 200:
        raise OnsFetchError(f"{file.id}: HTTP {status} from {file.url}")
    if file.filename.endswith(".xlsx") and not body.startswith(b"PK"):
        raise OnsFetchError(f"{file.id}: response is not an .xlsx file ({body[:40]!r})")
    if file.filename.endswith(".json"):
        doc = _json_doc(file.id, body)
        if not isinstance(doc.get("features"), list):
            raise OnsFetchError(f"{file.id}: unexpected response {str(doc)[:200]}")
        if doc.get("exceededTransferLimit"):
            raise OnsFetchError(f"{file.id}: more records than one page; paging is not implemented")


def _entry(item_id: str, filename: str, url: str, source_id: str, licence: str, description: str,
           status: int, body: bytes, retrieved: datetime, **extra: object) -> dict:
    return {
        "id": item_id,
        "file": filename,
        "url": url,
        "sourceId": source_id,
        "licence": licence,
        "description": description,
        **extra,
        "httpStatus": status,
        "bytes": len(body),
        "sha256": hashlib.sha256(body).hexdigest(),
        "retrievedAt": retrieved.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def _fetch_file(file: OnsFile, folder: Path, transport: Transport, now: Callable[[], datetime]) -> list[dict]:
    status, body = transport(file.url)
    _check(file, status, body)
    (folder / file.filename).write_bytes(body)
    logger.info("%s: %d bytes from %s", file.id, len(body), file.url)
    return [_entry(file.id, file.filename, file.url, file.source_id, file.licence, file.description,
                   status, body, now())]


def _fetch_query(query: OnsQuery, folder: Path, transport: Transport, now: Callable[[], datetime]) -> list[dict]:
    """Fetch the count, then pages until the service reports no more records; check the total."""
    meta = (query.source_id, query.licence, query.description)
    status, body = transport(query.count_url())
    if status != 200:
        raise OnsFetchError(f"{query.id}: HTTP {status} from {query.count_url()}")
    count = _json_doc(query.id, body).get("count")
    if not isinstance(count, int) or count <= 0:
        raise OnsFetchError(f"{query.id}: count query returned {str(body[:200])}")
    files = [(f"{query.stem}.count.json", query.count_url(), status, body, {"role": "count"})]

    offset, page = 0, 0
    while True:
        if page >= MAX_PAGES:
            raise OnsFetchError(f"{query.id}: more than {MAX_PAGES} pages; stopping")
        url = query.page_url(offset)
        status, body = transport(url)
        if status != 200:
            raise OnsFetchError(f"{query.id}: HTTP {status} from {url}")
        features = _json_doc(query.id, body).get("features")
        if not isinstance(features, list):
            raise OnsFetchError(f"{query.id}: page {page} has no features list")
        more = bool(json.loads(body).get("exceededTransferLimit"))
        files.append((f"{query.stem}.p{page:03d}.json", url, status, body,
                      {"role": "page", "page": page, "features": len(features)}))
        offset += len(features)
        page += 1
        if not more or not features:
            break
    if offset != count:
        raise OnsFetchError(f"{query.id}: pages hold {offset} features but the service counts {count}")

    entries = []
    for filename, url, status, body, extra in files:
        (folder / filename).write_bytes(body)
        entries.append(_entry(query.id, filename, url, *meta, status, body, now(), **extra))
    logger.info("%s: %d features in %d pages", query.id, count, page)
    return entries


def _existing(folder: Path) -> list[dict]:
    if not (folder / "index.json").is_file():
        return []
    return load_index(folder)["files"]


def fetch(snapshot: str, raw_root: Path, transport: Transport = urllib_transport,
          now: Callable[[], datetime] = lambda: datetime.now(UTC)) -> Path:
    """Download every item not yet cached into raw_root/<snapshot>/ and write index.json.

    Items already listed in index.json are verified against their checksums and kept as they
    are. index.json is written only after every new item has downloaded and passed its checks.
    Returns the folder.
    """
    folder = raw_root / snapshot
    folder.mkdir(parents=True, exist_ok=True)
    entries = _existing(folder)
    cached = {e["id"] for e in entries}
    new: list[dict] = []
    for file in FILES:
        if file.id not in cached:
            new += _fetch_file(file, folder, transport, now)
    for query in QUERIES:
        if query.id not in cached:
            new += _fetch_query(query, folder, transport, now)
    if not new and entries:
        logger.info("all ONS items for %s already cached", snapshot)
        return folder
    index = {"schemaVersion": 1, "snapshot": snapshot, "files": entries + new}
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


def files_for(index: dict, item_id: str) -> list[dict]:
    """Index entries of one item, in the order they were fetched."""
    found = [e for e in index["files"] if e["id"] == item_id]
    if not found:
        raise OnsFetchError(f"{item_id}: not in the ONS cache {index.get('snapshot')}")
    return found
