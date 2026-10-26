# ADR-0025 — Sixteen baskets: groups from Defra's SITC divisions, a searchable picker, a matrix per group, small HMRC filters

- Status: Accepted (sixteen-basket data step)
- Date: 2026-10-26

## Context
John asked on 26 Oct 2026 for the other eleven commodity baskets of spec §6.1 to be added:
- apples, oranges, rice;
- beef, lamb (sheep meat), poultry;
- cheese, milk products;
- sugar, coffee, cocoa.

Spec §6.1 requires the baskets to be checked against Defra's trade codes and HMRC's `/Commodity` list before any figure is shown (gate G3). FO-01 asks for a selector with icon, search and keyboard navigation (B11).

The app was built for five baskets:
- a list of large radio buttons;
- a Risk Explorer ranking sized for five bars;
- a commodity–country matrix with one column per basket.

On 26 Oct 2026 the HMRC API answered HTTP 400 to a `/Commodity` filter of 24 OR-ed headings. The URL was only about 750 characters long, so the limit is on the filter's size, not on URL length.

## Decision
1. **Baskets.** The eleven take the spec's HS scopes, with HMRC's headings as the definition. Labels say what the codes hold: "Beef and veal", "Sheep and goat meat" (lamb and mutton, 0204 10–43, and goat meat, 0204 50; most cuts do not separate lamb from mutton), "Poultry meat", "Milk products (not cheese)". Ids are hyphenated (`sheep-goat`, `milk-products`), as the URL pattern requires. Where a basket adds unlike products by net mass (milk products, cocoa), or Defra's own groups are wider (instant coffee; cocoa shells and chocolate), the definition says so.
2. **Groups.** Each basket has a group, in `trade_baskets.json` and the trade index (`groups`, `group`). The groups follow the SITC divisions Defra uses (05 fruit and vegetables, 04 cereals, 01 meat, 02 dairy, 06 sugar with 07 coffee and cocoa). Gate G3 checks that each basket's codes sit in one division. Groups organise the picker and the matrix; they never add baskets together.
3. **Picker.** From eight baskets, the picker shows a search box and titled groups in two compact columns.
   - Search matches name, group, definition or a commodity code; a code matches within ranges such as 0401–0405.
   - Enter picks the first match; Escape clears the search.
   - It stays one radio group: arrow keys move through the options shown, and each option is described by its group.
   - Snapshots without groups keep the single list.
4. **Risk Explorer.** The HHI ranking lists every basket, sized to the number of bars, with every bar named. The commodity–country matrix compares the selected basket with its own group, because sixteen columns do not fit the panel. Column names wrap for up to three commodities and are angled for more.
5. **HMRC filters.** No query sends more than ten OR-ed comparisons: ten is the largest list the API has answered (wheat, 23 Oct 2026). A basket with more codes is fetched as several queries over disjoint, consecutive runs of its codes (`<prefix>-cNN`). `/Commodity` is fetched in queries of at most ten headings. The build reads either form. Every part is reconciled (G1) and tested to build the same snapshot as one query.
6. **National context.** Defra's annual supply balances are added where Defra publishes one, read as published with Defra's notes on coverage:
   - apples: Horticulture 2025, Table 12;
   - sugar: AUK Table 7.6b, refined basis;
   - beef and veal, mutton and lamb, poultry meat: AUK chapter 8.

   Baskets Defra classes as non-indigenous (S05) are "not grown commercially in the UK". The dairy baskets have no product balance in these files and say so. Seasonal Supply now distinguishes "a monthly Defra series exists but is not verified yet" (meat and milk, S06–S08) from "no monthly series".

## Consequences
- A seventeenth basket needs only config, a reconciliation month, an icon and the G3 check. The picker, ranking and matrix adapt.
- The matrix no longer shows cross-group dependence on one country (for example, Ireland across beef, dairy and potatoes). The ranking and each basket's partner table still show it.
- The trade family's newest snapshot is 2026-10-26. The 2026-10-23 snapshot stays committed: unit tests use it as a fixture, and the pipeline tests rebuild it and check the five baskets are identical in both snapshots.
- The context family's newest snapshot is 2026-10-26. It is read from two raw Defra folders (`--raw-snapshot`, `--extra-defra-snapshot`); its council context is byte-identical to 2026-10-25's.
- If the API's filter limit is ever confirmed in its documentation, `MAX_OR_CLAUSES` can be raised. Until then, ten is the proven size.
