"""ONS 2021 Rural Urban Classification tables (S21; England and Wales).

Read from the cached feature-service pages (`fetch-reference --set context`): one row per council
(LAD 2024) or per LSOA (2021) with `RUC21CD`, `RUC21NM` and `Urban_rural_flag`. The council
classes describe where most of the population lives (urban, intermediate urban, intermediate rural,
majority rural), each split by relative access to a major town or city; the LSOA classes follow the
majority of the population of their Output Areas (urban, larger rural, smaller rural; nearer or
further). Fields verified on the layers on 25 Oct 2026 (docs/03-DATA-SOURCES.md, S21).
"""

from __future__ import annotations

import json
from pathlib import Path

FLAGS = ("Urban", "Rural")
LAD_CODES = ("UUN", "UUF", "UIN", "UIF", "RIN", "RIF", "RMN", "RMF")
LSOA_CODES = ("UN1", "UF1", "RLN1", "RLF1", "RSN1", "RSF1")


class Ruc21Error(RuntimeError):
    """The classification table does not have the verified structure."""


def read_ruc21(pages: list[Path], code_field: str, classes: tuple[str, ...]) -> dict[str, dict[str, str]]:
    """Area code → {code, name, flag}; every class code must be one of `classes`, every code unique."""
    out: dict[str, dict[str, str]] = {}
    for page in pages:
        for feature in json.loads(page.read_text(encoding="utf-8"))["features"]:
            a = feature["attributes"]
            missing = [f for f in (code_field, "RUC21CD", "RUC21NM", "Urban_rural_flag") if not a.get(f)]
            if missing:
                raise Ruc21Error(f"{page.name}: row without {missing}: {a}")
            if a["RUC21CD"] not in classes or a["Urban_rural_flag"] not in FLAGS:
                raise Ruc21Error(f"{page.name}: {a[code_field]} has class {a['RUC21CD']!r} / {a['Urban_rural_flag']!r}")
            if a[code_field] in out:
                raise Ruc21Error(f"{page.name}: {a[code_field]} appears twice")
            out[a[code_field]] = {"code": a["RUC21CD"], "name": a["RUC21NM"], "flag": a["Urban_rural_flag"]}
    if not out:
        raise Ruc21Error("no rows")
    return out
