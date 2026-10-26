# Architecture decision records

MADR-style records. Status values: Proposed · Accepted · Superseded. Summaries also appear in `docs/02-ARCHITECTURE.md` §3.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-static-first-hosting.md) | Static-first hosting with pipeline-built snapshots | Accepted (Stage 1) |
| [0002](0002-map-components-in-react-19.md) | ArcGIS map components directly in React 19; no widgets, no React wrapper | Accepted (Stage 1) |
| [0003](0003-one-way-state-to-map-sync.md) | One-way sync: Zustand store → map controllers | Accepted (Stage 1) |
| [0004](0004-single-2d-web-mercator-view.md) | Single 2D Web Mercator view; 3D globe later | Accepted (Stage 1) |
| [0005](0005-symbolic-flow-arcs.md) | Flows as symbolic curves to a single UK point | Accepted (Stage 2) |
| [0006](0006-json-schema-contracts.md) | JSON Schema as the canonical data contract | Accepted (Stage 1) |
| [0007](0007-python-pipeline.md) | Python pipeline, TypeScript app | Accepted (Stage 1) |
| [0008](0008-data-adapters.md) | Data access through adapters | Accepted (Stage 1, static adapter only) |
| [0009](0009-indicator-envelope.md) | Indicator envelope with provenance | Accepted (Stage 1) |
| [0010](0010-pdf-from-profile-model.md) | PDF built from the profile model | Proposed (Stage 8) |
| [0011](0011-api-key-handling.md) | Referrer-restricted API key injected at build | Accepted (Stage 1) |
| [0012](0012-straight-line-first.md) | Straight-line proximity first; network times pre-computed later | Accepted |
| [0013](0013-query-string-state.md) | Query-string state, no path routing | Accepted (Stage 1) |
| [0014](0014-sdk-asset-hosting.md) | ArcGIS/Calcite assets: Esri CDN in production, local copy for tests | Accepted (Stage 1) |
| [0015](0015-flow-animation.md) | Moving markers on a canvas overlay, not CIM symbol animations | Accepted (Stage 2) |
| [0016](0016-hmrc-ingest-on-actions.md) | HMRC ingest runs on GitHub Actions; raw responses are committed | Accepted (Stage 2) |
| [0017](0017-seasonal-transitions-and-fixed-scales.md) | Seasonal Supply: eased widths only, fixed scales, nothing interpolated | Accepted (Stage 3) |
| [0018](0018-map-framing-on-the-data.md) | Map framing on the UK and the drawn connections | Accepted (post-Stage 3 review) |
| [0019](0019-one-share-ramp-and-data-first-startup.md) | One opaque share ramp; hover by highlight; figures before the map | Accepted (post-Stage 3 review) |
| [0020](0020-local-data-boundaries-stores-population.md) | Local data: two boundary editions, D5 store classes, built offline and published in Stage 4 | Accepted (pre-Stage 4 data step) |
| [0021](0021-snapshot-families.md) | Each data family (trade, local) comes from its own newest snapshot | Accepted (Stage 4) |
| [0022](0022-basemap-colour-sets-and-local-scale.md) | A colour set per basemap style; one local-scale rule (zoom 12) for stores, councils and imagery | Accepted (Stage 4) |
| [0023](0023-local-authority-profiles.md) | Local Authority Profiles: per-council small areas, a profile map mode, small areas as graphics | Accepted (Stage 5) |
| [0024](0024-risk-explorer.md) | Risk Explorer: three separate views on one map, a warm risk ramp, explanations built from indicators, no composite | Accepted (Stage 6) |
| [0025](0025-sixteen-baskets.md) | Sixteen baskets: groups from Defra's SITC divisions, a searchable picker, a matrix per group, small HMRC filters | Accepted (sixteen-basket data step) |
