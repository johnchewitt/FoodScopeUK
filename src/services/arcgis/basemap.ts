import Basemap from "@arcgis/core/Basemap";
import BasemapStyle from "@arcgis/core/support/BasemapStyle";
import type { MapStyle } from "@/styles/palette";

/**
 * Basemap styles service (v2) style IDs for the curated choice (SH-08, S25). Verified in the
 * SDK 5.1 `BasemapStyle` typings and the service's style list (docs/03-DATA-SOURCES.md, S25):
 * `arcgis/imagery` is imagery with labels; `arcgis/imagery/standard` would be imagery without.
 */
export const BASEMAP_STYLE_IDS: Record<MapStyle, string> = {
  dark: "arcgis/dark-gray",
  light: "arcgis/light-gray",
  imagery: "arcgis/imagery",
};

/** Default style (kept for callers that predate the basemap choice). */
export const BASEMAP_STYLE_ID = BASEMAP_STYLE_IDS.dark;

/**
 * An Esri basemap from the Basemap styles service (S25). Returns null without a key; the app
 * then shows the offline reference outlines.
 *
 * The key itself is not passed here: `configureArcgisRequests()` (run at startup) registers
 * it as `esriConfig.apiKeys.basemapStyles`, which the SDK sends only to the basemap service
 * hosts and adds to every basemap request (ADR-11).
 */
export function createBasemap(apiKey: string | null, style: MapStyle = "dark"): Basemap | null {
  if (!apiKey) return null;
  return new Basemap({ style: new BasemapStyle({ id: BASEMAP_STYLE_IDS[style] as never }) });
}
