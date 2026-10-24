# ADR-0019 — One opaque share ramp; hover by highlight; figures before the map

- Status: Accepted (post-Stage 3 review)
- Date: 2026-10-23

## Context
The post-Stage 3 review found three problems.

**Map colours.** The share-class fills on the map were semi-transparent (alpha 0.55–0.95), linear-RGB mixes of teal and cyan. Two consequences followed:
- What the eye saw depended on the basemap underneath. The smallest class reached only 1.27:1 against the Esri dark grey land (#3d3d3d) and 1.48:1 against the offline outline map; the dataviz ordinal check fails below 2:1.
- The legend swatches used a different mix and opacity, so the legend did not show the map's colours.

**Hover.** Every hover over a country rebuilt the partner layer's `UniqueValueRenderer`, which re-symbolises every country.

**Start-up.** The first view's figures waited behind the ArcGIS SDK. Data loaded as manifest → trade index → commodity, each step starting only after React re-rendered, while about 410 SDK modules loaded. Measured over HTTP/2 with a 50 ms round trip, the KPI cards were ready about 2.9 s after navigation although the commodity file is 36 kB.

## Decision
1. **One share ramp.** Map fills, legend swatches and the Seasonal heatmap use the same six opaque colours: the `--fs-seq-0…5` tokens, `color-mix(in oklab, cyan p %, teal)`.
   - **Mirror:** `src/styles/palette.ts` mirrors the tokens with an OKLab mix (`src/analysis/colour.ts`). `palette.test.ts` fails if the TypeScript values, `tokens.css` or the legend CSS drift apart.
   - **Validation:** the ramp passes the dataviz ordinal check against both map surfaces. The lowest class is 2.07:1 on the Esri land and 2.66:1 on the offline map.
   - **Separators:** partner fills have thin navy separators.
   - **Casing:** connection lines get a navy casing so they stay readable over the brighter fills.
2. **Hover by highlight.** The partner under the pointer is emphasised with `layerView.highlight(graphic, { name: "fs-hover" })`, a named highlight registered once on the view. The renderer is rebuilt only when the data or the selection changes. The view container exposes `data-partner-renderer-builds` for tests.
3. **Figures before the map.**
   - **Preload:** `index.html` preloads `data/manifest.json` while the app code downloads.
   - **Prefetch:** before React renders, `main.tsx` calls `prefetchStartupData`. Once the manifest arrives, it loads the trade index, the country label points and the URL's commodity in parallel, through the same query options as the hooks (same cache keys, same schema validation).
   - **SDK in parallel:** the map chunk is requested straight after, so data and SDK download side by side.
   - **Seasonal chunk:** links that open Seasonal Supply also start its lazy chunk at once.

## Consequences
- The map looks the same as the legend on either basemap, and the smallest partners no longer disappear into the land colour. Opaque fills hide the basemap's land texture under partners; the labels still draw on top, because they are in the basemap's reference layer.
- Measured in the sandbox over HTTP/2 with a 50 ms round trip (median of 7 cold loads; review report):
  - KPI cards: 2.85–2.92 s → 1.06–1.37 s;
  - KPI cards with the CPU slowed 4×: 5.41 s → 2.68 s;
  - map with its connections drawn: 2.4 s → 2.4–2.7 s, and 5.3 s → 5.2 s with the CPU slowed.
  The panels now render while the SDK loads, so the map view itself can become ready up to about 0.3 s later on a fast CPU.
- Hover cost is now independent of the number of countries.
