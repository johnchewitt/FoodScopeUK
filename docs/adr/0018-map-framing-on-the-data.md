# ADR-0018 — Map framing on the data

- Status: Accepted (post-Stage 3 review)
- Date: 2026-10-23

## Context
The trade views opened on the whole world at zoom 2. At 1920 × 1080 the connections for tomatoes, the default commodity, covered about 5 % of the map: a small knot around the UK. This was confirmed on the live site with the Esri basemap. The flows are the app's flagship visual and the reason the map is the centrepiece. Backlog items B5 and B12 had already noted the problem. Framing also has to stay clear of the docked panels, the KPI cards and the timeline, and of the legend card, which on desktop is open at the bottom left of the map, where partners south and west of the UK are drawn.

## Decision
1. **What is framed.** The shared map model `OriginsMapModel` carries `frame: { key, bbox }`, built from pure functions in `src/analysis/frame.ts`. `bbox` is the box around every vertex of the drawn connections, joined with the whole UK. The UK extent is taken from the Natural Earth 1:110m outlines the map draws; a unit test checks it against the committed GeoJSON. In Food Origins the connections are the period's top N. In Seasonal Supply they are the year's top N, so the view stays still while the months play.
2. **When it is framed.** The view is framed on the first view, when the commodity changes (`key` is the commodity id), and when the user asks:
   - the "Fit to recorded partners" map control;
   - the F key.

   It is never framed on a month, year, period or measure change, so it does not fight a user who has panned or zoomed. Switching between Food Origins and Seasonal Supply with the same commodity keeps the view.
3. **How it is framed.** `fitBBox` computes the Web Mercator centre and zoom that fit the box into the area left free by the panels, the KPI cards and the timeline (the view's padding), with a 28 px margin.
   - **Desktop legend:** on desktop the framing area also excludes the legend column (`framingPadding`). The centre is then offset so the box sits in the middle of that smaller area.
   - **Zoom:** clamped to 2–6.
   - **Minimum box:** 24° × 14°, so a cluster of neighbours is never framed at street level.
4. **Motion.** The first frame replaces the default world view instantly. Later frames fly in 1.6 s, or jump instantly under reduced motion.
5. **Purity.** All the maths is pure and unit tested. The map controller only reads the frame from the store and calls `view.goTo` (ADR-03).

## Consequences
- The default tomato view opens at about zoom 4.2 instead of 2, with the whole UK, Morocco and Turkey on screen and clear of every panel (tested in E2E at 1920 × 1080).
- Fitting the drawn connections can leave a small partner without a connection (beyond the top N) off screen. Its share is still in the table and charts, and the globe control shows the world.
- MapView's `padding` is an Accessor whose sides are prototype getters, so spreading it copies nothing. `framingPadding` reads each side explicitly, and a unit test uses getter-based padding.
