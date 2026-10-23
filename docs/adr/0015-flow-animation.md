# ADR-0015 — Moving markers on a canvas overlay, not CIM symbol animations

- Status: Accepted (Stage 2)
- Date: 2026-10-23

## Context
FO-04 asks for subtle motion along the connections, off under reduced motion. ArcGIS Maps SDK 5.1 offers CIM symbol animations, including `CIMSymbolAnimationMoveAlongLine` (beta in 5.1). The roadmap planned a spike between MoveAlongLine, pulse markers and a static fallback.

## Spike (23 Oct 2026)
- A `CIMLineSymbol` with a `CIMVectorMarker` carrying `CIMSymbolAnimationMoveAlongLine` (Speed and Distance modes, explicit duration, `continuous`) drew **nothing** — not even its non-animated stroke layers — in a `GraphicsLayer`, `view.graphics` or a `GeoJSONLayer` renderer.
- Even the simplest documented case, a `CIMPointSymbol` with `CIMSymbolAnimationScale`, did not draw; the same symbols without animations drew normally. `has("esri-cim-animations-enable-status")` is `"enabled"` and `view.animationsEnabled` is `true`.
- Reproduced in headless Chromium with SwiftShader (the CI environment) and in desktop Chromium on an Intel UHD Graphics 630 GPU (ANGLE Metal), on the deployed site with CDN assets. Root cause not found; the SDK's typings mark MoveAlongLine as beta and omit it from the `CIMSymbolAnimation` union.

## Decision
- The connections stay static ArcGIS graphics (CIM strokes: core line + soft glow).
- Moving markers are drawn by `src/map/layers/flowParticles.ts` on a 2D canvas appended to the view container (pointer events off, device-pixel-ratio aware, resized with the view). Each frame it places evenly spaced markers along each connection's Mercator path (`particleFractions`, `pointAlong` in `src/analysis/arcs.ts`, unit tested) at ~55 screen px/s towards the UK and converts them with `view.toScreen`, so they follow pan and zoom.
- Under `prefers-reduced-motion` or the in-app switch the overlay stops its animation loop and hides; static lines remain. E2E tests check markers are drawn, move between frames, and stop under reduced motion.

## Consequences
If the overlay fails, only the motion is lost. Markers are drawn above the map layers (not interleaved) and above the attribution text. Revisit when CIM animations render in our view (try a newer 5.x patch); switching back means replacing the overlay with a marker layer in `drawFlows`.
