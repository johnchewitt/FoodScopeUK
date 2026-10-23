import Basemap from "@arcgis/core/Basemap";
import BasemapStyle from "@arcgis/core/support/BasemapStyle";

export const BASEMAP_STYLE_ID = "arcgis/dark-gray";

/**
 * Esri dark grey basemap from the Basemap styles service (S25). Returns null without a key;
 * the app then shows the offline reference outlines.
 *
 * The key itself is not passed here: `configureArcgisRequests()` (run at startup) registers
 * it as `esriConfig.apiKeys.basemapStyles`, which the SDK sends only to the basemap service
 * hosts and adds to every basemap request (ADR-11).
 */
export function createBasemap(apiKey: string | null): Basemap | null {
  if (!apiKey) return null;
  return new Basemap({ style: new BasemapStyle({ id: BASEMAP_STYLE_ID }) });
}
