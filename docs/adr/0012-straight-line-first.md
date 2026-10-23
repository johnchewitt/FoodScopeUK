# ADR-0012 — Straight-line proximity first

- Status: Accepted
- Date: 2026-10-23

## Decision
Release 1 uses straight-line distance (labelled as such) from small-area representative points, computed in EPSG:27700 (GB) or EPSG:2157 (NI). Network travel times are pre-computed in the pipeline in Release 3 with documented speeds, snapping reports and external validation. No bulk client-side routing with an embedded key.
