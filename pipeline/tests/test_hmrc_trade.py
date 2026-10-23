"""HMRC ingestion and trade build, exercised end to end with an obviously synthetic fake API.

Real-response checks live in test_trade_snapshot.py (they read the committed raw cache).
"""

from __future__ import annotations

import json
import urllib.parse
from pathlib import Path

import pytest

from foodscope_pipeline.sources import hmrc_ots as h
from foodscope_pipeline.trade import (
    TradeBuildError,
    build_partner_table,
    build_trade,
    month_range,
    provisional_from,
)

BASKETS = [
    h.Basket("testfruit", "Test fruit", "Synthetic basket", "HS 9901", ("9901",), ()),
]

# Synthetic partners: "A" and "B" are ordinary countries, "C" appears under two HMRC ids,
# "XS" exercises the alpha override, 959 is a non-geographic HMRC category.
COUNTRIES = [
    {"CountryId": 1, "CountryName": "Aland", "CountryCodeAlpha": "AA"},
    {"CountryId": 2, "CountryName": "Bland", "CountryCodeAlpha": "BB"},
    {"CountryId": 3, "CountryName": "Cland", "CountryCodeAlpha": "CC"},
    {"CountryId": 4, "CountryName": "Cland (old code)", "CountryCodeAlpha": "CC"},
    {"CountryId": 98, "CountryName": "Serbia", "CountryCodeAlpha": "XS"},
    {"CountryId": 959, "CountryName": "Estimates", "CountryCodeAlpha": "QV"},
]
POINTS = {
    "source": "synthetic",
    "points": [
        {"iso_a2": "AA", "name": "A", "name_long": "Country A", "lon": 1.0, "lat": 2.0, "in110m": True},
        {"iso_a2": "BB", "name": "B", "name_long": "Country B", "lon": 3.0, "lat": 4.0, "in110m": False},
        {"iso_a2": "RS", "name": "Serbia", "name_long": "Republic of Serbia", "lon": 20.8, "lat": 44.2, "in110m": True},
    ],
}
CROSSWALK = {
    "alphaOverrides": {"XS": {"iso2": "RS", "reason": "test"}},
    "nonGeographicCountryIds": {"959": "Estimates"},
}
COMMODITIES = [
    {"CommodityId": 99010010, "Cn8Code": "99010010", "Hs4Code": "9901", "Hs6Code": "990100", "Cn8LongDescription": "Test A"},
    {"CommodityId": 99010090, "Cn8Code": "99010090", "Hs4Code": "9901", "Hs6Code": "990100", "Cn8LongDescription": "Test B"},
]


def agg(month: int, flow: int, country: int, commodity: int, kg: int, gbp: int, supp: int = 0) -> dict:
    return {"@odata.id": None, "MonthId": month, "FlowTypeId": flow, "CountryId": country, "CommodityId": commodity,
            "SuppressionIndex": supp, "SumNetMass": float(kg), "SumValue": float(gbp), "Rows": 1}


AGGREGATE = [
    agg(201901, 1, 1, 99010010, 1000, 2000),
    agg(201901, 3, 2, 99010010, 500, 700),
    agg(201901, 3, 3, 99010090, 100, 150),
    agg(201901, 3, 4, 99010090, 50, 60),  # same partner as CountryId 3
    agg(201901, 1, 959, 99010010, 10, 20),  # non-geographic
    agg(201902, 1, 1, 99010010, 0, 0, supp=3),  # suppressed: quantity not published
    agg(201902, 3, 98, 99010090, 400, 900),
    # 201903 deliberately absent → nil month
    agg(201904, 1, 1, 99010010, 300, 600),
]
RAW_201901 = [
    {"MonthId": 201901, "FlowTypeId": 1, "CountryId": 1, "CommodityId": 99010010, "SuppressionIndex": 0, "PortId": 1, "NetMass": 600.0, "Value": 1500.0},
    {"MonthId": 201901, "FlowTypeId": 1, "CountryId": 1, "CommodityId": 99010010, "SuppressionIndex": 0, "PortId": 2, "NetMass": 400.0, "Value": 500.0},
    {"MonthId": 201901, "FlowTypeId": 3, "CountryId": 2, "CommodityId": 99010010, "SuppressionIndex": 0, "PortId": 1, "NetMass": 500.0, "Value": 700.0},
    {"MonthId": 201901, "FlowTypeId": 3, "CountryId": 3, "CommodityId": 99010090, "SuppressionIndex": 0, "PortId": 1, "NetMass": 100.0, "Value": 150.0},
    {"MonthId": 201901, "FlowTypeId": 3, "CountryId": 4, "CommodityId": 99010090, "SuppressionIndex": 0, "PortId": 1, "NetMass": 50.0, "Value": 60.0},
    {"MonthId": 201901, "FlowTypeId": 1, "CountryId": 959, "CommodityId": 99010010, "SuppressionIndex": 0, "PortId": 0, "NetMass": 10.0, "Value": 20.0},
]


class FakeApi:
    """Routes the pipeline's URLs to synthetic OData responses; splits the aggregate into two pages."""

    def __init__(self, aggregate=None, raw=None) -> None:
        self.aggregate = AGGREGATE if aggregate is None else aggregate
        self.raw = RAW_201901 if raw is None else raw
        self.calls: list[str] = []

    def __call__(self, url: str) -> tuple[int, bytes]:
        self.calls.append(url)
        q = urllib.parse.unquote(url)
        def body(value, next_link=None):
            doc = {"@odata.context": "synthetic", "value": value}
            if next_link:
                doc["@odata.nextLink"] = next_link
            return 200, json.dumps(doc).encode()
        if "/Commodity?" in q:
            return body(COMMODITIES)
        if q.endswith("/Country"):
            return body(COUNTRIES)
        if "$apply=" in q:
            if "$skip=4" in q:
                return body(self.aggregate[4:])
            return body(self.aggregate[:4], next_link=url + "&$skip=4")
        if "$top=1" in q:
            month = int(q.split("MonthId eq ")[1].split(" ")[0])
            present = month in {r["MonthId"] for r in self.aggregate}
            return body([{"MonthId": month}] if present else [])
        if "MonthId eq 201901" in q:
            return body(self.raw)
        return 404, b"not found"


def no_sleep(_: float) -> None:
    pass


def make_client(api) -> h.HmrcClient:
    return h.HmrcClient(transport=api, limiter=h.RateLimiter(clock=lambda: 0.0, sleep=no_sleep), sleep=no_sleep)


@pytest.fixture
def env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setitem(h.RECONCILE_MONTHS, "testfruit", 201901)
    points = tmp_path / "points.json"
    points.write_text(json.dumps(POINTS))
    crosswalk = tmp_path / "crosswalk.json"
    crosswalk.write_text(json.dumps(CROSSWALK))
    clock = iter(f"2026-10-23T10:00:{i:02d}Z" for i in range(60))
    return {
        "raw": tmp_path / "raw",
        "data": tmp_path / "data",
        "reports": tmp_path / "reports",
        "points": points,
        "crosswalk": crosswalk,
        "now": lambda: next(clock),
    }


def run(env, api=None):
    api = api or FakeApi()
    h.ingest("2026-10-23", env["raw"], BASKETS, client=make_client(api), now=env["now"])
    return build_trade("2026-10-23", env["raw"], env["data"], env["reports"], BASKETS, env["points"], env["crosswalk"])


# --- query builders ------------------------------------------------------------------------


def test_aggregate_query_groups_imports_by_month_flow_country_cn8_suppression():
    url = urllib.parse.unquote(h.aggregate_query([99010090, 99010010]))
    assert url.startswith("https://api.uktradeinfo.com/OTS?$apply=filter(MonthId ge 201901 and ")
    assert "(FlowTypeId eq 1 or FlowTypeId eq 3)" in url
    assert "(CommodityId eq 99010010 or CommodityId eq 99010090)" in url  # sorted, deterministic
    assert "groupby((MonthId,FlowTypeId,CountryId,CommodityId,SuppressionIndex)" in url
    assert "NetMass with sum as SumNetMass" in url and "Value with sum as SumValue" in url


def test_commodity_query_covers_hs4_and_hs6_headings():
    url = urllib.parse.unquote(h.commodity_query([
        h.Basket("x", "X", "", "", ("0702",), ()), h.Basket("y", "Y", "", "", (), ("081010",)),
    ]))
    assert "Hs4Code eq '0702'" in url and "Hs6Code eq '081010'" in url


def test_odata_url_encodes_spaces_but_keeps_odata_syntax_readable():
    assert h.odata_url("OTS", [("$filter", "MonthId eq 1")]) == "https://api.uktradeinfo.com/OTS?$filter=MonthId%20eq%201"


def test_next_month_rolls_over_the_year():
    assert h.next_month(202608) == 202609
    assert h.next_month(202612) == 202701


# --- client ----------------------------------------------------------------------------------


def test_rate_limiter_spaces_requests_to_50_per_minute():
    t = [0.0]
    slept: list[float] = []
    limiter = h.RateLimiter(per_minute=50, clock=lambda: t[0], sleep=lambda d: slept.append(d))
    limiter.wait()
    limiter.wait()
    assert slept == [pytest.approx(1.2)]


def test_client_retries_after_rate_limit_then_succeeds():
    responses = iter([(429, b"limit"), (200, b'{"value":[]}')])
    waits: list[float] = []
    client = h.HmrcClient(transport=lambda url: next(responses),
                          limiter=h.RateLimiter(clock=lambda: 0.0, sleep=no_sleep), sleep=waits.append)
    assert client.get("https://api.uktradeinfo.com/Country") == b'{"value":[]}'
    assert waits == [60.0]


def test_client_does_not_retry_client_errors_and_refuses_other_hosts():
    client = make_client(lambda url: (400, b"bad query"))
    with pytest.raises(h.HmrcError, match="HTTP 400"):
        client.get("https://api.uktradeinfo.com/OTS?$filter=x")
    with pytest.raises(h.HmrcError, match="refusing"):
        client.get("https://example.com/OTS")


# --- crosswalk (G4) --------------------------------------------------------------------------


def test_partner_table_applies_overrides_merges_shared_codes_and_flags_non_geographic():
    points = {p["iso_a2"]: p for p in POINTS["points"]}
    table = build_partner_table(COUNTRIES, CROSSWALK, points)
    assert table[98].key == "RS" and table[98].geometry == "polygon"
    assert table[3] is table[4] and sorted(table[3].hmrc_country_ids) == [3, 4]
    assert table[3].geometry == "none" and table[3].point is None  # no Natural Earth geometry
    assert table[2].geometry == "point"  # only in the 1:50m points
    assert table[959].kind == "unallocated" and table[959].key == "hmrc-959"


# --- months ----------------------------------------------------------------------------------


def test_month_range_and_provisional_window():
    assert month_range(202511, 202602) == [202511, 202512, 202601, 202602]
    months = month_range(202401, 202608)
    # Retrieved 23 Oct 2026: months first published within the previous 18 months are provisional.
    assert provisional_from(months, "2026-10-23T10:00:00Z") == 202503


# --- end to end ------------------------------------------------------------------------------


def test_ingest_follows_next_links_and_caches_every_response(env):
    api = FakeApi()
    cache = h.ingest("2026-10-23", env["raw"], BASKETS, client=make_client(api), now=env["now"])
    names = sorted(cache.entries)
    assert "ots-aggregate-testfruit-p001" in names and "ots-aggregate-testfruit-p002" in names
    assert cache.meta["latestMonthId"] == 201904
    assert len(cache.items("ots-aggregate-testfruit")) == len(AGGREGATE)
    index = json.loads((env["raw"] / "2026-10-23" / "index.json").read_text())
    assert all(len(r["sha256"]) == 64 and r["url"].startswith(h.API_BASE) for r in index["responses"])


def test_build_trade_aggregates_partners_keeps_suppressed_and_nil_months(env):
    run(env)
    snap = json.loads((env["data"] / "snapshots/2026-10-23/trade/testfruit.json").read_text())
    keys = [p["key"] for p in snap["partners"]]
    assert keys == ["AA", "BB", "CC", "RS", "hmrc-959"]  # countries first, unallocated last
    assert snap["months"] == {"first": "2019-01", "last": "2019-04", "provisionalFrom": None}
    jan = {snap["partners"][p]["key"]: (kg, gbp) for m, p, kg, gbp in snap["rows"] if m == 0}
    assert jan == {"AA": (1000, 2000), "BB": (500, 700), "CC": (150, 210), "hmrc-959": (10, 20)}
    assert snap["suppressed"] == [[1, 3, None, 0]]  # quantity not published at level 3
    assert snap["nilMonths"] == [2]
    recon = json.loads((env["reports"] / "hmrc-reconciliation-2026-10-23.json").read_text())
    assert recon["allMatch"] is True and recon["checks"][0]["netMassKg"] == {"aggregate": 1660, "raw": 1660}


def test_build_trade_is_byte_identical_on_rerun(env):
    written = run(env)
    first = {p: p.read_bytes() for p in written}
    build_trade("2026-10-23", env["raw"], env["data"], env["reports"], BASKETS, env["points"], env["crosswalk"])
    assert {p: p.read_bytes() for p in written} == first


def test_build_trade_fails_when_aggregation_and_raw_rows_disagree(env):
    raw = [dict(r) for r in RAW_201901]
    raw[0]["NetMass"] = 601.0
    with pytest.raises(TradeBuildError, match="reconciliation failed"):
        run(env, FakeApi(raw=raw))


def test_build_trade_rejects_unknown_country_ids(env):
    with pytest.raises(TradeBuildError, match="CountryId 4242"):
        run(env, FakeApi(aggregate=AGGREGATE + [agg(201904, 3, 4242, 99010010, 1, 1)]))


def test_code_change_detection_rules() -> None:
    """Synthetic codes: a replacement, a code that simply stops, and one that starts later."""
    from foodscope_pipeline.trade import code_changes, code_history

    a = {"code": "00000001", **code_history({202001, 202012}, [0] * 12)}  # ends Dec 2020
    b = {"code": "00000002", **code_history({202101, 202103}, [0] * 12)}  # starts Jan 2021
    c = {"code": "00000003", **code_history({202001, 202106}, [0] * 12)}  # ends Jun 2021, nothing starts
    d = {"code": "00000004", **code_history({202003, 202112}, [0] * 12)}  # starts Mar 2020, nothing ends
    e = {"code": "00000005", **code_history(set(), [0] * 12)}  # never recorded
    assert e["firstMonth"] is None and e["monthsRecorded"] == 0 and e["calendarMonths"] == []
    assert a["calendarMonths"] == [1, 12]
    assert code_changes([a, b, c, d, e], "2020-01", "2021-12") == [
        {"month": "2021-01", "ended": ["00000001"], "started": ["00000002"]}
    ]
    # A code first recorded in the snapshot's first month, or last recorded in its last month, is
    # not a change (the snapshot boundary is not evidence of one).
    assert code_changes([a, b], "2021-01", "2021-12") == []
