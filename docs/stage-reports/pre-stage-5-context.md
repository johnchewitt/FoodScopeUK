# Pre-Stage 5 context data — urban/rural class, car availability by council, Defra production

| | |
|---|---|
| **Date** | 25 October 2026 |
| **Branch** | `data/stage-5-context` |
| **Why** | John's Stage 5 brief asks for urban/rural context and domestic production context in the council profiles. Neither had verified data. John chose to fetch them before building (25 Oct 2026). |
| **Sources** | S21 (ONS 2021 Rural Urban Classification), S09 (Defra Horticulture statistics 2025), S10 (Defra Agriculture in the UK 2025, chapter 7), S20 (Census 2021 car availability, already cached) |

## What was built

- **Fetch.** `fetch-reference` gained `--set context`: the ONS urban/rural tables for councils (`LAD24_RUC21_EW_LU`) and LSOAs (`LSOA21_RUC21_EW_LU`), and the two Defra .ods datasets. The workflow fetched them into snapshot 2026-10-25. The Stage 5 files from PR #12 stay in snapshot 2026-10-24 and were not downloaded again.
- **Reading .ods.** `pipeline/foodscope_pipeline/sources/ods.py` reads OpenDocument spreadsheets with the Python standard library (`zipfile`, `xml.etree`), so no new dependency.
- **Readers.** `sources/ruc21.py` (class codes checked against the eight council and six LSOA classes) and, in `sources/defra_stats.py`, `read_horticulture_supply` and `read_auk_table` (rows found by their labels, never by position; `[x]` read as not available).
- **Build.** `build-context` writes the `context` family. It isn't published yet: Stage 5 publishes it with the app changes, as with `areas` and `register`.
  - `council-context.json`: for all 361 May 2025 councils, the urban/rural class (England and Wales) and Census 2021 households with no car or van (England, Wales, Northern Ireland).
    - Scotland has neither. The Scottish Government classification is published for Data Zones, and Scotland's census was in 2022.
    - Northern Ireland has no council-level urban/rural class (NISRA's latest edition is 2015 and is per settlement). Each gap is stored as `null` with its reason, never filled in.
  - `uk-production.json`: Defra's 2025 supply balance for tomatoes, strawberries, potatoes and wheat, as published, and the share series for the last 10 years. Bananas show "Defra publishes no UK production statistics for bananas".
- **Boundary changes, handled explicitly.**
  - The four councils formed in April 2023 (Cumberland, Westmorland and Furness, North Yorkshire, Somerset) carry the sums of the Census 2021 councils they replaced. Their names are listed in the data.
  - Barnsley and Sheffield got new codes after a small 2025 boundary change. They keep their 2024 urban/rural class and Census figures, with a note naming the earlier code.

## Commands run and results

| Command | Result |
|---|---|
| `git push` of `data/stage-5-context` → workflow run 40190433555 | Success; 39 ONS files (count + pages) and 2 Defra files committed by the workflow |
| `uv run pytest` (pipeline) | 158 passed |
| `uv run foodscope-pipeline build-context --snapshot 2026-10-25 --reference-snapshot 2026-10-24 --local-snapshot 2026-10-24 --out <scratch>` | 361 councils, 5 commodities; QA report `pipeline/reports/context-qa-2026-10-25.json` |
| `npm run gen:types`, `npm run typecheck`, `npm run format` | Types generated for the two new schemas; typecheck and format pass |

## Checks (in the tests and the QA report)

- **Urban/rural:** 318 council rows and 35,672 LSOA rows, all codes unique. Every England and Wales council has a class. Manchester is `UUN` ("Urban: Majority nearer to a major town or city").
- **Car availability:**
  - Census 2021 households in England and Wales are 24,783,193 both before and after mapping the 331 Census councils to the 318 councils of 2025.
  - Manchester matches the TS045 row: 214,732 households, 83,770 with no car or van.
  - Belfast matches the NISRA council table: 149,207 and 50,594.
  - Cumberland equals Allerdale + Carlisle + Copeland.
- **Defra:**
  - Total supply = production + imports − exports, and share = production ÷ supply. Both are exact for the four baskets in 2025.
  - 2025 values: wheat (provisional) 11,958 thousand tonnes produced, 82.9 % of total new supply; potatoes (provisional) 71.1 %; tomatoes 16.9 %; strawberries 56.5 %.
- **Determinism:** two builds give byte-identical files, and the committed QA report matches.

## Not verified, and why

- **Scotland:** urban/rural class and car availability (Census 2022) were not fetched. They are Release 2 data, and the gap is shown as not available.
- **Northern Ireland, council-level urban/rural:** NISRA publishes none. Belfast's small areas use NISRA's 2015 class from the NIMDM file in Stage 5.
- **The app doesn't read the new family yet.** It is published and shown in Stage 5. The Seasonal Supply text that calls S09/S10 "not yet verified" is updated there (monthly UK production is still not published).
- **Defra's import figures differ from the Food Origins basket.** They use their own product definitions (fresh produce where distinguishable). The profile will show them as Defra publishes them and say they are not the Food Origins figure. They are never compared with HMRC monthly trade.

## Open questions

None for John.
