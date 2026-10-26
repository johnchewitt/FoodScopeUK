# Data step — the sixteen Food Origins baskets (26 October 2026)

John asked on 26 Oct 2026 for "all 11 commodities" to be added: the rest of spec §6.1. Branch: `data/trade-16-baskets` (from `main` after Stage 6). Design: ADR-0025. Stage 7 has not been started.

## What was built

**HMRC data (S01).** Snapshot `2026-10-26` holds all sixteen baskets; the five Stage 2 baskets are unchanged.

| Group | Baskets (UI label, HS scope) |
|---|---|
| Fruit and vegetables | Tomatoes 0702 · Potatoes 0701 · Strawberries 0810 10 · **Apples 0808 10** · **Oranges 0805 10** · Bananas 0803 |
| Cereals | Wheat 1001 · **Rice 1006** |
| Meat | **Beef and veal** 0201, 0202 · **Sheep and goat meat** 0204 · **Poultry meat** 0207 |
| Dairy | **Milk products (not cheese)** 0401–0405 · **Cheese** 0406 |
| Sugar, coffee and cocoa | **Sugar** 1701 · **Coffee** 0901 · **Cocoa** 1801, 1803–1805 |

- **Fetch.** `refresh-trade-data.yml` on `data-refresh/2026-10-26`, merged into this branch. Run 40297475958 made 122 requests in about four minutes; August 2026 is still the latest month.
- **Query size.** The first run failed: HMRC answered HTTP 400 to a `/Commodity` filter of 24 OR-ed headings, a URL of only about 750 characters, so the limit is the filter's size.
  - The pipeline now sends at most ten comparisons per filter, the largest list proven on 23 Oct.
  - Longer code lists are split into exact parts (`<prefix>-cNN`): poultry needs 16 parts, milk products 14.
  - Ingest failures are now job annotations, because the job log is not readable from the sandbox.
- **Ids** for two baskets are hyphenated (`sheep-goat`, `milk-products`): the app's URL pattern refused underscores. This was caught before any data was cached.
- **Groups** follow the SITC divisions Defra uses. They are in the config and the trade index (`groups`, `group`).

**Gate G3 (S05, Defra trade codes).**
- New command `check-baskets`; report `pipeline/reports/basket-codes-2026-10-26.json`.
- The Defra file (15 Nov 2022, 8,031 codes) was fetched with a new `fetch-reference --set trade`.
- Result: every basket's codes sit in one SITC division. There are eight definitional differences from Defra's own groups, all stated in the basket definitions:
  - instant coffee (2101) is in Defra's coffee group;
  - cocoa shells and chocolate (1802, 1806) are in its cocoa group;
  - goat meat is grouped with other meat (0205, 0206, 0208);
  - potatoes for starch sit with 1108 and 1903.
- HMRC codes missing from Defra's table all date from 2023 onwards.

**National context (S09, S10, S05).** New context snapshot `2026-10-26`; its council context is byte-identical to 2026-10-25's. Defra's 2025 supply balances, as published:

| Basket | Table | UK production as % of supply |
|---|---|---|
| Apples | Horticulture 2025, Table 12 | 47.4 % |
| Sugar | AUK 7.6b, refined basis (provisional) | 60.9 % |
| Beef and veal | AUK 8.2d | 84.3 % |
| Mutton and lamb (for sheep and goat meat) | AUK 8.4d | 102.7 % |
| Poultry meat | AUK 8.5d (revised 3 Sep 2026) | 80.4 % |

- **Not grown commercially in the UK:** oranges, rice, coffee, cocoa and bananas. This follows Defra's indigeneity classification (S05), and a test ties the wording to the file.
- **Dairy:** milk products and cheese have no product supply balance in these files. AUK has raw milk and the milk used for each product; the app says so.

**App.**
- **Picker:** search plus titled groups in two compact columns (B11). It is one radio group with arrow keys over the options shown. Enter picks the first match and Escape clears the search. Codes are searched within ranges, so 0403 finds milk products.
- **Icons:** 11 new ones.
- **Risk Explorer:**
  - the HHI ranking lists all sixteen, every bar named;
  - the commodity–country matrix compares the selected basket with its group;
  - column names wrap or angle.
- **Seasonal Supply:** for meat and dairy it says a monthly Defra series exists but is not verified yet (S06–S08, Release 2), instead of saying none exists.
- **Profiles:** national context for all sixteen; "includes provisional months" is said once when it applies to every row.
- **Text:** module summaries and Help now describe the sixteen.

## Figures checked against the raw files

An independent script read the raw HMRC pages for all sixteen baskets, single or split, without the pipeline's or the app's code. It found:
- no row duplicated across parts;
- no row outside a basket's codes.

Its HHI, partner count, top partner and share for Sep 2025 – Aug 2026 (net mass) equal the app's for every basket. They are asserted in `src/features/risks/model.test.ts`.

| Basket | HHI | Partners | Top partner |
|---|---|---|---|
| Beef and veal | 4,271 | 31 | Ireland 63.4 % |
| Sheep and goat meat | 3,883 | 18 | New Zealand 49.1 % |
| Tomatoes | 2,992 | 25 | Netherlands 43.8 % |
| Strawberries | 2,637 | 22 | Spain 41.5 % |
| Oranges | 2,626 | 33 | Egypt 34.9 % |
| Cocoa | 2,535 | 61 | Côte d'Ivoire 42.0 % |
| Sugar | 2,473 | 69 | Brazil 46.6 % |
| Milk products (not cheese) | 2,132 | 46 | Ireland 39.8 % |
| Potatoes | 1,950 | 16 | Ireland 35.1 % |
| Apples | 1,869 | 35 | France 31.3 % |
| Poultry meat | 1,786 | 29 | Poland 29.8 % |
| Rice | 1,783 | 67 | India 37.9 % |
| Bananas | 1,650 | 43 | Colombia 30.1 % |
| Wheat | 1,434 | 35 | Canada 22.2 % |
| Coffee | 1,169 | 100 | Brazil 26.7 % |
| Cheese | 1,154 | 41 | Ireland 20.2 % |

Further checks:
- **G1:** all sixteen reconciliation months (one per basket, 2019–2026) match the raw rows exactly.
- **Defra balances:** each satisfies supply = production + imports − exports exactly.
- **Continuity:** the five Stage 2 baskets keep their fingerprints in the new snapshot.

## Commands run and results (sandbox, 26 Oct 2026)

| Command | Result |
|---|---|
| `npm run typecheck`; `npm run lint`; `npm run check:banned` | 0 errors; 0 warnings; OK |
| `npm run format` | All files formatted |
| `npm test` | **509 passed** (36 files; 498 before) |
| `cd pipeline && uv run pytest` | **296 passed, 1 skipped** (the index rebuild of the five-basket 2026-10-23 snapshot, by design) |
| `VITE_ARCGIS_ASSETS=local npm run build`; `npm run build:e2e-basemap` | Both succeed |
| `npm run e2e` | First full run (before merging main): 74 of 75 passed; the failure was the smoke test's trade snapshot date (2026-10-23 → 2026-10-26), fixed. Rerun after merging main (PR #18): **74 of 75 passed** (15.4 min); the failure is the intermittent basemap request count (B49, same symptom: the last imagery request does not reach the stub), which passed in the first run and in 2 of 3 isolated reruns |
| `uv run foodscope-pipeline check-baskets --snapshot 2026-10-26 --defra-snapshot 2026-10-26` | "16 baskets, 8 definitional differences, one SITC division each: True" |
| Screenshots (Origins with cocoa; Risk Explorer with beef; matrix for fruit and vegetables and for meat; Profiles national context; Seasonal with beef) | Picker, ranking and matrix legible; figures as in the table above |

New tests:
- **Pipeline:**
  - URL and clause splitting: a split basket builds the same snapshot as one query;
  - groups and overlaps;
  - the spec's scopes and the URL pattern;
  - the trade set;
  - G3 (`test_basket_codes.py`);
  - production for the eleven;
  - snapshot tests over both trade snapshots.
- **App:** grouping and code search (`commodityGroups.test.ts`); the sixteen baskets against the raw-response values; the matrix per group.
- **E2E:** search by code (0406 finds cheese) and by group, Escape, and the group titles.

## Not verified, and why

- **The live site** with a real GPU and the Esri basemap (with B48, after merge).
- **HMRC's filter limit** is not documented. Ten is the largest list it has answered; 24 failed. Lists between 11 and 23 were not tried.
- **Defra's monthly meat and milk series** (S06–S08) are not verified, so Seasonal Supply shows no UK production for meat and dairy (B50).
- **Dairy context:** no product-level supply balance was found in the files used (B51).
- **Defra's trade codes** date from Nov 2022, so codes introduced since are not classified. The G3 report lists those with imports.

## Open questions for John

1. **Milk products and cocoa** add unlike products by mass, as the spec defines them: liquid milk with powders and butter, beans with butter and powder. Partner shares by value compare them fairly; shares by mass are dominated by bulky products. Keep them as one basket each, or split them (B52)?
2. **The matrix** now compares a commodity with its own group, because sixteen columns do not fit the panel. Is that the comparison you want, or would you prefer a choice of commodities?
3. **Lamb** is shown as "Sheep and goat meat": the basket is HS 0204, lamb and mutton plus goat meat (0204 50: 3.2 % of its recorded net mass, Sep 2025 – Aug 2026). Defra's balance (AUK) is mutton and lamb only; since PR #20 the profile and the Risk Explorer show that scope beside the figure. Keep goat in the basket, or restrict it to lamb and mutton?

## Addendum: independent review and fixes (PR #20, 26 Oct 2026)

An independent review of PR #19, run after its merge, found no error in the trade figures. It re-derived every split query, the reconciliations and the shown figures from the raw responses. It did find the following, all fixed in PR #20:

- **Goat meat.** The sheep and goat basket said the trade codes do not separate goat meat. They do (HS 0204 50, 12 codes). The definition, the spec's §6.1 row and the docs are corrected; the basket keeps HS 0204 (question 3 above).
- **Contradictory production text.** Seasonal Supply's data notes and the Evidence page still said Defra publishes production of every commodity once a year. The note now comes from each basket's status; the Evidence caveat covers annual, monthly-not-verified and not-grown-in-the-UK.
- **Defra's scope not shown.** Each published production figure now carries a short scope from the config (e.g. "Defra: mutton and lamb only (no goat meat), carcase weight"). It is shown beside the figure in the profiles and the Risk Explorer, and is in the indicators' coverage. The Risk Explorer also shows Defra's notes. The poultry production label now matches Defra's row ("Production"), and the apples note adds Table 12's footnote (non-commercial orchards).
- **Picker.**
  - Enter in an empty search box no longer changes the commodity.
  - Search ignores what a definition excludes and "(not …)" in a name, so "cheese" no longer finds milk products, and "offal" no longer finds beef.
  - Enter picks the best match, a name first; "HS 0403" works like "0403".
  - The result count is announced on the first change, and the tab stop moves to the best match when the search hides the selection.
  - A component test covers the keyboard behaviour.
- **Pipeline hardening.**
  - Cache names are matched exactly, so a future `milk` basket can never read `milk-products` pages.
  - Ingest refuses to write into an existing snapshot.
  - The build checks that each basket's query parts name disjoint codes that together make the basket's codes.
  - Reconciliation fails on a group that appears twice instead of overwriting it.
  - Provenance records all three `/Commodity` queries, and gives the real reason for split queries (ten codes per query, not URL length).
  - G3 also lists Defra codes HMRC no longer lists.
  - The split commodity-list test now really splits.
- **Wording.**
  - "Not grown commercially in the UK" now says "every trade code Defra lists under these headings", since newer HMRC codes are not in Defra's 2022 table.
  - Stale stage numbers (Scenario Lab 7, Consulting Insights 8, PDF export 8) are corrected.
  - "routes" in a consulting suggestion becomes "ports of entry".
- **B49 (intermittent basemap E2E).** It failed in two of three full runs on 26 Oct. Playwright's routing disables the HTTP cache, so the missing last imagery request was the view reusing the imagery style it had already loaded. The test still checks that imagery is never requested while zoomed out, and that the view shows imagery when back at local scale. It no longer requires a fresh request. It passed 5 of 5 alone.

**Checks for PR #20 (sandbox):**
- typecheck, lint, format and banned imports pass;
- `npm test`: 517 passed;
- pipeline: 302 passed, 1 skipped (by design);
- full E2E: 74 of 75, where the one failure was B49, then fixed as above and passing 5 of 5.

