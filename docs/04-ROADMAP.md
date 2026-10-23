# FOODSCOPE UK — Development Roadmap

| | |
|---|---|
| **Document** | 04 — Staged delivery plan |
| **Version** | 0.1 — 23 October 2026 |
| **Approach** | Small, demonstrable stages. Each stage ends with working software, passing checks and a short stage report. No stage starts while its verification gates are open. |

---

## 1. Stage overview

| Stage | Name | Release | Depends on | Demo at end of stage |
|---|---|---|---|---|
| 0 | Planning baseline | — | — | This document pack ✅ |
| **1** | **Application foundation** | R1 | 0, decisions D1–D2 | Branded shell, live dark map, empty module panels, CI + Pages deploy |
| 2 | Data pipeline v1 | R1 | 1, gates G1–G6 | Dated snapshot with manifest; Evidence page lists real sources |
| 3 | Food Origins + Seasonal vertical slice | R1 | 2 | Pick tomatoes, step Jan→Jul, watch partners and flows change |
| 4 | Supermarket network | R1 | 2, G7 | Clustered stores, retailer/class filters, store search, per-10k choropleth |
| 5 | Local Authority Profiles (Belfast, Manchester deep) | R1 | 3, 4, G8–G11 | Search "Belfast" → fly → full profile; compare with Manchester |
| 6 | Scenario Lab (import disruption, store closure) | R1 | 3, 5 | Spanish tomato preset; close a store and see the access change |
| 7 | Consulting Insights + PDF export | R1 | 5, 6, D3, D7 | One-click profile PDF that matches the screen |
| 8 | Hardening and Release 1 | R1 | 1–7 | Release 1 tagged and deployed; acceptance criteria evidenced |
| 9 | Release 2 | R2 | 8 | National access layers, Risk Explorer, Scenarios B/C, Ask FOODSCOPE, 3D globe |
| 10 | Release 3 | R3 | 9 | Network travel times, secure LLM assistant, AGOL publishing |

Stages 3 and 4 can run in parallel once Stage 2 is merged.

---

## 2. Verification gates

Each gate must be cleared (evidence recorded in `docs/stage-reports/`) before the stage that depends on it. Update `03-DATA-SOURCES.md` status when cleared.

| Gate | Question | How to clear | Blocks |
|---|---|---|---|
| G1 | Does HMRC `$apply=groupby/aggregate` work on `/OTS` for our filters, within limits? | Live test in pipeline; compare with paged raw aggregation for one month | 2 |
| G2 | What is the API `Value` basis and HMRC revision policy? | HMRC methodology pages | 2 (labels) |
| G3 | Are commodity baskets aligned with Defra trade codes? | Compare spec §6.1 with Defra trade codes ODS (S05) and `/Commodity` | 2 |
| G4 | HMRC `CountryCodeAlpha` ↔ Natural Earth crosswalk complete? | Generate crosswalk; list unmapped codes | 2 |
| G5 | ONS/OS attribution wording for boundaries | ONS metadata | 2 |
| G6 | UKFSR 2024 ODS table IDs for Short Straits figures | Download Theme 3 ODS | 2 (context file) |
| G7 | GEOLYTIX current schema, store-class values, **NI coverage**, `bng_*` for NI | Download latest file; inspect `size_band`/`fascia` values; count `BT` postcodes | Clear in Stage 2; blocks 4 |
| G8 | **PPFI v2.1 NI coverage** and column names | Download HASP LSOA CSV | Clear in Stage 2 (early warning for Belfast); blocks 5 |
| G9 | NISRA DZ2021 CRS, licence, centroids; DZ2021↔SOA2011 lookup | NISRA downloads | 5 |
| G10 | Census car availability tables (E&W TS045?; NI table ID) | Nomis / NISRA | 5 |
| G11 | ONS LSOA 2021 boundaries + population-weighted centroids service | ONS Open Geography Portal | 5 |
| G12 | SIMD 2026 released? Scotland DZ2022 and car availability | Scottish Government / NRS | 9 |
| G13 | DfT PORT tables with port-level Ro-Ro; HMRC port allocation for EU Ro-Ro | Inspect ZIP; HMRC notes | 9 (Scenario B) |

---

## 3. Stage 1 — Application foundation (start here)

**Goal**: a deployable, tested, beautifully styled application shell with a working ArcGIS map and all the plumbing later stages need — but **no data features yet**.

### 3.1 Prerequisites

- D1 ✅: repository `johnchewitt/FoodScopeUK` → Vite `base` `/FoodScopeUK/`, site `https://johnchewitt.github.io/FoodScopeUK/`.
- D2: ArcGIS API key created by John (see `docs/setup/arcgis-api-key.md`) and saved as Actions secret `ARCGIS_API_KEY`. If not yet available, Stage 1 proceeds with a key-free fallback (plain navy background + generalised country/LAD outlines from a bundled sample) and the basemap appears on the next deploy after the secret is added — no code change.
- Repository Settings → Pages → Source set to "GitHub Actions".

### 3.2 Deliverables

1. **Project scaffold**: Vite 8 + React 19 + TypeScript 6 (`strict`, `noUncheckedIndexedAccess`), ESLint flat config, Prettier, path aliases (`@/…`), `.nvmrc` (current Node LTS), `.editorconfig`, `.gitignore`.
2. **Pinned dependencies** per architecture §2 (exact versions in lockfile; Calcite pinned to 5.1.x).
3. **ArcGIS setup**: `src/vite-env.d.ts` with `/// <reference types="@arcgis/map-components/types/react" />`; component imports per module; core CSS for the dark theme; Calcite dark mode; asset path configuration verified in production build (fonts, workers, wasm).
4. **Design system**: `styles/tokens.css` (spec §7.1), `calcite-theme.css` (Calcite CSS variables mapped to tokens), `glass.css`, typography with self-hosted IBM Plex Sans/Mono, focus styles, reduced-motion media query and in-app motion toggle.
5. **App shell**: `TopBar` (brand, module nav, utilities incl. data-freshness placeholder fed by `manifest.json`), collapsible `Sidebar`, `InsightsPanel`, `TimelineBar` (static month stepper UI, no data), floating `KpiCard` slots, responsive behaviour at the four breakpoints (spec §4.1). Modules show "In development" empty states.
6. **MapHost + MapController skeleton**: one `<arcgis-map>` with dark basemap (or fallback), `onarcgisViewReadyChange` → controller; layer registry with a no-op test layer; `goTo` helpers (UK extent, world extent) respecting motion settings; map status tray.
7. **State and URL**: Zustand store with `ui`, `selection`, `filters`, `scenario` slices; query-string sync (ADR-13) with tests.
8. **Data plumbing (empty)**: `config.json` loader + schema validation; `manifest.json` loader; `useDataset` with TanStack Query and ajv; `StaticSnapshotAdapter` and `ArcGISFeatureLayerAdapter` interfaces; sample manifest with one tiny real dataset (e.g. LAD boundaries for Belfast and Manchester only, from S14) to prove the path.
9. **Provenance primitives**: `Indicator<T>` type, `<Metric>`, `<ProvenanceBadge>`, `<SourceBadge>` popover, data-state components (`Skeleton`, `EmptyState`, `ErrorState`, `StaleBanner`, partial-failure notice) with stories/tests.
10. **Evidence & Limitations page** shell reading the catalogue from the manifest.
11. **Pipeline skeleton**: `pipeline/` uv project, `foodscope_pipeline` package with `publish.py` writing a valid `manifest.json`, accounting helper, pytest, one real ingest (LAD May 2025 BGC for the two demo LADs) to exercise the end-to-end path.
12. **Schemas**: `schemas/manifest.schema.json`, `schemas/config.schema.json`, `schemas/indicator.schema.json`; TS generation script.
13. **Testing**: Vitest configured (node + jsdom projects); Playwright configured with Chromium software WebGL; smoke tests: app loads, map ready event fires, module switch updates URL, reduced-motion respected; axe check on shell.
14. **CI/CD**: `ci.yml`, `deploy-pages.yml` with `BASE_PATH`; post-deploy smoke test.
15. **Docs**: `README.md` (setup, scripts, config, API key handling, deploy); `docs/adr/0001…0013` from architecture §3; `docs/stage-reports/stage-1.md`.

### 3.3 Exit criteria

- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run e2e` all pass locally and in CI.
- [ ] Deployed Pages URL loads the shell and the map at the correct base path; deep link `?m=profiles&lad=N09000003` restores state.
- [ ] Map ≥ 60 % visible at 1920×1080 with panels open; layouts checked at 1366, 1024, 390 widths (screenshots in stage report).
- [ ] Rendered-panel contrast check passes (AA); keyboard navigation through top bar, sidebar and timeline works.
- [ ] No ArcGIS widget imports; no `@arcgis/map-components-react`; no `__esri` types (lint rule or CI grep).
- [ ] No secrets in repo (CI secret scan); `config.json` validated by schema.
- [ ] Stage report lists what was verified and anything not verified.

### 3.4 Risks

| Risk | Mitigation |
|---|---|
| ArcGIS assets/workers not resolving under the Pages base path | Verify in `vite preview` with base set; Playwright test against preview build |
| WebGL unavailable in CI | Chromium `--use-angle=swiftshader`/`--enable-unsafe-swiftshader`; fall back to marking map-render tests as required only on a WebGL-capable runner |
| Calcite theming fights glass styling | Theme through Calcite CSS variables only; avoid shadow-DOM overrides |
| API key delay | Fallback map background; key added via `config.json` without code change |

---

## 4. Stage 2 — Data pipeline v1

**Goal**: real, validated, versioned data for Release 1 features.

Deliverables: HMRC ingest for 16 baskets, Jan 2019 → latest (gates G1–G4); countries crosswalk + Natural Earth geometries; LAD boundaries (national, generalised) + LAD population; GEOLYTIX snapshot (raw, validated, trimmed) — class mapping waits for G7 but ingest can proceed; Defra context file (UKFSR, pocketbook CSVs); `catalogue.json` generated from this inventory; accounting reports; `refresh-data.yml` opening PRs; reconciliation tests (pipeline total vs direct API query for at least three commodity-months).

Exit: snapshot validates against schemas in both pytest and Vitest; Evidence page shows real catalogue entries; reconciliation tests pass; rerun produces byte-identical output from cached raw data.

## 5. Stage 3 — Food Origins + Seasonal vertical slice

Deliverables: commodity selector (FO-01); partner choropleth (FO-02); flows with width scaling and Stage-3 animation spike (CIM `MoveAlongLine` beta vs pulse markers vs static) with reduced-motion off-switch (FO-03/04); KPI cards and partner table (FO-05/06); period controls (FO-07); supplier-change card (FO-08); caveat chip (FO-10); series-break markers (FO-11); timeline with play (SS-01..03); heatmap and year comparison with fixed breaks (SS-04..06).

Exit: tomatoes Jan vs Jul reproduces fixture-expected partner shares; all metrics show provenance; E2E for commodity and month changes; animation spike decision recorded as ADR.

## 6. Stage 4 — Supermarket network

Deliverables: stores layer via adapter (SM-01); clustering and symbols (SM-02/04); retailer and class filters (SM-03); search and detail cards (SM-05); LAD counts and per-10k choropleth with fixed breaks (SM-06); proximity tool (SM-07); density table (SM-08); comparison chart (SM-09); provision caveat (SM-10). Hosted-layer config tested against a public sample FeatureLayer with the same schema (or a mock server).

Exit: filter counts match pipeline counts; LAD totals reconciled and differences from ONS S12 explained in the stage report.

## 7. Stage 5 — Local Authority Profiles

Deliverables: LAD search/selection and fly-to (LP-01); basic profiles for all LADs (A, B, D); deep profiles for Belfast and Manchester (C, E) with small-area layers, straight-line distances from representative points, deprivation within nation, car availability, PPFI (subject to G8); comparison view with comparability warnings (LP-07).

Exit: both deep profiles render every section with provenance; a hand-checked sample of five small areas per LAD matches source values; nation comparability banner appears in Belfast–Manchester comparison.

## 8. Stage 6 — Scenario Lab

Deliverables: scenario framework (SC-01..05); SC-A/E import disruption with Spanish tomato preset; SC-D store closure. Formula tests from spec §6.5; assumptions panel; baseline vs scenario views; URL-reproducible runs.

Exit: unit tests cover recovery profile edges; E2E runs both scenarios; wording audit shows no "shortage" language.

## 9. Stage 7 — Consulting Insights + PDF export

Deliverables: workstream content (CI-01, approved copy D7); rule engine with "why am I seeing this?" (CI-02/03); opportunity statements for authority, commodity and scenario contexts; PDF export (EX-01..05) with checksum; CSV export.

Exit: PDF values equal on-screen values (automated comparison of model vs extracted PDF text for key figures); rule tests pass; P14 copy review signed off.

## 10. Stage 8 — Hardening and Release 1

Accessibility audit (axe + manual keyboard/screen reader pass); responsive review; performance budgets enforced; error-path E2E (blocked data, malformed snapshot, map layer failure); README complete (setup, data prep, refresh, licensing, assumptions, limitations — brief §19.15); acceptance criteria evidence table (spec §9) in `docs/stage-reports/release-1.md`; tag `v1.0.0`.

## 11. Stage 9 — Release 2 (outline)

National Food Access layers (E&W LSOA, Scotland DZ2022, NI DZ2021) with per-nation tiling/lazy loading; Risk Explorer with weights and sensitivity (RK-01..06); Scenarios B (Short Straits; G13) and C (wheat); domestic production overlays (SS-07); Ask FOODSCOPE deterministic engine (AF-01..03); 3D globe for Food Origins; deep profiles for all LADs; authority-type benchmarking.

## 12. Stage 10 — Release 3 (outline)

Pre-computed network travel times (OSM network, documented speeds, snapping report, validation against an external router per the accessibility standard); secure serverless backend for LLM assistant (grounded tool calls only) and optional live trade proxy; ArcGIS Online publishing scripts (CI secrets, idempotent overwrite, item metadata with licences).

---

## 13. Working with Claude Code, stage by stage

Use this prompt pattern at the start of each stage:

> Read `CLAUDE.md`, then `docs/04-ROADMAP.md` §<stage>. Check the gates for this stage are cleared in `docs/03-DATA-SOURCES.md`. Propose a short plan (files to create/change, tests to add), then implement Stage <n> only. Finish with `docs/stage-reports/stage-<n>.md`: what was built, commands run and their results, what could not be verified and why, and open questions.

Rules of engagement:

- One stage per branch (`stage/<n>-<slug>`), merged by pull request after CI passes.
- Commits follow Conventional Commits and reference requirement IDs, e.g. `feat(origins): partner choropleth (FO-02)`.
- If a stage reveals that a requirement is unrealistic or a source is unusable, stop, record it in the stage report and propose a spec change rather than improvising data.

---

## 14. Risk register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | PPFI v2 lacks NI → Belfast profile weaker | Medium | High (Belfast is a flagship demo) | Gate G8 early; NI-native indicator set; transparent v1 reference | Data |
| R2 | GEOLYTIX schema/coverage differs from v31 assumptions | Medium | Medium | Gate G7; adapter maps fields via config | Data |
| R3 | HMRC aggregation queries slow or rejected | Low–Medium | Medium | Paged raw fallback; cache raw responses; throttle | Pipeline |
| R4 | Netherlands dispatch effect misread by audiences | High | High (credibility) | Persistent caveat chip, Evidence page, S02 context, briefing notes | Product |
| R5 | ArcGIS 5.2/6.0 changes during build | Medium | Medium | Pin `~5.1.27`; upgrade only via ADR after Release 1 | Front end |
| R6 | Visual ambition crowds out correctness | Medium | High | Integrity principles; stage exit criteria require reconciliation tests before styling polish | All |
| R7 | WebGL-dependent tests flaky in CI | Medium | Low | Software rendering; retry policy; separate required/optional jobs | QA |
| R8 | API key misuse/quota exhaustion on public demo | Low | Medium | Referrer restrictions; basemap-only scope; usage alerts | Ops |
| R9 | Brand/credential claims in consulting content | Low | High | P14; ConsultingWhere copy approval (D7) | Product |
| R10 | Scope creep from Release 2 ideas | High | Medium | Release table in spec §3; new ideas go to backlog, not current stage | Product |

---

## 15. Decision log

| Date | Decision | Ref |
|---|---|---|
| 2026-10-23 | Static-first architecture with Python pipeline | ADR-01, ADR-07 |
| 2026-10-23 | TypeScript pinned to 6.0.x (lint toolchain does not yet support 7.x) | Architecture §2 |
| 2026-10-23 | Calcite pinned to 5.1.x to align with SDK 5.1 | Architecture §2 |
| 2026-10-23 | Scenarios A and E merged into one generalised country × commodity disruption scenario | Spec §5.7 |
| 2026-10-23 | Ask FOODSCOPE moved to Release 2 to protect Release 1 quality | Spec §3 |
| 2026-10-23 | "Lamb" labelled as sheep and goat meat (HS limitation) | Spec §6.1 |
| 2026-10-23 | Repository `johnchewitt/FoodScopeUK`; base path `/FoodScopeUK/` (D1) | Architecture §8 |
| 2026-10-23 | ArcGIS API key injected at build from Actions secret, never committed | ADR-11 |
