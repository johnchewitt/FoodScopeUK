# FOODSCOPE UK — Development Roadmap

| | |
|---|---|
| **Document** | 04 — Staged delivery plan |
| **Version** | 0.8 — 26 October 2026 (the sixteen Food Origins baskets: data step on `data/trade-16-baskets`, gate G3 cleared, §5.3 item done. Earlier the same day, 0.7: Stage 6 merged to main through PR #17 and deployed; Northern Ireland road corridors from OpenStreetMap, S38, gate G16 cleared. Earlier, 0.6 — 25 October 2026: Stage 6 Risk Explorer built on `stage/6-risk-explorer`, awaiting review; earlier the same day, 0.5: Stages renumbered for John's Stage 6 brief: 6 Risk Explorer, 7 Scenario Lab, 8 Consulting Insights, 9 Hardening and Release 1; Stage 6 data step built, gates G6 and G14–G18 recorded) |
| **Approach** | Small, demonstrable stages. Each stage ends with working software, passing checks and a short stage report. No stage starts while its verification gates are open. |

---

## 1. Stage overview

| Stage | Name | Release | Depends on | Demo at end of stage |
|---|---|---|---|---|
| 0 | Planning baseline | — | — | This document pack ✅ |
| **1** | **Application foundation** ✅ merged (PR #1) and deployed | R1 | 0, decisions D1–D2 | Branded shell, live dark map, empty module panels, CI + Pages deploy |
| **2** | **Food Origins explorer + HMRC trade pipeline** ✅ merged (PR #3) and deployed | R1 | 1, gates G1, G2, G4 | Pick tomatoes, step Jan→Jul, watch partners, connections, cards and charts change — real HMRC data for five commodities |
| **3** | **Seasonal Supply Explorer** ✅ merged (PR #5) and deployed | R1 | 2 | Play tomatoes January → December 2025; compare January with July; partner-by-month heatmap; year-on-year change — the same real HMRC data as Food Origins |
| **4** | **Supermarket network** ✅ merged (PR #9) and deployed | R1 | 3, G7 ✅, and the LAD/GEOLYTIX data built in the pre-Stage 4 data step (§5.3) | Clustered stores, retailer/class filters, store search, per-10k choropleth; basemap choice: dark grey, light grey, imagery (SH-08) |
| **5** | **Local Authority Profiles** ✅ merged (PR #14) and deployed | R1 | 3, 4, G8–G11 | Search "Belfast" → fly → full profile; compare with Manchester |
| **6** | **UK Food Resilience — Risk Explorer** (supply exposure, logistics, community access) ✅ merged (PRs #15 and #17) and deployed; live checks to do | R1 | 2, 3, 5, G6, G14–G18 | Tomatoes: concentration, partners' water stress and an estimated exposure to one supplier; ports and road corridors; councils' priority places within each nation — each with "Explain this risk" |
| 7 | Scenario Lab (import disruption, store closure; port and production shocks as far as the data allows) — data step PR #21, module on `stage/7-scenario-lab` | R1 | 3, 5, 6, G19 | Spanish tomato preset; close a supermarket anywhere in the UK and see the nearest-store change for every small area |
| 8 | Consulting Insights + PDF export | R1 | 5, 6, 7, D3, D7 | One-click profile PDF that matches the screen |
| 9 | Hardening and Release 1 | R1 | 1–8 | Release 1 tagged and deployed; acceptance criteria evidenced |
| 10 | Release 2 | R2 | 9 | National access layers, Scenarios B/C, Ask FOODSCOPE, 3D globe |
| 11 | Release 3 | R3 | 10 | Network travel times, secure LLM assistant, AGOL publishing |

**Renumbering (25 Oct 2026, John's Stage 6 brief).** The Risk Explorer, planned for Release 2, becomes Stage 6 of Release 1; the Scenario Lab, Consulting Insights and Hardening stages move to 7, 8 and 9, and Releases 2 and 3 to 10 and 11 (John's decision). Gates and references below use the new numbers.

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
| G3 ✅ | Are commodity baskets aligned with Defra trade codes? | Compare spec §6.1 with Defra trade codes ODS (S05) and `/Commodity` | 2 — **cleared 26 Oct 2026** (sixteen-basket data step): all sixteen against `/Commodity` and Defra's trade codes; one SITC division each, eight definitional differences stated (§5.3) |
| G4 ✅ | HMRC `CountryCodeAlpha` ↔ Natural Earth crosswalk complete? | Generate crosswalk; list unmapped codes | 2 — **cleared**: all partners crosswalked; Gibraltar has no geometry at 1:110m/1:50m |
| G5 ✅ | ONS/OS attribution wording for boundaries | ONS metadata | LAD ingest (§5.3) — **cleared 24 Oct 2026**: "Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data © Crown copyright and database right 2025" in every boundary provenance record |
| G6 ✅ | UKFSR 2024 ODS table IDs for Short Straits figures | Download Theme 3 ODS | 6 — **cleared 25 Oct 2026**: `FSR-theme3-241211.ods`, sheets 3_2_2a (port of entry), 3_2_2b (Short Straits by food group), 3_2_1a (SRN delay) |
| G7 ✅ | GEOLYTIX current schema, store-class values, **NI coverage**, `bng_*` for NI | Download latest file; inspect `size_band`/`fascia` values; count `BT` postcodes | 4 — **cleared 24 Oct 2026** on v46: the same 17 columns as v31; 4 size bands, 53 fascias; 627 `BT` postcodes (725 stores in NI councils); in NI `bng_*` are BNG values derived from WGS84, not Irish Grid |
| G8 ✅ | **PPFI v2.1 NI coverage** and column names | Download HASP LSOA CSV | Clear before Stage 5 (early warning for Belfast); blocks 5 — **cleared 25 Oct 2026**: NI included (890 SOAs 2011, ranked within NI; three domains without NI data); columns from the HASP data dictionary; file from John |
| G9 ✅ | NISRA DZ2021 CRS, licence, centroids; DZ2021↔SOA2011 lookup | NISRA downloads | 5 — **cleared 24 Oct 2026**: Irish Grid TM65 (EPSG:29902), OGL v3.0 (OSNI notice), population-weighted centroids published; no DZ↔SOA lookup, not needed (NIMDM shown on its own SOAs, John's decision) |
| G10 ✅ | Census car availability tables (E&W TS045?; NI table ID) | Nomis / NISRA | 5 — **cleared**: E&W TS045 (24 Oct 2026); NI table builder `HOUSEHOLD` × `DZ21` × `HH_CAR_VAN_TC5`, file from John (25 Oct 2026) |
| G11 ✅ | ONS LSOA 2021 boundaries + population-weighted centroids service | ONS Open Geography Portal | 5 — **cleared 24 Oct 2026**: `Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5`, `LSOA_PopCentroids_EW_2021_V4`, lookup `LSOA21_WD25_LAD25_EW_LU_v2` |
| G12 | SIMD 2026 released? Scotland DZ2022 and car availability | Scottish Government / NRS | 10 |
| G13 🟡 | DfT PORT tables with port-level Ro-Ro; HMRC port allocation for EU Ro-Ro | Inspect ZIP; HMRC notes | 10 (Scenario B) — **DfT part cleared 25 Oct 2026**: PORT0499 gives port-level Ro-Ro tonnage by year and region, no commodity; HMRC port allocation still open (S28) |
| G14 ✅ | Authoritative country climate/water indicator: source, licence, coverage, classes | World Bank API, FAO SDG 6.4.2 | 6 — **cleared 25 Oct 2026**: ER.H2O.FWST.ZS (FAO AQUASTAT, CC BY 4.0), 178 countries, FAO classes (S30); FAO water stress only (John) |
| G15 ✅ | DfT port tables, port codes and map locations | Fetch PORT0499/0304 and the port list; locate ports | 6 — **cleared 25 Oct 2026**: 51 current ports, 2015–2025, reconciled with PORT0304; 27 located by DfT, 24 by EMODnet on the same UN/LOCODE (S23, S36) |
| G16 ✅ | Strategic road corridors for the UK | OS Open Roads (GB); OSNI 50K transport (NI) | 6 — **GB cleared 25 Oct 2026** (S35 extract). NI: OSNI's service refused the pipeline in three runs (S34); **cleared 26 Oct 2026 with OpenStreetMap** (S38, John's file and decision), labelled community-mapped and not official |
| G17 ✅ | Priority Places for every council: geography and lookups per nation | PPFI codes vs ONS, Scottish Government and NISRA lookups | 6 — **cleared 25 Oct 2026**: Scotland is on 2011 Data Zones (S32 lookup); all 43,538 areas assigned to the 361 councils |
| G18 ✅ | Agricultural production regions: Defra regional and country tables, boundaries | Defra June survey files; ONS ITL1 | 6 — **cleared 25 Oct 2026**: 2025 wheat, cattle, sheep, pigs, poultry; regional sums checked (S31, S33) |
| G19 ✅ | Small areas for the whole UK: a population-weighted point, council and Census population for every LSOA and Data Zone | ONS centroids for every LSOA; Scottish Government Data Zone Centroids 2022; NISRA Data Zones | 7 — **cleared 26 Oct 2026**: 46,844 small areas (35,672 LSOAs, 7,392 Scottish and 3,780 NI Data Zones) in the 361 councils; populations within 0.01 % of the published national totals (Scotland: Census 2022) (S15, S17, S16, S18) |

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

- ~~Remaining 11 baskets, after the Defra trade-code comparison (gate G3, B10), and commodity search (B11).~~ **Done** in the sixteen-basket data step (26 Oct 2026, John's request; `data/trade-16-baskets`, `docs/stage-reports/data-sixteen-baskets.md`, ADR-0025): HMRC snapshot 2026-10-26, G3 cleared, grouped picker with search, Defra production context for apples, sugar, beef, sheep meat and poultry.
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

Why in Stage 4: at world and continent scale the shaded countries carry the information, and the current colours are checked against dark grey only. A basemap choice pays off when the map reaches street level (stores, catchments) and for presentations and print (PDF export in Stage 8).

Deliverables:
- **Styles:**
  - dark grey: the default, unchanged;
  - light grey;
  - imagery with labels, offered only at local zooms: zoom 12 and closer (about 1:144,000), set in the Stage 4 plan (ADR-0022); the control explains why imagery is unavailable at world scale.
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

Status on 24 October 2026 (evidence in `docs/stage-reports/stage-4.md`): merged as PR #9 and deployed. The colour checks, E2E tests and live checks are done. The live checks led to a follow-up fix of the proximity colours, the opening view and the header at tablet width. The usage note waits for John's dashboard reading.

## 7. Stage 5 — Local Authority Profiles

Deliverables: LAD search/selection and fly-to (LP-01); basic profiles for all LADs (A, B, D); deep profiles for Belfast and Manchester (C, E) with small-area layers, straight-line distances from representative points, deprivation within nation, car availability, PPFI (subject to G8); comparison view with comparability warnings (LP-07).

Added at John's request (25 Oct 2026): Northern Ireland shops easier to see. UK Food Access says what the store data covers in NI and offers the convenience layer. A supplementary layer shows the 285 NI grocers from the FSA register (S29) that GEOLYTIX misses, never counted in rates. The Belfast profile lists its stores by type and retailer.

Added at John's request (25 Oct 2026, with his Stage 5 brief): urban/rural context and Defra domestic production context, fetched first in a small data step (`data/stage-5-context`): ONS 2021 Rural Urban Classification of councils and LSOAs (S21), Defra Horticulture statistics 2025 and Agriculture in the UK 2025 chapter 7 (S09, S10), and Census 2021 car availability per council (S20, from files already cached). `build-context` writes the `context` family (`council-context.json`, `uk-production.json`), published in Stage 5. Seasonal Supply's SS-07 text is updated to say S09/S10 are verified annual sources (monthly production still not published).

Exit: both deep profiles render every section with provenance; a hand-checked sample of five small areas per LAD matches source values; nation comparability banner appears in Belfast–Manchester comparison.

Status on 25 October 2026 (evidence in `docs/stage-reports/stage-5.md`): built on `stage/5-local-authority-profiles` (ADR-0023). Every exit criterion is met in the sandbox:
- both deep profiles render every section with provenance;
- five small areas per council, the store counts and the populations match the raw sources, checked independently;
- the banner appears in the Belfast–Manchester comparison.

Not yet done: the live checks with a real GPU and basemap, after merge. LP-05 food prices, Short Straits and climate risks are not included (sources not verified). LP-07 benchmarks and FA-04 attention flags wait for Release 2.

## 8. Stage 6 — UK Food Resilience: Risk Explorer

John's Stage 6 brief (25 Oct 2026) and decisions the same day: Stage 6 is the Risk Explorer (renumbering above); fetch and verify the data first, in its own pull request; FAO water stress as the only country climate/water indicator; the Priority Places index summarised for every council.

**Data step (`data/stage-6-inputs`).** `fetch-reference --set stage6` and `fetch-open-roads` on GitHub Actions; `build-risk` writes the `risk` family: water stress by country (S30), ports (S23, S36), port of entry and Short Straits evidence (S03), road corridors (S35, GB), farming regions (S31, S33) and the Priority Places index by council (S13 with S15, S32, S19). Report: `docs/stage-reports/pre-stage-6-data.md`.

Deliverables: a "UK Food Resilience — Risk Explorer" module with three views (RK-01), each with its own map, indicators, filters and explanation:
- **International supply exposure** (RK-02): per commodity, recorded import partners, top-supplier and top-three shares, number of partners, HHI, year-on-year change, monthly concentration, an estimated exposure to one supplier's disruption, and partners' water stress (national, labelled); Defra's annual production share as national context.
- **Food logistics and infrastructure** (RK-03): major ports with DfT tonnage, UKFSR port-of-entry and Short Straits shares, strategic road corridors (Great Britain: OS Open Roads; Northern Ireland: OpenStreetMap, from 26 Oct 2026), Northern Ireland's railway lines, agricultural production regions; rail freight, distribution centres and Great Britain's railway lines stated as not available.
- **Community food access** (RK-04): councils by the share of their small areas in their nation's highest-priority deciles, per domain, ranked within nation only, with urban/rural context and links to profiles.
- KPIs, linked charts and selection, an "Explain this risk" panel separating observed evidence from interpretation; no composite across views (RK-06).

Exit: statistics reproduced independently from the raw files; HHI, shares, time filtering, aggregation, missing data, commodity codes, source dates, map selection and explanations unit-tested; E2E across the three views; Stages 1–5 unchanged.

Status on 25 October 2026 (evidence in `docs/stage-reports/stage-6.md`): built on `stage/6-risk-explorer` (ADR-0024), on top of the data step. In the sandbox, every exit criterion is met:
- the statistics shown were reproduced from the raw HMRC, World Bank, DfT and PPFI files with independent scripts;
- the listed behaviours are unit- and component-tested;
- four E2E tests cover the three views, map clicks and view switching;
- the Stage 1–5 tests pass unchanged.

RK-05 (user weights and sensitivity) is deferred to Release 2 (spec §5.6).

Status on 26 October 2026: the data step merged as PR #15. The module (PR #16) was merged into the data branch rather than main, so it reached main through PR #17 (merged and deployed on 26 Oct 2026). Northern Ireland's road corridors were then added from OpenStreetMap (S38, a data pull request). Not yet done: the live checks with a real GPU and the Esri basemap (with Stage 5's, B48).

## 9. Stage 7 — Scenario Lab

John's Stage 7 brief (26 Oct 2026, "Food Security Scenario Lab") and his decisions the same day: the supermarket-closure scenario covers **every small area of the UK**, with the data fetched and verified first in its own pull request; distances are **straight-line only** (no routed travel time in this stage).

**Data step (`data/stage-7-inputs`).** `fetch-reference --set stage7` on GitHub Actions: every LSOA population-weighted centroid (S15) and Scotland's Data Zone Centroids 2022 with Census 2022 population (S17). `build-scenario` writes the `scenario` family: for Great Britain and for Northern Ireland, every small area (point, council, Census population, England's IoD decile), every supermarket (GEOLYTIX class `supermarket`) and each area's three nearest supermarkets by straight line in the national grid. Report: `docs/stage-reports/pre-stage-7-data.md`.

Deliverables (the brief, with the spec's SC requirements): scenario framework (SC-01..05) with a typed scenario model; scenario cards, sliders, baseline vs scenario KPIs and charts, a results panel and a methodology panel for each scenario; named scenarios saved locally and in the URL, compared, reset and exported.
- **A — international supply disruption** (SC-A/E): commodity, recorded partner, baseline month and year, reduction 0–100 %, optional duration; affected volume, residual recorded imports, affected share, HHI before and after, map connections updated; a static exposure calculation with no substitution, stockpiles or demand response assumed.
- **B — supermarket closure** (SC-D): any supermarket; remaining supermarkets nearby, nearest-store distance change, small areas whose nearest supermarket changes, population affected, retailer concentration in the council; stores beyond the council boundary count; straight-line, never travel time.
- **C — domestic production shock** and **D — port disruption**: built only as far as verified, comparable data allows (Defra supply balances; DfT port tonnage without commodity routing), otherwise documented as future extensions.

Exit: exposure calculations, zero and full disruption, missing observations, closure and nearest-store recalculation, population, comparison, URL persistence and reset unit-tested; E2E runs the scenarios; Stages 1–6 unchanged; wording audit shows no "shortage" or "forecast" language.

Status on 26 October 2026 (evidence in `docs/stage-reports/stage-7.md`, ADR-0026):
- The data step is PR #21 (CI green).
- The module is built on `stage/7-scenario-lab`, stacked on the data branch:
  - all four scenarios;
  - presets;
  - results, charts and methodology;
  - saved scenarios with comparison and export;
  - URL state.
- In the sandbox every exit criterion is met:
  - the figures shown were recomputed independently from the published files;
  - the listed behaviours are unit- and component-tested;
  - three E2E tests run the scenarios on the map;
  - the Stage 1–6 tests pass unchanged;
  - the wording audit is a test.
- Not yet done: the live checks with a real GPU and the Esri basemap (B48).

## 10. Stage 8 — Consulting Insights + PDF export

Deliverables: workstream content (CI-01, approved copy D7); rule engine with "why am I seeing this?" (CI-02/03); opportunity statements for authority, commodity and scenario contexts; PDF export (EX-01..05) with checksum; CSV export.

Exit: PDF values equal on-screen values (automated comparison of model vs extracted PDF text for key figures); rule tests pass; P14 copy review signed off.

## 11. Stage 9 — Hardening and Release 1

Accessibility audit (axe + manual keyboard/screen reader pass); responsive review; performance budgets enforced; error-path E2E (blocked data, malformed snapshot, map layer failure); README complete (setup, data prep, refresh, licensing, assumptions, limitations — brief §19.15); acceptance criteria evidence table (spec §9) in `docs/stage-reports/release-1.md`; tag `v1.0.0`.

## 12. Stage 10 — Release 2 (outline)

National Food Access layers (E&W LSOA, Scotland DZ2022, NI DZ2021) with per-nation tiling/lazy loading; Risk Explorer weights and sensitivity (RK-05) where components are comparable; Scenarios B (Short Straits; G13) and C (wheat); domestic production overlays (SS-07); Ask FOODSCOPE deterministic engine (AF-01..03); 3D globe for Food Origins; deep profiles for all LADs; authority-type benchmarking.

## 13. Stage 11 — Release 3 (outline)

Pre-computed network travel times (OSM network, documented speeds, snapping report, validation against an external router per the accessibility standard); secure serverless backend for LLM assistant (grounded tool calls only) and optional live trade proxy; ArcGIS Online publishing scripts (CI secrets, idempotent overwrite, item metadata with licences).

---

## 14. Working with Claude Code, stage by stage

Use this prompt pattern at the start of each stage:

> Read `CLAUDE.md`, then `docs/04-ROADMAP.md` §<stage>. Check the gates for this stage are cleared in `docs/03-DATA-SOURCES.md`. Propose a short plan (files to create/change, tests to add), then implement Stage <n> only. Finish with `docs/stage-reports/stage-<n>.md`: what was built, commands run and their results, what could not be verified and why, and open questions.

Rules of engagement:

- One stage per branch (`stage/<n>-<slug>`), merged by pull request after CI passes.
- Commits follow Conventional Commits and reference requirement IDs, e.g. `feat(origins): partner choropleth (FO-02)`.
- If a stage reveals that a requirement is unrealistic or a source is unusable, stop, record it in the stage report and propose a spec change rather than improvising data.

---

## 15. Risk register

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

## 16. Decision log

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
| 2026-10-24 | Stage 4: local scale is zoom 12 (individual stores, council outlines, imagery offered); light grey is offered in every module, imagery only in UK Food Access (and later Local Authority Profiles); each style has its own validated colour set | SH-08, ADR-0022 |
| 2026-10-24 | D5 store classes (John's decision): convenience under 280 m²; supermarket 280 m² and over in three bands; forecourt, motorway, travel and hospital stores flagged as their own formats; default view supermarkets in the standard format; wholesale and non-food left out (decided later the same day) | Spec §11 D5, S11 |
| 2026-10-24 | Population: ONS mid-2025 estimates for all four nations, fetched by the pipeline on GitHub Actions (John's decision) | S18 |
| 2026-10-24 | Council boundaries: BGC clipped edition for display, BFE full-extent edition for store assignment; local data built offline and published in Stage 4 | ADR-0020, S14 |
| 2026-10-24 | John's decisions: leave out wholesale and mainly non-food stores; show the 125 Crown Dependency stores on the map without a council; each kind of data keeps its own newest date, so trade and stores refresh on their own schedules | ADR-0020, Stage 4 |
| 2026-10-24 | Stage 5: Northern Ireland deprivation (NIMDM 2017) is shown on its own 2011 Super Output Areas, never reallocated to Data Zones | John (decision); spec P12, P11 |
| 2026-10-24 | Stage 5: if PPFI v2.1 has no Northern Ireland rows, the Belfast profile says it is not available and uses Northern Ireland's own measures (no PPFI v1 reference). **25 Oct: v2.1 does cover NI** (890 SOAs), so Belfast shows it on its SOAs, like NIMDM, with the three missing domains stated | John (decision); S13 |
| 2026-10-24 | Stage 5: small-area data is published for the two deep profiles only (Belfast, Manchester), as planned for Release 1 | John (decision); LP-10 |
| 2026-10-24 | Stage 5: NI car availability by Data Zone and the PPFI v2.1 LSOA file are provided by John (the NISRA table builder disallows automated access; HASP downloads go through a basket) | John |
| 2026-10-25 | Northern Ireland shops: make the GEOLYTIX NI stores easier to see, and add the NI grocers GEOLYTIX misses from the FSA food hygiene register (S29) as a separate, labelled layer that is never part of a store count or rate | John (request); Stage 5 |
| 2026-10-25 | Stage 5 (John's brief and decision): fetch urban/rural context (ONS 2021 RUC, England and Wales) and Defra annual production context (tomatoes, strawberries, potatoes, wheat) before building; council car availability added from the cached Census files; Scotland's and NI's council-level urban/rural shown as not available | S09, S10, S20, S21 |
| 2026-10-25 | Stage 5 built: profiles for all 361 councils, deep profiles for Belfast and Manchester, comparison never ranked; small areas drawn as graphics; the camera fits each selected council (up to zoom 13); the 1:110m outlines stop at about zoom 8; the NI grocers layer draws from zoom 7.5; profile figures use all mapped stores, whatever the map filters show | ADR-0023, LP-01–LP-08, LP-10 |
| 2026-10-25 | John's Stage 6 brief: the Risk Explorer becomes Stage 6 (Release 1); Scenario Lab, Consulting Insights and Hardening move to Stages 7–9, Releases 2 and 3 to 10 and 11 | §1 |
| 2026-10-25 | Stage 6 data first, in its own pull request; FAO water stress (SDG 6.4.2) the only country climate/water indicator; the Priority Places index for every council, ranked within nation | John (decisions); S13, S30 |
| 2026-10-25 | Port symbols: DfT's rough location where given, otherwise EMODnet's location for the same UN/LOCODE; food-specific port dependence only from UKFSR's published shares, never derived from DfT tonnage | S03, S23, S36 |
| 2026-10-25 | Not shown, with the reason stated: Northern Ireland roads (OSNI service unreachable), rail freight routes and distribution centres (no open official dataset found) | S34; 03-DATA-SOURCES §9 |
| 2026-10-25 | Northern Ireland transport (John's links): the Translink NIR railway network is fetched and shown as Northern Ireland's railway lines (S37); DfI's Highway Network has no open geometry and OSNI's Hub download failed, so Northern Ireland's roads wait for a file from John | S34, S37 |
| 2026-10-25 | Stage 6 built: three views on one map, never combined; the supply view reuses the trade map with a water-stress fill; ports as graphics (the only hit-tested logistics layer); councils in a risk mode of the Access layers, ranked within nation; a warm risk ramp for vulnerability measures, teal for volumes; "Explain this risk" built from indicators with a separate interpretation; RK-05 weights deferred to Release 2 | ADR-0024; spec §5.6, §6.6 |
| 2026-10-26 | Stage 6 reached main through PR #17 (PR #16 had been merged into the data branch, not main) and was deployed | PRs #15–#17 |
| 2026-10-26 | Northern Ireland road corridors: the file John sent is an OpenStreetMap extract, not OSNI's layer. John chose to use it, labelled as OpenStreetMap and as not official data, motorways and primary roads only (matching GB's two categories; secondary roads left out). The committed ZIP leaves out the file's ArcGIS metadata, which records local file paths | S38; John (decision) |
| 2026-10-26 | All sixteen baskets of spec §6.1 (John's request): HMRC snapshot 2026-10-26; gate G3 against Defra's trade codes; groups by SITC division; the Risk Explorer's commodity–country matrix compares a basket with its group; Defra production context where Defra publishes a supply balance (apples, sugar, beef, mutton and lamb, poultry), "not grown commercially in the UK" from Defra's indigeneity for oranges, rice, coffee, cocoa and bananas | ADR-0025; S01, S05, S09, S10 |
| 2026-10-26 | HMRC filters: at most ten OR-ed comparisons per query (a 24-clause filter answered HTTP 400) | S01 |
| 2026-10-26 | John's Stage 7 brief (Scenario Lab): the closure scenario covers every small area of the UK, data fetched and verified first in its own pull request; straight-line distances only for now (routed travel time stays Release 3) | John (decisions); G19; S15, S16, S17 |
| 2026-10-26 | Stage 7 built: one typed scenario model for controls, URL, saving and export; A on the trade map with the disrupted partner's baseline dashed; B on precomputed three-nearest supermarkets (no browser spatial search), an Access scenario mode and a closure layer; C on Defra's published balances only; D on DfT tonnage, food exposure only where recorded at the port (never Dover's tunnel-inclusive figure, never by partner country); saved scenarios in the browser, compared kind by kind, never combined | ADR-0026; SC-01 – SC-06 |
