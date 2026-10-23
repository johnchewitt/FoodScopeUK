# Stage 1 report — Application foundation

| | |
|---|---|
| **Branch** | `stage/1-foundation` |
| **Date** | 23 October 2026 |
| **Scope** | Roadmap §3. No data features; no Stage 2 work. |
| **Result** | All local checks pass. CI and GitHub Pages deployment not yet run (see "Not verified"). |

## What was built

**Application shell (SH-01 – SH-07)**
- Header: FOODSCOPE UK mark and wordmark, subtitle, "Powered by ConsultingWhere", current module and its question, Search and Export shown as not-yet-available (with the stage that adds them), Help, data-freshness indicator driven by the manifest, 2D/3D toggle (3D marked Release 2), insights toggle.
- Left navigation rail for the seven modules (Release 2 modules badged "R2"), Evidence link and controls toggle; becomes a drawer on mobile.
- Collapsible controls panel: each module's planned controls (empty state, no fake controls) plus working map settings — fly to World/UK and a "Reduce motion" switch (Calcite).
- Floating KPI cards per module: the measures each module will show, with "No data loaded" and the build stage that adds them — no numbers anywhere.
- Bottom timeline placeholder: real month state (mirrored to the URL, keyboard-operable), play disabled until data exists.
- Right insights panel: what the view will show, what data is loaded now (from the manifest and live layer status), a chart slot with an empty state, and the integrity principles relevant to the module.
- Evidence & limitations dialog (deep-linkable `?view=evidence`) generated from the manifest; Help dialog with shortcuts.
- Loading, empty, error, partial-failure and stale components; per-region error boundaries so a failing panel never blanks the map.
- Responsive layouts: desktop (≥ 1440), laptop (1280–1439), tablet (768–1279, overlay panels one at a time), mobile (< 768, drawer and bottom sheets). Reduced motion via OS setting or in-app switch.

**Map (ADR-0002 – ADR-0004, ADR-0014)**
- One `<arcgis-map>` (SDK 5.1.27), lazy-loaded; `MapController` applies React state to the view (padding from open panels, camera commands, layer updates) and reports status back through store actions.
- Without an API key: Natural Earth 1:110m country outlines (S24) on navy with a subtle glow, the UK outlined in green for orientation. With a key: Esri dark grey basemap via `BasemapStyle` (key scoped to the style).
- Bespoke zoom and fly-to controls; attribution visible ("Made with Natural Earth", "Powered by Esri").

**State and data plumbing**
- Zustand store; URL sync for module, month, authority code and overlay (`?m=profiles&mo=7&lad=N09000003`), with defensive parsing.
- `config.json` and `data/manifest.json` loaded with TanStack Query and validated with Ajv against `schemas/`; typed errors with plain-English causes; `useDataset` + static snapshot adapter.
- `Indicator` envelope, `<Metric>` (refuses values without provenance), provenance badges distinguished by shape, `formatByUnit` implementing spec §6.4.
- ECharts 6 hook (lazy, tree-shaken, SVG renderer, accessible description).

**Pipeline, schemas, CI**
- `pipeline/` (Python, uv): `publish` builds `public/data/manifest.json` from provenance sidecars and a catalogue, verifies checksums, validates against the schema, writes byte-identical output on reruns; row accounting helper.
- `scripts/build-reference-layers.mjs`: Natural Earth TopoJSON → GeoJSON with antimeridian repair and a provenance sidecar.
- `.github/workflows/ci.yml` (checks, unit tests, local-asset build, Playwright, pipeline tests) and `deploy-pages.yml` (CDN build with the `ARCGIS_API_KEY` secret, deploy, live smoke test).
- Docs: README, ADR-0001 – ADR-0014, this report, backlog; CLAUDE.md, architecture, specification, data sources and roadmap updated.

## Package compatibility (verified)

| Check | Result |
|---|---|
| `npm ls` | One copy each of `@arcgis/core` 5.1.27, `@arcgis/map-components` 5.1.27, `@arcgis/common-components` 5.1.27, `@esri/calcite-components` 5.1.2; peer ranges satisfied (`^5.1.0`, `^5.1.1`). Only optional peers unmet. |
| Calcite alignment | Pinned to 5.1.2 (Esri version matrix pairs SDK 5.1 with Calcite 5.1; npm `latest` is 5.2.0). |
| React 19 typings | `@arcgis/map-components/types/react` and `@esri/calcite-components/types/react` type every element and event used; `tsc` clean. |
| TypeScript | 6.0.3 (typescript-eslint 8.72 supports < 6.1; TypeScript 7 not used). |
| Vite 8.3.5 + plugin-react 6.1.2 | Builds in both asset modes. |
| Engine warning | `jsdom` 30 asks for Node ≥ 22.22.2; the sandbox has 22.22.0 and tests pass. CI uses Node 24 (`.nvmrc`). |

## Commands run and results (sandbox, 23 Oct 2026)

| Command | Result |
|---|---|
| `npm run check:banned` | OK |
| `npm run format` | All files formatted |
| `npm run typecheck` | 0 errors (app, node and test projects) |
| `npm run lint` | 0 errors, 0 warnings |
| `npm test` | **119 passed** (11 files) |
| `npm run gen:types` + `git status` | Generated types current |
| `cd pipeline && uv run pytest` | **12 passed** |
| `VITE_ARCGIS_ASSETS=local npm run build` | Success |
| `npm run e2e` (Chrome for Testing 153, SwiftShader WebGL) | **19 passed** |
| `npm run build` (production, CDN assets) | Success; `dist/` 21 MB; initial JS 605.8 kB (183.7 kB gzip); lazy map chunk 1.15 MB (275 kB gzip) |

E2E coverage: map becomes ready and draws the reference layer with no console errors; module navigation, URL updates, reload and back button; deep links; invalid URL fallback; panel toggles change `view.padding`; map buttons move the camera; Evidence/Help dialogs; month keyboard control; KPI cards contain no numbers; manifest HTTP failure and schema failure; five viewports with no horizontal scroll and ≥ 60 % unobstructed map width at 1920 px; mobile drawer; axe (no serious/critical violations); reduced motion disables map animation.

Screenshots: [desktop 1920](stage-1/desktop-1920.png) · [laptop 1366](stage-1/laptop-1366.png) · [tablet 1024](stage-1/tablet-1024.png) · [tablet portrait 820](stage-1/tablet-portrait-820.png) · [mobile 390](stage-1/mobile-390.png) · [Evidence dialog](stage-1/evidence-dialog-1440.png)

## Problems found and fixed during the stage

1. **App blank on load** — Ajv strict mode rejected `"type": ["string", "null"]` at module load. Fixed with `allowUnionTypes`; unit tests now compile every schema.
2. **Map never became ready** — with no basemap the view had no zoom levels. Fixed by passing Web Mercator LODs in `MapViewConstraints` (ADR-0004).
3. **Lines across the map** — some Natural Earth rings in world-atlas jump from +180° to −180°. Fixed by splitting at the antimeridian; a test guards the committed file.
4. **Cramped layout at 1024–1279 px** — both docked panels left ~280 px of map. Tablet overlay layout now extends to 1279 px; KPI cards capped per breakpoint.
5. **Accessibility** — month buttons' labels did not contain their visible text (axe). Fixed.

## Not verified, and why

- **GitHub Actions CI and Pages deploy** — workflows written but not yet run; they run when this branch is pushed and the pull request is opened. Pages also needs Settings → Pages → Source = GitHub Actions (not changed by Claude).
- **Esri basemap and CDN asset mode in a browser** — the sandbox cannot reach `js.arcgis.com` or the Basemap styles service, and no API key is available. The CDN build compiles and points at `js.arcgis.com/5.1.27/…`; the post-deploy smoke test will exercise it.
- **Contrast of glass panels over the Esri basemap** — only checked over the offline outline map.
- **Real-GPU rendering and performance** — tests used software WebGL; load-time budgets (PF-01) not measured.
- **Safari and Firefox** — only Chromium tested.
- **Mid-size Windows/macOS font rendering** — not checked.

## Deviations from the roadmap

- Module navigation is a left rail (John's Stage 1 instruction) rather than top-centre; spec SH-02 updated.
- The roadmap suggested a real LAD boundary ingest in Stage 1; the ONS service is unreachable from the sandbox, so Stage 1's real data path uses the Natural Earth reference layer instead. LAD ingest moves to Stage 2 as planned for the full pipeline.
- The ArcGIS FeatureLayer adapter is an interface only (implemented with the supermarket layer in Stage 4).
- Initial JS bundle exceeds the 350 kB budget (backlog B1).

## Open questions

1. Pages source: switch to GitHub Actions now (you or Claude, with your OK)?
2. ArcGIS key: Location Platform account or ArcGIS Online with a custom role?
3. Brand: is a ConsultingWhere logo available for the header and PDFs, or stay text-only?
