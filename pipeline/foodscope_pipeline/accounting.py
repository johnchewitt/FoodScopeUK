"""Row accounting for pipeline steps.

Every step records rows in, rows out and rejects (with reasons) so silent data loss is
impossible (CLAUDE.md, pipeline rules).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class StepRecord:
    """Accounting for one pipeline step."""

    step: str
    rows_in: int
    rows_out: int
    rejects: dict[str, int] = field(default_factory=dict)

    @property
    def rejected(self) -> int:
        return sum(self.rejects.values())

    @property
    def unexplained(self) -> int:
        """Rows lost without a recorded reason. Must be zero."""
        return self.rows_in - self.rows_out - self.rejected


class Accounting:
    """Collects step records and enforces that every lost row is explained."""

    def __init__(self) -> None:
        self.steps: list[StepRecord] = []

    def record(self, step: str, rows_in: int, rows_out: int, rejects: dict[str, int] | None = None) -> StepRecord:
        """Record a step.

        Raises:
            ValueError: If counts are negative or rows are lost without a reason.
        """
        if rows_in < 0 or rows_out < 0:
            raise ValueError(f"{step}: row counts must be non-negative")
        rec = StepRecord(step=step, rows_in=rows_in, rows_out=rows_out, rejects=dict(rejects or {}))
        if rec.unexplained != 0:
            raise ValueError(
                f"{step}: {rec.unexplained} rows unaccounted for "
                f"(in={rows_in}, out={rows_out}, rejected={rec.rejected})"
            )
        logger.info("%s: in=%d out=%d rejected=%d", step, rows_in, rows_out, rec.rejected)
        self.steps.append(rec)
        return rec

    def to_dict(self) -> list[dict[str, object]]:
        return [
            {"step": s.step, "rows_in": s.rows_in, "rows_out": s.rows_out, "rejects": dict(sorted(s.rejects.items()))}
            for s in self.steps
        ]

    def write(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2) + "\n", encoding="utf-8")
