# ADR-0007 — Python pipeline, TypeScript app

- Status: Accepted (Stage 1)
- Date: 2026-10-23

## Decision
Data acquisition, validation, spatial joins and publishing run in Python 3.12 (`uv`, pinned in `pipeline/uv.lock`). The browser app is TypeScript.

## Consequences
Two toolchains in CI. Stage 1 contains the `publish` step (manifest from provenance sidecars, schema-validated, idempotent) and row accounting. The single Node script `scripts/build-reference-layers.mjs` converts the npm-packaged Natural Earth TopoJSON because the TopoJSON tooling is JavaScript; it writes a provenance sidecar that the Python publish step verifies by checksum.
