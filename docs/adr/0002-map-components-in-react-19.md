# ADR-0002 — ArcGIS map components directly in React 19

- Status: Accepted (Stage 1)
- Date: 2026-10-23

## Context
All widgets were deprecated in ArcGIS Maps SDK 5.0 (removal targeted as early as Q1 2027). Esri staff state `@arcgis/map-components-react` is unnecessary for React 19. `@arcgis/map-components` 5.1.27 ships React JSX typings.

## Decision
- Register elements by import (`@arcgis/map-components/components/arcgis-map`).
- Type JSX with `/// <reference types="@arcgis/map-components/types/react" />` (and Calcite's equivalent).
- Use JSX event props such as `onarcgisViewReadyChange`.
- No widgets, no React wrapper, no AMD, no `__esri` types — enforced by ESLint `no-restricted-imports` and `scripts/check-banned-imports.mjs`.
- Map UI controls (zoom, fly-to) are bespoke React buttons driving the view through the store.

## Consequences
Verified in Stage 1: the element type `HTMLArcgisMapElement` and its `view` are fully typed; React 19 sets object properties (`map`, `constraints`, `background`) directly on the element.
