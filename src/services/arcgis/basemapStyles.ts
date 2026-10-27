import type { MapStyle } from "@/styles/palette";

/**
 * Where each basemap comes from (SH-08, S25; SDK-free, so the UI and tests can read it).
 *
 * - Eight styles come from Esri's Basemap styles service (v2), authorised by the app's
 *   referrer-restricted key (`esriConfig.apiKeys.basemapStyles`, ADR-0011). Style IDs verified in
 *   Esri's list of ArcGIS and open styles on 27 Oct 2026. `arcgis/imagery` is imagery with labels;
 *   `open/osm-style` is Esri's OpenStreetMap style (OpenStreetMap data, ODbL).
 * - National Geographic is not in the styles service. It is Esri's public "National Geographic
 *   Style Map" web map in ArcGIS Online (owner esri, item f33a34de3a294590ab48f246e99958c9: World
 *   Hillshade, the National Geographic Style Base and the National Geographic Style vector layer),
 *   under the Esri Master License Agreement. Its layers are public, so no key is sent; whether that
 *   use is covered by the app's Esri account is an open question for John (S25, B74).
 */
export type BasemapSource = { kind: "style"; styleId: string } | { kind: "webmap"; itemId: string };

export const BASEMAP_SOURCES: Record<MapStyle, BasemapSource> = {
  dark: { kind: "style", styleId: "arcgis/dark-gray" },
  light: { kind: "style", styleId: "arcgis/light-gray" },
  human: { kind: "style", styleId: "arcgis/human-geography" },
  "human-dark": { kind: "style", styleId: "arcgis/human-geography-dark" },
  imagery: { kind: "style", styleId: "arcgis/imagery" },
  terrain: { kind: "style", styleId: "arcgis/terrain" },
  topographic: { kind: "style", styleId: "arcgis/topographic" },
  natgeo: { kind: "webmap", itemId: "f33a34de3a294590ab48f246e99958c9" },
  osm: { kind: "style", styleId: "open/osm-style" },
};

/** Names used in map captions, the PDF and the Insights panel. */
export const BASEMAP_NAMES: Record<MapStyle, string> = {
  dark: "Esri Dark Gray",
  light: "Esri Light Gray",
  human: "Esri Human Geography",
  "human-dark": "Esri Human Geography Dark",
  imagery: "Esri World Imagery with labels",
  terrain: "Esri Terrain",
  topographic: "Esri Topographic",
  natgeo: "Esri National Geographic Style",
  osm: "Esri OpenStreetMap style (OpenStreetMap data)",
};
