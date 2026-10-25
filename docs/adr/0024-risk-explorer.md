# ADR-0024 — Risk Explorer: three separate views on one map, a warm risk ramp, explanations built from indicators, no composite

- Status: Accepted (Stage 6)
- Date: 2026-10-25

## Context
John's Stage 6 brief (25 Oct 2026) asks for a "UK Food Resilience — Risk Explorer" with three views:
- international supply exposure;
- food logistics and infrastructure;
- community food access.

Each view needs its own map, indicators, filters and an "Explain this risk" panel that keeps observed evidence apart from interpretation. Weights are allowed only for comparable, documented composites. The brief also asks for semantic colour (a graduated risk scale), legends, tooltips and linked selection between charts and map.

The data step (`data/stage-6-inputs`, `docs/stage-reports/pre-stage-6-data.md`) published the `risk` family:
- FAO water stress by country (S30);
- DfT major ports with map locations (S23, S36);
- UKFSR port-of-entry and road-delay evidence (S03);
- OS Open Roads corridors for Great Britain (S35);
- Defra June survey by region (S31, S33);
- the Priority Places index summarised for every council (S13).

Earlier stages already draw the trade map (Food Origins and Seasonal Supply, `OriginsLayerController`) and the councils (`AccessLayersController`, with an access mode and a profile mode, ADR-0023).

## Decision
1. **Three views, never combined.** The module has one view switch (`rv`: supply, logistics, access), kept in the URL; history gets a new entry when it changes. Each view has its own:
   - controls;
   - KPI cards;
   - insights;
   - legend;
   - tooltip.

   No figure combines views (P10, RK-06). RK-05 (user-weighted composites with sensitivity analysis) is deferred to Release 2. None of the published indicators share a unit and direction within a view, so a weighting would not yet be defensible.
2. **The supply view reuses the trade map.** `buildSupplyModel` wraps `buildOriginsModel`, so shares, connections, framing and selection behave as in Food Origins and are shared with it (commodity, period, measure, partner). `selectTradeMapModule` decides where the trade layers show. `OriginsMapModel.fill` adds a water-stress fill:
   - partners take the FAO class of their national value;
   - a partner without a value is hatched (no-data), never shown as low.

   Exposure to one supplier's disruption is the partner's share of recorded imports, month by month and over the period, called "estimated exposure", never "shortage". Concentration measures (HHI, CR1, CR3, partner count, monthly HHI, year-on-year) come from `src/analysis/risk.ts`, on the allocated partner total only.
3. **A logistics controller.** `RiskLogisticsController` (`src/map/layers/riskLogistics.ts`) draws three layers from `state.riskMap` only (built by `buildLogisticsModel`):
   - **farming regions** (GeoJSONLayer): Defra regions of England and the devolved countries on ITL1 boundaries. Fixed classes of a density (per cent of area for wheat; head per km² for livestock) on the sequential colours 1–5, or outlines.
   - **road corridors** (GeoJSONLayer): motorway and trunk versus primary A roads, Great Britain only.
   - **railway lines** (GeoJSONLayer, dashed, its own validated colour per basemap): Northern Ireland's NIR network (Translink, S37), added at John's request. Great Britain's railway lines are not in this build.
   - **ports** (GraphicsLayer): circles with area proportional to tonnage. A zero for the measure is a hollow ring. UKFSR food entry points have a warm ring; the selected port has the selection ring.

   Only the ports are hit-tested, so hover stays fast (B29). Port-of-entry shares are shown only as UKFSR publishes them, beside DfT tonnage and never derived from it.
4. **The access view reuses the council layer in a risk mode.** `AccessMapModel.mode = "risk"`:
   - councils are filled by the share of their small areas in their own nation's deciles 1–2 for the chosen measure (six fixed classes on the risk ramp);
   - councils without data for the measure are hatched (Northern Ireland, three domains);
   - no stores layer is created: the map is built from the council boundaries in the manifest, so the view never downloads the stores file;
   - councils stay filled and clickable at local scale (UK Food Access outlines them there);
   - the selected council is emphasised.

   Councils are ranked within their own nation only: competition ranking, ties marked "=".
5. **Semantic colour.** A warm risk ramp (`RISK_DARK` and `RISK_LIGHT` in `src/styles/palette.ts`, tokens `--fs-risk-*` and `--fs-map-risk-*`) shows vulnerability measures:
   - concentration;
   - water stress;
   - exposure;
   - priority places.

   The teal ramp keeps volumes and shares. Both risk ramps passed the dataviz `--ordinal` validator against their surfaces. Colour is never the only cue: each colour has a legend with labels, a tooltip, chart labels and a table or description (AX-06).
6. **Explanations are built from indicators.** `src/features/risks/explain.ts` builds an `Explanation` from the view models for each kind of subject:
   - a commodity;
   - the port network;
   - a port;
   - the road corridors;
   - a farming region;
   - a council.

   Each explanation contains: what is measured, why it matters, how it is calculated, observed evidence (`Indicator`s rendered through `<Metric>`), sources, limitations, further evidence, general options, and a separately labelled interpretation. The interpretation always ends with "not a prediction that supply will fail". Unit tests check that:
   - every observed value's sources are listed;
   - each value carries its own reference period;
   - nothing forecasts, scores or gives a probability.
7. **Framing.** Logistics and community access each frame the whole UK, including Shetland and western Northern Ireland (`UK_FULL_EXTENT`), once per visit (ADR-0018). Selecting a port or council never moves the camera.
8. **Lazy module.** `src/features/risks/` loads through its `lazy.tsx` (chunk loader in `load.ts`), like Seasonal, Access and Profiles. It compiles its own validators for the risk schemas. ECharts heatmaps (monthly HHI, commodity–country matrix) carry a hidden piecewise `visualMap` that maps each cell's class index to the same fixed colours. ECharts requires a visualMap for heatmaps; it adds no continuous scale.

## Consequences
- A new commodity basket in the trade snapshot joins the supply view's ranking and matrix automatically. A new risk dataset needs a schema, a validator in `validate.ts` and an `Indicator` builder in `indicators.ts`.
- Water stress is a national figure. The legend, tooltips, KPI method and explanation all say that it does not describe where the produce was grown, nor how it was irrigated.
- Rail freight, distribution centres, Northern Ireland's road corridors and Great Britain's railway lines are listed as "Not available" in the logistics controls, with the reason. They are never drawn from unverified sources. DfI's open road files have no line work; a file of OSNI's 50K transport lines from John would add Northern Ireland's roads without code changes beyond the pipeline.
- RK-05 waits for Release 2. It is not available yet, so the UI never presents a weighting.
- Council hit tests on the councils GeoJSON layer take seconds under SwiftShader (as in UK Food Access, B37); the E2E test allows for it.
