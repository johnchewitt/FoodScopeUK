# Stage 5 report — Local Authority Profiles

| | |
|---|---|
| **Branch** | `stage/5-local-authority-profiles`, stacked on `data/stage-5-context` (PR #13, the urban/rural and Defra production data step), which is stacked on `main` after PR #12 (the Stage 5 input data) |
| **Date** | 25 October 2026 |
| **Scope** | Roadmap §7 and John's Stage 5 brief (25 Oct 2026): LP-01 – LP-08 and LP-10, the comparison view, and John's earlier request to make Northern Ireland's shops easier to see. LP-09 (PDF) is Stage 7. Stage 6 not started. |
| **Data** | Each family from its newest snapshot (ADR-0021): trade **2026-10-23**; local (stores, councils, population) **2026-10-24**; register (NI grocers, FSA) **2026-10-24**; areas (Belfast and Manchester small areas) **2026-10-25**; context (urban/rural, car availability by council, Defra production) **2026-10-25**. Built offline from committed raw files; no new downloads in this stage. |
| **Result** | All checks pass in the sandbox (below). Hand checks against the raw sources match. Not yet done: CI on the pull request, review, merge, and the live checks with a real GPU and the Esri basemap. |

## What was built

| Requirement | Built |
|---|---|
| **LP-01** select and fly | Search by name or GSS code; a list of the 361 councils with an England / Wales / Scotland / NI filter; shortcuts to the two deep profiles; or a click on a council on the map. The map fits the council (up to zoom 13) and outlines it in the selection colour with a light tint. The council stays selected in every module and in the URL (`lad`), so a profile link is shareable. Councils are the ONS May 2025 boundaries, the same edition as their codes and populations. |
| **LP-02** area overview | Name, nation, code, residents (ONS mid-2025), land area, density, urban/rural class (ONS 2021 for England and Wales; "Data unavailable" with the reason for Northern Ireland and Scotland), households with no car or van (Census 2021; not Scotland). Every value shows its provenance class, period and source IDs. Badges give each source's date. |
| **LP-03** retail network | From the Stage 4 GEOLYTIX data (the same stores the map draws): mapped stores by type, supermarkets and all stores per 10,000 residents, retailers represented, the largest retailer's share of supermarkets and the HHI (spec §6.3), a retailer donut (eight fixed colour slots plus "Other retailers") with a table that names every retailer, and the council's store list. |
| **LP-04** accessibility and vulnerability (deep) | Straight-line distance from each small area's population-weighted centroid to the nearest supermarket and to any store, in BNG or ITM; residents beyond 1, 2 and 5 km; the underserved areas listed farthest first, with car availability beside them (never combined). PPFI v2.1 (combined and seven domains) and the nation's deprivation index (IoD 2025, NIMDM 2017), each on its own geography and ranked within its nation. NI's three PPFI domains without data say "Data unavailable". Public transport and drive times are not modelled; the PPFI accessibility domain is shown where it exists, and the profile says so. |
| **LP-05** national context | Labelled "National context" (amber chip and banner): the largest recorded import partner's share over the latest 12 months for the five Food Origins baskets (HMRC), and UK production share of supply from Defra (annual, 2025; potatoes and wheat provisional). Bananas: Defra publishes no UK production. The text says these are the same for every council and say nothing about its own supply chains. Food prices, Short Straits and climate risks are not included (sources not verified). |
| **LP-06** neighbourhood map (deep) | Small areas drawn as graphics below the councils, shaded by the chosen measure in fixed classes: PPFI combined or a domain, deprivation (both deciles 1–2 most salient), no car or van (15/30/45/60 %), straight-line distance (0.5/1/2/5 km); no data hatched. Belfast's PPFI and NIMDM are on the 174 SOAs (2011), its census measures on the 735 Data Zones (2021); Manchester uses its 295 LSOAs (2021) throughout. Click an area for its card (tooltip on hover). Click a chart bar, or its keyboard button, to outline that class's areas on the map. |
| **LP-07** comparison | A dialog (`view=compare`, `cmp=`) with the selected council and up to three others, in the order chosen, never ranked. Rows are grouped (population, supermarket provision, accessibility and vulnerability) and each says how far it compares. A banner appears when the councils are in different nations. Deep-only rows say "Data unavailable" for other councils. Benchmarks against similar authorities wait for Release 2. |
| **LP-08** consulting prompts (provisional) | "Consulting opportunities", closed by default and badged "Provisional": rule-based prompts from the figures shown (for example low supermarket provision, many residents beyond 1 km, a high no-car share against the nation), each with "why am I seeing this?". The text says it implies no requirement, budget or procurement. Expanded in Stage 7. |
| **LP-10** deep profiles | Belfast (N09000003) and Manchester (E08000003). Other councils get the council-level profile and a note that small areas follow in Release 2. |
| **NI shops** (John, 25 Oct) | UK Food Access and the profiles say what GEOLYTIX covers in Northern Ireland and offer the convenience layer. An optional layer (`ng=1`) shows the 285 NI grocers from the FSA register that GEOLYTIX misses: hollow diamonds from zoom 7.5, with a tooltip and legend entry, never counted. The Belfast profile lists its stores by type and retailer. |

**Also in this stage:**
- **B29 fixed.** Hover hit tests in Food Origins test the points and connections first and the country fills only when nothing is found. GraphicsLayer hit tests take about 1 ms; the GeoJSON ones took 0.6–3 s under software rendering. B37 records the same for the Access stores layer.
- **Seasonal Supply.** The SS-07 note now says UK production is published annually, not monthly.
- **Evidence page.** It gains "Reading the local figures": store assignment, straight-line distances, population bases, PPFI direction and NI coverage, within-nation ranks, urban/rural and car coverage, the NI register layer, national context and deep-profile coverage.
- **Freshness pill.** With more than two families it shows the date range ("Data 2026-10-23 to 2026-10-25").

**Architecture** (ADR-0023):
- **Data loading.** Small areas are published per council (`areas/<LAD>/`) and loaded only when that council is selected.
- **Map layers.** The profile reuses the Food Access layers in a profile mode. Small areas are a GraphicsLayer fed by `state.profileMap`.
- **Distances.** Computed in the browser from the published centroids.
- **Code loading.** The module is a lazy chunk.
- **Reference outlines.** The 1:110m outlines now stop at about zoom 8. At council scale they cut across the map, as the first screenshots showed.

## Exit criteria and the brief's acceptance list

| Check | Result | Evidence |
|---|---|---|
| 1. Both initial authorities can be selected | Yes: search, list, shortcuts, map click and URL | E2E "search for Belfast", component tests |
| 2. Boundaries and codes are correct | May 2025 councils (ONS) with codes from the same service; the fly-to fits the published boundary's extent; the selected council's outline is drawn from the same file | E2E (zoom, outline renderer), `model.test.ts` (frame boxes) |
| 3. Supermarket counts match spatial queries | Yes, independently: a fresh point-in-polygon of the raw GEOLYTIX workbook against the raw BFE boundaries gives the same counts as the app for four councils (table below) | `check_stores_population.py` (scratch, not committed) |
| 4. Population denominators match sources | Yes: council populations equal the raw ONS mid-2025 table (MYE2 – Persons); small-area populations equal Census 2021 TS001 and NISRA MS-A01 for the sampled areas | Hand checks below; `model.test.ts` |
| 5. PPFI joins correctly | Yes: the sampled areas' ranks and deciles equal the raw HASP file; Manchester 119 and Belfast 6 areas in deciles 1–2, from the raw file and in the app | Hand checks; `model.test.ts`; component and E2E tests |
| 6. Map, charts and profiles stay synchronised | Council, small area, measure, chart outline and comparison all go through the store; the map and panels read the same models | E2E: map click → card, chart click → outline count, comparison → dashed outline; unit tests of the models |
| 7. Comparison doesn't combine incompatible indicators | No ranking, no totals across councils; within-nation and nation-specific rows marked; nation banner | Component test and E2E (banner, row markers, axe) |
| 8. National/local context labelled | "National context" banner and chip in every profile | Component test |
| 9. Previous modules still work | Full E2E suite, including Origins, Seasonal and Access | Commands below |
| 10. Tests and production build pass | Yes | Commands below |
| Roadmap: every section renders with provenance | Yes for both deep profiles (screenshots reviewed; values via `<Metric>`) | Screenshots, component tests |
| Roadmap: five small areas per council hand-checked | All match (below) | `check_small_areas.py` |
| Roadmap: nation banner in Belfast–Manchester comparison | Yes | Component test, E2E |

### Store counts: independent point-in-polygon

The script reads the raw workbook and boundaries only, plus the agreed store classes (D5 config). It assigns each store with shapely in EPSG:27700, using the documented 50 m nearest-council rule for coastal points. It does not use the pipeline's code.

| Council | Independent: all / supermarkets | Published council indicators | Stores in the app's store file |
|---|---|---|---|
| Belfast N09000003 | 140 / 39 | 140 / 39 | 140 / 39 |
| Manchester E08000003 | 150 / 55 | 150 / 55 | 150 / 55 |
| Cardiff W06000015 | 118 / 43 | 118 / 43 | 118 / 43 |
| City of Edinburgh S12000036 | 178 / 77 | 178 / 77 | 178 / 77 |

Populations from the raw ONS mid-2025 table: Belfast 351,927, Manchester 588,256, Cardiff 381,516, City of Edinburgh 531,370. All four equal the app's figures.

### Five small areas per deep profile against the raw files

Areas picked by sorted code at positions 0, ¼, ½, ¾ and last. "Distance" is computed independently with pyproj:
- from the raw centroid: BNG for England; Irish Grid TM65 transformed to ITM for Northern Ireland;
- to the nearest GEOLYTIX supermarket (280 m² and over, standard format) in the same nation.

`model.test.ts` checks the app's own distances against these to within 5 m. Every other field equals the published file.

| Area | Residents (Census 2021) | Households / no car | PPFI rank, decile | Deprivation decile | Urban/rural | Nearest supermarket (straight-line) |
|---|---|---|---|---|---|---|
| E01005061 Manchester 018A | 1,792 | 656 / 278 | 1,125, 1 | IMD 1 | UN1 | 1,358 m |
| E01005151 Manchester 029B | 1,476 | 703 / 231 | 9,124, 3 | IMD 5 | UN1 | 950 m |
| E01005230 Manchester 022B | 2,094 | 762 / 406 | 14,250, 5 | IMD 1 | UN1 | 634 m |
| E01005310 Manchester 036C | 1,986 | 585 / 240 | 3,685, 2 | IMD 3 | UN1 | 448 m |
| E01034138 Manchester 064B | 1,385 | 453 / 215 | 20,892, 7 | IMD 1 | UN1 | 159 m |
| N20000711 Oldpark_A1 | 764 | 249 / 18 | (on SOAs) | (on SOAs) | (on SOAs) | 1,071 m |
| N20000894 Titanic_H3 | 548 | 229 / 115 | | | | 499 m |
| N20001078 Lisnasharragh_R5 | 287 | 139 / 18 | | | | 403 m |
| N20001262 Collin_G3 | 448 | 187 / 81 | | | | 1,829 m |
| N20001445 Court_X5 | 394 | 173 / 104 | | | | 408 m |
| 95GG01S1 Andersonstown_1 | | | 594, 7 | NIMDM rank 388 → decile 5 | Urban (2015) | |
| 95GG15S1 Cherryvalley_1 | | | 774, 9 | 873 → 10 | Urban | |
| 95GG31S1 Ladybrook_1 | | | 676, 8 | 763 → 9 | Urban | |
| 95GG45S3 Upper Malone_3 | | | 459, 6 | 720 → 9 | Urban | |
| 95SS29S2 Twinbrook_2 | | | 170, 2 | 36 → 1 | Urban | |

Council totals from the raw files:
- Manchester: 295 LSOAs; 119 in PPFI deciles 1–2 (40.3 %); 120 in IMD decile 1 (40.7 %).
- Belfast: 174 SOAs (`LGD2014NAME = Belfast`); 6 in PPFI deciles 1–2 (3.4 %); 47 in NIMDM decile 1 (27.0 %).

The comparison dialog shows all four shares.

### Profile figures (as shown)

| | Belfast | Manchester |
|---|---|---|
| Residents (mid-2025) | 351,900 | 588,300 |
| Mapped grocery stores (supermarkets) | 140 (39) | 150 (55) |
| Supermarkets per 10,000 residents | 1.11 | 0.93 |
| All stores per 10,000 residents | 3.98 | 2.55 |
| Retailers represented | 10 | 13 |
| Largest retailer's share of supermarkets | 28.2 % (Iceland) | 18.2 % |
| Residents > 1 km straight-line from a supermarket | 32.2 % | 14.1 % |
| Households with no car or van (Census 2021) | 33.9 % | 39.0 % |
| Urban/rural (council) | Data unavailable (NI) | Urban: majority nearer to a major town or city |

Belfast has 6 of its 174 SOAs in PPFI deciles 1–2 but 47 in NIMDM's most deprived decile. The two indices measure different things and NI's PPFI rests on four of its seven domains (three have no NI data). The profile shows both on their own scales, says which domains are missing, and never combines them.

## Colour checks

| Set | Surface | Result |
|---|---|---|
| Retailer slots `#3987e5 #d95926 #199e70 #c98500 #d55181 #008300 #9085e9 #e66767` (categorical, fixed order; "Other retailers" muted) | Panel `#073435` | PASS: lightness band, chroma, CVD worst adjacent ΔE 8.4 (protan), normal-vision worst ΔE 19.3. WARN: `#008300` 2.74:1 → every slice is named in the table beside the donut, and the comparison bar has a text list |
| Small-area classes | Each basemap style's existing `MAP_COLOURS[style].seq` ramp (validated in Stage 4), classes 1–5 | No new map colours. Selection and outline colours reuse the Stage 4 selection and proximity colours (all-pairs check in the stage 4 report). The NI register colour has a value per style and a parity test |

## Commands run and results (sandbox, 25 Oct 2026)

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint`; `npm run check:banned` | 0 errors, 0 warnings; OK |
| `npm run format` | All files formatted |
| `npm test` | **413 passed** (31 files; 361 at the end of Stage 4) |
| `cd pipeline && uv run pytest` | **161 passed** (38 s) |
| `VITE_ARCGIS_ASSETS=local npm run build`; `npm run build:e2e-basemap` | Both succeed |
| `npm run e2e` | **70 passed** (13.5 min): the 62 earlier tests (two updated, see below) and 8 new profile tests, with the basemap project on the placeholder-key build. A first full run had 2 failures, both in tests that assumed Profiles was a placeholder; after updating them the profile tests passed, and the comparison test once failed axe while the dialog faded in (now waits for it to open) |
| Hand checks (`uv run python -I <scratch>/check_stores_population.py`, `check_small_areas.py`, `check_membership.py`) | All match (above) |
| Bundle | Profiles chunk 96.6 kB (26.6 kB gzip), loaded only when the module opens. App entry 462.1 kB (141.2 kB gzip). |

New tests:
- **Unit:**
  - `src/analysis/profile.test.ts` (14);
  - `src/features/profiles/model.test.ts` (11, on the real files: validation, council rows, joins, distances against pyproj, decile counts against the raw files, map models, framing);
  - URL and store tests for `am`, `sa`, `cmp`, `ng`;
  - MapController profile framing (3);
  - palette parity for the new colours.
- **Component:** `Profiles.test.tsx` (7):
  - Belfast deep link;
  - search;
  - chart outline by keyboard;
  - small-area card;
  - comparison;
  - non-deep council;
  - Scotland.
- **E2E:** `profiles.spec.ts` (8):
  - search → fly-to → outline → 174 SOAs;
  - map click on a Manchester LSOA → card;
  - chart bar click → 119 areas outlined, and the keyboard alternative;
  - comparison with dashed councils, banner and axe;
  - council kept across modules, back to Origins and back;
  - axe on a profile;
  - NI grocers (285, from zoom 7.5, counts unchanged);
  - mobile without sideways scroll.

  Two existing tests changed because Profiles is no longer a placeholder: the smoke deep link (the month is now checked in Seasonal Supply) and "other modules hide the Origins layers" (cards say "No council chosen").

**Found and fixed by the new tests and screenshots:**
- The camera framed Belfast at zoom 6: the profile frame inherited the trade views' zoom cap. It is now `PROFILE_MAX_ZOOM` 13.
- The 1:110m UK outline cut across Belfast and Cardiff at council scale. The outlines now stop at about zoom 8.
- At UK scale the 285 NI grocers covered Northern Ireland as one blot. They now draw from zoom 7.5, and the legend says so.
- Adding a comparison council did not dash it on the map. The council renderer's signature left out the comparison and the mode.
- The KPI cards said "No data loaded" before a council was chosen. They now say "No council chosen".
- The small-area card labelled Belfast's Data Zones "Urban/rural (ONS 2021): Data unavailable". ONS does not cover NI, so the row is not shown there; NISRA's 2015 class is on the SOAs.

## Independent review

A separate agent reviewed the application code without seeing this report. It reported six verified findings; all are fixed, with tests:

1. **High.** The council / nation / UK provision chart took its nation and UK totals from UK Food Access's council shading. After "All grocery stores" there, Manchester's supermarket rate (0.93) sat beside England's all-store rate. The chart now always uses the profile's supermarket totals.
2. **NI grocers layer.** Switched off, it came back on when the module changed; its diamonds then swallowed small-area clicks. It is now hidden on every update while off (E2E).
3. **SOA codes.** 10 of Belfast's 174 SOAs (whole-ward codes ending in W, e.g. `95II07W1`) were rejected when read from the URL. Fixed (unit and component tests).
4. **Point picking.** A pick started in UK Food Access captured clicks in Profiles. Picking now belongs to UK Food Access only.
5. **Back and forward.** Going back to another council left a stale "Outlined on the map" line. History navigation now drops the outline when the council or measure changes.
6. **Axis label.** The deprivation chart's axis said "1 = highest priority". It now says "1 = most deprived".

The reviewer also raised four possible issues; these are now done:
- a Northern Ireland store-coverage caveat on store figures and in the comparison (GEOLYTIX has ten retailers there);
- the small-area card's values through `<Metric>` with provenance;
- councils clickable at local scale in Profiles (to move to a neighbour);
- a keyboard selector for every small area.

Two remain:
- The underserved table and the store list show plain numbers. The table has a caption naming the source and method, as the Stage 4 tables do.
- The axe check on the comparison dialog sometimes failed on colour contrast while the dialog was still fading in. The test now waits for Calcite's `calciteDialogOpen` event.

## Not verified, and why

- **Live site.** Not checked with a real GPU and the Esri basemap (dark grey, light grey, imagery) until after merge. In the sandbox the map is the offline outline map, drawn by software WebGL. There, GeoJSON layers take up to about 20 s to draw at council scale, and coarse tiles of the outline layer sometimes draw partly. Neither is expected on a real GPU, but this needs the live check.
- **Small-area colours on light grey and imagery.** They reuse the Stage 4 ramps checked on those styles, but nobody has looked at them over small areas on the live site.
- **Deep-profile performance on a slow device.** Not measured: distances for 735 areas against about 19,000 stores, and drawing 735 graphics. In the sandbox the profile appears within the E2E timeouts.
- **Screen reader pass.** Axe passes and every chart has a text alternative (description, table or buttons), but no manual screen-reader test was done (Stage 8).
- **CI.** Not yet run on the pull request.

## Open questions for John

1. **PPFI direction.** The publisher's documentation does not say which end of the PPFI is highest priority. FOODSCOPE checked it from the data: the socio-demographic domain ranks with IoD 2025 and NIMDM 2017. The profile and the Evidence page say so. Would you like to ask CDRC to confirm?
2. **Consulting panel stage.** Your Stage 5 brief says the provisional Consulting Opportunities panel is "expanded in Stage 8". The roadmap has Consulting Insights in Stage 7, and the app says Stage 7. Which should it be?
3. **LP-05 extras.** Food prices (CPIH food), Short Straits dependence and climate risks are listed in LP-05 but have no verified source yet. Should they be scheduled as a data step, and before which stage?
4. **FA-04 attention flags** (rule-based, user-editable flags such as "beyond 2 km and top-20 % deprivation and ≥ 40 % no car"). They are not in this stage's roadmap deliverables. Should they come with Release 2's national Food Access layers, or earlier?
