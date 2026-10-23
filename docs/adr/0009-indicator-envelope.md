# ADR-0009 — Indicator envelope with provenance

- Status: Accepted (Stage 1)
- Date: 2026-10-23

## Decision
Every displayed value is an `Indicator` (src/types/indicator.ts, schema `indicator.schema.json`) carrying source ids, reference period, unit, coverage, method, scope and provenance class. `<Metric>` is the only component that renders numbers; it refuses values with incomplete provenance (logs in development, shows "Source unavailable" in production).

## Consequences
Stage 1 renders no statistics, so KPI cards show labelled empty states rather than placeholder numbers (P14). `<Metric>` and `<KpiCard>` are tested with obviously synthetic indicators.
