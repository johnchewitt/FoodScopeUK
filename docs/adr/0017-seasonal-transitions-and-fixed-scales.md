# ADR-0017 — Seasonal Supply: eased widths, fixed scales, nothing interpolated

- Status: Accepted (Stage 3)
- Date: 2026-10-23

## Context
John's Stage 3 brief asks for "smooth performance-conscious transitions, but make the map values statistically accurate" when the user moves the month slider or plays through the year. The spec allows restrained transitions of at most 400 ms, instant under reduced motion (SS-02). It also requires identical class breaks for year-to-year comparison (P11, §7.4) and missing data shown explicitly (P12).

Food Origins (Stage 2) scales connection widths to the largest connection of the period. Applied month by month, that would draw the largest partner at 12 px in every month, so a thin month and a thick month would look the same.

## Decision
1. **Only line widths are eased.** When the month changes, connection widths move from the old month's values to the new month's over 320 ms. The easing is ease-out cubic, implemented in `src/analysis/transition.ts` (unit tested). Symbols update at about 30 fps. A transition ends with every width exactly equal to its model value. Connections leaving the top N shrink to zero and are removed; new ones grow from zero.
2. **Nothing else is interpolated.** Share-class fills switch to the new month at once (the classes are discrete). KPI cards, tooltips, tables, the heatmap and charts show the target month's exact figures from the first frame. Charts animate their marks (ECharts, 300 ms) but never their values or labels.
3. **Reduced motion:** with the OS setting or the in-app switch, widths change at once and no transition starts (`data-flow-transitions` on the view container stays 0; tested in E2E).
4. **Fixed width scale (Seasonal Supply only):** 12 px is the largest monthly value from one drawable partner anywhere in the snapshot (tomatoes: Netherlands, Jul 2026, 24.8 kt). The scale is the same for every month and year and is shown in the legend. Food Origins keeps its period-relative scale.
5. **Fixed heatmap classes:**
   - share uses the map's classes;
   - amount uses six classes, the same for every commodity and year (tonnes: < 10, 10–100, 100–1,000, 1,000–5,000, 5,000–20,000, ≥ 20,000; £ from £10,000 to £20m);
   - change uses five classes: below −5 pp, −5 to −1, −1 to +1 (neutral), +1 to +5, +5 and above.

   Three steps per side were rejected: on the dark panel, the inner opposite steps could not be told apart under simulated deuteranopia (ΔE 5.3; validator run in the stage report). Cells with a change also carry a +/− sign.
6. **Missing months** (not yet published, before the snapshot) are never given a value: they are hatched on the timeline and in the heatmap, left empty in charts, and the map draws nothing, with a banner saying why.
7. **Performance:** the year-level matrices are computed once per model build (about 6 ms per month change for wheat, the largest basket). The Seasonal code is loaded only when the module opens (`src/features/seasonal/lazy.tsx`). Playback never starts by itself.

## Consequences
- During a transition (at most 0.32 s) a line can briefly be drawn at a width between two real months. That is the only intermediate state, and every number on screen is already exact.
- A fixed scale makes small partners and low-volume commodities thin (minimum 1.5 px). That is the intended honest encoding.
- In headless Chromium with software WebGL, frames are too slow to catch a transition mid-way. E2E therefore checks that a transition started and that widths end exactly at the model values; the easing itself is unit tested.
