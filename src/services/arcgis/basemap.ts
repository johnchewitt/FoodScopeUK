import Basemap from "@arcgis/core/Basemap";
import BasemapStyle from "@arcgis/core/support/BasemapStyle";
import type { MapStyle } from "@/styles/palette";
import { BASEMAP_NAMES, BASEMAP_SOURCES } from "./basemapStyles";

/**
 * An Esri basemap for a style (S25). Returns null without a key; the app then shows the offline
 * reference outlines, and offers no basemap choice.
 *
 * The key itself is not passed here: `configureArcgisRequests()` (run at startup) registers
 * it as `esriConfig.apiKeys.basemapStyles`, which the SDK sends only to the basemap service
 * hosts and adds to every basemap request (ADR-11). National Geographic loads Esri's public web
 * map from ArcGIS Online instead; with `useIdentity` off, a layer that needed a sign-in would fail
 * (and be reported) rather than prompt the visitor.
 */
export function createBasemap(apiKey: string | null, style: MapStyle = "dark"): Basemap | null {
  if (!apiKey) return null;
  const source = BASEMAP_SOURCES[style];
  const title = BASEMAP_NAMES[style];
  if (source.kind === "webmap") return new Basemap({ portalItem: { id: source.itemId }, title });
  return new Basemap({ style: new BasemapStyle({ id: source.styleId as never }), title });
}
