"""ONS download step: stores files byte-for-byte with checksums and refuses unexpected responses."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from foodscope_pipeline.sources import ons_files
from foodscope_pipeline.sources.ons_files import FILES, OnsFetchError, fetch, load_index

FIXED = datetime(2026, 10, 24, 9, 0, 0, tzinfo=UTC)
# Obviously synthetic bodies: a minimal zip signature for the workbook, a one-row lookup page.
XLSX = b"PK\x03\x04synthetic-workbook"
LOOKUP = json.dumps({"features": [{"attributes": {"LAD22CD": "A", "LAD23CD": "B"}}]}).encode()


def transport_for(responses: dict[str, tuple[int, bytes]]):
    calls: list[str] = []

    def transport(url: str) -> tuple[int, bytes]:
        calls.append(url)
        return responses[url]

    transport.calls = calls  # type: ignore[attr-defined]
    return transport


def ok_responses() -> dict[str, tuple[int, bytes]]:
    return {ons_files.MYE25_URL: (200, XLSX), ons_files.LAD22_LAD23_URL: (200, LOOKUP)}


def test_fetch_writes_files_and_index(tmp_path: Path) -> None:
    folder = fetch("2026-10-24", tmp_path, transport_for(ok_responses()), now=lambda: FIXED)
    index = load_index(folder)
    assert [e["id"] for e in index["files"]] == [f.id for f in FILES]
    assert (folder / "mye25tablesuk.xlsx").read_bytes() == XLSX
    entry = index["files"][0]
    assert entry["retrievedAt"] == "2026-10-24T09:00:00Z"
    assert entry["sourceId"] == "S18" and entry["httpStatus"] == 200


@pytest.mark.parametrize(
    ("url", "response", "message"),
    [
        (ons_files.MYE25_URL, (404, b"not found"), "HTTP 404"),
        (ons_files.MYE25_URL, (200, b"<html>blocked</html>"), "not an .xlsx"),
        (ons_files.LAD22_LAD23_URL, (200, b'{"error": {"code": 400}}'), "unexpected response"),
        (ons_files.LAD22_LAD23_URL, (200, b'{"features": [], "exceededTransferLimit": true}'), "paging"),
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
