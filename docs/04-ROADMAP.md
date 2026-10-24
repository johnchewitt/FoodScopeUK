# FOODSCOPE UK — Development Roadmap

| | |
|---|---|
| **Document** | 04 — Staged delivery plan |
| **Version** | 0.4 — 24 October 2026 (pre-Stage 4 data step: council boundaries, stores and population built; gates G5 and G7 cleared; D5 agreed) |
| **Approach** | Small, demonstrable stages. Each stage ends with working software, passing checks and a short stage report. No stage starts while its verification gates are open. |

---

## 1. Stage overview

| Stage | Name | Release | Depends on | Demo at end of stage |
|---|---|---|---|---|
| 0 | Planning baseline | — | — | This document pack ✅ |
| **1** | **Application foundation** ✅ merged (PR #1) and deployed | R1 | 0, decisions D1–D2 | Branded shell, live dark map, empty module panels, CI + Pages deploy |
| **2** | **Food Origins explorer + HMRC trade pipeline** ✅ merged (PR #3) and deployed | R1 | 1, gates G1, G2, G4 | Pick tomatoes, step Jan→Jul, watch partners, connections, cards and charts change — real HMRC data for five commodities |
| **3** | **Seasonal Supply Explorer** ✅ merged (PR #5) and deployed | R1 | 2 | Play tomatoes January → December 2025; compare January with July; partner-by-month heatmap; year-on-year change — the same real HMRC data as Food Origins |
| 4 | Supermarket network | R1 | 3, G7 ✅, and the LAD/GEOLYTIX data built in the pre-Stage 4 data step (§5.3) | Clustered stores, retailer/class filters, store search, per-10k choropleth; basemap choice: dark grey, light grey, imagery (SH-08) |
| 5 | Local Authority Profiles (Belfast, Manchester deep) | R1 | 3, 4, G8–G11 | Search "Belfast" → fly → full profile; compare with Manchester |
| 6 | Scenario Lab (import disruption, store closure) | R1 | 3, 5 | Spanish tomato preset; close a store and see the access change |
| 7 | Consulting Insights + PDF export | R1 | 5, 6, D3, D7 | One-click profile PDF that matches the screen |
| 8 | Hardening and Release 1 | R1 | 1–7 | Release 1 tagged and deployed; acceptance criteria evidenced |
| 9 | Release 2 | R2 | 8 | National access layers, Risk Explorer, Scenarios B/C, Ask FOODSCOPE, 3D globe |
| 10 | Release 3 | R3 | 9 | Network travel times, secure LLM assistant, AGOL publishing |

The LAD, population and GEOLYTIX items moved out of Stage 3 were built in the pre-Stage 4 data step (24 Oct 2026, `docs/stage-reports/pre-stage-4-data.md`); the other items in §5.3 are still to be scheduled.

**Re-scope (23 Oct 2026).** John defined Stage 2 as "the global food origins explorer" with real HMRC data for tomatoes, strawberries, bananas, potatoes and wheat. Stage 2 therefore combines the HMRC part of the former "Data pipeline v1" with the core of the former Food Origins slice. Everything else from those two stages moved to Stage 3 (table above; §5).

**Re-scope (23 Oct 2026, Stage 3).** John defined Stage 3 as "the Seasonal Supply Explorer" using "the existing real HMRC monthly import dataset and commodity model". Stage 3 is therefore Seasonal Supply only, for the five Stage 2 baskets. The data-pipeline items that had moved to Stage 3 (other baskets, LAD, GEOLYTIX, Defra context, FO-08/FO-09, scheduled refresh) are listed in §5.3 for John to schedule.

---

## 2. Verification gates

Each gate must be cleared (evidence recorded in `docs/stage-reports/`) before the stage that depends on it. Update `03-DATA-SOURCES.md` status when cleared.

| Gate | Question | How to clear | Blocks |
|---|---|---|---|
| G1 ✅ | Does HMRC `$apply=groupby/aggregate` work on `/OTS` for our filters, within limits? | Live test in pipeline; compare with paged raw aggregation for one month | 2 — **cleared 23 Oct 2026**: exact match for five basket-months |
| G2 ✅ | What is the API `Value` basis and HMRC revision policy? | HMRC methodology pages | 2 — **cleared**: CIF statistical value (Intrastat invoice value); provisional for up to 18 months |
| G3 🟡 | Are commodity baskets aligned with Defra trade codes? | Compare spec §6.1 with Defra trade codes ODS (S05) and `/Commodity` | 2 — **partly**: five baskets verified against `/Commodity`; Defra ODS comparison moved out of Stage 3, to schedule (§5.3) |
| G4 ✅ | HMRC `CountryCodeAlpha` ↔ Natural Earth crosswalk complete? | Generate crosswalk; list unmapped codes | 2 — **cleared**: all partners crosswalked; Gibraltar has no geometry at 1:110m/1:50m |
| G5 ✅ | ONS/OS attribution wording for boundaries | ONS metadata | LAD ingest (§5.3) — **cleared 24 Oct 2026**: "Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data © Crown copyright and database right 2025" in every boundary provenance record |
| G6 | UKFSR 2024 ODS table IDs for Short Straits figures | Download Theme 3 ODS | Defra context file (§5.3) |
| G7 ✅ | GEOLYTIX current schema, store-class values, **NI coverage**, `bng_*` for NI | Download latest file; inspect `size_band`/`fascia` values; count `BT` postcodes | 4 — **cleared 24 Oct 2026** on v46: the same 17 columns as v31; 4 size bands, 53 fascias; 627 `BT` postcodes (725 stores in NI councils); in NI `bng_*` are BNG values derived from WGS84, not Irish Grid |
| G8 | **PPFI v2.1 NI coverage** and column names | Download HASP LSOA CSV | Clear before Stage 5 (early warning for Belfast); blocks 5 |
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

Status on 23 October 2026 (evidence in `docs/stage-reports/stage-1.md`):

- [x] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run e2e` pass locally and in GitHub Actions CI (PR #1).
- [x] Deployed Pages URL loads the shell and map at the correct base path (merged 23 Oct 2026; post-deploy smoke test passes after the basemap key fix, PR #2). Deep link `?m=profiles&mo=7&lad=N09000003` restores state ✅ (E2E).
- [x] ≥ 60 % of viewport width unobstructed between side panels at 1920×1080; layouts checked at 1920, 1366, 1024, 820, 390 (screenshots in the stage report).
- [x] Automated accessibility check (axe) has no serious/critical violations; keyboard operation of navigation, panels and timeline tested. *Contrast of glass panels over the live Esri basemap not yet checked (no key in the sandbox).*
- [x] No ArcGIS widget imports; no `@arcgis/map-components-react`; no `__esri` types (ESLint rule + `check:banned` in CI).
- [x] No secrets in repo; `config.json` validated by schema (unknown keys such as `apiKey` are rejected). *A dedicated secret-scanning step is not yet in CI (backlog).*
- [x] Stage report lists what was verified and what was not.

### 3.4 Risks

| Risk | Mitigation |
|---|---|
| ArcGIS assets/workers not resolving under the Pages base path | Verify in `vite preview` with base set; Playwright test against preview build |
| WebGL unavailable in CI | Chromium `--use-angle=swiftshader`/`--enable-unsafe-swiftshader`; fall back to marking map-render tests as required only on a WebGL-capable runner |
| Calcite theming fights glass styling | Theme through Calcite CSS variables only; avoid shadow-DOM overrides |
| API key delay | Fallback map background; key added via `config.json` without code change |

---

## 4. Stage 2 — Food Origins explorer + HMRC trade pipeline

**Goal** (John, 23 Oct 2026): the global food origins explorer — verified HMRC API and commodity codes for tomatoes, strawberries, bananas, potatoes and wheat; genuine monthly recorded import volumes and values by partner and month; a reproducible ingestion and caching process; commodity selector, interactive country highlighting, weighted animated connections to the UK, KPI cards and interactive charts, all synchronised; trading partner distinguished from agricultural origin; unavailable observations labelled. Evidence: `docs/stage-reports/stage-2.md`.

### 4.1 Deliverables

1. **HMRC ingestion** (`pipeline/foodscope_pipeline/sources/hmrc_ots.py`): query builders, ≤ 50 requests/minute, retries, `@odata.nextLink` paging, raw responses cached byte-for-byte with URL, timestamp and SHA-256 (`pipeline/raw/hmrc/<snapshot>/`).
2. **Offline build** (`trade.py`): month × partner series per basket, HMRC ↔ Natural Earth crosswalk, suppressed and non-country trade kept apart, nil months, provisional window, row accounting, reconciliation against raw rows (build fails on mismatch); schemas `trade-snapshot`, `trade-index`; manifest lists the snapshot.
3. **`refresh-trade-data.yml`**: runs the ingest on GitHub Actions (the sandbox cannot reach HMRC; the browser must not), commits to a `data-refresh/**` branch; manual runs open a PR.
4. **Reference geometry**: Natural Earth v5.1.2 outlines with ISO codes and 1:50m label points.
5. **Analysis** (`src/analysis/trade.ts`, `arcs.ts`): periods, aggregation, shares, HHI, effective partners, CR3, YoY, top-N, share classes, flow widths, series breaks, symbolic arcs, particle motion.
6. **Explorer UI**: commodity selector (FO-01), partner shading (FO-02), weighted connections (FO-03) with moving markers (FO-04), KPI cards (FO-05), partner table (FO-06), period controls and timeline (FO-07), caveat chip (FO-10), series-break markers (FO-11), share and trend charts, selected-partner card, legend, tooltip, Evidence caveats.

### 4.2 Exit criteria

- [x] Snapshot validates against schemas in pytest and Vitest; Evidence page shows the real datasets and caveats.
- [x] Reconciliation tests pass (five basket-months, exact); rerun from cached raw data is byte-identical.
- [x] Tomatoes Jan vs Jul reproduces fixture-expected partner shares (Morocco 42.5 % → Netherlands 63.8 % of net mass, 2025).
- [x] All metrics show provenance; E2E for commodity, month, partner and measure changes and for map ↔ table ↔ chart synchronisation.
- [x] Animation decision recorded (ADR-0015).
- [x] Deployed site shows the explorer over the Esri basemap, with moving markers on a real GPU and no console errors (merged 23 Oct 2026; deploy run 39987833601; live check in `docs/stage-reports/stage-2.md`).
- [ ] Defra trade-code comparison (G3) — moved to Stage 3, then out of it to be scheduled (§5.3).

### 4.3 Moved to Stage 3 (later moved out again, §5.3)

FO-08 supplier pattern changes; FO-09 UK production context; the 11 remaining baskets; commodity search for 16 items; LAD boundaries and population; GEOLYTIX snapshot; Defra context file; catalogue generated from this inventory; scheduled refresh PRs.

## 5. Stage 3 — Seasonal Supply Explorer

**Goal** (John, 23 Oct 2026): the Seasonal Supply Explorer on the existing HMRC monthly import data and commodity model:
- a January–December timeline with selectable year, play/pause, playback speed and month comparison;
- moving the slider updates country symbology, import-flow thickness, quantities, KPIs and charts from genuine records;
- a seasonal supplier-country heatmap, monthly import trend and year-on-year comparison;
- smooth, performance-conscious transitions with statistically accurate map values;
- explicit handling of missing months, partial data, commodity-code changes and unverified seasonal domestic production;
- existing design and functionality maintained.

Evidence: `docs/stage-reports/stage-3.md`.

### 5.1 Deliverables

1. **Code history in the trade snapshot (pipeline, offline):** for each CN8 code, the first and last recorded month, the number of months recorded, the calendar months present and net mass by calendar month, plus basket-level `codeChanges`. Derived from the committed raw HMRC responses; schema fields are additive and optional; Stage 2 figures unchanged (fingerprint tests).
2. **Analysis** (`src/analysis/seasonal.ts`, `transition.ts`):
   - month states (published, nil, not yet published, before the snapshot) and year matrices;
   - monthly shares and HHI, year-on-year by month and like-for-like totals;
   - seasonality (peak and lowest month share, coefficient of variation; complete years only);
   - fixed heatmap classes, the fixed width scale, code changes and seasonal codes, comparability across series breaks;
   - width transitions.
3. **View model** (`src/features/seasonal/model.ts`): the selected month built with the Food Origins model; KPIs as `Indicator`s, heatmap rows, trend, year-on-year, HHI, month comparison and notices.
4. **UI:**
   - timeline: slider with real monthly bars, play/pause, ½×/1×/2× speed, year stepping, comparison-month marker, keyboard and pointer;
   - controls: commodity, year, comparison year and month, the SS-08 example, measure, supply view (UK production and combined shown as not available), connections;
   - four KPI cards;
   - insights: month comparison, selected partner by month, heatmap (share / amount / change), monthly trend with seasonality, year-on-year, monthly HHI, partner table, data handling and the commodity-code list;
   - map: legend with the fixed scale, tooltip, banner for months without figures.
5. **Map:** trade layers shown for Food Origins and Seasonal Supply; connection widths ease ≤ 320 ms between months (instant under reduced motion), ending exactly at the model values (ADR-0017).
6. **Shell:** Seasonal is lazy-loaded; taller timeline (88 px) in the layout metrics; Evidence caveats and Help shortcuts updated.

### 5.2 Exit criteria

- [x] Snapshot extended without changing Stage 2 figures: five fingerprint tests against the files merged in PR #3, plus the byte-identical offline rebuild.
- [x] Heatmap values reconcile with the trade snapshot: view-model tests on real data (e.g. Morocco, Jan 2025: 14,056.585 t, 42.5 %, −2.27 pp vs Jan 2024), with expected values computed independently in Python.
- [x] Slider, keyboard and playback update map symbology, connection widths, KPIs and charts to fixture-expected figures (E2E, read from the ArcGIS view).
- [x] Play animation respects reduced motion: no width transition and no moving markers (E2E); playback never starts by itself and stops at any user change.
- [x] Missing months, partial years, comparison across series breaks, commodity-code changes and UK production are each stated on screen (unit, component and E2E tests).
- [x] Fixed classes for every year; colours validated for lightness order, contrast and colour-vision separation (stage report).
- [x] Mobile (390 × 844): no horizontal scroll, timeline and bottom sheets usable (E2E with touch).
- [ ] Transitions and playback checked on a real GPU (deployed site) — after merge.

### 5.3 Moved out of Stage 3 (to schedule with John)

- Remaining 11 baskets, after the Defra trade-code comparison (gate G3, B10), and commodity search (B11).
- ~~LAD boundaries (national, generalised) and LAD population (G5); GEOLYTIX snapshot (G7). Stage 4 needs both.~~ **Done** in the pre-Stage 4 data step (24 Oct 2026): `foodscope-pipeline build-local` → `public/data/snapshots/2026-10-24/local/` (ADR-0020), published in the app's data index in Stage 4 (ADR-0021).
- Defra context file (UKFSR, pocketbook CSVs; G6); `catalogue.json` generated from the inventory.
- FO-08 supplier pattern changes; FO-09 UK production context (needs S09/S10 verified).
- Scheduled `refresh-trade-data` runs opening PRs (B14).
- Domestic production overlays (SS-07) remain Release 2, and only for commodities with a verified monthly Defra series (S06–S08: meat, poultry, milk).

## 6. Stage 4 — Supermarket network

Deliverables: stores layer via adapter (SM-01); clustering and symbols (SM-02/04); retailer and class filters (SM-03); search and detail cards (SM-05); LAD counts and per-10k choropleth with fixed breaks (SM-06); proximity tool (SM-07); density table (SM-08); comparison chart (SM-09); provision caveat (SM-10). Hosted-layer config tested against a public sample FeatureLayer with the same schema (or a mock server).

Exit: filter counts match pipeline counts; LAD totals reconciled and differences from ONS S12 explained in the stage report.

Inputs ready (pre-Stage 4 data step, ADR-0020): `public/data/snapshots/2026-10-24/local/` holds the display boundaries, the classified stores and per-council population, land area and store counts, each with a provenance record; a first all-format comparison with S12 is in `pipeline/reports/`. They enter `public/data/manifest.json` with each data family taken from its own newest snapshot (John's decision, ADR-0021).

### 6.1 Curated basemap switcher (SH-08; added at John's request, 23 Oct 2026)

Why in Stage 4: at world and continent scale the shaded countries carry the information, and the current colours are checked against dark grey only. A basemap choice pays off when the map reaches street level (stores, catchments) and for presentations and print (PDF export in Stage 7).

Deliverables:
- **Styles:**
  - dark grey: the default, unchanged;
  - light grey;
  - imagery with labels, offered only at local zooms. The zoom threshold is set in the stage plan; the control explains why imagery is unavailable at world scale.
- **Verify the services first:** check the Basemap styles service style IDs and attribution on the live site (S25) and record them in `docs/03-DATA-SOURCES.md`. Do not assume IDs.
- **Colour sets per style:**
  - share ramp, connection lines and casing, store symbols and choropleths, as tokens in `tokens.css` and `src/styles/palette.ts`;
  - checked with the dataviz validator against each style's land colour, sampled on the live site;
  - legend swatches follow the active set (parity test as in ADR-0019);
  - glass panels and text contrast re-checked over light grey (backlog B3).
- **Control and state:**
  - a bespoke basemap control in the map controls, keyboard operable and labelled;
  - the choice in the store and the URL (`bm`), restored from deep links and kept across module changes;
  - the map controller swaps `map.basemap` (ADR-03), keeping the `apiKeys.basemapStyles` registration (ADR-0011) and the reference-outline fallback when a style fails;
  - hidden when no API key is configured.
- **ADR:** one ADR for per-style colour sets and the imagery scale rule.

Exit criteria:
- **Colour checks:** validator runs for every style are recorded in the stage report.
- **E2E tests:**
  - switching style updates the basemap, legend and data colours;
  - deep link `bm=light` restores the style;
  - imagery is not offered at world scale;
  - no console errors;
  - axe passes in both dark and light grey.
- **Live checks:** each style seen on the live site with a real GPU. Attribution changes with the style and is never hidden.
- **Usage note:** basemap request usage under the key is recorded in the stage report, since each style counts towards it (risk R8).

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
| 2026-10-23 | Module navigation moved to a left rail; collapsible controls panel beside it (John's Stage 1 brief) | Spec SH-02 |
| 2026-10-23 | Breakpoints: tablet 768–1279 (overlay panels), laptop 1280–1439; desktop panels 312/340 px to meet the 60 % map-width target | Spec §4.1 |
| 2026-10-23 | ArcGIS assets from the Esri CDN in production; local copy for tests/offline | ADR-14 |
| 2026-10-23 | Offline reference map: Natural Earth 1:110m outlines (S24) when no API key is configured | ADR-11, S24 |
| 2026-10-23 | Basemap key registered as `apiKeys.basemapStyles`; visitors never prompted to sign in | ADR-11 (amended), PR #2 |
| 2026-10-23 | Stage 2 re-scoped to the Food Origins explorer for five commodities (John's instruction); the rest of "Data pipeline v1" moves to Stage 3 | §1, §4 |
| 2026-10-23 | HMRC ingest runs on GitHub Actions; raw responses committed for offline rebuilds | ADR-0016 |
| 2026-10-23 | Connections are symbolic curves in map space; moving markers on a canvas overlay (SDK CIM animations did not render) | ADR-0005, ADR-0015 |
| 2026-10-23 | Natural Earth v5.1.2 replaces world-atlas 4.1.0 (ISO alpha-2 codes, label points) | S24 |
| 2026-10-23 | Stage 3 re-scoped to the Seasonal Supply Explorer for the five Stage 2 baskets (John's instruction); data-pipeline items listed for scheduling | §1, §5.3 |
| 2026-10-23 | Seasonal map: only connection widths ease between months (≤ 320 ms); fixed width scale and fixed heatmap classes across months and years; missing months never estimated | ADR-0017 |
| 2026-10-23 | Heatmap change view uses five classes (two per side): three per side failed the colour-vision check on the dark panel | ADR-0017, stage 3 report |
| 2026-10-23 | Commodity-code history added to the trade snapshot (additive, offline from the committed raw cache) | S01, §5.1 |
| 2026-10-23 | UK seasonal production not shown for the five baskets: no verified monthly series (S06–S08 cover meat and milk; S09/S10 annual, unverified) | SS-07, S05–S10 |
| 2026-10-23 | Post-Stage 3 review (John's request): trade views framed on the data; one opaque share ramp for map, legend and heatmap; series-break and current-price cautions in Food Origins; data before the map on first load; KPI cards never hidden | ADR-0018, ADR-0019, `docs/reviews/2026-10-23-review.md` |
| 2026-10-23 | Curated basemap switcher (dark grey, light grey, imagery at local scales) scheduled for Stage 4 (John's decision); each style needs its own checked colour set; no switcher for the trade views before then | SH-08, §6.1 |
| 2026-10-24 | D5 store classes (John's decision): convenience under 280 m²; supermarket 280 m² and over in three bands; forecourt, motorway, travel and hospital stores flagged as their own formats; default view supermarkets in the standard format; wholesale and non-food left out (decided later the same day) | Spec §11 D5, S11 |
| 2026-10-24 | Population: ONS mid-2025 estimates for all four nations, fetched by the pipeline on GitHub Actions (John's decision) | S18 |
| 2026-10-24 | Council boundaries: BGC clipped edition for display, BFE full-extent edition for store assignment; local data built offline and published in Stage 4 | ADR-0020, S14 |
| 2026-10-24 | John's decisions: leave out wholesale and mainly non-food stores; show the 125 Crown Dependency stores on the map without a council; each kind of data keeps its own newest date, so trade and stores refresh on their own schedules | ADR-0020, Stage 4 |
