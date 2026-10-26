# Pre-Stage 7 data — Scenario Lab closure inputs

| | |
|---|---|
| **Date** | 26 October 2026 |
| **Branch** | `data/stage-7-inputs` |
| **Why** | John's Stage 7 brief (Food Security Scenario Lab) asks the supermarket-closure scenario for the neighbourhoods whose nearest mapped supermarket would change and the population potentially affected, with stores just beyond a council boundary taken into account. Small areas were published for only two councils (the deep profiles). John chose to cover every small area of the UK, with the data fetched and verified first in its own pull request, and straight-line distances only (26 Oct 2026). |
| **Sources** | S15 ONS LSOA population-weighted centroids (every LSOA, new) and lookup (cached, Stage 6); S17 Scottish Government Data Zone Centroids 2022 with Census 2022 population (new); S32 Scotland's 2022 Data Zone lookup (cached, now used); S16 NISRA Data Zones 2021 and centroids (cached); S18 Census 2021 TS001 and MS-A01 (cached); S19 IoD 2025 (cached); S11 GEOLYTIX supermarkets (published local family). |

## What was built

- **Fetch.** `fetch-reference --set stage7` (`sources/stage7_files.py`) on GitHub Actions through `refresh-reference-data.yml` (run 40312453094, push of 651b78b). The workflow committed the raw files with checksums as e2163ec:
  - `pipeline/raw/ons/2026-10-26/`: every LSOA (December 2021) population-weighted centroid, 36 pages of 1,000 plus the count query (35,672), EPSG:27700;
  - `pipeline/raw/scotgov/2026-10-26/SG_DataZoneCent_2022.zip` (326,108 bytes), the record's shapefile download.
- **Build** (`build-scenario`, `foodscope_pipeline/scenario.py`; schema `schemas/scenario-closure.schema.json`, types generated). It writes the `scenario` family in snapshot 2026-10-26, each file with a provenance sidecar, and a QA report `pipeline/reports/scenario-qa-2026-10-26.json`:
  - `closure-gb.json` (5.4 MB; 1.47 MB gzipped): 43,064 small areas of Great Britain (33,755 English and 1,917 Welsh LSOAs, 7,392 Scottish Data Zones) and 6,987 supermarkets;
  - `closure-ni.json` (0.40 MB; 0.11 MB gzipped): 3,780 Data Zones and 186 supermarkets.
- **What each file holds** (columnar arrays):
  - per small area: code, name, council, WGS84 point, national-grid point, Census population, England's IoD 2025 decile (null elsewhere), and the three nearest supermarkets with their straight-line distances in metres;
  - per supermarket: GEOLYTIX id, name, retailer, format, size band, council, WGS84 and national-grid points.
- **Representative points** are population-weighted centroids: ONS (England and Wales), the Scottish Government (Scotland) and NISRA (Northern Ireland).
- **Councils:** LSOAs from the LSOA → council (May 2025) lookup; Scottish Data Zones from the 2022 lookup's `LA_Code`; NI Data Zones from `LGD2014_cd` on their boundaries.
- **Supermarkets** are the published local family's stores of class `supermarket` (280 m² and over, D5) in a UK council. The 22 Crown Dependency supermarkets are left out.
- **Nearest supermarkets** are found among every supermarket of the area's part of the UK: Great Britain in British National Grid, Northern Ireland in Irish Transverse Mercator. So stores beyond a council boundary count (3,096 GB areas and 231 NI areas have their nearest supermarket in another council), and no distance crosses the Irish Sea. The search measures every pair, so it is exact; equal distances are ordered by store index.
- **Nothing in the files is a scenario result.** Closing a store, the change in distance, the population affected and the concentration changes are computed in the app (Stage 7 module) from these baseline values. Each area's three nearest give the new nearest exactly for any single closure, without a spatial search in the browser.

## Commands run and results

| Command | Result |
|---|---|
| Push of 651b78b → run 40312453094 (`SET: stage7`, `SNAPSHOT: 2026-10-26`) | success; raw files committed by the workflow (e2163ec) |
| `uv run foodscope-pipeline build-scenario --snapshot 2026-10-26 --raw-snapshot 2026-10-26 --stage6-snapshot 2026-10-25 --reference-snapshot 2026-10-24 --local-snapshot 2026-10-24` | `closure-gb.json`: 43,064 areas, 6,987 supermarkets; `closure-ni.json`: 3,780 areas, 186 supermarkets; 5 files written (about 10 s) |
| `uv run foodscope-pipeline publish` | Manifest 40 datasets, 28 catalogue entries (S17 added); `scenario` family 2026-10-26 |
| `uv run pytest` (pipeline) | 319 collected: 318 passed, 1 skipped (as before); 15 new in `tests/test_scenario_build.py` |
| `npm run gen:types`, `npm run typecheck`, `npm run lint`, `npm run format`, `npm test` | `ScenarioClosure` type generated; all pass; 517 app tests pass |

## Checks (in the build, the tests and the QA report)

- **Every small area once.** 33,755 + 1,917 + 7,392 + 3,780 = 46,844, matching the verified counts per nation. The centroids, the lookup and the populations cover exactly the same LSOAs (35,672, equal to the count query); likewise the same Data Zones in each nation. Every area's council is one of the 361 councils of the local family and in the area's own nation, and every council has small areas.
- **Population against the published totals** (cell-key perturbation means small areas need not add up exactly; the build stops beyond 0.01 %):

  | Nation | Small areas | Published | Difference |
  |---|---|---|---|
  | England (Census 2021) | 56,490,056 | 56,490,048 (TS001 country table) | +8 |
  | Wales (Census 2021) | 3,107,545 | 3,107,494 (TS001 country table) | +51 |
  | Northern Ireland (Census 2021) | 1,903,168 | 1,903,175 (MS-A01, sheet `NI`) | −7 |
  | Scotland (**Census 2022**) | 5,439,565 | 5,436,600 (NRS rounded first result) | +2,965 (0.05 %), not a build check; the record says Data Zone sums "may not match published totals" |

- **Deprivation:** all 33,755 English LSOAs carry their IoD 2025 decile; no other area has one.
- **Nearest supermarkets, independently:**
  - Recomputed from the published grid coordinates for every 97th area of both files: same stores, distances within the metre of rounding, sorted.
  - Against geodesic distances on WGS84 for 3,000 random areas: within 10.5 m, and within 0.12 % beyond 1 km, which is the British National Grid's scale factor.
  - `nearest_k` against brute force on synthetic points, including ties, a store on the centroid, fewer stores than three, and no stores.
- **Distances:** median nearest supermarket 889 m in Great Britain and 1,463 m in Northern Ireland. 12.1 million people in Great Britain and 0.84 million in Northern Ireland live in areas more than 2 km from one. The longest is 88.8 km: Mull, Iona, Coll and Tiree – 01 to Oban, across the sea (B55).
- **Coverage of the stores:** 6,525 of Great Britain's 6,987 supermarkets and 175 of Northern Ireland's 186 are the nearest for at least one area. The others are never an area's nearest, so closing one changes no area's nearest supermarket.
- **Rebuild:** the build in the tests reproduces the committed files byte for byte. A Scottish lookup missing a Data Zone stops the build.
- **Names:** one Scottish Data Zone's name has a trailing non-breaking space in the centroid file; the lookup's name is used, and the difference is reported.

## Not verified, and why

- **Republic of Ireland supermarkets** are not in GEOLYTIX's UK file, so distances for Northern Ireland's border areas may overstate (B54).
- **Straight-line distances** ignore roads, ferries and terrain. Island and estuary areas are the clearest case (B55). Routed travel time is Release 3 (John's decision for this stage).
- **Deprivation outside England** is not attached (B53):
  - WIMD 2025 has no verified file URL;
  - Scotland's SIMD is on 2011 Data Zones, not 2022;
  - NIMDM 2017 is on SOAs 2011.
- **The coordinate transformation** from WGS84 to British National Grid is PROJ's Helmert, as in Stages 4–5, not OSTN15: a few metres. That is well within the precision of a population-weighted point, but distances are not survey-grade.
- **Scotland's population** is from Census 2022, a year after the other nations' Census 2021. The app must say so wherever it adds populations across nations.

## Open questions

- None blocking the module. B54 (Republic of Ireland stores) is for John to decide on if cross-border access matters for the demonstration.
