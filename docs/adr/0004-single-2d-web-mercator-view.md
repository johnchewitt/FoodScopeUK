# ADR-0004 — Single 2D Web Mercator view

- Status: Accepted (Stage 1)
- Date: 2026-10-23

## Decision
One 2D `MapView` in Web Mercator (WKID 102100) for all modules, so flights between global and local scales are continuous and match Esri basemaps. A 3D globe for Food Origins is a Release 2 option.

## Consequences
- Country area is never used to encode quantities (Mercator distorts area).
- Stage 1 finding: with no basemap (no API key) the view has no tiling scheme and never becomes ready unless zoom levels are supplied. `MapHost` therefore passes `MapViewConstraints` with Web Mercator LODs from `TileInfo.create()` — as Esri's `MapViewConstraints` documentation advises for maps without a basemap.
