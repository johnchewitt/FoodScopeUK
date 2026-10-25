/**
 * Framing the map on the data (cartography): the bounding box of the drawn connections and the
 * Web Mercator centre and zoom that fit it into the part of the map not covered by panels.
 * Pure functions: no ArcGIS or DOM imports, so the maths is unit tested directly.
 */
import { symbolicArc, type LonLat } from "./arcs";

/** [west, south, east, north] in degrees. */
export type BBox = [number, number, number, number];

export interface Padding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface FitViewport {
  width: number;
  height: number;
  /** The view's own padding: MapView centres `center` in the area inside it. */
  padding: Padding;
  /**
   * The area the box must fit into, if smaller than the view's padded area (e.g. also clear of a
   * legend card). The returned centre is offset so the box is centred in this area.
   */
  framePadding?: Padding;
}

export interface FitOptions {
  /** Clear space kept around the box inside the padded area, px. */
  marginPx?: number;
  minZoom?: number;
  maxZoom?: number;
  /** Smallest box (degrees) so a cluster of neighbours is not framed at street level. */
  minSpanLon?: number;
  minSpanLat?: number;
}

/**
 * Extent of the United Kingdom polygon in the Natural Earth 1:110m outlines the map draws (S24,
 * public/data/reference/world-countries-110m.geojson; checked in frame.test.ts). The UK is the
 * focus of every connection, so a frame always shows all of it.
 */
export const UK_EXTENT_110M: BBox = [-7.572, 49.96, 1.682, 58.635];

/**
 * Smallest box containing every point with finite coordinates (UK Food Access frames all mapped
 * stores this way); null when there are none.
 */
export function pointsBBox(points: Iterable<{ lon: number; lat: number }>): BBox | null {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const { lon, lat } of points) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    w = Math.min(w, lon);
    e = Math.max(e, lon);
    s = Math.min(s, lat);
    n = Math.max(n, lat);
  }
  return w <= e ? [w, s, e, n] : null;
}

/** Smallest box containing both. */
export function unionBBox(a: BBox, b: BBox): BBox {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

/** Web Mercator tiles are 256 px at zoom 0 (TileInfo.create; matches the Esri basemap LODs). */
const TILE = 256;
const MAX_LAT = 85;

/**
 * Bounding box of the symbolic connections from `starts` to `anchor` (every vertex of each curve,
 * since the curves bow outside the straight line), including the anchor. Null without connections.
 * Longitudes are not wrapped, matching how the curves are drawn.
 */
export function connectionsBBox(starts: readonly LonLat[], anchor: LonLat, segments = 32): BBox | null {
  if (starts.length === 0) return null;
  let [w, s, e, n] = [anchor[0], anchor[1], anchor[0], anchor[1]];
  for (const start of starts) {
    for (const [lon, lat] of symbolicArc(start, anchor, segments)) {
      if (lon < w) w = lon;
      if (lon > e) e = lon;
      if (lat < s) s = lat;
      if (lat > n) n = lat;
    }
  }
  return [w, s, e, n];
}

/** Mercator y as a fraction of the world height (0 at the top, 1 at the bottom). */
function mercatorY(lat: number): number {
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2;
}

function latFromMercatorY(y: number): number {
  return (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
}

/**
 * Centre and zoom that fit `bbox` inside the framing area (`framePadding`, default the view's
 * padding) with `marginPx` to spare. MapView centres `center` in its own padded area, so when the
 * framing area is smaller the centre is shifted to put the box in the middle of the framing area.
 * The zoom is clamped to [minZoom, maxZoom]; a viewport with no room left gets minZoom.
 */
export function fitBBox(
  bbox: BBox,
  viewport: FitViewport,
  { marginPx = 28, minZoom = 2, maxZoom = 6, minSpanLon = 24, minSpanLat = 14 }: FitOptions = {},
): { center: LonLat; zoom: number } {
  let [w, s, e, n] = bbox;
  if (e - w < minSpanLon) {
    const c = (w + e) / 2;
    [w, e] = [c - minSpanLon / 2, c + minSpanLon / 2];
  }
  if (n - s < minSpanLat) {
    const c = (s + n) / 2;
    [s, n] = [c - minSpanLat / 2, c + minSpanLat / 2];
  }
  s = Math.max(-MAX_LAT, s);
  n = Math.min(MAX_LAT, n);
  const yTop = mercatorY(n);
  const yBottom = mercatorY(s);
  const dx = Math.min(1, (e - w) / 360);
  const dy = Math.max(1e-9, yBottom - yTop);
  const v = viewport.padding;
  const f = viewport.framePadding ?? v;
  const availW = viewport.width - f.left - f.right - 2 * marginPx;
  const availH = viewport.height - f.top - f.bottom - 2 * marginPx;
  const boxX = ((w + e) / 2 + 180) / 360;
  const boxY = (yTop + yBottom) / 2;
  const toLonLat = (x: number, y: number): LonLat => [x * 360 - 180, latFromMercatorY(y)];
  if (!(availW > 0 && availH > 0)) return { center: toLonLat(boxX, boxY), zoom: minZoom };
  const raw = Math.min(Math.log2(availW / (TILE * dx)), Math.log2(availH / (TILE * dy)));
  const zoom = Math.round(Math.min(maxZoom, Math.max(minZoom, raw)) * 100) / 100;
  // Screen offset of the framing area's centre from the view's padded centre, in world fractions.
  const world = TILE * 2 ** zoom;
  const offX = (f.left - v.left - (f.right - v.right)) / 2 / world;
  const offY = (f.top - v.top - (f.bottom - v.bottom)) / 2 / world;
  return { center: toLonLat(boxX - offX, boxY - offY), zoom };
}
