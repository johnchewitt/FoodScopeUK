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
