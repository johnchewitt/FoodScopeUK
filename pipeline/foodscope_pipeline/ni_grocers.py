"""OFFLINE build of the Northern Ireland grocers that GEOLYTIX misses, from the FSA register (S29).

John asked on 25 Oct 2026 to "add the missing NI grocers from another source if possible".
GEOLYTIX (S11) has only ten retailers in Northern Ireland; the FSA food hygiene register lists every
registered food business. This build keeps, from the 11 NI council files:

1. **Symbol groups GEOLYTIX does not carry in NI** (config `ni_grocers.json`: SuperValu, Mace,
   Vivo, Costcutter, Nisa, Premier): a record of either retail business type whose name contains
   the group's name as a whole word.
2. **Independent grocers**: records registered as "Retailers - supermarkets/hypermarkets" whose name
   holds no chain or group name and no mainly non-food retailer, unless a store already on the map
   lies within 50 m (most likely the same shop registered under its operator's name).

Chains GEOLYTIX already maps (Tesco, Spar, Centra, …) are left to GEOLYTIX, so nothing is counted
twice. Within the kept records, the same group (or the same independent name) at the same postcode
is one shop (e.g. a SuperValu and its off-licence). Records without coordinates are dropped and
counted. Every decision is in `pipeline/reports/ni-grocers-qa-<snapshot>.json`.

The layer is supplementary: it is never added to the GEOLYTIX store counts or rates (they must
stay like for like across the UK), and the app labels it with its source.

Output: `<out_root>/snapshots/<snapshot>/register/ni-other-grocers.geojson` and its provenance
sidecar (the `register` family, ADR-0021: the FSA register refreshes on its own schedule).
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

import jsonschema

from foodscope_pipeline.sources.fsa_fhrs import NI_COUNCILS
from foodscope_pipeline.sources.ons_files import load_index

logger = logging.getLogger(__name__)

FAMILY = "register"
COORD_DECIMALS = 6
FIELDS = ("FHRSID", "BusinessName", "BusinessType", "BusinessTypeID", "PostCode", "LocalAuthorityCode")
ATTRIBUTION = ("Food Standards Agency food hygiene rating data, Northern Ireland councils, licensed under the Open "
               "Government Licence v3.0")


class NiGrocersError(RuntimeError):
    """An input does not have the verified structure, or the rules contradict each other."""


@dataclass(frozen=True)
class NiGrocersInputs:
    fsa: Path  # pipeline/raw/fsa/<snapshot>/
    stores: Path  # the published GEOLYTIX store layer (local family)
    rules: Path  # config/ni_grocers.json


def default_inputs(raw_root: Path, config_dir: Path, data_dir: Path, snapshot: str, local_snapshot: str) -> NiGrocersInputs:
    return NiGrocersInputs(
        fsa=raw_root / "fsa" / snapshot,
        stores=data_dir / "snapshots" / local_snapshot / "local" / "stores.geojson",
        rules=config_dir / "ni_grocers.json",
    )


def _words(patterns: list[str]) -> re.Pattern[str]:
    return re.compile("|".join(r"(?<![a-z])" + re.escape(p) + r"(?![a-z])" for p in patterns))


def _metres(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distance between two WGS84 points (equirectangular; exact enough below a few hundred metres)."""
    lat = math.radians((a[1] + b[1]) / 2)
    return math.hypot((a[0] - b[0]) * 111_320 * math.cos(lat), (a[1] - b[1]) * 110_540)


def _postcode(value: str | None) -> str:
    return re.sub(r"\s+", "", (value or "").upper())


def read_register(folder: Path) -> list[dict]:
    """Every establishment of the 11 NI council files (checked against index.json and each file's header)."""
    index = load_index(folder)
    by_file = {e["file"]: e for e in index["files"]}
    rows = []
    for code, lad, _ in NI_COUNCILS:
        name = f"FHRS{code}en-GB.xml"
        if name not in by_file:
            raise NiGrocersError(f"{name} is not in {folder}/index.json")
        root = ET.parse(folder / name).getroot()
        if root.findtext("Header/ReturnCode") != "Success":
            raise NiGrocersError(f"{name}: header return code {root.findtext('Header/ReturnCode')!r}")
        items = list(root.iter("EstablishmentDetail"))
        if int(root.findtext("Header/ItemCount") or -1) != len(items):
            raise NiGrocersError(f"{name}: {len(items)} establishments, header says {root.findtext('Header/ItemCount')}")
        for e in items:
            row = {k: e.findtext(k) for k in FIELDS}
            if not row["FHRSID"] or not row["BusinessTypeID"]:
                raise NiGrocersError(f"{name}: a record has no FHRSID or BusinessTypeID")
            if row["LocalAuthorityCode"] != code:
                raise NiGrocersError(f"{name}: record {row['FHRSID']} belongs to council {row['LocalAuthorityCode']}")
            lon, lat = e.findtext("Geocode/Longitude"), e.findtext("Geocode/Latitude")
            row["point"] = (float(lon), float(lat)) if lon and lat else None
            row["town"] = next((e.findtext(f"AddressLine{i}") for i in (4, 3, 2) if e.findtext(f"AddressLine{i}")), None)
            row["lad"] = lad
            row["extractDate"] = root.findtext("Header/ExtractDate")
            rows.append(row)
    return rows


def build_ni_grocers(snapshot: str, inputs: NiGrocersInputs, out_root: Path, reports_dir: Path,
                     schema_dir: Path) -> list[Path]:
    rules = json.loads(inputs.rules.read_text(encoding="utf-8"))
    types = {v["id"]: k for k, v in rules["businessTypes"].items()}
    groups = [(g, _words(g["patterns"])) for g in rules["groups"]]
    chains = _words(rules["chainsCarriedByGeolytix"])
    non_food = _words(rules["mainlyNonFood"])
    min_m = float(rules["independentMinDistanceM"])

    rows = read_register(inputs.fsa)
    stores = json.loads(inputs.stores.read_text(encoding="utf-8"))["features"]
    ni_stores = [(f["properties"]["retailer"], tuple(f["geometry"]["coordinates"])) for f in stores
                 if (f["properties"].get("lad") or "").startswith("N")]
    if not ni_stores:
        raise NiGrocersError("the store layer has no Northern Ireland stores")

    qa: dict = {"snapshot": snapshot, "establishments": len(rows),
                "byBusinessType": dict(sorted(Counter(r["BusinessType"] for r in rows).items())),
                "extractDates": dict(sorted(Counter(r["extractDate"] for r in rows).items())),
                "kept": Counter(), "dropped": Counter(), "merged": [], "independentsNearMapStore": []}
    candidates = []
    for r in rows:
        kind = types.get(r["BusinessTypeID"])
        if kind is None:
            continue
        name = (r["BusinessName"] or "").lower()
        group = next((g for g, rx in groups if rx.search(name)), None)
        if group:
            rule = ("group", group["id"], group["label"])
        elif kind == "supermarket" and not chains.search(name) and not non_food.search(name):
            rule = ("independent", None, None)
        else:
            continue
        if r["point"] is None:
            qa["dropped"][f"{rule[1] or 'independent'}: no coordinates"] += 1
            continue
        if rule[0] == "independent":
            near = min((_metres(r["point"], p), retailer) for retailer, p in ni_stores)
            if near[0] <= min_m:
                qa["dropped"][f"independent within {min_m:.0f} m of a mapped {near[1]}"] += 1
                qa["independentsNearMapStore"].append({"fhrsId": r["FHRSID"], "name": r["BusinessName"],
                                                       "store": near[1], "distanceM": round(near[0], 1)})
                continue
        candidates.append((r, rule, kind))

    # The same group (or independent name) at the same postcode is one shop; keep the record
    # registered as a supermarket, else the lowest FHRSID.
    def key(item):
        r, rule, _ = item
        ident = rule[1] if rule[0] == "group" else re.sub(r"[^a-z0-9]", "", (r["BusinessName"] or "").lower())
        return (rule[0], ident, _postcode(r["PostCode"]))

    chosen: dict[tuple, tuple] = {}
    for item in sorted(candidates, key=lambda it: (it[2] != "supermarket", int(it[0]["FHRSID"]))):
        k = key(item)
        if k in chosen:
            qa["merged"].append({"kept": chosen[k][0]["FHRSID"], "merged": item[0]["FHRSID"],
                                 "name": item[0]["BusinessName"], "postcode": item[0]["PostCode"]})
            continue
        chosen[k] = item

    features = []
    for r, rule, kind in sorted(chosen.values(), key=lambda it: int(it[0]["FHRSID"])):
        qa["kept"][rule[1] or "independent"] += 1
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [round(r["point"][0], COORD_DECIMALS),
                                                          round(r["point"][1], COORD_DECIMALS)]},
            "properties": {
                "id": int(r["FHRSID"]), "name": r["BusinessName"], "kind": rule[0], "group": rule[2],
                "fsaType": rules["businessTypes"][kind]["label"], "postcode": r["PostCode"], "town": r["town"],
                "lad": r["lad"],
            },
        })
    doc = {"type": "FeatureCollection", "features": features}
    schema = json.loads((schema_dir / "ni-other-grocers.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(doc, schema)
    text = '{"type":"FeatureCollection","features":[\n' + ",\n".join(
        json.dumps(f, ensure_ascii=False, separators=(",", ":")) for f in features) + "\n]}\n"

    out_dir = out_root / "snapshots" / snapshot / FAMILY
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "ni-other-grocers.geojson"
    path.write_text(text, encoding="utf-8")
    index = load_index(inputs.fsa)
    combined = hashlib.sha256("".join(e["sha256"] for e in index["files"]).encode()).hexdigest()[:12]
    extract = sorted({r["extractDate"] for r in rows if r["extractDate"]})
    sidecar = {
        "id": "register.ni_other_grocers",
        "title": "Northern Ireland grocers not in the GEOLYTIX data, from the FSA food hygiene register",
        "role": "statistical", "path": f"snapshots/{snapshot}/{FAMILY}/ni-other-grocers.geojson",
        "format": "geojson", "schemaId": "ni-other-grocers",
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(), "bytes": len(text.encode("utf-8")),
        "featureCount": len(features), "sourceIds": ["S29", "S11"],
        "referencePeriod": f"FSA register extracts {extract[0]} to {extract[-1]}",
        "coverage": "Northern Ireland: 11 councils (supplementary to GEOLYTIX; not in any store count or rate)",
        "provenance": "derived", "licence": "Open Government Licence v3.0", "attribution": ATTRIBUTION,
        "expectedCadence": "irregular",
        "retrieval": {
            "method": "FSA open data XML per council (fetch-reference), cached in pipeline/raw/fsa/",
            "source": f"https://ratings.food.gov.uk/api/open-data-files/ ({len(index['files'])} files, combined sha256 {combined}…)",
            "retrievedAt": max(e["retrievedAt"] for e in index["files"]),
            "notes": ("Kept: grocery symbol groups GEOLYTIX does not carry in NI (by name), and independent grocers "
                      "registered as supermarkets/hypermarkets that are not within 50 m of a mapped store. Chains "
                      "GEOLYTIX maps are left to it. Same group or name at the same postcode = one shop. Rules: "
                      "pipeline/foodscope_pipeline/config/ni_grocers.json; every decision in the QA report."),
        },
    }
    manifest_schema = json.loads((schema_dir / "manifest.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(sidecar, {"$schema": manifest_schema["$schema"], "definitions": manifest_schema["definitions"],
                                  "$ref": "#/definitions/Dataset"}, format_checker=jsonschema.FormatChecker())
    prov = out_dir / "ni-other-grocers.provenance.json"
    prov.write_text(json.dumps(sidecar, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    qa["kept"] = dict(sorted(qa["kept"].items()))
    qa["dropped"] = dict(sorted(qa["dropped"].items()))
    qa["published"] = len(features)
    qa["byCouncil"] = dict(sorted(Counter(f["properties"]["lad"] for f in features).items()))
    qa["nearestMapStoreM"] = _nearest_summary([f["geometry"]["coordinates"] for f in features], ni_stores)
    reports_dir.mkdir(parents=True, exist_ok=True)
    report = reports_dir / f"ni-grocers-qa-{snapshot}.json"
    report.write_text(json.dumps(qa, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    logger.info("NI grocers %s: %d kept from %d establishments", snapshot, len(features), len(rows))
    return [path, prov, report]


def _nearest_summary(points: list[list[float]], stores: list[tuple[str, tuple[float, float]]]) -> dict:
    d = sorted(min(_metres(tuple(p), s) for _, s in stores) for p in points)
    if not d:
        return {}
    return {"under50": sum(x < 50 for x in d), "under200": sum(x < 200 for x in d),
            "median": round(d[len(d) // 2]), "max": round(d[-1])}


__all__ = ["NiGrocersError", "NiGrocersInputs", "build_ni_grocers", "default_inputs", "read_register"]
