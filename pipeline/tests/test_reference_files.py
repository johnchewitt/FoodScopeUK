"""Stage 5 download registries (Nomis, MHCLG, NISRA, ONS small areas) and the shared fetch checks."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from foodscope_pipeline import cli
from foodscope_pipeline.sources import fsa_fhrs, mhclg_iod, nisra_files, nomis_census, ons_files
from foodscope_pipeline.sources.ons_files import OnsFetchError, OnsFile, OnsQuery, fetch, load_index

FIXED = datetime(2026, 10, 24, 9, 0, 0, tzinfo=UTC)
# Obviously synthetic files "a" and "b".
ZIP_A = OnsFile(id="x.a", filename="a.zip", url="https://example.invalid/a.zip", source_id="S0",
                licence="OGL", description="synthetic")
CSV_B = OnsFile(id="x.b", filename="b.csv", url="https://example.invalid/b.csv", source_id="S0",
                licence="OGL", description="synthetic")


def transport_for(responses: dict[str, tuple[int, bytes]]):
    def transport(url: str) -> tuple[int, bytes]:
        return responses[url]

    return transport


def test_registries_are_https_with_unique_ids_and_filenames() -> None:
    files = nomis_census.FILES + mhclg_iod.FILES + nisra_files.FILES + fsa_fhrs.FILES + ons_files.FILES
    ids = [f.id for f in files] + [q.id for q in ons_files.QUERIES]
    assert len(ids) == len(set(ids))
    for group in (nomis_census.FILES, mhclg_iod.FILES, nisra_files.FILES, fsa_fhrs.FILES):
        assert len({f.filename for f in group}) == len(group)
    for f in files:
        assert f.url.startswith("https://") and f.licence and f.source_id.startswith("S")


def test_small_area_queries_count_what_they_page() -> None:
    by_id = {q.id: q for q in ons_files.QUERIES}
    for qid in ("ons.lsoa21_bgc_manchester_box", "ons.lsoa21_pwc_manchester_box"):
        q = by_id[qid]
        assert ons_files.MANCHESTER_BOX in q.count_url() and ons_files.MANCHESTER_BOX in q.page_url(0)
    lookup = by_id["ons.lsoa21_lad25_manchester"]
    assert "LAD25CD%3D%27E08000003%27" in lookup.count_url()
    assert "LAD25CD%3D%27E08000003%27" in lookup.page_url(0)
    # The council-boundary query keeps its original count URL (cached index entries name it).
    assert by_id["ons.lad25_bgc"].count_url().endswith("query?where=1%3D1&returnCountOnly=true&f=json")


@pytest.mark.parametrize(
    ("body", "message"),
    [
        (b"<!DOCTYPE html><html>blocked</html>", "not a .zip"),
        (b"\xd0\xcf\x11\xe0 ole", "not a .zip"),
    ],
)
def test_zip_must_be_a_zip(tmp_path: Path, body: bytes, message: str) -> None:
    with pytest.raises(OnsFetchError, match=message):
        fetch("s", tmp_path, transport_for({ZIP_A.url: (200, body)}), now=lambda: FIXED, files=(ZIP_A,), queries=())


@pytest.mark.parametrize("body", [b"", b"  \n", b"<html><body>Sign in</body></html>"])
def test_csv_must_be_data(tmp_path: Path, body: bytes) -> None:
    with pytest.raises(OnsFetchError, match="not a .csv"):
        fetch("s", tmp_path, transport_for({CSV_B.url: (200, body)}), now=lambda: FIXED, files=(CSV_B,), queries=())


def test_xls_signature(tmp_path: Path) -> None:
    xls = OnsFile(id="x.c", filename="c.xls", url="https://example.invalid/c.xls", source_id="S0",
                  licence="OGL", description="synthetic")
    with pytest.raises(OnsFetchError, match="not an .xls"):
        fetch("s", tmp_path, transport_for({xls.url: (200, b"PK\x03\x04")}), now=lambda: FIXED, files=(xls,), queries=())
    folder = fetch("s", tmp_path, transport_for({xls.url: (200, b"\xd0\xcf\x11\xe0rest")}), now=lambda: FIXED,
                   files=(xls,), queries=())
    assert load_index(folder)["files"][0]["file"] == "c.xls"


def test_a_failure_leaves_no_unindexed_files(tmp_path: Path) -> None:
    responses = {ZIP_A.url: (200, b"PK\x03\x04a"), CSV_B.url: (404, b"gone")}
    with pytest.raises(OnsFetchError, match="HTTP 404"):
        fetch("s", tmp_path, transport_for(responses), now=lambda: FIXED, files=(ZIP_A, CSV_B), queries=())
    assert list((tmp_path / "s").iterdir()) == []


def test_count_filter_is_used_for_the_count(tmp_path: Path) -> None:
    q = OnsQuery(id="x.q", stem="q", layer_url="https://example.invalid/FeatureServer/0",
                 params="where=K%3D%27A%27&f=json", count_filter="where=K%3D%27A%27", page_size=10,
                 source_id="S0", licence="OGL", description="synthetic")
    responses = {
        "https://example.invalid/FeatureServer/0/query?where=K%3D%27A%27&returnCountOnly=true&f=json":
            (200, json.dumps({"count": 1}).encode()),
        q.page_url(0): (200, json.dumps({"features": [{"attributes": {"K": "A"}}]}).encode()),
    }
    folder = fetch("s", tmp_path, transport_for(responses), now=lambda: FIXED, files=(), queries=(q,))
    assert [e["file"] for e in load_index(folder)["files"]] == ["q.count.json", "q.p000.json"]


def test_fetch_reference_continues_after_a_failing_publisher(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    seen: list[str] = []

    def fake_fetch(snapshot, raw_root, files=None, queries=None):  # noqa: ANN001
        seen.append(raw_root.name)
        if raw_root.name == "nomis":
            raise OnsFetchError("synthetic failure")
        return raw_root / snapshot

    monkeypatch.setattr(ons_files, "fetch", fake_fetch)
    monkeypatch.setattr(cli, "RAW", tmp_path)
    assert cli.main(["fetch-reference", "--snapshot", "2026-10-24"]) == 1
    assert seen == ["ons", "nomis", "mhclg", "nisra", "fsa"]


def test_fsa_covers_the_eleven_ni_councils_and_checks_xml(tmp_path: Path) -> None:
    assert sorted(lad for _, lad, _ in fsa_fhrs.NI_COUNCILS) == [f"N090000{n:02d}" for n in range(1, 12)]
    f = fsa_fhrs.FILES[0]
    with pytest.raises(OnsFetchError, match="not an .xml"):
        fetch("s", tmp_path, transport_for({f.url: (200, b"<!DOCTYPE html><html></html>")}), now=lambda: FIXED,
              files=(f,), queries=())
    folder = fetch("s", tmp_path, transport_for({f.url: (200, b"<?xml version='1.0'?><FHRSEstablishment/>")}),
                   now=lambda: FIXED, files=(f,), queries=())
    assert load_index(folder)["files"][0]["sourceId"] == "S29"
