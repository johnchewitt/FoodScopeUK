"""Gate G3 (OFFLINE): the Food Origins baskets against Defra's trade codes (S05) and HMRC's codes (S01).

Spec §6.1 asks that the baskets be "confirmed against Defra's published trade codes and the HMRC
/Commodity endpoint before any figure is shown". This module reads Defra's "trade codes and
descriptions" table (ODS of 15 Nov 2022; one sheet, `CN_CODES_MASTER_TABLE`) and the built trade
snapshot (each basket's CN8 codes as HMRC lists them, with the months they carry imports), and writes
`pipeline/reports/basket-codes-<snapshot>.json`:

- the SITC division(s) Defra gives the basket's codes (one division per basket is expected);
- Defra's most detailed grouping ("Brigade" levels 1-3) of the basket's codes, and every heading
  Defra puts in the same level-3 group that the basket leaves out (a definitional difference to
  state, not an error);
- Defra's indigeneity (can the product be grown in the UK on a commercially viable scale) and
  degree of processing, as counts of codes;
- HMRC codes with imports that Defra's 2022 table does not list (codes introduced since).

Defra's codes have nine digits: the CN8 code and a one-digit suffix. 124 are stored as numbers, which
drops leading zeros; they are restored to nine digits.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from foodscope_pipeline.sources.hmrc_ots import Basket
from foodscope_pipeline.sources.ods import read_sheet

SHEET = "CN_CODES_MASTER_TABLE"
COLUMNS = (
    "Com Code", "Com Description", "DIV Code", "DIV Description", "HS4 code", "HS4 Description",
    "Indig Description", "DOP Description", "Brigade1", "Brigade2", "Brigade3",
)


class BasketCodesError(RuntimeError):
    """Defra's table does not have the verified structure."""


@dataclass(frozen=True)
class DefraCode:
    code9: str
    cn8: str
    description: str
    division: tuple[str, str]
    hs4: tuple[str, str]
    indigeneity: str
    processing: str
    group: tuple[str, str, str]


def _code9(value: Any) -> str:
    if isinstance(value, float):
        if not value.is_integer():
            raise BasketCodesError(f"commodity code {value!r} is not a whole number")
        return str(int(value)).zfill(9)
    text = str(value).strip()
    if not text.isdigit():
        raise BasketCodesError(f"commodity code {value!r} is not a digit string")
    return text.zfill(9)


def read_defra_codes(path: Path) -> list[DefraCode]:
    rows = read_sheet(path, SHEET)
    if not rows:
        raise BasketCodesError(f"{path.name}: sheet {SHEET} is empty")
    header = [str(c).strip() for c in rows[0]]
    missing = [c for c in COLUMNS if c not in header]
    if missing:
        raise BasketCodesError(f"{path.name}: columns {missing} not found")
    col = {name: header.index(name) for name in COLUMNS}

    def cell(r: list, name: str) -> Any:
        i = col[name]
        return r[i] if i < len(r) else None

    out: list[DefraCode] = []
    for r in rows[1:]:
        if not any(c not in (None, "") for c in r):
            continue
        code = _code9(cell(r, "Com Code"))
        if len(code) != 9:
            raise BasketCodesError(f"commodity code {code} does not have nine digits")
        out.append(DefraCode(
            code9=code,
            cn8=code[:8],
            description=str(cell(r, "Com Description") or "").strip(),
            division=(str(cell(r, "DIV Code")).zfill(2), str(cell(r, "DIV Description") or "").strip()),
            hs4=(str(cell(r, "HS4 code")).zfill(4), str(cell(r, "HS4 Description") or "").strip()),
            indigeneity=str(cell(r, "Indig Description") or "").strip(),
            processing=str(cell(r, "DOP Description") or "").strip(),
            group=tuple(str(cell(r, f"Brigade{i}") or "").strip() for i in (1, 2, 3)),  # type: ignore[arg-type]
        ))
    return out


def in_basket(cn8: str, basket: Basket) -> bool:
    return any(cn8.startswith(h) for h in basket.hs4) or any(cn8.startswith(h) for h in basket.hs6)


def compare_basket(basket: Basket, defra: list[DefraCode], snapshot: dict[str, Any]) -> dict[str, Any]:
    mine = [d for d in defra if in_basket(d.cn8, basket)]
    if not mine:
        raise BasketCodesError(f"{basket.id}: Defra's table lists no code under {basket.hs_scope}")
    by_group: dict[tuple[str, str, str], list[DefraCode]] = defaultdict(list)
    for d in defra:
        by_group[d.group].append(d)

    groups = []
    differences: list[str] = []
    for group, n in sorted(Counter(d.group for d in mine).items(), key=lambda kv: (-kv[1], kv[0])):
        outside: dict[tuple[str, str], int] = Counter(d.hs4 for d in by_group[group] if not in_basket(d.cn8, basket))
        out_list = [{"hs4": h, "description": desc, "codes": c} for (h, desc), c in sorted(outside.items())]
        groups.append({"brigade": list(group), "codes": n, "outsideBasket": out_list})
        for o in out_list:
            differences.append(f"Defra's group '{group[2]}' ({group[1].lower()}) also includes HS {o['hs4']} "
                               f"({o['description']}), which the basket leaves out.")

    divisions = Counter(d.division for d in mine)
    if len(divisions) > 1:
        differences.append("The basket's codes fall in more than one SITC division: "
                           + ", ".join(f"{c} {desc}" for c, desc in sorted(divisions)))

    listed = snapshot["commodity"]["cn8"]
    defra_cn8 = {d.cn8 for d in defra}
    with_imports = [c for c in listed if c["monthsRecorded"] > 0]
    not_in_defra = [
        {"code": c["code"], "description": c["description"], "firstMonth": c["firstMonth"]}
        for c in with_imports if c["code"] not in defra_cn8
    ]
    return {
        "basket": basket.id,
        "label": basket.label,
        "hsScope": basket.hs_scope,
        "hmrc": {"listed": len(listed), "withImports": len(with_imports)},
        "defra": {
            "listed": len(mine),
            "sitcDivisions": [{"code": c, "description": desc, "codes": n} for (c, desc), n in sorted(divisions.items())],
            "groups": groups,
            "indigeneity": dict(sorted(Counter(d.indigeneity for d in mine).items())),
            "degreeOfProcessing": dict(sorted(Counter(d.processing for d in mine).items())),
        },
        "hmrcCodesWithImportsNotInDefra": not_in_defra,
        "differences": differences,
    }


def check_baskets(snapshot_id: str, baskets: list[Basket], defra_ods: Path, trade_dir: Path,
                  reports_dir: Path) -> dict[str, Any]:
    defra = read_defra_codes(defra_ods)
    results = []
    for basket in baskets:
        snap = json.loads((trade_dir / f"{basket.id}.json").read_text(encoding="utf-8"))
        results.append(compare_basket(basket, defra, snap))
    report = {
        "gate": "G3",
        "snapshotId": snapshot_id,
        "description": ("Each Food Origins basket against Defra's trade codes and descriptions (S05, 15 Nov 2022) and "
                        "the CN8 codes HMRC lists under its headings (S01). Differences are definitional and stated "
                        "in the basket definitions or the data catalogue; they are not errors."),
        "defraFile": defra_ods.name,
        "defraCodes": len(defra),
        "baskets": results,
        "oneSitcDivisionEach": all(len(r["defra"]["sitcDivisions"]) == 1 for r in results),
    }
    reports_dir.mkdir(parents=True, exist_ok=True)
    (reports_dir / f"basket-codes-{snapshot_id}.json").write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return report
