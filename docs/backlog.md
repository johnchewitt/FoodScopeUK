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
