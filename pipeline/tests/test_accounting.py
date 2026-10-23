import json

import pytest

from foodscope_pipeline.accounting import Accounting


def test_records_balanced_step() -> None:
    acc = Accounting()
    rec = acc.record("load", rows_in=10, rows_out=8, rejects={"bad_coordinate": 2})
    assert rec.rejected == 2
    assert rec.unexplained == 0


def test_unexplained_loss_raises() -> None:
    with pytest.raises(ValueError, match="unaccounted"):
        Accounting().record("load", rows_in=10, rows_out=7, rejects={"bad_coordinate": 2})


def test_negative_counts_raise() -> None:
    with pytest.raises(ValueError):
        Accounting().record("load", rows_in=-1, rows_out=0)


def test_empty_step_is_valid() -> None:
    assert Accounting().record("noop", rows_in=0, rows_out=0).unexplained == 0


def test_write_is_deterministic(tmp_path) -> None:
    acc = Accounting()
    acc.record("a", 3, 1, {"z_reason": 1, "a_reason": 1})
    out = tmp_path / "acc.json"
    acc.write(out)
    first = out.read_text(encoding="utf-8")
    acc.write(out)
    assert out.read_text(encoding="utf-8") == first
    assert list(json.loads(first)[0]["rejects"]) == ["a_reason", "z_reason"]
