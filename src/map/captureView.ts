/**
 * Map image capture with the view's screenshot API (EX-04, Stage 8). Captures the visible map (the
 * view without its padded areas under the panels), at up to twice the screen resolution, with the
 * extent of exactly that area, the scale, the basemap and the attribution the view shows. Only
 * src/map uses the SDK; the rest of the app calls `captureMap` (src/map/capture.ts).
 */
import { xyToLngLat } from "@arcgis/core/geometry/support/webMercatorUtils";
import type MapView from "@arcgis/core/views/MapView";
import { BASEMAP_NAMES } from "@/services/arcgis/basemapStyles";
import { MAP_STYLES, type MapStyle } from "@/styles/palette";
import { MapCaptureError, type MapCapture, type MapCapturer } from "./capture";

/** Longest side of a captured image, in pixels (about 250 dpi across an A4 page). */
const MAX_SIDE = 2000;

/**
 * The name of the Esri basemap the map draws, or null without one (offline outline map). The
 * basemap controller marks the style it loaded on the view's container (`data-basemap-style`).
 */
function basemapNameOf(view: MapView): string | null {
  const style = (view.container as HTMLElement | null)?.dataset.basemapStyle;
  if (style && (MAP_STYLES as readonly string[]).includes(style)) return BASEMAP_NAMES[style as MapStyle];
  const basemap = view.map?.basemap as { title?: string | null } | null | undefined;
  return basemap ? (basemap.title ?? "Esri basemap") : null;
}

/** `basemapHealthy` says whether the basemap loaded (a failed basemap draws no tiles). */
export function createViewCapturer(view: MapView, basemapHealthy: () => boolean): MapCapturer {
  return async (req) => {
    if (!view.ready) throw new MapCaptureError("The map is not ready yet.");
    const p = view.padding;
    const left = p.left ?? 0;
    const right = p.right ?? 0;
    const top = p.top ?? 0;
    const bottom = p.bottom ?? 0;
    const areaW = Math.max(1, view.width - left - right);
    const areaH = Math.max(1, view.height - top - bottom);
    // Same aspect as the visible map: the image shows exactly the area the extent describes.
    const scale = Math.min(MAX_SIDE / Math.max(areaW, areaH), Math.max(1, req.width / areaW), 2);
    const width = Math.round(areaW * scale);
    const height = Math.round(areaH * scale);
    const shot = await view.takeScreenshot({ format: "png", width, height });
    const sw = view.toMap({ x: left, y: view.height - bottom });
    const ne = view.toMap({ x: view.width - right, y: top });
    if (!sw || !ne) throw new MapCaptureError("The map extent could not be read.");
    const [w, s] = xyToLngLat(sw.x, sw.y);
    const [e, n] = xyToLngLat(ne.x, ne.y);
    const credits = view.attributionItems
      .map((item) => item.text)
      .filter((text): text is string => Boolean(text))
      .join(" | ");
    const capture: MapCapture = {
      dataUrl: shot.dataUrl,
      width,
      height,
      extent: [w, s, e, n],
      zoom: view.zoom,
      scale: view.scale,
      basemap: basemapHealthy() ? basemapNameOf(view) : null,
      attribution: credits ? `${credits} | Powered by Esri` : "Powered by Esri",
      capturedAt: new Date().toISOString(),
    };
    return capture;
  };
}
