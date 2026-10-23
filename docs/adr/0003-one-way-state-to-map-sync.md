# ADR-0003 — One-way sync: Zustand store → map controllers

- Status: Accepted (Stage 1)
- Date: 2026-10-23

## Context
React re-renders and ArcGIS's mutable view must not fight. The brief requires map interactions and React state to stay synchronised.

## Decision
- The Zustand store is the single source of truth and holds only serialisable values.
- `MapController` (src/map) subscribes to the store and applies changes to the view: padding from panel state, camera commands (`mapCommand` with an incrementing id so each runs once), and layer controller updates.
- Layer controllers implement `activate / update / deactivate` and are idempotent.
- The view reports back only through typed store actions (`setMapStatus`, `setLayerStatus`).
- `<arcgis-map>` is mounted once by `MapHost`, loaded lazily so the SDK does not block the shell.

## Consequences
Controllers are unit-tested against a fake `ViewLike`. Playwright verifies end to end that panel toggles change `view.padding` and that map buttons move the camera.
