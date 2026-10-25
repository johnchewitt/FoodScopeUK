# Backlog

Ideas and follow-ups that are outside the current stage's scope. Move an item into a stage only through the roadmap.

| # | Item | Source | Suggested stage |
|---|---|---|---|
| B1 | Reduce initial JS (606 kB / 184 kB gzip): precompile Ajv validators (standalone), lazy-load the Evidence and Help dialogs, review Calcite imports | Stage 1 measurement | 8 |
| B2 | Add a secret-scanning step to CI (e.g. gitleaks) | Roadmap 3.3 | 2 |
| B3 | Contrast check of glass panels over the live Esri dark grey basemap (measured, not by eye) | Stage 1 report | 8 |
| B4 | Visual polish pass once real data is on screen (KPI hierarchy, legend design, flow styling) | Stage 1 review | 8 |
| B5 | ~~Initial world view: fit the world to the padded map area at every breakpoint~~ Done for the trade views: they open framed on the data (ADR-0018). Other modules still open on the world | Stage 1 screenshots (1366 px) | Done (review 23 Oct 2026) |
| B6 | `eslint-plugin-jsx-a11y` for static accessibility linting | Stage 1 | 2 |
| B7 | Bundle-size report in CI with a regression threshold | Architecture §10 | 8 |
| B8 | Decide the code licence for the repository | README | ConsultingWhere |
| B9 | Recover from a failed lazy map chunk (seen once: transient GitHub Pages 503 on first load). `React.lazy` caches the rejected import, so "Try again" cannot recover; retry the import once and offer Reload | Stage 1 post-merge check (now also the lazy Seasonal chunk) | 8 |
| B10 | Defra trade-code comparison for the Food Origins baskets (gate G3, S05 ODS) before adding the other 11 | Stage 2 | Data pipeline (roadmap §5.3) |
| B11 | Commodity search and grouping once there are 16 baskets (FO-01) | Stage 2 | Data pipeline (roadmap §5.3) |
| B12 | ~~"Fit to partners" map control~~ Done: "Fit to recorded partners" control and F key (ADR-0018) | Stage 2 screenshots | Done (review 23 Oct 2026) |
| B13 | Retry SDK CIM symbol animations on a newer 5.x patch; if they render, replace the canvas overlay (ADR-0015) | Stage 2 spike | 8 |
| B14 | Schedule `refresh-trade-data.yml` a few days after each HMRC release (next: 12 Nov 2026) and add a diff summary to the PR | Stage 2 | Data pipeline (roadmap §5.3) |
| B15 | Prune superseded raw HMRC caches (keep latest and production snapshot) | ADR-0016 | 8 |
| B16 | Partner table: sortable columns and CSV export of the shown period | Stage 2 | 7 |
| B17 | Seasonal: side-by-side heatmaps for two years in a wider layout (SS-05 alternative); the panel currently offers the change view and the year selector | Stage 3 | 8 |
| B18 | Seasonal: CN8-level view within a basket (e.g. tomatoes by size and truss from 2025), with the code-change caveats | Stage 3 | Later |
| B19 | Seasonal: measure month-change cost on a real GPU and, if needed, defer off-screen chart updates during playback | Stage 3 (sandbox: ~90–130 ms per change with software WebGL) | 8 |
| B20 | Seasonal: annual UK production beside annual imports for tomatoes, strawberries, potatoes (S09) and wheat (S10) once verified, on separate axes and never as a ratio (FO-09, SS-07) | Stage 3 | Data pipeline (roadmap §5.3) |
| B21 | Start-up module count: about 410 SDK modules load before the map is ready, 294 of them under 2 kB. Try Rolldown `codeSplitting` groups for the SDK's start-up modules and measure on GitHub Pages before keeping it (risk: module evaluation order) | Review 23 Oct 2026 | 8 |
| B22 | KPI detail lines are still shortened on narrow cards (laptop, mobile): the full text is in the tooltip and the accessible name. Consider a two-line detail (card height +10 px) | Review 23 Oct 2026 | 8 |
| B23 | Live check on a real GPU with the Esri basemap: framing flight, hover highlight, connection casing over opaque fills | Review 23 Oct 2026 | Next deploy |
| B24 | Seasonal KPI cards still wait for the lazy Seasonal chunk (2.5 s vs 1.1 s for Food Origins in the review measurement); consider moving the KPI component out of the chunk | Review 23 Oct 2026 | 8 |
| B25 | ~~Publish the local datasets~~ Done in Stage 4: each family from its newest snapshot (ADR-0021), header and Evidence wording, S11, S14 and S18 in `catalogue.json` (S12 is a benchmark only, not shown) | Pre-Stage 4 data step (ADR-0020) | Done (Stage 4) |
| B26 | ~~Confirm wholesale, non-food and Crown Dependency stores~~ Decided by John, 24 Oct 2026: wholesale and mainly non-food stores left out; the 125 Crown Dependency stores shown with no council | Pre-Stage 4 data step | Done |
| B27 | ~~Repeat the S12 comparison for the counts Stage 4 displays~~ Done: `displayed` section of `pipeline/reports/ons-s12-comparison-<snapshot>.json` (stage 4 report) | Pre-Stage 4 data step | Done (Stage 4) |
| B28 | Two Northern Ireland shore-front stores fall 14–20 m outside the BFE boundary line (taken to the nearest council): check whether the NI coastline in BFE follows a different water line | Pre-Stage 4 data step | Data pipeline |
| B29 | ~~Intermittent E2E failure on CI: the review hover test's tooltip stays on Turkey after the pointer moves to Morocco.~~ **Done 25 Oct 2026 (Stage 5).** Reproduced locally (about half the runs with three browsers in parallel). Counters on the view container showed the pointer move arrived and its hit test was applied, but 4–12 s later: the hit test on the country fills (a GeoJSON layer) takes 0.6–3 s with software rendering and more under load, while the label points and connections (graphics) take about 1 ms. Hover and click now test the graphics first and the fills only when no graphic is under the pointer (`partnerAt` in `src/map/layers/origins.ts`); 24 of 24 runs passed under the same load. The counters stay (`data-hover-stats`) for diagnostics | Pre-Stage 4 data step; Stage 4; 24 Oct 2026 | Done (Stage 5) |
| B30 | Cluster counts are map labels, whose glyphs come from Esri's font server (`static.arcgis.com/fonts`); with `VITE_ARCGIS_ASSETS=local` and no network they do not draw. Host the one font needed with the local assets, or draw counts another way. The live site draws them (checked 24 Oct 2026), so this affects offline builds only | Stage 4 | 8 |
| B31 | Proximity from a typed postcode or place (needs a postcode lookup, e.g. ONS Postcode Directory, verified first); today the point is a map click, the map centre or a store | Stage 4 | 5 |
| B32 | Optional retailer colouring for store symbols (SM-04: categorical palette, not logos), behind a control, validated per basemap | Stage 4 | Later |
| B33 | Glass panels over bright map content: muted text on the dark-grey glass over the brightest share class computes to about 2.7:1 (light grey uses near-opaque glass, 4.7:1). Measure on the live site and raise the glass opacity if needed (with B3) | Stage 4 (computed, not measured) | 8 |
| B34 | ~~Stores file size (8.5 MB): check the transfer on the live site~~ Done 24 Oct 2026: GitHub Pages serves it gzipped, 1,008 kB transferred for 8,310 kB decoded (217 ms). Revisit (compact map file or vector tiles) only if the store data grows a lot | Stage 4 | Done |
| B35 | Council choropleth at local scale is outline-only by design; consider a subtle fill under the outlines on light grey if users miss the class colour when zoomed in | Stage 4 | Feedback |
| B36 | Map attribution repeats the ONS boundaries credit: once for the council layer and again inside the store layer's credit ("Councils: Source: Office for National Statistics …"). Both are correct; consider one shared credit when the store layer is drawn with the councils | Stage 4 live checks | Later |
| B37 | UK Food Access hover hit-tests GeoJSON layers (stores, councils), which are slow with software rendering (B29). If its hover tests ever flake, test the store symbols first or move to layers with fast hit tests; new Stage 5 small-area layers are drawn as graphics for this reason | Stage 5 (B29 finding) | 8 |
| B38 | Profiles: a legend sample for the chart outline (areas picked from a chart are outlined in the proximity colour; the status line names them, the legend does not) | Stage 5 | 8 |
| B39 | LP-05 national context extras: CPIH food prices, Short Straits dependence (UKFSR 2024) and documented climate/agricultural risks need verified sources first (data step) | Stage 5 | Data pipeline |
| B40 | Scotland in the profiles: Census 2022 car availability (NRS) and the Scottish Government Urban Rural Classification (Data Zones); today both say "Data unavailable" for Scottish councils | Stage 5 | Release 2 |
| B41 | FA-04 attention flags (rule-based, user-editable, never a composite) for the deep-profile small areas | Stage 5 | Release 2 (or earlier if John asks) |
| B42 | Offline outline map at council scale: with no key, closer in than about zoom 8 the map shows only council outlines, stores and small areas (the 1:110m outlines stop there). Consider a finer coastline for offline builds | Stage 5 | Later |
