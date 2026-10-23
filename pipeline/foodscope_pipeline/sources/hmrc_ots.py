"""HMRC Overseas Trade Statistics API (S01) — online ingestion into a raw-response cache.

This is the only module that talks to `api.uktradeinfo.com`. It never runs in the browser
(CLAUDE.md: rate-limited government APIs are called from the pipeline only).

Behaviour (docs/03-DATA-SOURCES.md, S01):
- At most 50 requests per minute (HMRC's limit is 60); retries with back-off on HTTP 429/5xx.
- Follows `@odata.nextLink` until the last page (responses are capped at 40,000 items).
- Every response is stored byte-for-byte (gzip, deterministic) in `pipeline/raw/hmrc/<snapshot>/`
  with its URL, retrieval timestamp, HTTP status, SHA-256 and item count in `index.json`, so the
  snapshot can be rebuilt offline (`build-trade`) and audited.
"""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

API_BASE = "https://api.uktradeinfo.com"
MAX_REQUESTS_PER_MINUTE = 50
IMPORT_FLOWS = (1, 3)  # 1 = EU imports, 3 = non-EU imports (OTS)
FIRST_MONTH = 201901
USER_AGENT = "foodscope-pipeline (+https://github.com/johnchewitt/FoodScopeUK)"
# Characters left unescaped in OData query values, for readable cached URLs.
_SAFE = "(),'/:$"

Transport = Callable[[str], tuple[int, bytes]]


@dataclass(frozen=True)
class Basket:
    id: str
    label: str
    definition: str
    hs_scope: str
    hs4: tuple[str, ...]
    hs6: tuple[str, ...]

    @staticmethod
    def from_dict(d: dict[str, Any]) -> Basket:
        return Basket(
            id=d["id"],
            label=d["label"],
            definition=d["definition"],
            hs_scope=d["hsScope"],
            hs4=tuple(d.get("hs4", [])),
            hs6=tuple(d.get("hs6", [])),
        )


def load_baskets(path: Path) -> list[Basket]:
    data = json.loads(path.read_text(encoding="utf-8"))
    baskets = [Basket.from_dict(b) for b in data["baskets"]]
    ids = [b.id for b in baskets]
    if len(set(ids)) != len(ids):
        raise ValueError(f"duplicate basket ids in {path}")
    for b in baskets:
        if not b.hs4 and not b.hs6:
            raise ValueError(f"basket {b.id} has no HS codes")
    return baskets


# ---------------------------------------------------------------------------------------------
# Query builders (pure; covered by tests)
# ---------------------------------------------------------------------------------------------


def odata_url(path: str, params: Sequence[tuple[str, str]]) -> str:
    """Builds a deterministic OData URL (parameter order as given)."""
    query = "&".join(f"{k}={urllib.parse.quote(v, safe=_SAFE)}" for k, v in params)
    return f"{API_BASE}/{path}?{query}" if query else f"{API_BASE}/{path}"


def _or(clauses: Iterable[str]) -> str:
    items = list(clauses)
    if not items:
        raise ValueError("empty OR clause")
    return items[0] if len(items) == 1 else "(" + " or ".join(items) + ")"


def flows_clause(flows: Sequence[int] = IMPORT_FLOWS) -> str:
    return _or(f"FlowTypeId eq {f}" for f in flows)


def commodity_query(baskets: Sequence[Basket]) -> str:
    """All CN8 codes (current and historical) under the baskets' HS headings."""
    clauses = [f"Hs4Code eq '{c}'" for b in baskets for c in b.hs4]
    clauses += [f"Hs6Code eq '{c}'" for b in baskets for c in b.hs6]
    return odata_url("Commodity", [("$filter", " or ".join(sorted(set(clauses))))])


def country_query() -> str:
    return odata_url("Country", [])


def aggregate_query(commodity_ids: Sequence[int], first_month: int = FIRST_MONTH) -> str:
    """Server-side aggregation of OTS imports to month × flow × country × CN8 × suppression.

    No upper month bound: the response contains every month HMRC has published at retrieval
    time, which is recorded in the cache index.
    """
    if not commodity_ids:
        raise ValueError("no commodity ids")
    commodities = _or(f"CommodityId eq {c}" for c in sorted(commodity_ids))
    filt = f"MonthId ge {first_month} and {flows_clause()} and {commodities}"
    apply = (
        f"filter({filt})/groupby((MonthId,FlowTypeId,CountryId,CommodityId,SuppressionIndex),"
        "aggregate(NetMass with sum as SumNetMass,Value with sum as SumValue,$count as Rows))"
    )
    return odata_url("OTS", [("$apply", apply)])


def raw_rows_query(commodity_ids: Sequence[int], month: int) -> str:
    """Unaggregated OTS rows for one month (used to reconcile the aggregation, gate G1)."""
    commodities = _or(f"CommodityId eq {c}" for c in sorted(commodity_ids))
    filt = f"MonthId eq {month} and {flows_clause()} and {commodities}"
    return odata_url(
        "OTS",
        [
            ("$filter", filt),
            ("$select", "MonthId,FlowTypeId,CountryId,CommodityId,SuppressionIndex,PortId,NetMass,Value"),
        ],
    )


def month_probe_query(month: int) -> str:
    """Does any OTS import record exist for `month`? (Confirms the latest published month.)"""
    return odata_url(
        "OTS",
        [("$filter", f"MonthId eq {month} and {flows_clause()}"), ("$top", "1"), ("$select", "MonthId")],
    )


def next_month(month: int) -> int:
    y, m = divmod(month, 100)
    return (y + 1) * 100 + 1 if m == 12 else y * 100 + m + 1


# ---------------------------------------------------------------------------------------------
# Transport, rate limiting and cache
# ---------------------------------------------------------------------------------------------


class RateLimiter:
    def __init__(self, per_minute: int = MAX_REQUESTS_PER_MINUTE, clock: Callable[[], float] = time.monotonic,
                 sleep: Callable[[float], None] = time.sleep) -> None:
        if per_minute <= 0:
            raise ValueError("per_minute must be positive")
        self.interval = 60.0 / per_minute
        self._clock = clock
        self._sleep = sleep
        self._last: float | None = None

    def wait(self) -> None:
        now = self._clock()
        if self._last is not None:
            delay = self._last + self.interval - now
            if delay > 0:
                self._sleep(delay)
                now += delay
        self._last = now


def urllib_transport(url: str, timeout: float = 180.0) -> tuple[int, bytes]:
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:  # noqa: S310 (fixed https host)
            return res.status, res.read()
    except urllib.error.HTTPError as err:
        return err.code, err.read()


class HmrcError(RuntimeError):
    pass


class HmrcClient:
    def __init__(self, transport: Transport = urllib_transport, limiter: RateLimiter | None = None,
                 sleep: Callable[[float], None] = time.sleep, max_attempts: int = 5) -> None:
        self.transport = transport
        self.limiter = limiter or RateLimiter()
        self.sleep = sleep
        self.max_attempts = max_attempts
        self.requests = 0

    def get(self, url: str) -> bytes:
        if not url.startswith(API_BASE + "/"):
            raise HmrcError(f"refusing to fetch a URL outside {API_BASE}: {url}")
        for attempt in range(1, self.max_attempts + 1):
            self.limiter.wait()
            self.requests += 1
            try:
                status, body = self.transport(url)
            except (urllib.error.URLError, TimeoutError, OSError) as err:
                status, body = 0, str(err).encode()
            if status == 200:
                return body
            retryable = status in (0, 429, 500, 502, 503, 504)
            logger.warning("HMRC %s (attempt %d/%d) for %s", status or "network error", attempt, self.max_attempts, url)
            if not retryable or attempt == self.max_attempts:
                raise HmrcError(f"HTTP {status} for {url}: {body[:300]!r}")
            # HMRC asks callers that hit the limit to wait up to a minute.
            self.sleep(60.0 if status == 429 else min(5.0 * 3 ** (attempt - 1), 120.0))
        raise AssertionError("unreachable")


def _gzip_deterministic(data: bytes) -> bytes:
    buf = io.BytesIO()
    with gzip.GzipFile(filename="", mode="wb", fileobj=buf, mtime=0, compresslevel=9) as gz:
        gz.write(data)
    return buf.getvalue()


@dataclass
class CacheEntry:
    name: str
    url: str
    retrieved_at: str
    sha256: str
    bytes: int
    items: int
    next_link: str | None


class RawCache:
    """Raw HMRC responses for one snapshot: `<root>/<name>.json.gz` plus `index.json`."""

    def __init__(self, root: Path) -> None:
        self.root = root
        self.index_path = root / "index.json"
        self.entries: dict[str, CacheEntry] = {}
        if self.index_path.exists():
            for e in json.loads(self.index_path.read_text(encoding="utf-8"))["responses"]:
                self.entries[e["name"]] = CacheEntry(
                    name=e["name"], url=e["url"], retrieved_at=e["retrievedAt"], sha256=e["sha256"],
                    bytes=e["bytes"], items=e["items"], next_link=e.get("nextLink"),
                )

    def put(self, name: str, url: str, body: bytes, retrieved_at: str) -> CacheEntry:
        doc = json.loads(body)
        entry = CacheEntry(
            name=name, url=url, retrieved_at=retrieved_at, sha256=hashlib.sha256(body).hexdigest(),
            bytes=len(body), items=len(doc.get("value", [])), next_link=doc.get("@odata.nextLink"),
        )
        self.root.mkdir(parents=True, exist_ok=True)
        (self.root / f"{name}.json.gz").write_bytes(_gzip_deterministic(body))
        self.entries[name] = entry
        return entry

    def body(self, name: str) -> bytes:
        entry = self.entries[name]
        data = gzip.decompress((self.root / f"{name}.json.gz").read_bytes())
        if hashlib.sha256(data).hexdigest() != entry.sha256:
            raise HmrcError(f"cached response {name} does not match its recorded checksum")
        return data

    def json(self, name: str) -> dict[str, Any]:
        return json.loads(self.body(name))

    def pages(self, prefix: str) -> list[dict[str, Any]]:
        """All pages stored under `<prefix>-pNNN`, in order."""
        names = sorted(n for n in self.entries if n.startswith(prefix + "-p"))
        if not names:
            raise HmrcError(f"no cached pages for {prefix}")
        return [self.json(n) for n in names]

    def items(self, prefix: str) -> list[dict[str, Any]]:
        return [row for page in self.pages(prefix) for row in page.get("value", [])]

    def write_index(self, meta: dict[str, Any]) -> None:
        responses = [
            {
                "name": e.name, "url": e.url, "retrievedAt": e.retrieved_at, "sha256": e.sha256,
                "bytes": e.bytes, "items": e.items, **({"nextLink": e.next_link} if e.next_link else {}),
            }
            for e in sorted(self.entries.values(), key=lambda e: e.name)
        ]
        doc = {**meta, "responses": responses}
        self.root.mkdir(parents=True, exist_ok=True)
        self.index_path.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    @property
    def meta(self) -> dict[str, Any]:
        doc = json.loads(self.index_path.read_text(encoding="utf-8"))
        return {k: v for k, v in doc.items() if k != "responses"}


def fetch_paged(client: HmrcClient, cache: RawCache, prefix: str, url: str,
                now: Callable[[], str]) -> list[dict[str, Any]]:
    """Fetches every page of `url`, caching each as `<prefix>-pNNN`."""
    items: list[dict[str, Any]] = []
    page = 1
    next_url: str | None = url
    while next_url:
        body = client.get(next_url)
        entry = cache.put(f"{prefix}-p{page:03d}", next_url, body, now())
        items.extend(json.loads(body).get("value", []))
        logger.info("%s page %d: %d items", prefix, page, entry.items)
        next_url = entry.next_link
        page += 1
        if page > 500:
            raise HmrcError(f"{prefix}: more than 500 pages; aborting")
    return items


# Reconciliation months (gate G1): one per basket, spread across years and seasons.
RECONCILE_MONTHS = {
    "tomatoes": 202501,
    "strawberries": 202406,
    "bananas": 202407,
    "potatoes": 202503,
    "wheat": 202311,
}


def basket_commodity_ids(basket: Basket, commodities: Sequence[dict[str, Any]]) -> list[int]:
    ids = [
        int(c["CommodityId"])
        for c in commodities
        if c.get("Hs4Code") in basket.hs4 or c.get("Hs6Code") in basket.hs6
    ]
    return sorted(set(ids))


def utc_now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def ingest(snapshot_id: str, raw_root: Path, baskets: Sequence[Basket], client: HmrcClient | None = None,
           now: Callable[[], str] = utc_now) -> RawCache:
    """Online step: fetch everything `build-trade` needs into the raw cache."""
    client = client or HmrcClient()
    cache = RawCache(raw_root / snapshot_id)
    started = now()

    commodities = fetch_paged(client, cache, "commodity", commodity_query(baskets), now)
    fetch_paged(client, cache, "country", country_query(), now)

    latest = 0
    for basket in baskets:
        ids = basket_commodity_ids(basket, commodities)
        if not ids:
            raise HmrcError(f"/Commodity returned no CN8 codes for basket {basket.id}")
        rows = fetch_paged(client, cache, f"ots-aggregate-{basket.id}", aggregate_query(ids), now)
        if rows:
            latest = max(latest, max(int(r["MonthId"]) for r in rows))
        month = RECONCILE_MONTHS.get(basket.id)
        if month:
            fetch_paged(client, cache, f"ots-raw-{basket.id}-{month}", raw_rows_query(ids, month), now)

    if latest == 0:
        raise HmrcError("no OTS rows returned for any basket")
    # Confirm the latest published month: the month after it must have no import records at all.
    fetch_paged(client, cache, f"probe-{latest}", month_probe_query(latest), now)
    fetch_paged(client, cache, f"probe-{next_month(latest)}", month_probe_query(next_month(latest)), now)

    cache.write_index({
        "source": "S01",
        "api": API_BASE,
        "snapshotId": snapshot_id,
        "startedAt": started,
        "finishedAt": now(),
        "requests": client.requests,
        "latestMonthId": latest,
        "licence": "Open Government Licence v3.0",
    })
    logger.info("ingest complete: %d requests, latest month %d", client.requests, latest)
    return cache
