# CLAUDE.md — FOODSCOPE UK

Instructions for Claude Code working in this repository. Read this file first, every session.

## What this project is

FOODSCOPE UK is a map-centred food security and supply-chain intelligence demonstrator for ConsultingWhere: React 19 + TypeScript + Vite + ArcGIS Maps SDK for JavaScript 5.1, hosted statically on GitHub Pages, fed by a Python data pipeline that builds dated snapshots from official UK sources. It must be visually exceptional **and** credible to Defra, devolved governments and local authorities. When those pull in different directions, credibility wins.

| Read | For |
|---|---|
| `docs/01-SPECIFICATION.md` | Requirements (IDs like `FO-03`), integrity principles `P1–P14`, formulas, design tokens, acceptance criteria |
| `docs/02-ARCHITECTURE.md` | Stack and versions, ADRs, folder layout, state/map/data patterns, testing, CI |
| `docs/03-DATA-SOURCES.md` | Every source (`S01…`), what is verified, field names you may use, caveats |
| `docs/04-ROADMAP.md` | Stages, verification gates (`G1…`), exit criteria, how to run a stage |
| `docs/00-ORIGINAL-BRIEF.md` | The original commissioning brief (do not edit) |

## Current stage

**Stages 1–4 are merged and deployed.** Stage 4 (UK Food Access and the basemap choice) merged as PR #9 and went live on 24 Oct 2026 (report: `docs/stage-reports/stage-4.md`, with the live checks; ADR-0021, ADR-0022). Its live-check fixes are in PR #11 (`fix/stage-4-live-checks`). The basemap usage count waits for John's dashboard. **Next: Stage 5 — Local Authority Profiles** (roadmap §7). John asked to proceed on 24 Oct 2026. Clear gates G8–G11 first; their data comes through a `data/**` branch, as in Stage 4. The other data-pipeline items in roadmap §5.3 are still to be scheduled. Update this line when a stage is merged.

## How to work

1. Work on **one stage at a time**, on branch `stage/<n>-<slug>`. Read the roadmap section for that stage and check its gates are cleared.
2. Before coding, write a short plan: files to create/change and tests to add. Keep changes within the stage's scope; put new ideas in `docs/backlog.md`.
3. Implement in small commits using Conventional Commits with requirement IDs: `feat(origins): partner choropleth (FO-02)`.
4. Run the checks (below). Fix failures; do not skip, disable or weaken tests to get green.
5. End the stage with `docs/stage-reports/stage-<n>.md`: what was built, commands run and their actual results, **what was not verified and why**, open questions. Never claim something works without evidence.

## Integrity rules (summary of spec §2 — these override feature requests)

- **No invented data, endpoints or field names.** Only use fields marked verified in `docs/03-DATA-SOURCES.md`. If you need something unverified, verify it (and update the doc) or stop and ask.
- **Every displayed number is an `Indicator`** with source IDs, reference period, unit, coverage, method and provenance class (`measured | official_estimate | derived | scenario | illustrative`). Render values only through `<Metric>`/provenance-aware components.
- **HMRC partner = country of dispatch.** Say "recorded import partner"; never "where food is grown". Flow arcs are symbolic, never routes, and never end at ports.
- **Never link trade data to retailers or stores.**
- **Straight-line distance is labelled "straight-line"**, never walking/driving time. Store counts and proximity are not affordability or access.
- **National context is labelled as such** inside local profiles.
- **Scenarios produce "estimated exposure"**, never "shortage". Substitution defaults to 0 % and is labelled a user assumption.
- **No single composite score** across national, logistics and local components.
- **Show missing and suppressed data explicitly**; never interpolate or redistribute silently.
- **Comparability warnings** across UK nations, statistical years, index versions and series breaks.
- **Consulting content**: no fabricated credentials, client names, project references, procurement needs or budgets.
- Test fixtures come from **real** source responses, stored with retrieval date. Synthetic data is allowed only in unit tests of pure functions and must be obviously synthetic (e.g. partners "A", "B").

## Stack rules

- Versions are pinned (architecture §2). Do not upgrade a major/minor of `@arcgis/*`, `@esri/calcite-components`, React, Vite or TypeScript without an ADR.
- **TypeScript 6.0.x**, not 7.x (lint toolchain support). `strict` on.
- **Calcite 5.1.x** to match SDK 5.1.

### ArcGIS Maps SDK 5.1

- Use **map components** (`<arcgis-map>`, `<arcgis-legend>`, `<arcgis-search>`, …) or bespoke React controls. **No widgets** (deprecated in 5.0). **No `@arcgis/map-components-react`.** No AMD/`require`, no `__esri` namespace types (deprecated in 5.0, removed in 6.0).
- Register components by import: `import "@arcgis/map-components/components/arcgis-map";`
- JSX types: `src/vite-env.d.ts` contains `/// <reference types="@arcgis/map-components/types/react" />`.
- Events in JSX: `onarcgisViewReadyChange`, `onarcgisReady`, etc. Get the view from the element after view-ready.
- Import core modules granularly from `@arcgis/core/...` (ESM). Check the 5.1 API reference at developers.arcgis.com before using an API you have not used in this repo; if documentation and the installed package's `.d.ts` disagree, trust the package typings and note it.
- `<arcgis-map>` is mounted **once** (`src/components/maps/MapHost.tsx`) and never re-mounted on module change. `MapHost` is lazy-loaded (`React.lazy`) so the SDK chunk does not block the shell; it is the only module that registers `arcgis-map`.
- **API key**: registered once at startup as `esriConfig.apiKeys.basemapStyles` with `esriConfig.request.useIdentity = false` (`src/services/arcgis/requestPolicy.ts`, ADR-0011). Do not rely on `BasemapStyle.apiKey` alone: SDK 5.1 copies it onto the basemap layers after they are created, so the view can request the style without it and visitors get an ArcGIS sign-in prompt. Never set the global `esriConfig.apiKey`.
- A view becomes ready even when its basemap fails; basemap health is reported separately (`BasemapStatusController`, `data-basemap-status` on `.map-host`).
- **CIM symbol animations do not render in our view** (any `animations` entry, including `CIMSymbolAnimationMoveAlongLine`, makes the whole symbol disappear — ADR-0015). Flow motion is drawn by `src/map/layers/flowParticles.ts` on a canvas overlay; keep the static lines as ordinary graphics.
- Food Origins and Seasonal Supply map state reaches the map only through `state.originsMap` (built by `buildOriginsModel`; Seasonal builds its selected month with it); do not compute shares in `src/map/`.
- Seasonal transitions (ADR-0017): only connection widths ease, ≤ 320 ms, via `src/analysis/transition.ts`, ending at the exact model widths. Never interpolate numbers, classes or missing months. Reduced motion means no transition. Seasonal uses a fixed width scale (largest monthly partner value in the snapshot) and fixed heatmap classes (`src/analysis/seasonal.ts`).
- `src/features/seasonal/` and `src/features/access/` are lazy-loaded through their `lazy.tsx` (chunk loader in `load.ts`). The shell imports only those wrappers (and `access/note.ts`, the SM-10 text), never the feature components directly. UK Food Access compiles its own validators (stores, council indicators) inside its chunk.
- **Share colours** (ADR-0019, ADR-0022): map fills and legend swatches use the opaque `--fs-map-seq-*` tokens of the active basemap style (on dark grey these are the `--fs-seq-*` ramp the Seasonal heatmap uses). ArcGIS code takes them from `MAP_COLOURS` in `src/styles/palette.ts`; `palette.test.ts` keeps them in sync. Do not reintroduce transparency.
- **Hover** uses the view's named highlight (`fs-hover`), never a renderer rebuild. Rebuild the partner renderer only when data or selection changes.
- **Framing** (ADR-0018): the camera fits `originsMap.frame` only when its `key` (commodity) changes, or on the `goTo partners` command (map control, F key). UK Food Access fits `accessMap.frame` (all mapped stores) once per visit, not when already at local scale (ADR-0022 amendment). Never move the camera on month/year/measure changes. Framing maths lives in `src/analysis/frame.ts`. MapView's `padding` is an Accessor: read its sides explicitly, never spread it.
- **Start-up** (ADR-0019): `main.tsx` prefetches the first view's data (`src/app/prefetch.ts`) and requests the map chunk (`loadMapHost`). The prefetch must use the hooks' query options (`manifestQuery`, `validatedDatasetQuery`) so the cache keys and validation match.
- **Basemap choice** (SH-08, ADR-0022): `BasemapStatusController` is the only code that sets `map.basemap`; it swaps styles from `selectRequestedMapStyle` and reports their health. Style IDs live in `src/services/arcgis/basemap.ts` (`BASEMAP_STYLE_IDS`, S25). Imagery is requested only at local scale in `IMAGERY_MODULES`; the choice stays in the URL (`bm`) meanwhile. The control is hidden without a key.
- **Colour sets per style** (ADR-0022): map colours come from `MAP_COLOURS[style]` (`src/styles/palette.ts`), legends from the `--fs-map-*` tokens switched by `data-map-style` on `.app`; `palette.test.ts` keeps them in sync. Use `selectMapColourStyle` (dark when there is no key or the basemap failed). A new map colour needs a value for every style and a validator run. The Seasonal heatmap (panel) keeps `--fs-seq-*`. Legend samples drawn as lines sit on `--fs-map-sample-ground` (the land colour on light grey), because legends are dark glass.
- **Local scale** is `LOCAL_ZOOM` (12) in `src/state/store.ts`: stores individual (cluster `maxScale`), councils outlined, imagery offered. The map reports its resting zoom and centre through `ViewStateController` → `setMapView`.
- **UK Food Access map** (Stage 4): `state.accessMap` (built by `useAccess`) is the only input of `AccessLayersController` (`src/map/layers/access.ts`); the stores layer reads a compact blob GeoJSON (id, layer, retailer) and filters with `filterWhereClause`; rates, classes and distances are computed in `src/analysis/` and `src/features/access/model.ts`, never in `src/map/`. Straight-line distances use the national grids (`src/analysis/projection.ts`): BNG, or ITM for Northern Ireland stores.
- **Map sync is never nested**: a store change made during `MapController.sync` (e.g. a layer reporting "loading") runs after the sync with the latest state. Still assign a layer to its field before reporting its status.
- **Without a basemap the view has no tiling scheme**: keep the Web Mercator `constraints.lods` that `MapHost` passes, or the view never becomes ready (ADR-0004).
- Asset hosting (ADR-0014): production uses the Esri CDN; `VITE_ARCGIS_ASSETS=local` copies ArcGIS/Calcite assets into the build for offline/sandboxed runs. `src/app/bootstrapAssets.ts` must stay the first import in `main.tsx`.
- Component tests never load the SDK: `MapHost` is mocked with `vi.mock`, and Calcite elements are registered only in `src/app/registerComponents.ts` (imported by `main.tsx`). Keep UI modules free of `@arcgis/core` imports (shared ids live in `src/map/layerIds.ts`).

### State and map synchronisation (ADR-03)

- Zustand store is the source of truth; only serialisable values in it (IDs, numbers, strings). No ArcGIS objects in React state or props.
- Only code in `src/map/` creates or mutates layers. Layer controllers implement `activate / update / deactivate` and must be idempotent.
- Map events → typed store actions. Store → controllers via subscriptions. No two-way binding.
- URL query string mirrors selection, filters, module and scenario (ADR-13). No path-based routes.

### Code organisation

- `src/analysis/` = pure functions (no React, ArcGIS or DOM imports). All formulas from spec §6 live here with unit tests.
- `src/features/<module>/` owns its UI, hooks and `layers.ts` declaration.
- Data access only through `useDataset()` + adapters (`src/services/data/`). Validate with ajv against `schemas/`.
- Styling: CSS variables from `src/styles/tokens.css` only — no hard-coded colours in components. Calcite themed via its CSS variables, not shadow-DOM hacks.
- Every panel handles loading / empty / error / partial / stale states with the shared components in `src/components/states/`.
- Respect `prefers-reduced-motion` and the in-app motion setting for all animation, including map flights and flow effects.
- UI copy in British English; numbers formatted per spec §6.4.

### Pipeline (`pipeline/`)

- Python 3.12 via `uv`. One module per source in `foodscope_pipeline/sources/`. Record URL, query, retrieval timestamp, checksum and licence for every download.
- Declare CRS explicitly; compute distances/areas in EPSG:27700 (GB) or EPSG:2157 (NI); publish WGS84.
- Log rows in/out at every step; write rejects with reasons; deterministic sort before writing; reruns must be idempotent.
- HMRC API: ≤ 50 requests/minute, follow `@odata.nextLink`, cache raw responses, keep suppressed rows separate.
- Outputs go to `public/data/snapshots/<date>/<family>/` (`trade`, `local`); `publish` takes each family from its newest snapshot (ADR-0021) and writes `manifest.json`; data refreshes arrive by pull request, never direct to `main`.
- ONS (S14, S18): the sandbox cannot reach ONS either. `fetch-ons` runs in `.github/workflows/refresh-reference-data.yml` on push to a `data/**` branch and is incremental; files provided by hand live in `pipeline/raw/<source>/<edition>/` with an `index.json` of checksums. Store classes (D5) and council code changes are config in `foodscope_pipeline/config/`; stores are assigned on the BFE boundaries in EPSG:27700, councils are drawn from the clipped BGC edition (ADR-0020).
- HMRC (S01): the sandbox cannot reach `api.uktradeinfo.com`. Run the online step through `.github/workflows/refresh-trade-data.yml` (push a `data-refresh/<date>` branch or run it manually); raw responses are committed in `pipeline/raw/hmrc/<snapshot>/` and everything after ingest runs offline from them (ADR-0016). Never hand-edit raw responses or snapshot files.

## Commands

Keep this list accurate as scripts change.

```bash
npm ci                     # install (lockfile)
npm run dev                # dev server at http://localhost:5173/FoodScopeUK/
npm run typecheck          # tsc -b (app, node and test projects)
npm run lint               # eslint (includes banned-import rules)
npm run format             # prettier --check (format:write to fix)
npm run check:banned       # no widgets / map-components-react / __esri / AMD
npm test                   # vitest: unit + component tests (jsdom)
npm run build              # typecheck + production build (BASE_PATH, VITE_ARCGIS_ASSETS)
npm run preview            # serve dist/ at http://localhost:4173/FoodScopeUK/
npm run e2e                # playwright against `vite preview` of an existing build (+ dist-basemap if built)
npm run build:e2e-basemap  # second build with a placeholder key (.env.e2e-basemap) → dist-basemap/, for basemap.spec.ts
npm run gen:types          # schemas/*.json -> src/types/generated (commit the output)
npm run build:reference    # rebuild Natural Earth v5.1.2 outlines + label points (pinned SHA-256) + sidecars

# E2E without internet access to the Esri CDN (e.g. a sandbox):
VITE_ARCGIS_ASSETS=local npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome npm run e2e   # only if Playwright's browser is not installed

cd pipeline && uv sync && uv run pytest              # pipeline tests (incl. offline rebuilds of the HMRC snapshot and the local datasets)
cd pipeline && uv run foodscope-pipeline publish     # rebuild public/data/manifest.json
cd pipeline && uv run foodscope-pipeline build-trade --snapshot 2026-10-23   # offline: raw HMRC cache -> trade snapshot
cd pipeline && uv run foodscope-pipeline ingest-hmrc --snapshot <date>       # ONLINE: only on GitHub Actions (refresh-trade-data.yml)
cd pipeline && uv run foodscope-pipeline fetch-ons --snapshot <date>         # ONLINE: only on GitHub Actions (refresh-reference-data.yml, push to data/**)
cd pipeline && uv run foodscope-pipeline build-local --snapshot 2026-10-24   # offline: boundaries, stores, population -> public/data/snapshots/<date>/local/ + reports
```

## Definition of done (every task)

- [ ] Meets the requirement IDs it claims; nothing outside the stage scope.
- [ ] Typecheck, lint, unit tests and build pass; E2E pass for user-facing changes.
- [ ] New analysis code has unit tests including edge cases (empty, zero, null, suppressed, single item).
- [ ] Every new on-screen number has provenance; every new source/field is verified in `docs/03-DATA-SOURCES.md`.
- [ ] Loading/empty/error states handled; keyboard accessible; reduced motion respected.
- [ ] No secrets, tokens or private org URLs committed. `config.json` contains public values only.
- [ ] Docs updated (README, ADR, data catalogue, stage report) where behaviour or data changed.

## Don't

- Don't fabricate figures, even as placeholders in the UI — use an explicit "Illustrative" badge and obviously fake values if a design mock is unavoidable, and remove before merge.
- Don't call the HMRC API (or any rate-limited government API) from the browser.
- Don't add dependencies without saying why in the commit body; prefer the existing stack.
- Don't compute monthly "domestic share of supply" from incompatible statistics.
- Don't compare deprivation ranks across nations.
- Don't hide basemap or data attribution.
- Don't edit `docs/00-ORIGINAL-BRIEF.md`.

## Configuration and secrets

- Repository: `github.com/johnchewitt/FoodScopeUK`; site: `https://johnchewitt.github.io/FoodScopeUK/`.
- Build-time: `BASE_PATH` (Vite `base`, default `/FoodScopeUK/` — case matters) and `VITE_ARCGIS_API_KEY`. See `.env.example`.
- **ArcGIS API key is never committed.** CI reads it from the Actions secret `ARCGIS_API_KEY`; locally it goes in git-ignored `.env.local`. If the key is missing, the app must still run with the fallback map. Never print the key in logs, tests or stage reports. Setup and rotation: `docs/setup/arcgis-api-key.md`.
- Runtime: `public/config.json` (validated by `schemas/config.schema.json`): optional hosted FeatureLayer URLs and field mappings, feature flags — public values only.
- Publishing credentials (Release 3) live only in GitHub Actions secrets.
