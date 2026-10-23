# ADR-0014 — ArcGIS and Calcite asset hosting

- Status: Accepted (Stage 1)
- Date: 2026-10-23

## Context
`@arcgis/core`, `@arcgis/map-components`, `@arcgis/common-components` and `@esri/calcite-components` load runtime assets (workers, translations, icons, fonts) from `js.arcgis.com`, pinned to their installed versions (5.1.27 / Calcite 5.1.2). Esri recommends the CDN. Self-hosting all four asset folders adds about 130 MB to a build. The development sandbox and some CI environments cannot reach the CDN.

## Decision
- **Production (GitHub Pages)**: CDN mode (default). The deploy is ~21 MB.
- **Tests and offline use**: `VITE_ARCGIS_ASSETS=local` copies the four asset folders into `dist/arcgis/` (vite-plugin-static-copy) and `src/app/bootstrapAssets.ts` points every package at them before any component loads.
- CI end-to-end tests run in local mode for determinism; the post-deploy smoke test exercises the CDN build on the live site.

## Consequences
Two build modes to keep working; both are built in Stage 1 (local mode verified end to end in headless Chrome).
