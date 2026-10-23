# ADR-0006 — JSON Schema as the canonical data contract

- Status: Accepted (Stage 1)
- Date: 2026-10-23

## Decision
Schemas in `/schemas` (draft-07) define config, manifest and indicator records. The pipeline validates with `jsonschema`; the app generates TypeScript types (`npm run gen:types`, `json-schema-to-typescript`) and validates fetched JSON at runtime with Ajv.

## Consequences
- CI fails if generated types are stale.
- Ajv runs in strict mode with `allowUnionTypes: true` (needed for `"type": ["string", "null"]`). Stage 1 found that without it the validators threw at module load and blanked the app — now covered by unit tests that compile every schema.
- `date-time` is checked with a narrow ISO 8601 regex instead of adding `ajv-formats`.
