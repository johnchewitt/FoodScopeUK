# Stage 3 report — Seasonal Supply Explorer

| | |
|---|---|
| **Branch** | `stage/3-seasonal-supply` (based on `docs/stage-2-deployed`, PR #4) |
| **Date** | 23 October 2026 |
| **Scope** | John's Stage 3 brief: the Seasonal Supply Explorer on the existing HMRC monthly data and commodity model (tomatoes, strawberries, bananas, potatoes, wheat). The data-pipeline items that had moved to Stage 3 are listed for scheduling (roadmap §5.3). Stage 4 not started. |
| **Data** | Snapshot **2026-10-23** (HMRC OTS, January 2019 – August 2026), unchanged except for the added commodity-code history. No new API calls. |
| **Result** | All checks pass locally (below): 244 unit and component tests, 45 pipeline tests, 38 E2E tests (9 new), both builds. GitHub Actions CI and the deployed-site check follow the PR. |

## What was built

| Brief / requirement | Built |
|---|---|
| Jan–Dec timeline, selectable year (SS-01) | Bottom timeline with 12 month columns: each shows that month's real recorded imports as a bar, on one scale for every year. Year stepping (‹ 2025 ›) and a year select; a comparison year (default: the year before) and a comparison month (dashed marker) |
| Play/pause, playback speed (SS-03) | Play/pause; ½×, 1×, 2× (2.4, 1.2, 0.6 s per month). Plays to the last published month and stops; from the end it restarts in January. Any user change to month, year, commodity, measure, comparison or module stops it; following a partner or changing the heatmap colour does not. Never starts by itself; not in the URL |
| Slider updates symbology, flow thickness, quantities, KPIs, charts (SS-02) | Pointer press or drag on the track scrubs month by month; the range input gives keyboard control (arrows, Home/End, Page Up/Down for the year, Space to play). One view model feeds the map, cards, charts, heatmap and tables. The selected month is built with the Food Origins model, so it matches Food Origins' month view exactly |
| Seasonal supplier-country heatmap (SS-04, SS-05) | Top 10 partners of the year plus "all other partners" × 12 months, built as a real table. Views: share of the month; tonnes or £; change in share vs the same month of the comparison year (pp). All use fixed classes, the same for every year and commodity. Click a month or cell to move the timeline; click a partner to select it |
| Monthly import trend | Selected year (cyan) vs comparison year (grey), selected-month rule, provisional band, months without figures labelled; peak and lowest month share and month-to-month variation (complete years only); data table |
| Year-on-year comparison | Monthly change bars (cyan higher, amber lower), like-for-like total (e.g. "Jan–Aug 2026 vs Jan–Aug 2025: +0.5 %"), KPI card "Change vs <month> <comparison year>", ± pp in the partner table |
| Monthly concentration (SS-06) | HHI by month for both years |
| Month comparison (SS-08) | Two months of the same year side by side (imports, value, partners, top partner, top-3 share, HHI) and a partner-share chart. An example button answers "How does tomato supply change between January and July?" with 2025 data |
| Smooth, performance-conscious, accurate transitions | Connection widths ease ≤ 320 ms and end exactly at the model values; fills, numbers and labels switch at once; instant under reduced motion (ADR-0017). Charts update in place (≤ 300 ms). The Seasonal code loads only when the module opens |
| Missing months, partial data | Unpublished (Sep–Dec 2026) and pre-snapshot months are hatched on the timeline and heatmap and left empty in charts. Selecting one gives "Not published" on every card and a map banner; nothing is drawn or estimated. Nil months are "no recorded imports". Partial years: no annual figures, like-for-like year-on-year. Provisional months are marked. Series breaks between the two years raise a warning. A year or comparison year outside the snapshot falls back with a warning |
| Commodity-code changes | Pipeline-derived code history (below). Notices: tomatoes (Jan 2025, three new codes), bananas (Jan 2024 split), potatoes (seasonal new-potatoes code). The full code list shows each code's recorded months |
| Unverified seasonal domestic production (SS-07) | "Supply shown: Imports" only. "UK production" and "Combined" are visible but disabled, with the reason per commodity (S09/S10 annual and not verified; none identified for bananas). Imports are never used to estimate production |
| Maintain existing design and functionality | Same shell, tokens and components. Food Origins unchanged; its 10 E2E tests and the Stage 1 smoke and responsive tests still pass. Shared commodity selector extracted; Help text corrected |

**Pipeline (offline, from the committed raw cache).** `build-trade` now writes code history for each CN8 code: `firstMonth`, `lastMonth`, `monthsRecorded`, `calendarMonths` and `netMassKgByCalendarMonth`. It also writes basket `codeChanges`; the schema fields are additive and optional. The Stage 2 figures are unchanged: SHA-256 fingerprints of every Stage 2 field match the files merged in PR #3. Code-history tests recompute everything from the raw responses.

## Reference values (independent Python over the snapshot)

| Check | Python | App |
|---|---|---|
| Tomatoes Jan 2025 total | 33,060.038 t (API-reconciled) | 33.1 kt |
| … vs Jan 2024 | −8.99 % (36.3 kt) | −9.0 % |
| … top partner / HHI | Morocco 42.52 % / 2,736.1 | 42.5 % / 2,740 |
| Tomatoes Jul 2025 | 33,168.836 t; +2.15 % vs Jul 2024; Netherlands 63.81 %; HHI 4,684.4; 8.51 % of 2025 | 33.2 kt; +2.2 %; 63.8 %; 4,680; 8.5 % |
| Tomatoes 2025 seasonality | annual 389,778.841 t; peak Apr 9.60 %; lowest Sep 7.37 %; CV 8.12 % | same (unit tests) |
| Tomatoes Mar 2025 vs Mar 2024; 2025 vs 2024 | +20.7 %; −1.5 % | same (bars, like-for-like) |
| Tomatoes Jan–Aug 2026 vs Jan–Aug 2025 | 269,216.06 vs 267,913.561 t, +0.49 % | +0.5 % |
| Heatmap cell: Morocco, Jan 2025 | 14,056.585 t, 42.52 %, −2.27 pp vs Jan 2024 | same (model test) |
| Fixed width scale | tomatoes NL Jul 2026 24,806.216 t; bananas CO Dec 2025 90,419 t; wheat DE Nov 2024 159,300 t | same |
| Netherlands width, Jul 2025 | 1.5 + 10.5 × 21,163.862 ÷ 24,806.216 = 10.458 px | 10.458 px (read from the ArcGIS graphic, E2E) |
| Potatoes `07019050` | 99.6 % of net mass in Jan–Jun; 10.8 % of the basket | same |
| Wheat Jan 2022 vs Jan 2021 | 116,101.308 vs 114,103.626 t | +1.8 %, with a series-break warning |

## Colour checks (dataviz palette validator, panel surface `#073435`)

| Scale | Result |
|---|---|
| Sequential (share and amount), teal → cyan, 6 classes | Lightness monotone, adjacent steps ≥ 0.06, lowest class 2.58:1 against the panel, single hue: **all pass**. A first ramp failed (lowest class 1.91:1) and was re-stepped |
| Diverging (change), 3 classes per side | **Rejected**: the inner opposite steps reached only ΔE 5.3 under simulated deuteranopia (fail) |
| Diverging, 2 per side + neutral (adopted) | Each arm monotone with steps ≥ 0.06 and neutral 2.05:1. Inner opposite steps: ΔE 8.2 (deutan, target 8 met); normal-vision ΔE 12.5 (below the 15 categorical floor, which is not designed for diverging ramps). Mitigated: a +/− sign in every non-neutral cell |
| Selected vs comparison year (cyan vs grey) | ΔE 12.4 deutan, 16.1 normal, contrast ≥ 3:1. Band and chroma checks flag the grey by design: "highlight one, grey the rest", with a legend and a table view |

## Commands run and results (sandbox, 23 Oct 2026)

| Command | Result |
|---|---|
| `npm run check:banned` | OK |
| `npm run format` | All files formatted |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 0 warnings |
| `npm test` | **244 passed** (19 files): 25 seasonal analysis, 4 transition, 19 Seasonal view-model and 8 Seasonal component tests (real snapshot), plus URL/playback/layout tests and all earlier tests |
| `npm run gen:types` | `trade-snapshot.ts` regenerated for the new optional fields and committed |
| `cd pipeline && uv run pytest` | **45 passed** (36 earlier + Stage 2 fingerprints ×5, code changes, code history vs raw rows, seasonal potato code, detection rules) |
| `uv run foodscope-pipeline build-trade --snapshot 2026-10-23` then `publish` | Snapshot rebuilt offline; reruns byte-identical (test) |
| `npm run build` (CDN) | Success. Startup JS 842.4 kB (265.0 kB gzip) over 35 files. `main` built the same way: 834.7 kB (260.5 kB gzip), so +4.5 kB gzip. Seasonal chunk 56.9 kB (17.1 kB gzip), loaded only when the module opens. Lazy map chunk 1.17 MB (279.6 kB gzip) |
| `VITE_ARCGIS_ASSETS=local npm run build` + `npm run e2e` | **38 passed**: 29 earlier (Food Origins, smoke, responsive) and 9 new Seasonal tests. The new tests cover real figures; slider → map fill class, connection width and cards; keyboard; play/pause/speed; unpublished month; reduced motion; heatmap and comparison; axe; mobile 390 × 844 with touch |

Performance measured in the sandbox (headless Chromium, software WebGL):
- view model plus chart options take 6.2 ms per month change (wheat, Node);
- a month change in the browser costs a 90–130 ms React update, with long tasks of 107–154 ms;
- idle with reduced motion runs at 60 fps once loaded; with markers moving, Food Origins and Seasonal both drop to about 6 fps there (software rendering of the canvas over the WebGL map; smooth on a real GPU in Stage 2).

Screenshots (offline outline map; the live site adds the Esri basemap):
- [tomatoes Jan 2025](stage-3/seasonal-tomatoes-jan-2025-1920.png)
- [Jan vs Jul 2025](stage-3/seasonal-jan-vs-jul-2025-1920.png)
- [change view 1366](stage-3/seasonal-change-view-1366.png)
- [unpublished Oct 2026](stage-3/seasonal-unpublished-oct-2026-1920.png)
- [potatoes, tonnes](stage-3/seasonal-potatoes-amount-1920.png)
- [mobile 390](stage-3/seasonal-mobile-390.png) and [mobile insights](stage-3/seasonal-mobile-390-insights.png)

## Not verified, and why

- **Transitions and playback on a real GPU** are verified only in headless Chromium with software WebGL. There, frames are too slow to catch a width transition mid-way. Instead:
  - E2E checks that a transition starts (and none under reduced motion) and that widths end exactly at the model values;
  - the easing is unit tested.

  A live check after merge is still to do (roadmap §5.2).
- **Month-change cost on real hardware:** measured only in the sandbox (90–130 ms). B19 covers deferring off-screen chart updates if a real device needs it.
- **Firefox and Safari:** only Chromium was tested.
- **Real phone:** the mobile test uses Chromium with touch emulation at 390 × 844, not a device.
- **Screen readers:** axe finds no serious or critical issues, and the heatmap is a table with text in every cell. No manual screen-reader pass was done.
- **Colour over the live Esri basemap:** the heatmap colours are validated against the panel surface; map shading over the basemap was checked by eye in Stage 2 only (B3).
- **UK production:** not verified, so nothing is shown (SS-07; S09/S10 still "to verify").

## Decisions and deviations

- **Stage numbering:** Stage 3 follows John's brief (Seasonal Supply only). Pipeline items are listed for scheduling, not dropped (roadmap §5.3).
- **Fixed connection-width scale in Seasonal** (12 px = the largest monthly value from one partner in the snapshot). Food Origins keeps its period-relative scale. Without it, every month's largest partner would be drawn the same width (ADR-0017).
- **Only widths are eased;** classes, numbers and labels never interpolate. Missing months are never estimated (ADR-0017).
- **Change view with five classes,** after the colour check above.
- **SS-05:** a difference view plus the year selector, rather than two heatmaps side by side in a 340 px panel (B17).
- **SS-07:** no annual figure either, because S09/S10 are not verified.
- **Selecting an unpublished month is allowed and explained** (cards, map banner, hatched column), not silently moved to the latest month as the Food Origins period does.
- **KPI cards:**
  - recorded imports, with the month's share of the year in the detail;
  - change vs the same month of the comparison year;
  - top partner;
  - monthly HHI.

  The spec's planned "peak-month share" is in the trend section, since it is a year-level figure.
- **Heatmap as an HTML table** (CSS tokens) rather than a chart: hatching, a text equivalent and keyboard access come for free.
- **Shared state:** commodity, year, month, measure and partner are shared with Food Origins; new URL keys are `cy`, `cm` and `hm`.

## Open questions

1. Merge and deploy PR: I can then check playback and transitions on your GPU and measure a month change on real hardware.
2. How should the items moved out of Stage 3 be scheduled? They are the other 11 baskets and the Defra codes (G3), LAD/GEOLYTIX (needed by Stage 4), the Defra context file, FO-08/FO-09 and the scheduled refresh.
3. Should playback loop (December → January) or keep stopping at the end of the year, as now?
