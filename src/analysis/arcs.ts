/**
 * Symbolic import connections (FO-03, P4). Each connection is a smooth curve from a partner's
 * representative point to the UK anchor, drawn in Web Mercator map space. It is deliberately
 * NOT a great-circle or shipping route: the curve only shows that a recorded import partner
 * exists. Pure functions: no ArcGIS imports.
 */

export type LonLat = [number, number];

const R = 6378137; // Web Mercator sphere radius (m)
const MAX_LAT = 85;

export function toMercator([lon, lat]: LonLat): [number, number] {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return [(R * lon * Math.PI) / 180, R * Math.log(Math.tan(Math.PI / 4 + phi / 2))];
}

export function fromMercator([x, y]: [number, number]): LonLat {
  return [((x / R) * 180) / Math.PI, ((2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * 180) / Math.PI];
}

/**
 * Quadratic Bézier from `from` to `to`, bowed to the left of the direction of travel by
 * `bend` × chord length. Returns `segments + 1` lon/lat vertices, starting at `from`.
 * Longitudes are not wrapped, so a curve never jumps across the map.
 */
export function symbolicArc(from: LonLat, to: LonLat, segments = 48, bend = 0.18): LonLat[] {
  const n = Math.max(2, Math.floor(segments));
  const a = toMercator(from);
  const b = toMercator(to);
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len === 0) return [from, to];
  // Left-hand normal of the chord.
  const nx = -dy / len;
  const ny = dx / len;
  const c: [number, number] = [(a[0] + b[0]) / 2 + nx * bend * len, (a[1] + b[1]) / 2 + ny * bend * len];
  const out: LonLat[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * a[0] + 2 * u * t * c[0] + t * t * b[0];
    const y = u * u * a[1] + 2 * u * t * c[1] + t * t * b[1];
    out.push(fromMercator([x, y]));
  }
  out[0] = [...from];
  out[n] = [...to];
  return out;
}

/** Cumulative segment lengths (map units) of a path given in Web Mercator. */
export function cumulativeLengths(path: readonly [number, number][]): number[] {
  const out = [0];
  for (let i = 1; i < path.length; i++) {
    const [x0, y0] = path[i - 1]!;
    const [x1, y1] = path[i]!;
    out.push(out[i - 1]! + Math.hypot(x1 - x0, y1 - y0));
  }
  return out;
}

/** Point at fraction `t` (0–1, wrapped) of the way along a Mercator path, by length. */
export function pointAlong(
  path: readonly [number, number][],
  cumulative: readonly number[],
  t: number,
): [number, number] {
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (path.length === 0) return [0, 0];
  if (path.length === 1 || total === 0) return path[0]!;
  const f = ((t % 1) + 1) % 1;
  const target = f * total;
  let lo = 0;
  let hi = cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid]! <= target) lo = mid;
    else hi = mid;
  }
  const seg = cumulative[hi]! - cumulative[lo]!;
  const u = seg === 0 ? 0 : (target - cumulative[lo]!) / seg;
  const [x0, y0] = path[lo]!;
  const [x1, y1] = path[hi]!;
  return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
}

/**
 * Particles for one connection at time `seconds`: evenly spaced (≈ `spacingPx` apart on screen)
 * and moving towards the UK at `speedPx` per second. Returns fractions along the path.
 */
export function particleFractions(
  screenLengthPx: number,
  seconds: number,
  spacingPx = 90,
  speedPx = 55,
): number[] {
  if (!(screenLengthPx > 0)) return [];
  const n = Math.max(1, Math.floor(screenLengthPx / spacingPx));
  const phase = ((seconds * speedPx) / screenLengthPx) % 1;
  return Array.from({ length: n }, (_, i) => (phase + i / n) % 1);
}
