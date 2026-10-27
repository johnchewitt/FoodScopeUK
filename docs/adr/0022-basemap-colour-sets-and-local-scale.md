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

## Amendment (27 Oct 2026, more basemaps; John's request)
- **Nine styles.** John asked for:
  - Human Geography, light and dark;
  - imagery at every scale;
  - Terrain, Topographic, National Geographic and OpenStreetMap, only where the data is lines and points.

  On 27 Oct he confirmed that National Geographic and OpenStreetMap follow the same rule as Terrain and Topographic. `MAP_STYLES` (`src/styles/palette.ts`) is also the list of URL values (`bm`).
- **Sources.** `BASEMAP_SOURCES` lives in `src/services/arcgis/basemapStyles.ts`, which is SDK-free, so the UI and captions can read it.
  - Eight styles come from the basemap styles service (`arcgis/human-geography`, `arcgis/human-geography-dark`, `arcgis/terrain`, `arcgis/topographic`, `open/osm-style` beside the original three). They use the same key, registered as `apiKeys.basemapStyles`.
  - National Geographic is not in that service. It is Esri's public "National Geographic Style Map" web map (`f33a34de3a294590ab48f246e99958c9`), loaded as a portal item with no key. With `useIdentity` off, a layer that needed a sign-in fails and is reported; it never prompts. Its terms for this site are open (B74).
- **Where each is offered.** `selectMapShadesAreas` (`src/state/store.ts`) says whether the current view shades areas. It mirrors the layer controllers, and the tests check them against the store:
  - the trade maps;
  - the Risk Explorer's community view, and its farming regions when a measure is chosen;
  - UK Food Access councils below local scale, unless the council layer is off;
  - a deep profile's drawn small areas.

  `DETAILED_STYLES` are offered only where it is false. Elsewhere `selectRequestedMapStyle` shows light grey and keeps the choice, as imagery used to wait for local scale. Imagery and Human Geography are offered everywhere, so `IMAGERY_MODULES` and `selectImageryAvailable` are gone.
- **Colour sets.** Each new style has a set, checked on 27 Oct 2026 against its land and water colours, which were read from Esri's published styles (S25):
  - **Human Geography (light)** uses the light set. Land `#f7f7f7`, sea white; lowest share and risk classes 3.0:1.
  - **Human Geography dark** uses the dark set. Land `#222426`; lowest classes 3.0:1, symbols and lines ≥ 4.9:1.
  - **Imagery** keeps the dark set with white outlines. Fills are opaque, so the photograph shows only between them.
  - **The detailed styles** share one set (`DETAILED`): the light set with four darker lines. Selection is indigo `#1a237e`, proximity brown `#4a2a00`, primary roads teal `#00525e`, rail blue `#3949ab`, and the UK outline navy.
    - Each line is ≥ 3:1 on their land, water, urban and relief colours.
    - On National Geographic's bright green parks, primary roads (3.0:1) and dashed rail (2.6:1) are lowest.
    - Within each view, colours drawn together differ by normal-vision ΔE ≥ 13.1 and CVD ΔE ≥ 9.8.
  - **Halos.** Symbols keep the light set's colours with a wider white halo (`haloBoost`, as on imagery), so they separate from any background.
- **Tokens.** The light styles share light grey's `[data-map-style]` block (a selector list), and the detailed four override the four line tokens. `palette.test.ts` now resolves every style's effective tokens against its set.
- **Control.** The control has two groups: five styles under any map, and "Lines and points only".
  - Where the map shades areas, the detailed four are disabled with a note. A chosen one stays checked and says light grey is shown.
  - The panel fits the space below the button and scrolls. It is nearly opaque and sits above the Seasonal timeline.
- **Captions.** Map images and PDFs name the basemap ("basemap Esri National Geographic Style") from the style the controller loaded. Esri's map-image notice applies to all nine. OpenStreetMap's ODbL credit comes with the style's attribution.
- **Not verified yet.** The real styles were not seen from the sandbox, which cannot reach Esri. The tests stub the styles service and ArcGIS Online.
  - Each style's look, attribution and request on the live site join the live checks (B48).
  - Terrain's land colours are estimated, because its relief is a raster.

