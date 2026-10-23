# Stage 2 report — Food Origins explorer + HMRC trade pipeline

| | |
|---|---|
| **Branch** | `stage/2-origins-explorer` |
| **Date** | 23 October 2026 |
| **Scope** | John's Stage 2 brief: the global food origins explorer with real HMRC data for tomatoes, strawberries, bananas, potatoes and wheat. This merges the HMRC part of the former "Data pipeline v1" with the core of the former Food Origins slice; everything else moves to Stage 3 (roadmap §1, §4). Stage 3 not started. |
| **Data** | Snapshot **2026-10-23**: monthly recorded UK imports, **January 2019 – August 2026**, from the HMRC Overseas Trade Statistics API, ingested on GitHub Actions ([run 39969667036](https://github.com/johnchewitt/FoodScopeUK/actions/runs/39969667036), 15 API requests) |
| **Result** | All local checks pass (below). GitHub Actions CI passed on PR #3 ([run 39982578050](https://github.com/johnchewitt/FoodScopeUK/actions/runs/39982578050)): both jobs, including the 29 E2E tests. Merged 23 Oct 2026 and deployed ([run 39987833601](https://github.com/johnchewitt/FoodScopeUK/actions/runs/39987833601)); live-site check below. |

## What was built

**Verified source and codes (S01, gates G1, G2, G4; G3 partly).** The HMRC API was checked from its documentation, live queries (desktop browser) and the pipeline itself. `$apply` aggregation matches raw `/OTS` rows exactly for five basket-months. Import values are CIF statistical value (Intrastat: invoice value), and figures are provisional for up to 18 months. The partner is the country of dispatch. Basket CN8 lists come from `/Commodity`, including discontinued codes, so the series is continuous. Full detail is in `docs/03-DATA-SOURCES.md` §S01.

| Basket | HS scope | CN8 codes | Partners (since 2019) | 12 months to Aug 2026 |
|---|---|---|---|---|
| Tomatoes | 0702 | 4 | 43 | 391.1 kt; Netherlands 43.8 %, Morocco 29.6 %, Spain 11.0 % |
| Strawberries | 0810 10 | 1 | 48 | 73.2 kt; Spain 41.5 %, Egypt 23.3 %, Netherlands 17.6 % |
| Bananas | 0803 | 9 | 67 | 832.6 kt; Colombia 30.1 %, Costa Rica 21.5 %, Ecuador 8.9 % |
| Potatoes | 0701 | 4 | 35 | 67.2 kt; Ireland 35.1 %, Netherlands 16.1 %, Israel 11.9 % |
| Wheat | 1001 | 10 | 65 | 2.5 Mt; Canada 22.2 %, Denmark 17.5 %, Germany 17.5 % |

Shares are of recorded net mass allocated to countries. No suppressed trade and no non-country HMRC categories occur in these baskets since 2019. The app still handles both and says so.

**Reproducible ingestion and caching**
- `pipeline/foodscope_pipeline/sources/hmrc_ots.py` (online):
  - deterministic OData query builders and a limit of 50 requests a minute;
  - retries (a 60-second wait after HTTP 429) and `@odata.nextLink` paging;
  - every response cached byte-for-byte, gzip with mtime 0, with its URL, timestamp, SHA-256 and item count in `pipeline/raw/hmrc/2026-10-23/` (196 KB, committed).
- `trade.py` (offline):
  - HMRC ↔ Natural Earth crosswalk; aggregation to month × partner;
  - suppressed and non-country buckets, nil months and the provisional window;
  - row accounting (`pipeline/reports/trade-accounting-2026-10-23.json`);
  - reconciliation against raw rows (`hmrc-reconciliation-2026-10-23.json`) — the build fails on any mismatch;
  - schema validation and provenance sidecars.
- `publish` now lists every sidecar under `reference/` and the newest snapshot.
- `.github/workflows/refresh-trade-data.yml` runs the online step on GitHub Actions. The sandbox's proxy refuses `api.uktradeinfo.com`, and the browser never calls it. A push to `data-refresh/**` commits back to that branch; a manual run opens a PR (ADR-0016).
- Reference geometry is now Natural Earth **v5.1.2**, pinned by SHA-256: 176 outlines with ISO codes, and 237 label points at 1:50m for small partners.

**Explorer** (shell unchanged apart from module content)

| Requirement | Built |
|---|---|
| FO-01 | Commodity selector: radio group with icons, HS scope and definition, arrow/Home/End keys. Unknown commodities in a link fall back with a notice |
| FO-02 | Partners shaded by share (fixed classes < 1, 1–5, 5–10, 10–25, 25–50, ≥ 50 %); selected partner outlined green; hover highlight and tooltip, including non-partners ("no recorded imports"); small partners as points; Gibraltar listed as not drawn |
| FO-03 | Symbolic curved connections from each top partner's Natural Earth label point to one UK point (never a port). Width is linear in the measure (1.5–12 px), top 3–25 partners (default 12), with a legend and "not shipping routes" wording (ADR-0005) |
| FO-04 | Moving markers towards the UK on a canvas overlay that follows pan and zoom; off under reduced motion or the in-app switch (ADR-0015) |
| FO-05 | KPI cards: recorded imports (t or £) with the other measure and change vs the same period a year earlier; partner count and effective number; top partner share with top-3; HHI with last year's value. All are provenance-complete `Indicator`s with badges |
| FO-06 | Partner table: rank, partner, tonnes, £, share and ± pp vs a year earlier, plus "not drawn on the map" and "connection drawn" flags. Row buttons select the partner; trade not attributed to a country is listed separately |
| FO-07 | Period: rolling 12 months (default: latest 12 complete months), single month, calendar year; year select; timeline sets the month and crosses years with arrow keys; unpublished months disabled |
| FO-10 | Persistent caveat chip (controls and insights) linking to the Evidence page, which now has a trade-caveats section |
| FO-11 | Monthly trend chart marks the January 2021 and January 2022 series breaks and the provisional months; data table alternative |

**Synchronisation.** One view model, `buildOriginsModel()`, feeds the cards, charts, table, timeline and the map model in the store, so they cannot disagree:
- Map click selects the partner everywhere, and so does a table row or a bar in the share chart.
- Clicking a month on the trend chart moves the timeline.
- Every selection is mirrored to the URL (`?c=…&pm=…&y=…&mo=…&ms=…&p=…`), and deep links restore it.

**Unavailable observations are labelled**, never hidden:
- months not yet published, and months before the snapshot;
- no comparison year (e.g. 2019);
- nil months, small bases (< 100 t) and provisional months;
- partners with no recorded imports in the period, and partners without map geometry;
- suppressed or non-country trade ("None in this period" when absent);
- data that fails schema validation, rejected with an error state.

Screenshots (offline outline map; the live site adds the Esri basemap):
- [tomatoes 1920](stage-2/origins-tomatoes-1920.png)
- [Jan 2025, Morocco](stage-2/origins-tomatoes-jan-2025-morocco.png) vs [Jul 2025, Netherlands](stage-2/origins-tomatoes-jul-2025-netherlands.png)
- [bananas](stage-2/origins-bananas-1920.png)
- [trend chart](stage-2/origins-insights-trend.png)
- [Evidence](stage-2/evidence-dialog-1920.png)
- [wheat 1366](stage-2/origins-wheat-1366.png)
- [strawberries 390](stage-2/origins-strawberries-390.png)

## Commands run and results (sandbox, 23 Oct 2026)

| Command | Result |
|---|---|
| `npm run check:banned` | OK |
| `npm run format` | All files formatted |
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 0 warnings |
| `npm test` | **178 passed** (15 files). Includes 49 analysis tests (synthetic edge cases and real tomato figures), 11 view-model tests and component tests on the committed snapshot |
| `npm run gen:types` + `git status` | Generated types current (new: trade-index, trade-snapshot, country-points) |
| `cd pipeline && uv run pytest` | **36 passed**. Includes an offline rebuild of the committed snapshot that is byte-identical, raw-cache checksums, the reconciliation and synthetic end-to-end ingest tests with a fake API |
| `npm run build` (CDN) | Success. Initial JS 656.1 kB (198.5 kB gzip); lazy map chunk 1.16 MB (278.7 kB gzip); `dist/` 22 MB |
| `VITE_ARCGIS_ASSETS=local npm run build` + `npm run e2e` | **29 passed** (10 new Food Origins tests: real figures, commodity change, table → map, map click → table, timeline/period/measure sync, deep link, fallback, reduced motion, motion switch, module switch) |
| GitHub Actions `Refresh trade data (HMRC)` | Success: 15 requests in 80 s, reconciliation 5/5 match, pipeline tests pass, data committed (`4474eef`) |
| Data payload (gzip) | Trade files 12–26 kB each (index 0.5 kB); outlines 66 kB; points 6 kB |

Key reconciled figure: tomatoes, January 2025, all partners. The API aggregate and the 117 raw rows both give 33,060,038 kg and £57,382,707. Tomato shares shift with the season: Morocco leads in January 2025 (42.5 %); the Netherlands leads in July 2025 (63.8 %).

## Deployed-site check (after merge, 23 Oct 2026)

| Check | Result |
|---|---|
| `Deploy to GitHub Pages` ([run 39987833601](https://github.com/johnchewitt/FoodScopeUK/actions/runs/39987833601)) | Build, deploy and post-deploy smoke test passed. The smoke test runs the shell test against the live URL: map ready, Esri basemap ready, no sign-in prompt, no console errors |
| John's desktop browser, fresh tab, `https://johnchewitt.github.io/FoodScopeUK/` (877 × 1191 CSS px, device pixel ratio 2) | `data-map-state` ready, `data-basemap-status` ready. Both Esri `arcgis/dark-gray` layers (base, labels) loaded with layer views. No sign-in prompt. The only console message is Calcite's version notice |
| Default view figures | 391.1 kt, £679.5m, 25 partners (effective 3.3), Netherlands 43.8 % (top 3: 84.5 %), HHI 2,990 (2,970 a year earlier): the same as E2E |
| "±0.0 % vs previous 12 months" on recorded imports | Correct: 391,081 t against 390,983 t (+0.025 %), recomputed from the snapshot. Value rose 7.3 % (£679.5m against £633.2m) |
| Connections and shading | 13 connection graphics (12 + UK point); 25 partners shaded over the basemap |
| Moving markers (FO-04) on a real GPU | Canvas overlay: 12 markers at world scale, 27 at zoom 4 over Europe. Two frames 300 ms apart: 4,473 changed pixels against 2,253 lit ones, so every marker had moved. Markers sit on their lines ([screenshot](stage-2/live-tomatoes-europe-esri.jpg)) |

## Not verified, and why

- **Colour contrast of the share classes over the dark grey basemap (B3):** checked by eye on the live site, not measured. The top classes (Morocco, the Netherlands) stand out. Adjacent lower classes are close in tone at a glance; the legend and tooltip carry the exact class.
- **Defra trade-code alignment (G3):** baskets are verified against HMRC `/Commodity` only; the Defra ODS comparison is in Stage 3 (B10).
- **Firefox and Safari:** only Chromium was tested.
- **Performance budgets (PF-01 – PF-03):** not measured with throttling. Interaction updates are synchronous over at most about 2,600 rows per basket. The initial JS bundle remains above budget (B1).
- **Scheduled refresh:** not set up. The workflow runs on push or by hand (B14).
- **CORS on the HMRC API:** not needed, because the browser never calls it.

## Decisions and deviations

- **Stage numbering:**
  - Stage 2 follows John's brief rather than the original roadmap.
  - FO-08 (supplier pattern changes), FO-09 (UK production context), the other 11 commodities, commodity search, LAD/GEOLYTIX/Defra ingest and the scheduled refresh move to Stage 3.
- **Natural Earth v5.1.2** replaces world-atlas 4.1.0, giving ISO alpha-2 codes and official label points. HMRC's `CountryCodeNumeric` turned out not to be ISO numeric. Antarctica is omitted from the outlines.
- **Connections are Bézier curves in map space, not great circles.** Great circles read as routes (ADR-0005).
- **Motion is on a canvas overlay:** every CIM animation tried (MoveAlongLine, scale, transparency) made its symbol disappear in both environments (ADR-0015).
- **Raw HMRC responses are committed** so the snapshot can be rebuilt and audited offline (ADR-0016).
- **Partner key** is the ISO alpha-2 code; HMRC ids sharing a code (two `US` ids) are merged. HMRC non-country categories are keyed `hmrc-<id>` and kept out of shares.
- **KPI cards show the provenance class as a glyph** in the card header; full badges appear in the Insights panel and Evidence page.

## Open questions

1. ~~Merge and deploy~~: merged and deployed on 23 October 2026; live check above.
2. Should the trade refresh run automatically after each HMRC release (next: 12 November 2026), opening a PR for you to merge?
3. Which 11 commodities come next, and in what order, once the Defra trade codes are checked?
