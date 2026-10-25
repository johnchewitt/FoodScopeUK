# Pre-Stage 6 data — Risk Explorer inputs

| | |
|---|---|
| **Date** | 25 October 2026 |
| **Branch** | `data/stage-6-inputs` |
| **Why** | John's Stage 6 brief (UK Food Resilience — Risk Explorer) needs country water stress, ports, road corridors, farming regions and the Priority Places index for every council. None of these were verified. John chose to fetch and verify the data first, in its own pull request; FAO water stress as the only country climate/water indicator; the index summarised for every council (25 Oct 2026). |
| **Sources** | S30 FAO water stress (World Bank API), S23 DfT port freight 2025, S36 EMODnet port locations, S03 UKFSR 2024 theme 3, S31 Defra June survey 2025, S33 ONS ITL1, S35 OS Open Roads, S13 Priority Places index with S15 (ONS LSOA lookup), S32 (Scottish 2011 Data Zone lookup) and S19 (NIMDM 2017). S34 OSNI transport could not be fetched. |

## What was built

- **Fetch.** `fetch-reference --set stage6` (`sources/stage6_files.py`) and `fetch-open-roads` (`sources/os_open_roads.py`) run on GitHub Actions through `refresh-reference-data.yml` on push to this branch. The workflow commits the raw files with checksums into snapshot 2026-10-25. Earlier sets in the same folders were not downloaded again.
  - Failures are printed as job annotations, because the job logs cannot be downloaded from here; the annotations are read through the API.
  - The OS Open Roads GeoPackage (1.0 GB) is too large to commit. The job downloads it to a temporary folder, checks its size and MD5, records its schema and commits only the extract (2 MB).
- **Second fetch run** after reading the first:
  - The Priority Places index codes Scotland as **2011** Data Zones (`S01006506`–`S01013481`), not the 2022 ones its HASP record lists. The 2022 lookup cannot assign them, so the 2011 lookup was added.
  - DfT's port list has no map location for 26 of its 53 statistical ports, among them Dover, Felixstowe and Belfast. EMODnet's port locations, keyed by the same UN/LOCODEs, were added.
- **Readers** (`sources/risk_inputs.py`). Each checks the header or structure it relies on and stops on any difference:
  - World Bank JSON, with aggregates excluded;
  - DfT PORT0499, PORT0304 and the port list;
  - EMODnet GeoJSON;
  - UKFSR sheets 3_2_2a, 3_2_2b and 3_2_1a;
  - Defra regional and country sheets;
  - the Scottish lookup (Windows-1252).
- **Build** (`build-risk`, `risk.py`; settings in `config/risk.json`). It writes the `risk` family, published in this pull request so the module can be reviewed on the real files. Each dataset has a provenance sidecar and a schema in `schemas/`; types are generated.
  - `water-stress.json`: 178 countries with their latest value, FAO class and series from 2000; 39 economies without a value are listed by name.
  - `ports.json`: the 51 major ports with 2025 data, 2015–2025. For each port: inwards by region of loading and by cargo group, agricultural products (category 23) inwards by region, outwards, and a location with its source.
  - `port-entry.json`: UKFSR port-of-entry shares (2022, 2023), the Short Straits share by food group, and the delay on England's Strategic Road Network, as published.
  - `roads.geojson`: 792 road corridors in Great Britain, 274 strategic and 518 primary.
  - `farming.json` and `farming-regions.geojson`: 2025 wheat area, cattle, sheep, pigs and poultry for 8 English regions and 3 countries, with outlines from ITL1.
  - `council-ppfi.json`: for all 361 councils, small areas in the nation's deciles 1–2 for the combined index and each domain, and the decile counts.
- **Nothing is scored or combined.** Shares, HHI, exposure and within-nation ranks are computed in the app from these values.

## Commands run and results

| Command | Result |
|---|---|
| Push → workflow run 40231289609 (first fetch) | World Bank, DfT, Defra, Scottish Government, ONS (ITL1, 36 lookup pages), OS probe cached; OSNI failed ("Remote end closed connection without response") |
| Push → run 40231643879 (after adding the Open Roads step) | Open Roads extract committed (3,961,077 links read, 115,947 kept, 792 roads); OSNI failed again |
| Push → run 40233240906 (2011 lookup, EMODnet) | Both cached; OSNI failed a second time (the job fails on any publisher failure, after committing what downloaded) |
| `uv run foodscope-pipeline build-risk --snapshot 2026-10-25 --reference-snapshot 2026-10-24 --local-snapshot 2026-10-24` | 178 countries, 51 ports, 361 councils; 7 datasets + 7 sidecars; QA report `pipeline/reports/risk-qa-2026-10-25.json` |
| `uv run foodscope-pipeline publish` | Manifest: 25 datasets, 24 catalogue entries; `risk` family 2026-10-25 |
| `uv run pytest` (pipeline) | 191 passed (21 new in `tests/test_risk_build.py`) |
| `npm run gen:types`, `npm run typecheck`, `npm run format`, `npm test` | Types for the 7 new schemas; typecheck and format pass; 413 app tests pass |

## Checks (in the tests and the QA report)

- **Water stress.** Values equal the raw API rows: Netherlands 16.659 % in 2022 (no stress), Spain 43.254 % (low), Egypt above 100 % (critical). Israel's and West Bank and Gaza's latest year is 2021. No aggregate appears. Every economy is listed once.
  - FAO classes on the boundaries: 25 % is low, 100 % is high, and anything above 100 % is critical.
  - Countries per class: 117 none, 23 low, 15 medium, 6 high, 17 critical.
- **Ports.**
  - PORT0499's 2025 totals equal PORT0304's for all 33 ports over 2 million tonnes.
  - Dover, Felixstowe, Belfast, Liverpool, London and Holyhead are summed again in the test from the raw rows.
  - Dover's inward freight is over 95 % roll-on/roll-off, with no agricultural dry bulk. This is why food-specific port dependence comes only from UKFSR.
  - 27 ports are located by DfT and 24 by EMODnet. Where both locate a port, the two points agree within 3 km, except for multi-site estuary ports (Forth 18 km, Rivers Hull & Humber 12 km, Tees & Hartlepool 9 km).
- **Port of entry.** Each year sums to 100 % ± 0.01. Dover/Folkestone/Eurotunnel is 18.09 % (2022) and 17.89 % (2023). The SRN year-ending series keeps its 11 empty months as gaps.
- **Farming regions.** For each measure, the regions add up to the England row. For wheat, sheep, pigs and poultry they also equal England in the UK table.
  - Cattle differ by design: 4,660,871 head on commercial holdings against 4,911,311 on all holdings. This is stated in the dataset.
  - The UK table labels cattle, sheep and pigs "thousand head", but the values are head counts; this is recorded.
  - The outlines are a valid coverage after simplification.
- **Priority Places by council.** All 43,538 small areas are assigned to a council in their own nation: England 33,755, Wales 1,917, Scotland 6,976, Northern Ireland 890.
  - Each nation has 20.0 % of its areas in deciles 1–2.
  - Glasgow City's 746 Data Zones match the Scottish lookup. Manchester has 295 LSOAs and Belfast 174 SOAs, none of them in NI's decile 1 (as in Stage 5).
  - Northern Ireland's three domains without data are null.
- **Determinism.** Two builds give byte-identical files; the published files and the committed QA report match a fresh build.

## Not verified, and why

- **Northern Ireland roads (S34).** OSNI's only open service closed the connection to GitHub's runners in all three runs. The sandbox cannot reach it either. The roads layer is Great Britain only, and the app will say so. To retry before Release 1 sign-off.
- **Rail freight routes and distribution centres.** No open, official mapped dataset was found: ORR publishes national freight statistics, not routes; there is no public register of distribution centres. They will be shown as not available, never inferred.
- **UKFSR 3_2_3a** (agri-food import volume, EU and non-EU). Its unit is unclear (the title says "MT", the values are not million tonnes), so it was left out.
- **HMRC port-level trade (S28).** Not used; still open (gate G13, HMRC part).
- **Port locations are rough.** DfT calls its points "rough location for mapping purposes". EMODnet's come mostly from Eurostat GISCO (2013) or UN/LOCODE. Symbols mark the statistical port, not a terminal.

## Open questions

None for John. The roadmap was renumbered as he decided: 6 Risk Explorer, 7 Scenario Lab, 8 Consulting Insights, 9 Hardening and Release 1.
