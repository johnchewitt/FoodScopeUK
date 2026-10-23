# ADR-0005 — Flows as symbolic curves to a single UK point

- Status: Accepted (Stage 2; supersedes the proposed great-circle version)
- Date: 2026-10-23

## Context
FO-03 needs a connection from each recorded import partner to the UK whose width carries the recorded quantity, without implying a shipping route or a port of entry (P3, P4). Great-circle arcs look like routes (and some cross land masses no ship would), so they invite the wrong reading.

## Decision
- One polyline per partner from its Natural Earth label point (S24, 1:50m `LABEL_X/LABEL_Y`) to one UK point (the United Kingdom label point). Never a port.
- The path is a quadratic Bézier in Web Mercator map space, bowed to the left of the direction of travel by 0.18 × the chord (`src/analysis/arcs.ts`). Longitudes are not wrapped, so no curve jumps across the map. It is described in the legend and Evidence page as a symbolic link, not a route.
- Width is linear in the selected measure between 1.5 px and 12 px, scaled to the largest connection drawn; the legend shows both ends. Top-N partners (default 12, 3–25) are drawn; every partner stays in the table.
- Partners without geometry (e.g. Gibraltar) get no connection and are flagged in the table; the UK itself never gets one.
- Motion: see ADR-0015.

## Consequences
Short European connections bunch near the UK at world scale; users zoom in to separate them. The curve shape carries no information, which the legend states.
