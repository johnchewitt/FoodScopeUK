/**
 * Map image capture registry (Stage 8, EX-01, brief §6–7). SDK-free: the map host registers a
 * capturer once the view is ready; reports and exports call `captureMap` without importing the
 * ArcGIS SDK. A capture carries what the image shows (extent, scale, basemap) and the attribution
 * of every layer drawn, so the image is never separated from its credits.
 */

export interface MapCapture {
  /** PNG data URL of the map at the requested size (attribution not drawn on it). */
  dataUrl: string;
  width: number;
  height: number;
  /** The visible extent in WGS84 degrees [west, south, east, north]. */
  extent: [number, number, number, number];
  zoom: number;
  /** Map scale denominator at the centre (Web Mercator: approximate away from the centre). */
  scale: number;
  /** The basemap drawn (Esri style id), or null for the offline outline map. */
  basemap: string | null;
  /** Credits of the visible layers, as the map shows them ("Esri, TomTom, … | GEOLYTIX …"). */
  attribution: string;
  capturedAt: string;
}

export interface CaptureRequest {
  width: number;
  height: number;
}

export type MapCapturer = (req: CaptureRequest) => Promise<MapCapture>;

let capturer: MapCapturer | null = null;

export function registerMapCapture(fn: MapCapturer | null): void {
  capturer = fn;
}

export function mapCaptureAvailable(): boolean {
  return capturer !== null;
}

/** Why a capture failed, in words a user can act on. */
export class MapCaptureError extends Error {}

/**
 * Captures the map as shown. Rejects with a MapCaptureError when the map is not ready or the
 * browser refuses to read the map canvas (a tainted canvas: a layer served without CORS headers).
 */
export async function captureMap(req: CaptureRequest): Promise<MapCapture> {
  if (!capturer) throw new MapCaptureError("The map is not ready yet.");
  try {
    return await capturer(req);
  } catch (e) {
    if (e instanceof MapCaptureError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    throw new MapCaptureError(
      /taint|security|cross-origin/i.test(msg)
        ? "The browser does not allow this map to be exported (a map service did not permit it)."
        : `The map image could not be made: ${msg}`,
    );
  }
}

/** "54.12° N, 2.34° W" style corner text for the extent caption. */
export function formatLatLon(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(lon).toFixed(2)}° ${ew}`;
}

/** One line describing what the image shows: extent corners, approximate scale and basemap. */
export function captureCaption(c: Pick<MapCapture, "extent" | "scale" | "basemap" | "capturedAt">): string {
  const [w, s, e, n] = c.extent;
  const scale = Math.round(c.scale / 1000) * 1000;
  return `Map extent ${formatLatLon(s, w)} to ${formatLatLon(n, e)}; scale about 1:${scale.toLocaleString("en-GB")} at the centre (Web Mercator); ${c.basemap ? `Esri basemap ${c.basemap.replace(/^arcgis\//, "")}` : "offline outline map (no basemap)"}; captured ${c.capturedAt.slice(0, 16).replace("T", " ")} UTC.`;
}
