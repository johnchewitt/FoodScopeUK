# Backlog

Ideas and follow-ups that are outside the current stage's scope. Move an item into a stage only through the roadmap.

| # | Item | Source | Suggested stage |
|---|---|---|---|
| B1 | Reduce initial JS (606 kB / 184 kB gzip): precompile Ajv validators (standalone), lazy-load the Evidence and Help dialogs, review Calcite imports | Stage 1 measurement | 8 |
| B2 | Add a secret-scanning step to CI (e.g. gitleaks) | Roadmap 3.3 | 2 |
| B3 | Contrast check of glass panels over the live Esri dark grey basemap, once a key is available | Stage 1 report | 3 |
| B4 | Visual polish pass once real data is on screen (KPI hierarchy, legend design, flow styling) | Stage 1 review | 3 |
| B5 | Initial world view: fit the world to the padded map area at every breakpoint (currently centre/zoom 2) | Stage 1 screenshots (1366 px) | 3 |
| B6 | `eslint-plugin-jsx-a11y` for static accessibility linting | Stage 1 | 2 |
| B7 | Bundle-size report in CI with a regression threshold | Architecture §10 | 8 |
| B8 | Decide the code licence for the repository | README | ConsultingWhere |
| B9 | Recover from a failed lazy map chunk (seen once: transient GitHub Pages 503 on first load). `React.lazy` caches the rejected import, so "Try again" cannot recover; retry the import once and offer Reload | Stage 1 post-merge check | 3 |
| B10 | Defra trade-code comparison for the Food Origins baskets (gate G3, S05 ODS) before adding the other 11 | Stage 2 | 3 |
| B11 | Commodity search and grouping once there are 16 baskets (FO-01) | Stage 2 | 3 |
| B12 | "Fit to partners" map control: zoom to the selected commodity's recorded partners (short European connections bunch at world scale) | Stage 2 screenshots | 3 |
| B13 | Retry SDK CIM symbol animations on a newer 5.x patch; if they render, replace the canvas overlay (ADR-0015) | Stage 2 spike | 8 |
| B14 | Schedule `refresh-trade-data.yml` a few days after each HMRC release (next: 12 Nov 2026) and add a diff summary to the PR | Stage 2 | 3 |
| B15 | Prune superseded raw HMRC caches (keep latest and production snapshot) | ADR-0016 | 8 |
| B16 | Partner table: sortable columns and CSV export of the shown period | Stage 2 | 7 |

