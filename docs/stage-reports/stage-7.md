# Stage 7 — Food Security Scenario Lab

| | |
|---|---|
| **Date** | 26 October 2026 |
| **Branch** | `stage/7-scenario-lab`, stacked on `data/stage-7-inputs` (PR #21) |
| **Brief** | John's Stage 7 brief (26 Oct 2026). His decisions the same day: UK-wide small areas with the data step first; straight-line distances only |
| **Requirements** | SC-01 – SC-05, SC-06 (new: save, compare, export, confidence, methodology); spec §6.5 for A (SC-A/E), B (SC-D), C (SC-C), D (SC-B) |
| **ADR** | ADR-0026 |

## What was built

**Module.** "Scenario Lab" in the left rail, lazy-loaded like the other modules (`src/features/scenarios/`). It has the four scenarios of the brief, labelled A–D as the brief does:

| | Scenario | Baseline (published) | What the user sets | Map |
|---|---|---|---|---|
| A | International supply disruption | HMRC recorded imports by partner and month (S01) | Commodity, recorded partner (default: the largest), start month and year (default: January of the latest complete year), reduction 0–100 %, duration 1–12 months, linear recovery 0–6 months, substitution 0–100 % (default 0 %, labelled a user assumption), net mass or value | Trade map. Connections on a fixed width scale; the disrupted partner's baseline dashed behind its narrower scenario line; partner fills show the scenario's shares |
| B | Supermarket closure | Every small area's three nearest supermarkets (`scenario` family, PR #21), Census population, IoD 2025 decile (England) | Any supermarket: click on the map, search by name, retailer or council, or a preset ("most relied-on" in Manchester or Belfast, computed from the data) | Supermarkets (clustered nationally), councils outlined with the closed store's council emphasised, the affected areas sized by residents and coloured by the extra distance, dashed straight links to the nearest supermarket before or after, rings on the stores that take over |
| C | Domestic production shock | Defra's published UK supply balance, latest year (S09, S10) | Basket with a balance, reduction 0–100 % | None (UK-wide figures; the legend says so) |
| D | Port disruption | DfT inward tonnage by port, 2025 (S23); UKFSR port-of-entry shares (S03) | Port (list or click on the map), capacity reduction 0–100 %, duration 1–12 months | Ports; the selected port's baseline as a dashed ring around its scenario circle |

**Every scenario** has the same parts:
- **Scenario cards** (one radio group, arrow keys).
- **Presets** for each scenario.
- **Sliders** for the settings.
- **A "Map shows" switch** between the scenario and the baseline (SC-03).
- **Four KPI cards** showing the scenario value, with the baseline in the detail line.
- **A results panel:**
  - a "Scenario-modelled" banner with an explanatory paragraph built from the figures;
  - a data-confidence rating with its reasons;
  - a results table: baseline, scenario, absolute and relative change, with provenance badges and each value's method on hover;
  - before-and-after charts with a table or description;
  - "Explain the model": source data, formula, geographic boundary, user assumptions, known limitations, what the outputs mean and do not mean.
- **Reset to baseline** (0 %, or no store) and **Restore defaults**.

**Save, compare, share, export (SC-05, SC-06):**
- Named scenarios are saved in the browser (parameters only; results recomputed from current data).
- Up to four can be compared with the current scenario, kind by kind, never ranked or combined.
- Every setting is in the URL, so a copied link reproduces the run; the link survives a reload.
- CSV and JSON exports carry baseline, scenario, change, provenance, sources, confidence and the link.

**Typed scenario model.** `ScenarioParams` (`src/state/scenarioParams.ts`) is a discriminated union, one member per kind. It is the controls, the URL, the saved scenario and the export.

**Formulas and models.**
- Formulas: `src/analysis/scenario.ts`, pure and unit-tested.
- View models (`Indicator`s, rows, headlines, confidence, map models): `src/features/scenarios/model.ts`.

**Map:**
- `OriginsLayersController` draws a ghost baseline line.
- `AccessLayersController` has a `scenario` mode.
- `RiskLogisticsController` draws a scenario port ring and also shows in the Scenario Lab.
- A new `ScenarioClosureController` (graphics layer, 280 ms fade, none under reduced motion).
- Framing: a closure fits its areas once per store; a supply disruption frames like Food Origins; the production shock frames the UK.
- Port and closure symbol specs are SDK-free (`portSymbols.ts`, `closureSymbols.ts`) and unit-tested.

**Performance:**
- The closure inputs (5.8 MB, 1.6 MB compressed) load only for B. Parsing and validating them takes about 80 ms in Node. A closure is then one pass over the areas, about 2 ms, because the pipeline precomputed each area's three nearest supermarkets (the brief's server-side preprocessing option), so no worker is needed.
- Loading shows progress ("1 of 2 files"); errors use the shared error states.
- The shell bundle grew by 2.4 kB.

## Figures checked independently

Each was recomputed by a script that uses no app code (03-DATA-SOURCES §11, Stage 7):

| Scenario | Shown | Independent |
|---|---|---|
| A: tomatoes, Spain, Jan–Mar 2025, −30 % | 6.8 kt affected, 6.7 %, 94.1 kt remaining, HHI 2,570 → 2,660, Spain 22.4 % → 16.8 % | 6,785.317 t; 6.7228 %; 94,143.866 t; 2,571.7 → 2,661.4; 22.4095 % → 16.8172 % |
| B: Morrisons Whalley Range Manchester closed | 26,730 residents in 17 areas, +0.8 km on average (up to 1.5 km), 2 supermarkets left within 2 km, Manchester residents > 2 km 0 → 4,560 | 26,731; 17; 822 m; 1,491 m; 2; 0 → 4,563 (brute force over all 6,987 supermarkets) |
| C: wheat 2025, −15 % | 1.8 Mt removed, 12.4 % of supply, share 82.9 % → 80.5 % | 1,793.7 kt; 12.43 %; 80.47 % |
| D: Dover, −50 % for one month | 521.4 kt, 2.6 % of UK major-port inwards; food share not attributable | 12,512.825 kt a year → 521.368 kt; 2.634 %; UKFSR's group includes the Channel Tunnel |

## Commands run and results

| Command | Result |
|---|---|
| `npm run typecheck`, `npm run lint`, `npm run format`, `npm run check:banned` | Pass |
| `npm test` | 43 files, 604 tests pass (517 before). The 87 new tests: 30 in `analysis/scenario.test.ts`; 17 model, 7 saved-scenario and 6 component tests in `features/scenarios/`; 22 URL and scenario-parameter tests; 3 symbol tests; 2 framing tests |
| `VITE_ARCGIS_ASSETS=local npm run build` | Pass; shell `index` 479.0 kB (476.6 kB before) |
| `npx playwright test tests/e2e/scenarios.spec.ts` | 3 passed: A (preset, map layers, baseline/scenario switch, reset, reload keeps the URL), B (preset, 17 areas drawn, hover and click a supermarket on the map to close it), C and D (port, save, production preset, compare, CSV download); axe (no serious or critical violations) and the wording audit in each |
| `npm run build:e2e-basemap` and `npm run e2e` (all specs) | Running when this report was first committed; result added below |
| `cd pipeline && uv run pytest` | 318 passed, 1 skipped (data step) |

**Wording audit (P9, SC-04).** The component and E2E tests check that "shortage" appears only negated ("not a forecast, and not a shortage"), and that "forecast shortage" never appears.

## Not verified, and why

- **Live checks with a real GPU and the Esri basemap**, as for Stages 5 and 6 (B48). The sandbox has neither: SwiftShader and the offline outline map. Still to check live:
  - the ghost line and its contrast on light grey and imagery;
  - the closure symbols over imagery at local scale;
  - the 280 ms fade.
- **The clipboard** ("Copy link") is not exercised in E2E (headless clipboard permissions). It falls back to showing the link.
- **Mobile layout** of the Scenario Lab is covered only by the shared responsive rules. The comparison table scrolls sideways in the narrow insights panel.
- **Retailer concentration** is by store count, not floor space or sales: GEOLYTIX gives size bands, not areas.

## Open questions

- Would John like several closures at once (a retailer leaving a town)? This needs more neighbours per area or a browser-side search (B56).
- SC-B's Short Straits by food group (Release 2, B57): UKFSR publishes Dover with the Channel Tunnel, so it cannot be a port scenario.
