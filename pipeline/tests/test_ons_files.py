"""ONS download step: stores files byte-for-byte with checksums and refuses unexpected responses."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from foodscope_pipeline.sources import ons_files
from foodscope_pipeline.sources.ons_files import FILES, OnsFetchError, OnsQuery, fetch, files_for, load_index

FIXED = datetime(2026, 10, 24, 9, 0, 0, tzinfo=UTC)
# Obviously synthetic bodies: a minimal zip signature for the workbook, a one-row lookup page,
# and a paged feature query over councils "A" … "E".
XLSX = b"PK\x03\x04synthetic-workbook"
LOOKUP = json.dumps({"features": [{"attributes": {"LAD22CD": "A", "LAD23CD": "B"}}]}).encode()
QUERY = OnsQuery(
    id="ons.synthetic_polygons", stem="synthetic", layer_url="https://example.invalid/FeatureServer/0",
    params="where=1%3D1&f=json", page_size=2, source_id="S14", licence="OGL", description="synthetic",
)
CODES = ["A", "B", "C", "D", "E"]


def page(codes: list[str], more: bool) -> bytes:
    doc: dict = {"features": [{"attributes": {"LAD25CD": c}, "geometry": {"rings": []}} for c in codes]}
    if more:
        doc["exceededTransferLimit"] = True
    return json.dumps(doc).encode()


def ok_responses(count: int = 5) -> dict[str, tuple[int, bytes]]:
    return {
        ons_files.MYE25_URL: (200, XLSX),
        ons_files.LAD22_LAD23_URL: (200, LOOKUP),
        QUERY.count_url(): (200, json.dumps({"count": count}).encode()),
        QUERY.page_url(0): (200, page(CODES[0:2], True)),
        QUERY.page_url(2): (200, page(CODES[2:4], True)),
        QUERY.page_url(4): (200, page(CODES[4:5], False)),
    }


def transport_for(responses: dict[str, tuple[int, bytes]]):
    calls: list[str] = []

    def transport(url: str) -> tuple[int, bytes]:
        calls.append(url)
        return responses[url]

    transport.calls = calls  # type: ignore[attr-defined]
    return transport


@pytest.fixture(autouse=True)
def synthetic_query(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ons_files, "QUERIES", (QUERY,))


def test_fetch_writes_files_and_index(tmp_path: Path) -> None:
    folder = fetch("2026-10-24", tmp_path, transport_for(ok_responses()), now=lambda: FIXED)
    index = load_index(folder)
    assert [e["id"] for e in index["files"][:2]] == [f.id for f in FILES]
    assert (folder / "mye25tablesuk.xlsx").read_bytes() == XLSX
    entry = index["files"][0]
    assert entry["retrievedAt"] == "2026-10-24T09:00:00Z"
    assert entry["sourceId"] == "S18" and entry["httpStatus"] == 200


def test_paged_query_is_stored_page_by_page(tmp_path: Path) -> None:
    folder = fetch("2026-10-24", tmp_path, transport_for(ok_responses()), now=lambda: FIXED)
    entries = files_for(load_index(folder), QUERY.id)
    assert [e["file"] for e in entries] == [
        "synthetic.count.json", "synthetic.p000.json", "synthetic.p001.json", "synthetic.p002.json"]
    assert [e.get("features") for e in entries] == [None, 2, 2, 1]
    assert (folder / "synthetic.p002.json").read_bytes() == page(["E"], False)


def test_paged_query_total_must_match_the_count(tmp_path: Path) -> None:
    with pytest.raises(OnsFetchError, match="pages hold 5 features but the service counts 6"):
        fetch("2026-10-24", tmp_path, transport_for(ok_responses(count=6)), now=lambda: FIXED)
    assert not (tmp_path / "2026-10-24" / "index.json").exists()


def test_fetch_is_incremental(tmp_path: Path) -> None:
    responses = ok_responses()
    fetch("2026-10-24", tmp_path, transport_for(responses), now=lambda: FIXED)
    again = transport_for(responses)
    fetch("2026-10-24", tmp_path, again, now=lambda: FIXED)
    assert again.calls == []


def test_fetch_adds_only_missing_items(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ons_files, "QUERIES", ())
    fetch("2026-10-24", tmp_path, transport_for(ok_responses()), now=lambda: FIXED)
    monkeypatch.setattr(ons_files, "QUERIES", (QUERY,))
    later = transport_for(ok_responses())
    folder = fetch("2026-10-24", tmp_path, later, now=lambda: FIXED)
    assert ons_files.MYE25_URL not in later.calls and QUERY.count_url() in later.calls
    assert len(load_index(folder)["files"]) == 2 + 4


@pytest.mark.parametrize(
    ("url", "response", "message"),
    [
        (ons_files.MYE25_URL, (404, b"not found"), "HTTP 404"),
        (ons_files.MYE25_URL, (200, b"<html>blocked</html>"), "not an .xlsx"),
        (ons_files.LAD22_LAD23_URL, (200, b'{"error": {"code": 400}}'), "unexpected response"),
        (ons_files.LAD22_LAD23_URL, (200, b'{"features": [], "exceededTransferLimit": true}'), "paging"),
        (QUERY.count_url(), (200, b'{"count": 0}'), "count query"),
        (QUERY.page_url(2), (200, b'{"error": {"code": 500}}'), "unexpected response"),
    ],
)
def test_fetch_rejects_unexpected_responses(tmp_path: Path, url: str, response, message: str) -> None:
    responses = ok_responses()
    responses[url] = response
    with pytest.raises(OnsFetchError, match=message):
        fetch("2026-10-24", tmp_path, transport_for(responses), now=lambda: FIXED)


def test_load_index_detects_edited_files(tmp_path: Path) -> None:
    folder = fetch("2026-10-24", tmp_path, transport_for(ok_responses()), now=lambda: FIXED)
    (folder / "mye25tablesuk.xlsx").write_bytes(XLSX + b"edited")
    with pytest.raises(OnsFetchError, match="does not match"):
        load_index(folder)
