import Basemap from "@arcgis/core/Basemap";
import BasemapStyle from "@arcgis/core/support/BasemapStyle";

export const BASEMAP_STYLE_ID = "arcgis/dark-gray";

/**
 * Esri dark grey basemap from the Basemap styles service (S25), authorised by a
 * referrer-restricted key scoped to this style only (not set globally on esriConfig).
 * Returns null without a key; the app then shows the offline reference outlines.
 */
export function createBasemap(apiKey: string | null): Basemap | null {
  if (!apiKey) return null;
  return new Basemap({
    style: new BasemapStyle({ id: BASEMAP_STYLE_ID, apiKey }),
  });
}
