# ADR-0023 — Local Authority Profiles: per-council small areas, a profile map mode and graphics for small areas

- Status: Accepted (Stage 5)
- Date: 2026-10-25

## Context
Stage 5 adds a profile for any of the 361 UK councils and deep profiles (small areas) for Belfast and Manchester (LP-10). John's Stage 5 brief asks for:
- council search, map selection, fly-to and a highlighted boundary, kept across modules and in the URL;
- a neighbourhood map (PPFI, deprivation, car availability, straight-line distance) linked to the charts, where a click on a chart outlines its areas;
- a side-by-side comparison that never ranks deprivation across nations;
- an approach that scales to all four nations without downloading every small area at once.

Stage 4 already draws councils and stores (`AccessLayersController`, ADR-0020 to ADR-0022). Hover on the Food Origins countries had shown that `view.hitTest` on a GeoJSONLayer takes 0.6–3 s under software rendering (B29), while a GraphicsLayer answers in about 1 ms.

## Decision
1. **Data families and files.** Three families join `trade` and `local` (ADR-0021), each from its own newest snapshot:
   - `areas`: one folder per council, `areas/<LAD>/small-areas.geojson` and `small-area-indicators.json`. The app loads only the selected council's folder (`areaDatasetIds(lad)`), so adding councils never adds to a page load.
   - `context`: `council-context.json` (urban/rural, Census 2021 car availability, map frame for all 361 councils) and `uk-production.json` (Defra annual production, national).
   - `register`: the Northern Ireland grocers from the FSA register (S29), an optional layer.

   Joins are by GSS or NISRA code only. Each geography keeps its own vintage: LSOA 2021 (England), Data Zones 2021 and SOAs 2011 (Northern Ireland). PPFI and NIMDM stay on the SOAs they are published on (John's decision, 24 Oct 2026); nothing is reallocated between geographies.
2. **The profile reuses the Food Access layers in a profile mode.** `AccessMapModel.mode` is `"access"` or `"profile"`. In profile mode:
   - councils are outlined, the selected council emphasised and comparison councils dashed;
   - the stores keep the UK Food Access filters;
   - the council choropleth and proximity tool are off.

   The renderer is rebuilt when the mode, selection or comparison changes (part of its signature). Only `src/map/` touches layers (ADR-03).
3. **Small areas are graphics.** A GraphicsLayer (`profile-small-areas`) below the councils draws the deep profile's areas from `state.profileMap`, shaded by fixed classes:
   - deciles in five classes, deciles 1–2 most salient;
   - no car or van: 15 / 30 / 45 / 60 %;
   - straight-line distance: 0.5 / 1 / 2 / 5 km;
   - no data hatched.

   Hit tests run in priority order: store, grocer, small area, council. Graphics are rebuilt only when the council or geography changes; a new measure or highlight only changes symbols.
4. **Chart to map.** A click on a chart bar (or the keyboard buttons under each chart) sets `areaHighlight` (label and codes). The map outlines those areas; a status line names them and clears them. A new measure clears the outline.
5. **Framing.** The camera fits the selected council whenever it changes, at any scale, up to zoom 13 (`PROFILE_MAX_ZOOM`); without a council it frames all mapped stores. It never moves on a measure, area or filter change (ADR-0018).
6. **Distances in the browser.** Straight-line distances are computed in the browser (`src/analysis/profile.ts`):
   - from the Census 2021 population-weighted centroids (published in WGS84) to the nearest store;
   - in the national grid (BNG, or ITM in Northern Ireland), among stores in the same grid.

   They use every mapped supermarket (280 m² and over, standard format) or every mapped store, whatever the map shows. The stores file is already loaded for the map, so nothing more is downloaded; 735 areas against about 19,000 stores take milliseconds.
7. **Lazy module.** `src/features/profiles/` loads through its `lazy.tsx`, as Seasonal and Access do. The comparison dialog is a Calcite dialog (`view=compare`) that lists councils in the order chosen. Rows that rank within a nation are marked and never compared across nations.
8. **Scale helpers.**
   - The 1:110m outlines stop at about zoom 8 (`REFERENCE_MAX_SCALE`): closer in they cut across councils.
   - The 285 NI grocers draw from zoom 7.5 (`REGISTER_GROCERS_MIN_ZOOM`); the legend says to zoom in until then.

## Consequences
- **Adding a council's deep profile:**
  - build the pipeline's `build-areas` for that council (config `deep_profiles.json`);
  - publish;
  - no app change unless the nation brings a new geography (Scotland's Data Zones need an adapter in the pipeline and a `kind` in the schema).
- **The map filters change only the map.** The store types and retailers chosen for the map (shared with UK Food Access) never change a profile's counts, rates or distances, which always use all mapped stores of the type they name.
- **Population bases.** Rates use ONS mid-2025 population; small-area shares use Census 2021 counts. They are never combined in one figure.
- **Hover on the Access stores layer** is still a GeoJSON hit test (B37 in the backlog); the small areas avoid it.
