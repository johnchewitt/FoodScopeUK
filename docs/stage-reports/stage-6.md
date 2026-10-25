# Stage 6 report — UK Food Resilience: Risk Explorer

| | |
|---|---|
| **Branch** | `stage/6-risk-explorer` (PR #16), on top of `data/stage-6-inputs` (PR #15, the Stage 6 data step; merge it first) |
| **Date** | 25 October 2026 |
| **Scope** | John's Stage 6 brief and decisions (25 Oct 2026); roadmap §8; spec §5.6 RK-01 – RK-04 and RK-06 – RK-08. RK-05 (user weights and sensitivity) is deferred to Release 2. Stage 7 not started. |
| **Data** | Each family from its newest snapshot (ADR-0021): trade **2026-10-23** (HMRC, five baskets); risk and context **2026-10-25**; local **2026-10-24** (council boundaries). No new downloads in this stage: the `risk` family was fetched on GitHub Actions and built offline in the data step. |
| **Result** | All checks pass in the sandbox (below). The figures shown match independent computations from the raw files. Not yet done: CI on the pull request, review, merge, and the live checks with a real GPU and the Esri basemap. |

## What was built

A new module, **UK Food Resilience — Risk Explorer** ("Risks" in the rail), with three views on the one map (`rv` in the URL). Each view has its own controls, KPI cards, linked charts, legend, tooltip and "Explain this risk". No score combines them (P10, RK-06).

| Requirement | Built |
|---|---|
| **RK-01** three views | One radio group: International supply · Logistics · Community access. Switching view keeps the map; the other views' layers are hidden, and hovers are cleared. History gets one entry per view change. |
| **RK-02** international supply exposure | Uses the Food Origins selection (commodity, period, measure, partner) and the trade map. **Cards:** recorded imports, partners, top supplier (with top three), HHI, share from partners in high or critical water stress, and data availability (share allocated to a partner country; provisional months). **Charts and tables:** concentration ranking of the five baskets (click a bar to switch commodity); monthly HHI heatmap (fixed classes of 1,000, provisional months dashed, empty months as gaps); estimated exposure to one partner, month by month, with a 50 % line, the period share, the largest month and the months at or above half; recorded imports by partners' water-stress class with the largest partners' values; import trend by year (partial years marked); commodity–country matrix (each basket's top five partners); Defra's UK production share (national context, annual, never combined with monthly figures); data notes (country of dispatch, provisional months, series breaks, commodity-code changes). **Map:** a "Map colour" switch between share of imports and partners' water stress (FAO classes on the risk ramp; no value hatched, never shown as low). |
| **RK-03** food logistics and infrastructure | **Cards:** the major ports' total (or the selected port), the largest port's share, the Short Straits share of food imports (UKFSR), England's SRN delay, and how many ports are on the map. **Port symbols:** three measures (inward freight from abroad, agricultural products inwards, roll-on/roll-off inwards), 2015–2025, circles with area proportional to tonnage; a zero is a hollow ring; UKFSR food entry points carry a warm ring. **Charts and tables:** all ports by year (or the selected port, with its regions of loading); the full port table with shares; food imports by port of entry and Short Straits dependence by food group (as published); SRN delay. **Layers:** road corridors (Great Britain); railway lines (Northern Ireland, Translink NIR network, 2015); agricultural production regions (wheat, cattle, sheep, pigs, poultry as densities in fixed classes) with a region table. **Not available**, listed with reasons: Northern Ireland roads, Great Britain's railway lines, rail freight routes, distribution centres. |
| **RK-04** community food access | Every council's share of small areas in its own nation's deciles 1–2 of the Priority Places for Food Index, combined or by domain. **Map:** councils on the risk ramp in six fixed classes (hatched where the measure has no data: three domains in Northern Ireland). **Cards:** the selected council's share and its rank within its nation; its nation's pooled share; councils at 40 % or more in the ranking nation; data availability. **Charts:** the selected council by domain against 20 %; its small areas by decile; councils of one nation ranked (the selected one always shown; click to select); median share by urban/rural flag for the ranking nation (England or Wales; one nation at a time). A link opens the council's profile. The map needs only the council boundaries, never the stores file, and councils stay filled and clickable at local scale. |
| **RK-07** "Explain this risk" | For the commodity, the port network or a port, the road corridors, a farming region, or a council. It gives: what is measured; why it matters; how it is calculated; observed evidence (each value through `<Metric>`, with provenance class, period, scope and sources); sources; a labelled interpretation, which always ends "not a prediction that supply will fail"; limitations; evidence that would help; general options (never recommendations or anyone's needs). In the logistics view, a switch chooses ports, roads or the farming region. |
| **RK-08** linked selection | A bar, table row, map feature or control selects the commodity, partner, port or council everywhere: map, cards, charts, explanation and URL. Every chart selection also has a keyboard route (controls, table rows or buttons). |

**Northern Ireland transport (John's links, 25 Oct 2026):**
- **Railway lines.** Translink's NIR railway network (OpenDataNI, OGL, 2015) was fetched on GitHub Actions and built into `risk/rail.geojson` on the data branch: 10 route lines, about 334 km, with 24 sidings left out. It is drawn as dashed violet lines, validated against every other logistics colour, with a switch (`rl`) and a legend entry.
- **Roads.** DfI's *Highway Network* has no geometry in its open files, and its map service needs credentials. OSNI's Hub download of the 50K transport lines answered HTTP 400. Northern Ireland's roads therefore stay "Not available", and a file has been requested from John (B44).

**Also in this stage:**
- **Semantic colour.** A warm risk ramp for vulnerability measures (concentration, water stress, exposure, priority places), with dark and light basemap sets. Teal stays for volumes and shares.
- **Shell.** The module list and placeholders use the new stage numbers (7 Scenario Lab, 8 Consulting Insights). The Insights panel lists the risk evidence snapshot and drops its "no chart yet" placeholder for this module.
- **Backlog.** Suggested stages renumbered to match (B1–B42); B43–B48 added.

**Architecture** (ADR-0024):
- The supply view reuses the trade map, with an optional water-stress fill.
- A new `RiskLogisticsController` draws ports (graphics, the only hit-tested layer), road corridors and farming regions.
- Councils use a `risk` mode of the Access layers.
- Explanations are built from the same `Indicator`s as the cards.
- The module is a lazy chunk.
- Each ECharts heatmap carries a hidden visualMap of its class index. The development build of ECharts throws without one: the first component test showed "Chart could not be drawn", although the production build had drawn the charts.

## Exit criteria and the brief's checklist

| Check | Result | Evidence |
|---|---|---|
| Statistics compared against the original data | Yes, independently (tables below) | `hmrc_check.py`, `ports_check.py`, `ppfi_check.py` (scratch, not committed); values asserted in `risk.test.ts` and `model.test.ts` |
| Shares, HHI, time filtering, aggregation | Unit tests on synthetic partners and on the real snapshots; rolling 12 months = Sep 2025 – Aug 2026 | `src/analysis/risk.test.ts`, `src/features/risks/model.test.ts` |
| Missing, zero and suppressed data | No value → "no data" class (never low stress); nil months are gaps in the heatmap; NI domains without data are hatched, unranked and shown as "Data unavailable"; a zero tonnage is a hollow ring; non-country and suppressed trade are excluded from shares and reported as data availability | Unit, chart and component tests |
| Commodity-code consistency | The tomato code change (07020000 → three codes, Jan 2025) is reported and the series stays continuous (January 2025 HHI 2,736, as from the raw responses) | `model.test.ts`, data notes |
| Source dates | Each observed value carries its own period: HMRC period, water stress 2022, ports 2025, UKFSR 2023, SRN year to Dec 2023, June survey 2025, PPFI v2.1 | `model.test.ts` ("date each port figure…") |
| Map selection | Partner, port and council selected by map click; URL, cards and explanation follow; layers of the other views hidden | E2E `risks.spec.ts` (4 tests), store tests |
| Explanations | Every observed value's sources listed; interpretation separate; no forecast, probability or composite wording | `model.test.ts` (explanations) |
| No composite across views | None exists; the shell and controls say so | Component test |
| Previous modules still work | Full E2E suite | Commands below |
| Full test suite and build | Pass | Commands below |

### Hand checks against the raw files

The scripts read the committed raw files only: HMRC `/OTS` responses, World Bank API JSON, DfT PORT0499 (pandas with odf), the HASP PPFI CSV and the Scottish Government's 2011 Data Zone lookup. They do not use the pipeline's or the app's code.

| Figure | Raw files | App |
|---|---|---|
| HHI, Sep 2025 – Aug 2026, net mass: tomatoes, strawberries, potatoes, bananas, wheat | 2,991.676; 2,636.594; 1,949.755; 1,649.640; 1,433.959 | 2,990; 2,640; 1,950; 1,650; 1,430 (nearest 10, spec §6.4); order the same |
| Partners (same order) | 25, 22, 16, 43, 35 | Same |
| Tomatoes: Netherlands' share, top three | 43.8 %, 84.482 % | 43.8 %, 84.5 % |
| Spain's share of tomato imports over the 12 months; largest month | 11.0358 %; Feb 2026, 23.816 % | 11.0 %; Feb 2026, 23.8 % |
| Imports from partners in high or critical water stress: tomatoes, strawberries, potatoes | 0.0831 %, 23.5215 %, 23.3025 % (Egypt, Jordan, Israel, Tunisia, Uzbekistan) | 0.1 %, 23.5 %, 23.3 % |
| Spain's water stress | 43.25 % (2022) → low | Low (43.3 %, 2022) |
| Major ports, inward freight from abroad, 2025 | 237,484.733 kt; London 38,341.863 kt (16.145 %) | 237.5 Mt; London 16.1 % |
| Dover 2025 and change on 2024 | 12,512.825 kt; −2.238 % | 12.5 Mt; −2.2 % on 2024 |
| Agricultural products inwards, 2025 | 9,534.031 kt; Belfast 2,590.651 kt (largest) | Same (model test) |
| Glasgow City, combined index | 103 of 746 Data Zones in Scotland's deciles 1–2; rank 18 of 32, no tie | 13.8 %; 18 of 32 |
| Scotland's three highest | North Ayrshire 119/186, East Ayrshire 98/163, West Dunbartonshire 60/121 | 64.0 %, 60.1 %, 49.6 % |
| Scotland | 1,396 of 6,976 (20.01 %) | 20.0 % |
| Highland | 65 of 312; deciles 31, 34, 60, 48, 47, 38, 24, 19, 10, 1 | 20.8 %; same deciles |
| Glasgow by domain | Family food support 746 of 746; online deliveries 335; fuel poverty 230; socio-demographic 410 | Same |

Glasgow's family food support domain puts every one of its Data Zones in deciles 1–2. That is how the index is published, not a join error. In the raw file, Glasgow's 746 Data Zones hold ranks 1 to 753 of Scotland's 6,976 for that domain, all within the top two deciles.

## Colour checks

| Set | Surface | Result |
|---|---|---|
| Risk ramp, dark (`#9d5b38 #bb6d3b #d68241 #ed9a4e #fbb76e #ffd696`) | Dark grey land `#3d3d3d`; panel `#073435` | PASS with `--ordinal` (monotonic lightness, adjacent steps distinguishable under CVD simulation) |
| Risk ramp, light (`#d17c28 … #572317`) | Light grey land | PASS with `--ordinal` |
| Roads, ports | Each style | Text and muted tokens (dark), navy and grey (light); parity test per style |

The validator is the dataviz skill's `validate_palette.js`. Colour is never the only cue: every map has a labelled legend and tooltips, and every chart has a description and either a table or labelled values.

## Commands run and results (sandbox, 25 Oct 2026)

| Command | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint`; `npm run check:banned` | 0 errors, 0 warnings; OK |
| `npm run format` | All files formatted |
| `npm test` | **498 passed** (35 files; 413 at the end of Stage 5) |
| `cd pipeline && uv run pytest` | **196 passed** (82 s; includes the data step's risk build tests and the railway test) |
| `VITE_ARCGIS_ASSETS=local npm run build`; `npm run build:e2e-basemap` | Both succeed |
| `npm run e2e` | **74 tests** (chromium and basemap projects) in the final run (14.7 min): 73 passed. The 74th, basemap "imagery is offered only at local scale", failed once: it counts style requests, and the last imagery request did not reach the stub, though the view showed imagery. It passed in the previous full run and in 3 of 3 reruns, and is unrelated to this stage (B49). The four new Risk Explorer tests pass |
| Hand checks (`python3 -I <scratch>/hmrc_check.py`, `ports_check.py`, `ppfi_check.py`) | All match (above) |
| Bundle | Risk Explorer chunk 110.6 kB (30.5 kB gzip), loaded only when the module opens. App entry 468.9 kB (141.6 kB gzip; 462.1 kB at the end of Stage 5). |

New tests:
- **Unit:**
  - `src/analysis/risk.test.ts`;
  - `src/features/risks/model.test.ts` (21, on the real files: validation, supply, logistics, access, explanations);
  - `src/features/risks/charts.test.ts` (4);
  - URL and store tests for `rv`, `rf`, `pt`, `pms`, `rd`, `fm`, `pf`, `rn`;
  - palette parity for the risk ramp, roads and ports.
- **Component:** `Risks.test.tsx` (6):
  - supply deep link;
  - water-stress fill and legend;
  - switch to logistics and select Dover;
  - farming regions;
  - Glasgow and Belfast in community access;
  - no composite.
- **E2E:** `risks.spec.ts` (4):
  - supply with the water-stress fill and a click on Spain;
  - logistics with hover and click on Dover, sheep regions and roads off;
  - community access with a click on Highland;
  - view switching, back, and on to Profiles.

  All four check for console errors; the first three also run axe (no serious or critical violations).

**Found and fixed by the tests and screenshots:**
- The first screenshot of the logistics view showed an empty map: it was taken before the layers had drawn under SwiftShader. The layers were there (51 port graphics), and a longer wait showed them. Waits are now explicit.
- The road corridors dominated the ports at UK scale. They are thinner and more transparent now; the legend samples match.
- Bar charts' value-axis labels overlapped in the narrow panel ("20 %0.0 %0.08…"). The bars carry their own labels, so the axis keeps grid lines only, and the reference line is labelled above the plot.
- The logistics explanation defaulted to the road corridors. It now explains the port network (largest port's share, Short Straits share, all-cargo caveat), and the user can switch to roads or the farming region.
- The survey year was written as 2025 in five places. It now comes from the data.
- The council explanation listed the Northern Ireland limitation for every council. Limitations now follow the council's nation (Scotland's 2011 Data Zones; Northern Ireland's three missing domains).
- The "Councils above twice their nation's share" card counted councils at 40 % or more, not twice the actual share (about 20.0 %). It is now "Councils in <nation> at 40 % or more", counted within the ranking nation only (review finding 9).
- Heatmaps failed in the development build (above).

## Independent review

A separate agent reviewed the application code (`09c9654..HEAD`, `src` and `tests`) without seeing this report. It found the core maths correct on the real data:
- shares, HHI, CR1/CR3, exposure, ties and classes;
- port totals and farming densities;
- water-stress classes.

It found no composite score, no forecast or "shortage" wording, no port-of-entry shares derived from DfT tonnage and no cross-nation ranking. It reported nine verified findings. All are fixed, with tests where they apply:

1. **Medium. Wrong nation for a council's baseline.** With a ranking nation chosen (e.g. Hartlepool with Scotland ranked), the council's explanation lost its nation's share and the "times the nation's share" sentence, and the card showed Scotland's share. Each nation's pooled share is now computed, and a council is always set against its own nation (unit test).
2. **Medium. Legends inverted on light grey.** The HHI and water-stress legends in the panel used the map tokens, which are reversed on the light grey basemap, while the charts always draw the dark-panel ramp. Panel legends now use the panel tokens.
3. **Medium/low. A published zero shown as missing.** A change from 0 t (e.g. Cairnryan, Milford Haven) read "no 2024 figure". It now reads "up from 0 t in 2024" or "also 0 t in 2024" (unit test).
4. **Medium. Community access depended on the stores file.** The view waited for the 8.5 MB stores file and failed if it failed. The council map is now built from the manifest boundaries; no stores layer is created in this view (E2E checks the stores layer is absent).
5. **Low. Councils at local scale.** At zoom 12 and closer, councils lost their fills and could not be clicked. They now stay filled and clickable (E2E zooms to 12.5).
6. **Low. £ format.** The trend axis showed "£29m" for £29.1m. It now uses the shared format (spec §6.4).
7. **Low. Month keys.** Reference periods showed "2025-12" and "Year to 2023-12". They now read "Dec 2025" and "Year to Dec 2023".
8. **Low. Port-of-entry clicks.** Two UKFSR groups share London's port, so a second click on the chart cleared it. Chart clicks now only select.
9. **Low. Cross-nation reading.** The "40 % or more" card counted councils UK-wide, and the urban/rural chart set England beside Wales. Both now show one nation at a time.

It also listed possible issues that the current data does not trigger; four are fixed anyway:
- a farming region without a value for the chosen measure is hatched on the map;
- its table cell says "No data" (it showed wheat hectares);
- an unreported region of loading is left out, not counted as 0 t;
- pooled shares use each measure's own denominator.

One possible issue was not fixed: the supply view leaves its water-stress trade map in the store after the view closes. Every trade view sets its own map when it opens, and the trade layers show only in trade views, so nothing visible follows; clearing it would redraw the map when moving between trade views.

## Not verified, and why

- **Live site.** The module has not been checked with a real GPU and the Esri basemap, light grey or dark grey; that waits until after merge (with the outstanding Stage 5 live checks, B48). In the sandbox the map is the offline outline map, drawn by software WebGL.
- **Council clicks.** Under SwiftShader a click on a council takes 5–7 s to select it, in this view and in UK Food Access alike (hit test on the councils GeoJSON layer, B37). Not measured on a real GPU.
- **Port locations.** 24 points come from EMODnet (mostly Eurostat GISCO, 2013) and 27 from DfT's "rough location". Neither is surveyed; the legend and explanations say "rough locations".
- **Screen reader.** No manual pass. Axe passes, and every chart has a text alternative.
- **Water stress.** The indicator is published nationally. Whether a partner's exports come from stressed basins is not known from these sources, and the explanation lists the evidence that would help.

## Open questions for John

1. **RK-05 weights.** No indicators within a view yet share a unit and direction, so no weighting is built. Do you want a weighted view in Release 2 (e.g. combining concentration and water-stress exposure within the supply view, with sensitivity analysis), or should RK-05 be dropped?
2. **Northern Ireland roads.** OSNI's service refused the pipeline three times. Could you download the OSNI 1:50,000 transport file by hand, to add it like the other provided files (B44)?
3. **Port-level food evidence.** Only UKFSR's shares are food-specific. Should HMRC's port allocation (S28) be investigated for Release 2 (gate G13), or is the UKFSR evidence enough for the demonstrator?
