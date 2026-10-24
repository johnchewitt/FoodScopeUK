# ADR-0022 — A colour set per basemap style, and one local-scale rule

- Status: Accepted (Stage 4)
- Date: 2026-10-24

## Context
SH-08 (added 23 Oct 2026) asks for a curated basemap choice: dark grey (default), light grey, and imagery with labels only at local scales. Every data colour in the app had been checked against dark grey only (ADR-0019: one opaque share ramp for the map, its legend and the Seasonal heatmap). Navy text-coloured connections, cyan outlines and a teal-to-cyan ramp would fail on a light grey map.

Stage 4 also adds the first map with local detail: about 19,000 stores and 361 council areas. A council fill hides the stores drawn over it, and 19,000 symbols at national scale are unreadable.

## Decision
1. **A colour set per style.** `MAP_COLOURS` in `src/styles/palette.ts` holds, for each style, every colour the map layers use:
   - the six-class ramp;
   - separators and the no-data hatch;
   - selection and hover;
   - trade connections and their casing;
   - country, UK and council outlines;
   - store symbols, clusters and the proximity overlay.

   `tokens.css` mirrors the colours that legends need as `--fs-map-*` custom properties: dark grey values on `:root`, light grey under `[data-map-style="light"]`. The app root carries `data-map-style`. `palette.test.ts` checks the two stay in sync, as ADR-0019 did for one ramp.
2. **Map and panels part ways on light grey.** Map fills and legend swatches use `--fs-map-seq-*`. The Seasonal heatmap sits on the dark panel and keeps `--fs-seq-*`. On dark grey the two are the same ramp, so ADR-0019 still holds there.
3. **Validated sets.** Each set was checked with the dataviz validator (stage 4 report):
   - **Dark grey:** the existing ramp against `#3d3d3d`; store symbols near-white, orange and violet.
   - **Light grey:** a single-hue teal ramp (`#3b9ca7` → `#003641`), navy, rust and indigo symbols with white outlines, navy connections with a white casing. Light grey's land colour could not be read from the sandbox, so it was validated against both ends of a bracket, `#d6d6d6` and `#f0f0f0`. The value measured on the live site is recorded in the stage report.
   - **Imagery:** reuses the dark grey symbols with white council outlines. Imagery is shown only at local scale, where councils are outlines and stores are individual.
   - **Shape encoding:** store classes also differ by shape (circle, square, triangle), so colour is never the only cue.
4. **Fallback colours.** The colour set follows the requested style while its basemap works. Without a key, or when a style fails to load, the app uses the dark set, which matches the offline outline map.
5. **One local-scale rule (zoom 12, about 1:144,000).** From this zoom:
   - stores are drawn individually (clusters stop: `maxScale` just above the zoom 12 scale);
   - councils are outlined instead of shaded;
   - imagery is offered.

   The rule lives in `src/state/store.ts` (`LOCAL_ZOOM`, `selectLocalScale`, `selectImageryAvailable`). The map reports its resting zoom to the store (`ViewStateController`).
6. **Imagery is a choice that waits.** Imagery is offered in UK Food Access (and later Local Authority Profiles) at local scale.
   - If a visitor has chosen it and zooms out, or opens a world-scale module, the map shows dark grey while `bm=imagery` stays in the URL.
   - Imagery returns at local scale. The control says why it is unavailable.
7. **One basemap owner.** `BasemapStatusController` swaps `map.basemap` when the requested style changes, and reports whether that basemap loaded.
   - The key stays registered once, as `apiKeys.basemapStyles` (ADR-0011).
   - The reference outlines follow the status both ways. On a failure they switch to the offline style, and back when another style loads.
   - Without a key the control is hidden and nothing is swapped.

## Consequences
- **Adding a colour:** a new map colour needs an entry in every set. The validator runs and the parity test cover each style.
- **Request usage:** switching styles requests a new style, so each visitor's choice counts towards basemap usage under the key (risk R8). The stage report records the count.
- **E2E without Esri:** CI cannot reach Esri. The basemap tests use a build with a placeholder key (`.env.e2e-basemap`) and stub the styles service: one flat tile per style, with a stub attribution. How the real styles look, and their real attribution, are checked on the live site.
- **Map sync is never nested:** `MapController` defers a store change made during a sync (for example a layer reporting "loading" while it is created) until the sync ends, then runs it with the latest state. This was found when the store data arrived after the map was ready.

## Amendment (24 Oct 2026, after the live checks)
- **Measured land colour:** light grey's land is `#f4f4f4` below zoom 7 and `#efefef` from zoom 7 (water `#cfd3d4`). The light set passes against all three.
- **Proximity colour:** the all-pairs check of the overlays failed the normal-vision floor: proximity against selection measured ΔE 11.8 on dark grey and 14.8 on light grey. On dark grey the proximity cyan also equalled the council outlines. Proximity is now pink `#f184c0` on dark grey and imagery, and magenta `#9c0a73` on light grey. On light grey the legend ring is drawn on the light land colour (`--fs-map-sample-ground`), because the legend sits on dark glass.
- **Opening view:** UK Food Access frames the box around all mapped stores once per visit (`accessMap.frame`). It skips the frame when the map is already at local scale.
