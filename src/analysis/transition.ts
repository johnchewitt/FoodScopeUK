/**
 * Map transitions between months (spec SS-02: restrained, ≤ 400 ms, instant under reduced
 * motion). Pure functions: no React, ArcGIS or DOM imports.
 *
 * Only line widths are eased; every number on screen shows the target month from the first
 * frame, and at the end of the transition each width equals its model value exactly.
 */

/** Longest allowed transition (SS-02). */
export const TRANSITION_MAX_MS = 400;

export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

/**
 * Widths at progress `t` (0–1) between two states. Keys only in `from` shrink to 0 (connections
 * leaving the top N); keys only in `to` grow from 0. At t ≥ 1 the result is exactly `to`
 * (keys missing from `to` are dropped).
 */
export function interpolateWidths(
  from: ReadonlyMap<string, number>,
  to: ReadonlyMap<string, number>,
  t: number,
): Map<string, number> {
  if (t >= 1) return new Map(to);
  const e = easeOutCubic(t);
  const out = new Map<string, number>();
  for (const key of new Set([...from.keys(), ...to.keys()])) {
    const a = from.get(key) ?? 0;
    const b = to.get(key) ?? 0;
    out.set(key, a + (b - a) * e);
  }
  return out;
}

/** True when any width differs by more than `epsilon` px (otherwise no transition is needed). */
export function widthsDiffer(
  from: ReadonlyMap<string, number>,
  to: ReadonlyMap<string, number>,
  epsilon = 0.01,
): boolean {
  for (const key of new Set([...from.keys(), ...to.keys()]))
    if (Math.abs((from.get(key) ?? 0) - (to.get(key) ?? 0)) > epsilon) return true;
  return false;
}
