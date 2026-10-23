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

**Stage 1 — Application foundation: built on branch `stage/1-foundation`, awaiting review and merge** (report: `docs/stage-reports/stage-1.md`). Next is Stage 2 — Data pipeline v1; do not start it until Stage 1 is merged. Update this line when a stage is merged.

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
- Outputs go to `public/data/snapshots/<date>/` with `manifest.json`; data refreshes arrive by pull request, never direct to `main`.

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
npm run e2e                # playwright against `vite preview` of an existing build
npm run gen:types          # schemas/*.json -> src/types/generated (commit the output)
npm run build:reference    # rebuild Natural Earth reference outlines + provenance sidecar

# E2E without internet access to the Esri CDN (e.g. a sandbox):
VITE_ARCGIS_ASSETS=local npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome npm run e2e   # only if Playwright's browser is not installed

cd pipeline && uv sync && uv run pytest              # pipeline tests
cd pipeline && uv run foodscope-pipeline publish     # rebuild public/data/manifest.json
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
