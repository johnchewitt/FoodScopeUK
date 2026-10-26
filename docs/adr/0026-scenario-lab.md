# ADR-0026 — Scenario Lab: one typed scenario model, four scenarios on existing map controllers, precomputed nearest supermarkets, saved scenarios in the browser

- Status: Accepted (Stage 7)
- Date: 2026-10-26

## Context
John's Stage 7 brief (26 Oct 2026, "Food Security Scenario Lab") asks for a decision-support module with:
- a large map, scenario cards, sliders and baseline-versus-scenario KPIs and charts;
- an explanatory results panel and a methodology panel for every scenario;
- four scenarios:
  - A, international supply disruption;
  - B, supermarket closure;
  - C, a domestic production shock (optional);
  - D, a port disruption;
- named scenarios that can be saved, compared, shared as a URL, reset and exported;
- a typed scenario model, so that later simulations can be added.

The specification already had SC-01 – SC-05 and formulas for import disruption (SC-A/E) and store closure (SC-D), with SC-B (Short Straits) and SC-C (wheat) planned for Release 2. John chose two things on 26 Oct 2026:
- the closure scenario covers every small area of the UK, with the data fetched and verified first (the `scenario` family, PR #21);
- distances are straight-line only.

## Decision
1. **Letters follow the brief.** The UI's A, B, C and D are the brief's. They map to the specification's IDs as follows:
   - A = SC-A/E;
   - B = SC-D;
   - C = SC-C;
   - D = SC-B.

   C and D are delivered in Release 1 only as far as verified data allows (see 5 and 6).
2. **One typed scenario model.** `ScenarioParams` (`src/state/scenarioParams.ts`) is a discriminated union with one member per kind. It is the same object for:
   - the controls;
   - the URL (SC-05);
   - a saved scenario;
   - a comparison;
   - an export.

   `paramsFromState` / `stateFromParams` map it to the URL fields.

   The commodity, partner, measure, store and port are shared with the other modules (`c`, `p`, `ms`, `st`, `pt`). The scenario's own settings have their own fields: `sk`, `sy`, `smo`, `sr`, `sd`, `srk`, `ss`, `spr`, `sdr`, `sdm`, `sv`. Values are validated and clamped on the way in.

   `parseScenarioParams` checks anything read back from storage. A new simulation adds a member, its URL fields and a model builder.
3. **Pure formulas, then view models.** `src/analysis/scenario.ts` holds the formulas, each with unit tests including zero, full and missing cases:
   - `effectiveReduction`;
   - `importDisruption`;
   - `closureImpact`;
   - `productionShock`;
   - `portDisruption`.

   `src/features/scenarios/model.ts` turns them into `Indicator`s, results rows, headlines, a confidence rating and map models. Baseline figures keep their published provenance; every scenario figure is `scenario` ("Scenario-modelled", P2, P9).
4. **Scenario A on the trade map.**
   - The scenario publishes an `OriginsMapModel`, so the trade layers, framing and hover are those of Food Origins (`selectTradeMapModule` now includes it).
   - Connections are the baseline's top partners on a fixed width scale (the largest baseline connection), so a narrower line means less.
   - The disrupted partner's baseline width is drawn as a dashed "ghost" line under its narrower scenario line (`OriginsMapPartner.ghostWidth`).
   - Width changes ease within ADR-0017's ≤ 320 ms tween; classes are never interpolated.
   - Shares and HHI after assume every other partner unchanged, as stated.
   - Substitution defaults to 0 % and is labelled a user assumption.
5. **Scenario B on precomputed nearest supermarkets.**
   - The pipeline publishes each small area's three nearest supermarkets by straight line in the national grid, over every supermarket of its part of the UK (so stores beyond a council boundary count).
   - Closing one store is then a linear pass over the areas, about 2 ms, with no spatial search, worker or server in the browser. The brief's "server-side preprocessing" option is used.
   - The map uses `AccessLayersController` in a new `scenario` mode:
     - councils outlined, the closed store's council emphasised;
     - supermarkets from a compact blob GeoJSON of the closure inputs;
     - clicking a supermarket picks it to close; clicking beside the stores keeps the current one.
   - A new `ScenarioClosureController` (GraphicsLayer, the only hit-tested scenario graphics) draws the affected areas and links them by dashed straight lines to their nearest supermarket before or after the closure, with rings on the stores that take over. A change fades in (≤ 280 ms, none under reduced motion).
   - Framing (`scenarioClosure`) fits the closed store's areas once per store, up to `PROFILE_MAX_ZOOM`.
6. **C and D use only verified, comparable data.**
   - **C** shocks Defra's published annual balance (one table and year per basket). Imports and exports are held; consumption and stocks are listed as not in the balance. Baskets without a balance show Defra's reason and stay a documented future extension. Nothing is combined with HMRC monthly trade.
   - **D** reduces DfT inward tonnage at one port, with an even spread over months stated. Commodity exposure is computed only where the data records it at the port:
     - DfT cargo category 23 (agricultural products);
     - UKFSR's food, feed and drink share where its port of entry is the port. Dover's figure includes the Channel Tunnel and is never attributed.

     Partner countries are never linked to ports. The map is `RiskLogisticsController` with the selected port's baseline drawn as a dashed ring around its scenario circle (`RiskMapPort.scenarioRadius`).
7. **Confidence is a stated rule, not a statistic.** Each model rates its inputs Higher, Moderate or Lower and gives the reasons, for example:
   - provisional or missing months;
   - suppressed rows;
   - a small base;
   - straight-line distance;
   - Republic of Ireland stores missing in Northern Ireland;
   - crossings over 10 km;
   - provisional Defra figures;
   - different source years.
8. **Saved scenarios stay in the browser.**
   - Only parameters are saved, in localStorage (`foodscope.scenarios.v1`, at most 12), and results are always recomputed from the current published data.
   - Every access is guarded, so a blocked storage keeps the list for the visit.
   - Up to four saved scenarios are compared with the current one, kind by kind, never ranked or combined (P10).
   - Exports (CSV and JSON) carry each result's baseline, scenario, change, provenance, sources, confidence and reproducing link. CSV fields neutralise spreadsheet formulas.
9. **Lazy module.** `src/features/scenarios/` loads through its `lazy.tsx` like the other modules. Its validator (scenario-closure, plus column-length and index checks the schema cannot express) is compiled in the chunk. The shell gains about 2.4 kB, for the URL fields, store actions and lazy wrappers.

## Consequences
- The Scenario Lab adds no new basemap colours. It uses the validated risk ramp for distance-increase classes, and the selection colour for ghosts and rings.
- The closure inputs (5.8 MB, 1.6 MB compressed) load only when Scenario B is opened. Their three nearest per area support any single closure exactly. Closing several stores at once would need more neighbours or a browser-side search (backlog).
- Routed travel time stays Release 3. Every distance is labelled straight-line, and the methodology lists water crossings and border effects.
- SC-02's recovery profile applies to Scenario A only. D has a duration but no recovery, because DfT figures are annual.

## Amendment (26 Oct 2026, review of Stage 7)
1. **The ghost of Scenario A** is CIM in the flow line's own units (`src/map/layers/ghostSymbols.ts`, SDK-free and unit-tested). It is drawn at the baseline line's full extent, core plus its 2 pt casing:
   - a faint body under the scenario line;
   - two dashed edges, offset ± half that extent, above it.

   The first version (a `SimpleLineSymbol` at 0.75 × the baseline width, under the wider scenario line with its casing and glow) was invisible at −30 %. The flows layer reports the disrupted partners in `data-flow-ghosts`.
2. **Scenario D's window.** Cards, the results table and the cargo-group chart all cover the disrupted months (annual DfT tonnage × *m* ÷ 12, an even spread). The chart had applied the reduction to the whole year.
3. **Scenario D's categories.** DfT's cargo category 23 is called "agricultural dry bulk". At a port with none (Dover), the card's detail leads with the share of its inwards in Ro-Ro units or containers, whose contents DfT does not record ("97.6 % Ro-Ro or containers · contents not recorded"). A results row adds that unitised freight over the disruption, any origin.
4. **Map credits for graphics.**
   - GraphicsLayers carry no `copyright`, so the ports' credit (DfT, OGL; EMODnet, CC BY 4.0) is a credit layer: an empty GeoJSONLayer with the dataset's attribution, shown and hidden with the ports (`src/map/layers/creditLayer.ts`; Risk Explorer logistics and Scenario D).
   - Scenario B's supermarkets are drawn from the closure inputs, so the scenario's store layer credits both closure datasets (`mergeAttributions`), not GEOLYTIX alone.
5. **Smaller screens.**
   - The scenario cards are a compact 2 × 2 picker.
   - KPI cards show short labels (`KpiCard.shortLabel`, `kpiLabels.ts`); the full label stays the accessible name.
   - Updated results are announced as a status message once the settings rest (800 ms).
