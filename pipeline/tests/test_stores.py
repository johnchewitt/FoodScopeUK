"""Store classes (D5), coordinates and council assignment, on obviously synthetic stores and squares.

Councils "A…" are squares in EPSG:27700 metres; stores are placed by converting chosen BNG
points to WGS84 first, so the tests exercise the same projection path as the build.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest
import shapely
from pyproj import Transformer

from foodscope_pipeline.sources.geolytix import RetailPoint
from foodscope_pipeline.stores import (
    NEAREST_MAX_M, REJECT_CROWN, REJECT_NO_LOCATION, REJECT_OUTSIDE, StoreClassError, assign, bng_residuals,
    classify, load_store_classes, locate, postcode_area,
)

CONFIG = Path(__file__).resolve().parents[1] / "foodscope_pipeline" / "config" / "store_classes.json"
TO_WGS84 = Transformer.from_crs(27700, 4326, always_xy=True)
BANDS = ("< 3,013 ft2 (280m2)", "3,013 < 15,069 ft2 (280 < 1,400 m2)",
         "15,069 < 30,138 ft2 (1,400 < 2,800 m2)", "30,138 ft2 > (2,800 m2)")


def store(id_: int, x: float | None = None, y: float | None = None, *, fascia: str = "Shop A",
          band: str | None = BANDS[1], postcode: str | None = "ZZ1 1ZZ", wgs: bool = True,
          bng: tuple[float, float] | None = None) -> RetailPoint:
    lon = lat = None
    if x is not None and wgs:
        lon, lat = (float(v) for v in TO_WGS84.transform(x, y))
    e, n = bng if bng is not None else ((x, y) if x is not None else (None, None))
    return RetailPoint(id=id_, retailer="Retailer A", fascia=fascia, store_name=f"Store {id_}", add_one=None,
                       add_two=None, town=None, suburb=None, postcode=postcode, long_wgs=lon, lat_wgs=lat,
                       bng_e=e, bng_n=n, pqi="Rooftop", size_band=band)


# Two adjacent 1 km squares, A (x 400000–401000) and B (x 401000–402000), at y 300000–301000.
CODES = ["A", "B"]
SQUARES = np.array([shapely.box(400_000, 300_000, 401_000, 301_000), shapely.box(401_000, 300_000, 402_000, 301_000)])


@pytest.fixture(scope="module")
def classes():
    return load_store_classes(CONFIG)


def test_size_band_sets_class(classes) -> None:
    assert classify(store(1, band=BANDS[0]), classes) == ("lt280", "convenience", "standard")
    assert classify(store(2, band=BANDS[1]), classes) == ("280to1400", "supermarket", "standard")
    assert classify(store(3, band=BANDS[3]), classes)[:2] == ("ge2800", "supermarket")


def test_fascia_sets_format_not_class(classes) -> None:
    assert classify(store(1, fascia="Tesco Express Esso", band=BANDS[0]), classes) == ("lt280", "convenience", "forecourt")
    assert classify(store(2, fascia="Waitrose MSA", band=BANDS[0]), classes)[2] == "motorway"
    assert classify(store(3, fascia="Costco", band=BANDS[3]), classes) == ("ge2800", "supermarket", "wholesale")
    assert classify(store(4, fascia="Asda Living", band=BANDS[2]), classes)[2] == "nonfood"


@pytest.mark.parametrize("band", [None, "", "10,000 ft2"])
def test_unknown_size_band_stops_the_build(classes, band) -> None:
    with pytest.raises(StoreClassError, match="not in the D5 mapping"):
        classify(store(1, band=band), classes)


def test_config_rejects_a_fascia_in_two_formats(tmp_path: Path) -> None:
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    cfg["formats"][2]["fascias"].append(cfg["formats"][1]["fascias"][0])
    path = tmp_path / "classes.json"
    path.write_text(json.dumps(cfg), encoding="utf-8")
    with pytest.raises(StoreClassError, match="in two formats"):
        load_store_classes(path)


def test_groups_cover_every_band_and_format(classes) -> None:
    assert len(classes.groups) == len(classes.size_bands) * len(classes.formats)
    assert classes.groups[0] == ("lt280", "standard")


@pytest.mark.parametrize(("postcode", "area"), [("GY1 1AA", "GY"), ("je2 3xx", "JE"), ("IM1 2AB", "IM"),
                                                ("M1 1AA", "M"), ("BT1 1AA", "BT"), ("", None), (None, None)])
def test_postcode_area(postcode, area) -> None:
    assert postcode_area(postcode) == area


def test_locate_uses_wgs84_then_bng_then_rejects() -> None:
    located, missing = locate([
        store(1, 400_500, 300_500),
        store(2, 400_500, 300_500, wgs=False),
        store(3, None, None, bng=(None, None)),  # type: ignore[arg-type]
    ])
    assert [(s.point.id, s.source) for s in located] == [(1, "wgs84"), (2, "bng")]
    assert [p.id for p in missing] == [3]
    assert located[0].lon == pytest.approx(located[1].lon, abs=1e-9)
    assert REJECT_NO_LOCATION


def test_assign_inside_crown_nearest_and_outside() -> None:
    located, _ = locate([
        store(1, 400_500, 300_500),  # inside A
        store(2, 401_500, 300_500),  # inside B
        store(3, 400_500, 301_020),  # 20 m north of A: nearest council
        store(4, 400_500, 302_000),  # 1 km north: outside
        store(5, 400_500, 302_000, postcode="JE2 4AB"),  # Jersey postcode, outside: Crown Dependency
    ])
    result = assign(located, CODES, SQUARES)
    assert result.council == ["A", "B", "A", None, None]
    assert result.match == ["inside", "inside", "nearest", None, None]
    assert result.reasons == [None, None, None, REJECT_OUTSIDE, REJECT_CROWN]
    assert result.nearest[0]["id"] == 3 and result.nearest[0]["distanceM"] == pytest.approx(20, abs=0.5)
    assert result.ties == 0 and result.crown_inside == 0
    assert NEAREST_MAX_M == 50


def test_store_inside_two_councils_goes_to_the_lowest_code_and_is_counted() -> None:
    overlapping = np.array([shapely.box(400_000, 300_000, 401_100, 301_000), SQUARES[1]])  # A overlaps B by 100 m
    located, _ = locate([store(1, 401_050, 300_500)])
    result = assign(located, ["B", "A"], overlapping[::-1])
    assert result.council == ["A"] and result.ties == 1


def test_near_boundary_counts_stores_within_10_m_of_another_council() -> None:
    located, _ = locate([store(1, 400_995, 300_500), store(2, 400_500, 300_500)])
    assert assign(located, CODES, SQUARES).near_boundary == 1


def test_crown_postcode_inside_a_council_is_counted() -> None:
    located, _ = locate([store(1, 400_500, 300_500, postcode="IM1 1AA")])
    result = assign(located, CODES, SQUARES)
    assert result.council == ["A"] and result.crown_inside == 1


def test_bng_residuals_group_by_council_and_measure_metres() -> None:
    located, _ = locate([
        store(1, 400_500, 300_500),
        store(2, 400_500, 300_500, bng=(400_500, 300_510)),  # delivered BNG 10 m off
    ])
    out = bng_residuals(located, ["A", "N1"])
    assert out["Great Britain"]["maxM"] == pytest.approx(0, abs=0.01)
    assert out["Northern Ireland"]["maxM"] == pytest.approx(10, abs=0.01)


def test_config_matches_the_published_schema(classes) -> None:
    schema = json.loads((Path(__file__).resolve().parents[2] / "schemas" / "stores.schema.json").read_text(encoding="utf-8"))
    enums = {k: schema["definitions"][k]["enum"] for k in ("SizeBand", "StoreClass", "StoreFormat")}
    assert enums["SizeBand"] == [b["id"] for b in classes.size_bands]
    assert sorted(enums["StoreClass"]) == sorted(c["id"] for c in classes.store_classes)
    assert enums["StoreFormat"] == [f["id"] for f in classes.formats]
