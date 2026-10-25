# Stage 4 report — Supermarket network (UK Food Access) and the basemap choice

| | |
|---|---|
| **Branch** | `stage/4-supermarket-network` (PR #8), stacked on PR #7 (`data/stage-4-inputs`), which is stacked on PR #6 (`improve/review-top-five`). Merged to `main` as PR #6, PR #10 (the data) and PR #9 (the stage) on 24 Oct 2026; PRs #7 and #8 were closed. Fixes from the live checks: PR #11 (`fix/stage-4-live-checks`) |
| **Date** | 24 October 2026 |
| **Scope** | Roadmap §6: SM-01 – SM-10 and the curated basemap switcher (SH-08, §6.1). Includes John's three decisions of 24 Oct 2026: wholesale and mainly non-food stores are left out; each kind of data keeps its own newest date; the 125 Channel Islands and Isle of Man stores are on the map without a council. Stage 5 not started. |
| **Data** | Trade snapshot **2026-10-23** (unchanged). Stores and population snapshot **2026-10-24**: GEOLYTIX v46 (June 2026), ONS mid-2025 population and land area, May 2025 councils. No new downloads; one offline rebuild to add the displayed-count comparison to the S12 report. |
| **Result** | All checks pass locally and on CI. Deployed from `main` at `0417872` (CI and Pages deploy both succeeded, smoke test included). Live checks done on 24 Oct 2026 (below); they found three small issues, fixed in the follow-up PR. Still open: the basemap request count from John's dashboard. |

## What was built

| Requirement | Built |
|---|---|
| **SM-01** stores via adapter | `useAccess` loads `local.stores` through `adapterFor()`: the static snapshot by default, or a hosted FeatureLayer when `config.json` lists one under `hostedLayers["local.stores"]`. `featureLayerAdapter` pages through `query?f=geojson` with `resultOffset` (at most 50 pages) and renames fields with `fieldMap`. Either way the result is validated against `stores.schema.json` before use; a layer that does not match is rejected. Tested with a mock service (unit tests), as the roadmap allows; no public layer with this schema exists. The store and council files load in parallel with the map SDK at start-up (`prefetch.ts`), and the Food Access code is a lazy chunk |
| **SM-02** clustering | Clustered below local scale (zoom 12, about 1:144,000) and drawn individually from it. Clusters: navy disc, light ring, store count. Clicking a cluster zooms in two levels (at most to local scale) |
| **SM-03** filters | Store types with counts: supermarkets (default), convenience, and forecourt, travel and hospital. Retailers: multi-select with counts for the types shown (All / None / each). The map filters with an SQL where clause built in `src/analysis/retail.ts`. All of it is in the URL (`sl`, `rt`) |
| **SM-04** symbols | Brand-neutral: class by colour **and** shape (supermarket circle, convenience square, other formats triangle), in a validated colour set per basemap. No logos |
| **SM-05** search and cards | Search by name, town or postcode within the data; a result flies to the store at street level. Clicking a store or picking a result opens its card, which shows only fields present in the data: retailer, fascia, address, type and size band, council or Crown Dependency, with source and snapshot date. The card offers "Zoom to store" and "Measure from here", and says when the store is hidden by the filters (with a one-click fix) |
| **SM-06** council counts and choropleth | Councils shaded by supermarkets, convenience stores or all stores per 10,000 residents (or off), with fixed, documented class breaks. The no-data class is a hatch with its own legend entry (empty for this edition: every council has a population). Councils are shaded at national and regional scale and outlined at local scale. The selected council has a selection outline. The legend gives the count of councils per class |
| **SM-07** proximity | Choose a point on the map, use the map centre (keyboard route: pan with the arrow keys), or measure from a store. Results show the nearest *N* (1–20) of the stores shown, and how many lie within a radius (0.5–20 km). Distances are straight-line in the national grid (BNG; ITM in Northern Ireland). On the map: the ring is drawn in the same grid, with dashed straight lines to the nearest stores. Labelled "straight-line", never walking or driving |
| **SM-08** density | Council table: stores, per 10,000 residents, per km² of land. Sortable, filterable by nation, 15 rows then "show all". Choosing a row selects the council and fits the map to it |
| **SM-09** comparison | Bar chart: the selected council (if any), the four nations and the UK, for the chosen measure, with a numerator and denominator table underneath |
| **SM-10** note | "Store counts and distances describe physical provision only; they do not measure affordability, choice or nutritional access." It is always on the map while UK Food Access is open (also on phones) and at the top of the insights panel. The shell draws it, so it shows before the module's code arrives |
| **SH-08** basemap choice | A map control (keyboard operable, labelled) offering dark grey (default), light grey, and imagery with labels, in the URL as `bm`. Imagery is offered only at local scale in UK Food Access; elsewhere the control says why. Without a key the control is hidden. Each style has its own validated colour set: legends follow it, and attribution follows the style. A style that fails falls back to the outline map with the dark colour set (ADR-0022) |

**Cards.** Mapped stores (with the filters); per 10,000 residents and per km² of land, for the selected council or the UK, for the chosen measure. "Population beyond threshold (straight-line)" stays a planned card: it needs small-area population, which arrives with Local Authority Profiles (Stage 5).

**Wording and dates (ADR-0021).** The header reads "Trade 2026-10-23 · Stores and population 2026-10-24". The Evidence page and Insights status list name each family's snapshot. Food Origins and Seasonal Supply cite the trade snapshot.

**Pipeline.** `build-local` writes into `public/data/snapshots/<date>/local/`, and `publish` takes each family from its newest snapshot (ADR-0021). The S12 comparison report gains a `displayed` section (below), and its CSV gains the displayed counts per council. The data files are byte-identical after the rebuild.

**Map plumbing found in testing.** When the store data arrived after the map was ready, a layer's "loading" report inside its own update re-entered the update: "Maximum call stack size exceeded". This happened once in E2E. `MapController` now defers a store change made during a sync until the sync ends (unit test), and the layer is assigned before it reports. An E2E test delays the stores file by 6 s to cover this order.

**Hover fix found on CI.** The Food Origins hover test (from the post-Stage 3 review) failed twice on CI for this PR: after the pointer moved from Turkey to Morocco, the tooltip stayed on Turkey. It passed locally in Chrome and in the headless shell. Diagnostics added to the test showed the camera unchanged, nothing covering the map, and the map's own hit test at Morocco's point returning Morocco. Hover hit tests run asynchronously and can resolve out of order, so a slower one for the earlier position overwrote the newer result. Each hover hit test now carries a sequence number, so only the latest can set the hover, and leaving the map cancels any in flight. This applies to the trade and Food Access layers. CI then passed: **61 of 61 E2E** (19.1 min), with typecheck, lint, unit tests, build and the pipeline all green. This is a likely cause of the intermittent CI failures in B29.

## Exit criteria

### Filter counts match the pipeline

| Check | Result |
|---|---|
| Stores on the map by type (unit test on the published file) | supermarkets **7,193** (7,171 in councils + 22 in the Crown Dependencies), convenience **10,722**, forecourt/travel/hospital **1,268**; total **19,183** = pipeline `published`; 19,058 in councils = pipeline `assigned`; Crown Dependencies 125 (Guernsey 30, Jersey 51, Isle of Man 44) |
| Same counts recomputed from the store file and the council indicator file, by type | Equal for all three types (`reconcile()`, unit test) |
| The map layer itself (E2E, `queryFeatureCount` with the layer's own where clause) | Default 7,193; supermarkets + convenience 17,915; supermarkets + convenience for Aldi only 1,085 (1,084 + 1). Each equals the card |
| UK supermarkets per 10,000 residents | 7,171 ÷ 69,483,939 × 10,000 = **1.03** (card, unit test, Python) |

### Choropleth classes for three councils (hand-computed, then checked on the map)

| Council | Supermarkets | Residents (mid-2025) | Per 10,000 | Class | Fill on the map (E2E) |
|---|---|---|---|---|---|
| Hartlepool `E06000001` | 12 | 99,656 | 1.204 | 4: 1.15 to under 1.30 | `#3fd1c3` (dark grey set, class 4) |
| Manchester `E08000003` | 55 | 588,256 | 0.935 | 2: 0.85 to under 1.00 | `#2ea39c` |
| Belfast `N09000003` | 39 | 351,927 | 1.108 | 3: 1.00 to under 1.15 | `#37baaf` |

The breaks are 0.70 / 0.85 / 1.00 / 1.15 / 1.30. They put 30, 43, 90, 80, 59 and 59 councils in the six classes. They are round numbers near this edition's deciles, fixed for later editions (`PROVISION` in `src/analysis/retail.ts`). Convenience: 1.0 / 1.2 / 1.4 / 1.6 / 2.0. All stores: 2.0 / 2.3 / 2.6 / 2.9 / 3.3. Every class of every measure holds at least 20 councils (unit test).

### LAD totals reconciled with ONS S12

S12 (ONS, March 2024) counts GEOLYTIX stores of its time per council, in all formats including wholesalers, plus 52 stores from retailers GEOLYTIX lacked. The like-for-like comparison of every store is in the pre-Stage 4 report: 19,174 against 18,069, +6.1 %. What the app **displays** (from `pipeline/reports/ons-s12-comparison-2026-10-24.json`, section `displayed`):

| Displayed | App | S12 (comparable part) | Difference | Median council difference | Within ±10 % |
|---|---|---|---|---|---|
| All store types (wholesale and non-food left out) | 19,058 | 18,069 (all) | +989 (+5.5 %) | 6.2 % | 270 of 361 |
| Supermarkets (standard format, 280 m² and over) | 7,171 | 7,420 (280 m² and over, all formats) | −249 (−3.4 %) | 6.2 % | 273 |
| Convenience (standard format, under 280 m²) | 10,622 | 10,649 (under 280 m², all formats) | −27 (−0.3 %) | 7.3 % | 225 |

By nation, all types: England +5.3 %, Wales +2.7 %, Scotland +5.6 %, Northern Ireland +14.2 % (722 against 632).

**Why they differ:**
1. **Vintage.** S12 was published in March 2024 and the app uses June 2026. Grouped by ONS's retailer types, the convenience growth shows: ONS's "Convenience" type is +1,064 stores. Retailers ONS did not group (Centra, Cook and one other) add 221. Together these explain most of the "all types" difference.
2. **Definitions in the supermarket and convenience rows.**
   - The app's supermarket and convenience layers hold standard-format stores only. Forecourt, motorway, station, airport and hospital stores (1,265 in councils) form a separate layer, while S12's size bands include them. That is why the app's supermarkets are 3.4 % below S12's 280 m² and over bands.
   - Wholesale (52) and mainly non-food (64) stores are left out by John's decision; S12 includes its 56 wholesalers.
3. **Northern Ireland.** The largest relative differences: Lisburn and Castlereagh +40.5 %, Mid Ulster +23.1 %, Belfast +11.1 %. Centra's 102 stores are all in Northern Ireland and appear in none of S12's groupings (pre-Stage 4 report). Centra alone is more than NI's displayed difference (+90). This is not a boundary problem: every NI store is in a council, two of them by the 50 m nearest-council rule.
4. **Councils of the time.** S12 counts are on pre-2023 councils, mapped to May 2025 councils by the S14 lookup (17 merged, 2 recoded). These add, never split, so they cannot move stores between councils.

No figure is adjusted to agree with S12; S12 stays a check, not a second value on screen (spec §6.3).

### E2E for the switcher, live checks and usage
See "Commands run" and "Not verified" below.

## Colour checks (dataviz palette validator)

| Set | Surface | Result |
|---|---|---|
| Dark grey ramp `#1e7877 … #49ead8` (ordinal) | `#3d3d3d` (dark grey land) | PASS: monotone, ΔL ≥ 0.06, single hue (10°), lowest class 2.07:1 |
| Light grey ramp `#3b9ca7 #1e8691 #00717c #005d68 #004954 #003641` (ordinal) | `#d6d6d6` and `#f0f0f0` | PASS both: monotone, ΔL ≥ 0.06, single hue (10°), lightest class 2.22:1 / 2.84:1 |
| Dark grey stores `#edf7f5 #eb6834 #9085e9` | `#3d3d3d` | CVD worst ΔE 25.5 (protan), normal 26.9, all ≥ 3:1. Lightness band and chroma flag the near-white supermarket symbol (intended: achromatic, with shape as the second cue) |
| Light grey stores `#071923 #a3410b #5a3fc0` | `#d6d6d6`, `#f0f0f0` | CVD worst ΔE 25.0, normal 28.6, all ≥ 3:1. Same intended flag for the navy symbol |
| Imagery (dark set) | `#2f3a24` (vegetation) | All ≥ 3:1 |
| Imagery (dark set) | `#6b6b6b` (roofs, roads) | WARN: orange 1.67:1, violet 1.70:1. Relief: on imagery the navy outline is 0.6 px wider, shapes differ, and every store has a card and tooltip |
| Light grey connections and selection `#071923 #46821f` | `#d6d6d6` | CVD ΔE 36.9, both ≥ 3:1 |
| Light grey proximity `#00717c` | `#d6d6d6` | ≥ 3:1 (chroma flag only). Replaced after the live checks (below) |
| Light grey ramp, rechecked on the measured land | `#f4f4f4` (below zoom 7), `#efefef` (zoom 7 and above), `#cfd3d4` (water) | PASS all three: lightest class 2.94:1, 2.81:1, 2.14:1 |
| Light grey stores, rechecked | `#f4f4f4`, `#efefef` | PASS: all ≥ 3:1 |
| Overlays, all pairs (selection, proximity, council lines, store symbols, ramp ends) | — | **FAIL before the fix:** proximity vs selection normal-vision ΔE 11.8 on dark grey (`#49ead8` vs `#a1eb83`; the proximity cyan also equalled the council outlines) and 14.8 on light grey (`#00717c` vs `#46821f`; also the class 2 fill) |
| Overlays after the fix: proximity `#f184c0` (dark grey, imagery), `#9c0a73` (light grey) | `#3d3d3d`; `#efefef`, `#cfd3d4` | PASS: dark worst normal ΔE 16.8, CVD 8.9, 4.55:1; light worst normal ΔE 17.5, CVD 9.2, 6.75:1 / 5.15:1. The legend ring sits on the light land colour on light grey, as it does on the map |

Panels stay dark glass on light grey but near-opaque (97 %). Muted text then computes to 4.7:1 over light map content, against 2.7:1 at the dark style's 76 %. The dark style's figure over the brightest share class is a separate, existing issue (B33).

Light grey's land colour could not be read from the sandbox, so the light set was first validated against both ends of the plausible range. On the live site the style's own layers give land `#f4f4f4` below zoom 7 and `#efefef` from zoom 7, water and background `#cfd3d4`, and urban areas `#e5e8e7` → `#eceded`; the rechecks above use these.

## Commands run and results (sandbox, 24 Oct 2026)

| Command | Result |
|---|---|
| `npm run check:banned` | OK |
| `npm run format` | All files formatted |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 0 warnings |
| `npm test` | **361 passed** (28 files). New since PR #7:
<br>- analysis: national grids, provision, filters, search, proximity;
<br>- the hosted-layer adapter;
<br>- URL state;
<br>- store actions and basemap rules;
<br>- per-style palette parity;
<br>- basemap swapping;
<br>- nested-sync deferral;
<br>- the Food Access view model on the real files (counts, reconciliation, three councils' classes, pyproj distances);
<br>- 5 Food Access component tests |
| `cd pipeline && uv run pytest` | **105 passed** (104 earlier + displayed-count comparison) |
| `uv run foodscope-pipeline build-local --snapshot 2026-10-24` | Rebuilt offline; data files byte-identical (`git diff` shows only the two S12 report files) |
| `VITE_ARCGIS_ASSETS=local npm run build` and `npm run build:e2e-basemap` | Both succeed |
| `npm run e2e` | **61 passed** (11.3 min): the 47 earlier tests, 8 Food Access tests and 6 basemap tests (project `basemap`, placeholder-key build) |
| Bundle | - **Start-up JS** (local-assets build, same chunks as CDN): 864.4 kB, 273.6 kB gzip, over 37 files. The Stage 3 report measured 842.4 kB / 265.0 kB on `main`; PRs #6 and #7 are in between, so this is not a like-for-like delta.
- **Food Access chunk:** 45.0 kB (13.4 kB gzip), loaded only when the module opens. Its validators and store model are inside it. |

New E2E tests:
- **UK Food Access (`access.spec.ts`):**
  - real counts and choropleth classes on the map;
  - filters → where clause → layer counts = cards;
  - shading at national scale and outlines at local scale;
  - store click → card; picking a point → five straight-line lines in ITM;
  - density table → council selected and fitted;
  - no basemap control without a key; axe;
  - mobile 390 × 844: the SM-10 note visible, no sideways scroll;
  - stores arriving after the map.
- **Basemap choice (`basemap.spec.ts`, placeholder-key build, stubbed styles service):**
  - light grey changes the basemap, the attribution, the legend swatches (painted colour) and the map fills, and survives a module change;
  - deep link `bm=light`;
  - imagery disabled at world scale and in Food Origins, offered at zoom 13 in UK Food Access, back to dark grey when zoomed out and to imagery when zoomed in;
  - a failing style falls back to outlines and dark colours;
  - axe on dark and light grey;
  - no console errors.

Screenshots:
- [national scale, offline outline map](stage-4/access-national-1600.png);
- [local scale with a store card and straight-line proximity](stage-4/access-local-proximity-1600.png);
- [light grey colour set over the stub basemap, Manchester selected](stage-4/access-light-stub-1600.png).

The stub basemap is one flat tile; the live site shows the real Esri styles.

## Deployment and live checks (24 Oct 2026)

Checked on https://johnchewitt.github.io/FoodScopeUK/ in the Claude desktop app's browser pane (Chromium, about 800 px wide, real GPU), after the merge of PR #9.

| Check | Result |
|---|---|
| CI and deploy on `main` (`0417872`) | Both succeeded, including the post-deploy smoke test |
| Each style loads with the site's key | Dark grey (`arcgis/dark-gray`), light grey (`arcgis/light-gray`) and imagery (`arcgis/imagery`) all report "ready" |
| Attribution follows the style | Dark grey: "Esri \| TomTom \| FAO \| NOAA \| USGS \| Made with Natural Earth \| …". Light grey: "Esri UK \| Esri \| TomTom \| Garmin \| FAO \| NOAA \| USGS \| …". Imagery over Manchester: "Esri UK \| Earthstar Geographics \| Esri \| TomTom \| Garmin \| GeoTechnologies, Inc \| METI/NASA \| USGS \| …". The ONS boundary and GEOLYTIX credits follow in every style |
| Imagery only at local scale | Offered at zoom 13 in UK Food Access; at zoom 9 the map shows dark grey and `bm=imagery` stays in the URL; imagery returns at local scale |
| Deep link `bm=light` | Opens in light grey, in Food Origins and UK Food Access |
| Stores file transfer (B34) | GitHub Pages serves `stores.geojson` gzipped: 1,008 kB transferred for 8,310 kB decoded, 217 ms |
| Cluster counts (B30) | Drawn on the live site; B30 affects only offline builds |
| Console on fresh loads | No errors. Two earlier 401 responses for an Esri item (`5e9b3685…`) did not reproduce on fresh loads |
| Legibility | Stores, clusters and the choropleth read clearly over all three styles (by eye) |

Issues found, fixed in the follow-up PR:
1. **Overlay colours:** the proximity ring and lines were too close to the selection outline for full-colour readers on both grey styles (table above). Proximity is now pink on dark grey and imagery, magenta on light grey.
2. **Opening view:** UK Food Access opened on the default world view (zoom 2, centred on 8° E, 30° N). It now fits the box around every mapped store (Channel Islands to Shetland, Northern Ireland to East Anglia) once per visit, instantly on first load and flying from another module. It does not move when filters change, or when the map is already at local scale.
3. **Header at about 800 px:** the brand ran into the Search button. The cause was the freshness pill: with two data families its label grew to about 330 px ("Trade 2026-10-23 · Stores and population 2026-10-24"). Below 1024 px the pill now shows compact dates ("Trade 23 Oct · Stores 24 Oct"; the full dates stay in its accessible name and tooltip), and the subtitle and the disabled 2D/3D toggle are hidden, as on phones. The subtitle also shortens instead of overflowing at any width.

## Not verified, and why

- **Light grey and imagery** were checked on the live site in one browser (Chromium in the desktop app's pane, about 800 px wide); see "Deployment and live checks". Other browsers and widths were not checked.
- **Basemap request usage (risk R8).** Each style switch requests a new style under the key. Only John's ArcGIS Location Platform dashboard shows the count.
- **Cluster counts offline.** Cluster labels need glyphs from `static.arcgis.com/fonts`. Offline builds (`VITE_ARCGIS_ASSETS=local` without network) draw clusters without numbers (B30); the live site shows them.
- **Hosted FeatureLayer (SM-01).** Tested with a mock service only: there is no public layer with this schema, and `config.json` lists none.
- **Firefox, Safari, real phones, screen readers:** as in Stage 3, only Chromium (with touch emulation for mobile) and axe.
- **Performance on real hardware:** clustering 19,183 points and switching filters were exercised only with software WebGL.

## Decisions and deviations

- **Local scale = zoom 12** for individual stores, council outlines and imagery: one rule, not three (ADR-0022).
- **Light grey is offered in every module;** imagery only in UK Food Access at local scale (later also Local Authority Profiles). An imagery choice waits in the URL while the map is zoomed out.
- **Rates ignore the retailer filter.** The fixed breaks are for store types, not single chains. The legend and panels say so.
- **The choropleth is drawn on the display boundaries** (BGC, coastline-clipped); counts come from the full-extent BFE assignment (ADR-0020).
- **Cards:** "per 10,000 residents" and "per km² of land" are labelled by denominator, with the measure and area in the detail line, because the full measure name did not fit the card.
- **Top bar:** a long module question (UK Food Access) overlapped the tools at 1600 px. The question now shortens with an ellipsis inside its column.
- **Kernel density** stays in Release 2 (SM-08).
- **Header below 1024 px (live-check fix):** the subtitle (SH-01) and the disabled 2D/3D toggle (SH-03, Release 2) are hidden, as they already were on phones, and the freshness pill shows compact dates. The page title still carries the subtitle.

## Open questions

1. **Merges:** done (PRs #6, #10 and #9). The live checks are recorded above.
2. **Basemap usage:** after a few style switches on the live site, could you read the basemap request count from your ArcGIS Location Platform dashboard? I will record it here.
3. **Proximity:** is a typed postcode for the proximity point worth adding (B31)? It needs a postcode lookup verified first.
