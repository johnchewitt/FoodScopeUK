# ADR-0005 — Flows as symbolic great-circle arcs

- Status: Proposed (decide after the Stage 3 spike)
- Date: 2026-10-23

## Decision (proposed)
Draw client-side polylines from each recorded import partner's representative point to a single UK anchor, densified geodesically. Width is linear in recorded net mass within stated clamps; top-N partners plus an "others" aggregate. Animation candidates: `CIMSymbolAnimationMoveAlongLine` (beta in SDK 5.1), CIM pulse markers, or static glow. Reduced motion turns animation off.

## Consequences
Arcs never imply shipping routes or ports (P4). The legend says so.
