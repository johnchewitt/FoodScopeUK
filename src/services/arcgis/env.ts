/** Build-time ArcGIS settings (see .env.example and ADR-11/ADR-14). */
export interface ArcgisEnv {
  /** Referrer-restricted basemap key, or null when not configured. Never logged. */
  apiKey: string | null;
  assets: "cdn" | "local";
}

export type BasemapMode = "esri-dark-gray" | "offline-outlines";

export function basemapMode(apiKey: string | null): BasemapMode {
  return apiKey ? "esri-dark-gray" : "offline-outlines";
}

export function readArcgisEnv(env: Record<string, unknown> = import.meta.env): ArcgisEnv {
  const rawKey = typeof env.VITE_ARCGIS_API_KEY === "string" ? env.VITE_ARCGIS_API_KEY.trim() : "";
  return {
    apiKey: rawKey.length > 0 ? rawKey : null,
    assets: env.VITE_ARCGIS_ASSETS === "local" ? "local" : "cdn",
  };
}
