# Pre-Stage 5 data step: small areas for the Belfast and Manchester profiles

- **Date:** 24 October 2026
- **Branch:** `data/stage-5-inputs`, from `main` at `0417872` (Stage 4 merged)
- **Brief (John):** "all done, can you do any checks and then we will proceed to stage 5". John's choices on 24 Oct 2026:
  - **NI deprivation:** "Its own 2011 areas". NIMDM 2017 is shown on its Super Output Areas and never reallocated to Data Zones.
  - **PPFI for Belfast:** "Say it's not available". If PPFI v2.1 has no Northern Ireland rows, Belfast uses Northern Ireland's own measures, with no v1 reference.
  - **Coverage:** "Belfast and Manchester". Small areas are published for the two deep profiles only.
  - **Manual downloads:** "I can download the NI deprivation data separately", and yes to downloading the PPFI file if needed.
- **Scope:** gates G8–G11 (roadmap §2) and the small-area inputs for LP-04, LP-06 and FA-01–FA-03. **Stage 5 itself is not started:** there are no app changes. The build writes its outputs to a folder of your choice; they enter `public/data/` and the data index in Stage 5.

## Gates

| Gate | Status | Evidence |
|---|---|---|
| G8 PPFI v2.1 NI coverage and columns | 🟡 Columns ✅; the data file is still to come from John | The column names come from the HASP data dictionary, which John provided on 25 Oct. The v2.1 user guide says Northern Ireland is included on its 2011 SOAs, ranked within each country, with several indicators unavailable there. The HASP record says "Great Britain". HASP downloads need a free account. |
| G9 NISRA Data Zones: CRS, licence, centroids, lookup | ✅ | Irish Grid TM65 (EPSG:29902) from the `.prj`. Licensed under the OGL with an OSNI notice. Population-weighted centroids are published. NISRA has no DZ↔SOA lookup, and none is needed (John's decision). |
| G10 Census car availability | ✅ | E&W: TS045, households by LSOA. NI: NISRA table builder, `HOUSEHOLD` × `DZ21` × `HH_CAR_VAN_TC5` (all 3,780 Data Zones pass its confidentiality check). John downloaded it on 25 Oct, because the builder disallows automated access. |
| G11 LSOA 2021 boundaries and centroids | ✅ | Services `Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5` and `LSOA_PopCentroids_EW_2021_V4`, plus the lookup `LSOA21_WD25_LAD25_EW_LU_v2`. Fields were verified in the responses. |

## Inputs

All inputs were downloaded by `fetch-reference` on GitHub Actions (run 40137753934, 24 Oct 2026, every item first time). They are committed byte for byte with URL, retrieval time, size and SHA-256 in each folder's `index.json`.

| Input | Source | Where | Size |
|---|---|---|---|
| LSOA → Ward → LAD lookup, Manchester (295 LSOAs) | S15 | `pipeline/raw/ons/2026-10-24/` | 67 kB |
| LSOA BGC V5 boundaries, box around Manchester (714 LSOAs, 8 pages, count checked) | S15 | same | 1.0 MB |
| LSOA population-weighted centroids V4, same box (651) | S15 | same | 139 kB |
| Census 2021 TS001 usual residents (Nomis bulk zip) | S18 | `pipeline/raw/nomis/2026-10-24/` | 1.9 MB |
| Census 2021 TS045 car or van availability (Nomis bulk zip) | S20 | same | 2.7 MB |
| IoD 2025 File 7 (33,755 LSOAs) | S19 | `pipeline/raw/mhclg/2026-10-24/` | 9.9 MB |
| Data Zone 2021 boundaries (shapefile, 3,780) | S16 | `pipeline/raw/nisra/2026-10-24/` | 14.8 MB |
| Data Zone population-weighted centroids (CSV zip) | S16 | same | 57 kB |
| Census 2021 MS-A01 usual residents (Data Zones, councils) | S18 | same | 479 kB |
| SOA 2011 boundaries (shapefile, 890) | S19 | same | 17.8 MB |
| NIMDM 2017 SOA results (.xls) | S19 | same | 1.8 MB |
| Households by car or van availability, Data Zones (CSV, 22,680 rows) and councils (.xlsx), from NISRA's table builder (John) | S20 | `pipeline/raw/nisra-provided/census2021-car-van-2026-10-25/` | 1.3 MB |
| PPFI v2.1 data dictionary (HASP record 1.0.24; John) | S13 | `pipeline/raw/hasp-provided/ppfi-v2.1-lsoa-1.0.24/` | 4 kB |

Raw data in the repository grows by about 48 MB, to roughly 99 MB.

## What was built

- **Fetch step.** `fetch-reference` runs `fetch-ons` plus three new registries, one module per publisher: `nomis_census.py`, `mhclg_iod.py` and `nisra_files.py`. ONS gains the three Manchester queries; for the boxed ones, the count query uses the same filter as the pages.
  - The shared fetch now checks that `.zip`, `.xls` and `.csv` responses are what they claim to be; a blocked download usually returns an HTML page instead.
  - If any item fails, the fetch removes the files from that run, so a publisher's folder is either complete or unchanged.
  - The workflow commits what downloaded even when another publisher failed, and then fails the job.
- **Readers** (`sources/small_areas.py`). Each reader checks the field names, header rows and CRS verified above, and refuses anything else.
- **Build** (`build-areas --snapshot 2026-10-24 [--out <dir>]`, `areas.py`). It writes the `areas` family, each file with a provenance sidecar:
  - **`small-areas.geojson`** (1.1 MB, 1,204 features), WGS84 with 6 decimals:
    - Manchester's 295 LSOAs, BGC simplified as a coverage at 5 m;
    - Belfast's 735 Data Zones and 174 SOAs (2011), simplified at 10 m in the Irish Grid after cleaning.
  - **`small-area-indicators.json`** (215 kB). For each small area: Census 2021 usual residents, households, households with no car or van, and the population-weighted centroid. Deprivation is ranked within its own nation:
    - IoD 2025 rank and published decile for Manchester's LSOAs;
    - NIMDM 2017 rank, domain ranks and the 2015 urban/rural class for Belfast's SOAs. NISRA publishes ranks only, so the decile is derived at 89 SOAs per decile and labelled as derived.

    The council's missing fields are listed with their reasons.
  - **`pipeline/reports/areas-qa-2026-10-24.json`**: every check below.
- **Schemas** `small-areas` and `small-area-indicators`, with generated types. `display_geometry` takes the CRS, tolerance and island rule as parameters, and can clean a coverage whose edges do not quite match. The council build is unchanged: its rebuild test still passes byte for byte.
- **New dependency:** `xlrd==2.0.1`, released December 2020, to read NIMDM 2017. NISRA publishes it only as `.xls`, which openpyxl cannot read.

## Checks and figures

| Check | Result |
|---|---|
| Manchester LSOAs (lookup = boundaries = centroids = TS001 = TS045 = IoD) | 295 in every source |
| Census totals, Manchester: small areas vs council table | Population 551,919 vs 551,938; households 214,712 vs 214,732; no car 83,777 vs 83,770. Both offices perturb counts for confidentiality. Values are used as published and the differences reported. |
| Census totals, Belfast | Population: Data Zones 345,423 vs MS-A01 council 345,418. Households with no car or van: Data Zones 50,595 of 149,193 vs council table 50,594 of 149,207 |
| Northern Ireland households | Data Zones 768,805 vs councils 768,810 |
| IoD 2025 deciles, Manchester's LSOAs | 120 in decile 1 (most deprived 10 % in England); 5 in decile 10 |
| LSOA centroids in their LSOA | 293 inside; 2 on or 1.6 m outside the 20 m generalised boundary |
| Data Zone centroids in their Data Zone (Irish Grid) | 3,780 of 3,780. This confirms the CSV's undeclared grid. |
| Data Zone coverage | 36 of Belfast's Data Zones do not quite match their neighbours: overlaps of 0.01 m² and hairline gaps. Cleaning moved 1.1 m². |
| NIMDM 2017 | 890 SOAs ranked 1–890, matching the SOA boundaries' codes. Belfast has 174 (decile 1: 47; decile 10: 33). |
| SOAs vs Data Zones, Belfast | 141.3 km² against 137.7 km², with 13.3 km² differing. The SOAs predate the 2015 council boundaries, and the profile must say so. |
| Irish Grid → WGS84 | PROJ "Irish Grid + TM65 to WGS 84 (2)", about 1 m |
| Hand-checked sample (Stage 5 exit criterion) | 5 LSOAs (population, households, no car, IoD rank and decile), 5 Data Zones (population) and 5 SOAs (NIMDM rank and derived decile). Each was read straight from the raw files with the standard library and matches the build. |

## Commands run and results (sandbox, 24 Oct 2026)

| Command | Result |
|---|---|
| GitHub Actions `refresh-reference-data.yml` (push to `data/stage-5-inputs`) | Run 40137753934: success, 11 new items in four folders |
| `uv run foodscope-pipeline build-areas --snapshot 2026-10-24 --out <scratch>` | 4 s, 5 files |
| `cd pipeline && uv run pytest` | **137 passed**: 116 earlier, plus 8 for the fetch registries and checks and 21 for the areas build: rebuild determinism, figures, samples (now including Belfast households and no-car counts), readers, deciles and cleaning (25 Oct) |
| `npm run gen:types`; `npm run typecheck`; `npx vitest run` | Types generated for the two schemas; 0 type errors; 361 tests passed (no app changes) |

## Not verified, and why

- **PPFI v2.1 data (G8):** waiting for the data file. John has provided the data dictionary, so the column names are verified. Whether Northern Ireland's rows are in the LSOA file is still unchecked: the user guide says yes, the HASP record says "Great Britain". HASP needs an account, so the file cannot be scripted.
- **Northern Ireland grocers not in GEOLYTIX:** in NI the file has only ten retailers (S11). No other NI symbol group or independent grocer is in it. Whether to add them from another source is John's call, and it would be a separately labelled layer so the per-10,000 comparisons stay like for like.
- **Urban/rural class for every council (LP-02):** not sourced yet. E&W has ONS RUC 2021, NI has NISRA's settlement classification, and Scotland has its own scheme. Stage 5 decides whether the basic profiles show it, or say it is not available, for each nation.
- **SOA 2011 boundary licence:** NISRA's publication page states no licence. The OpenDataNI record lists the OGL v3.0. NISRA's copyright page puts its material under the OGL, but OSNI mapping is exempt unless a publication says otherwise.
- **TM65 or TM75:** NISRA's `.prj` names the TM65 datum (EPSG:29902). OSNI products often use TM75. In this area the two give positions within about a metre of each other, inside the display and distance precision; recorded, not resolved.
- **The outputs are not in the app yet.** Stage 5 publishes them as a new family (`areas`, its own date per ADR-0021) and wires the profiles.

## Waiting on John

1. ~~The NISRA table-builder CSV~~: received 25 Oct and built in.
2. The PPFI v2.1 LSOA **data** file from Leeds HASP (dataset 5276). The data dictionary arrived on 25 Oct.
3. Merging this pull request. Stage 5 starts from `main` after it.
