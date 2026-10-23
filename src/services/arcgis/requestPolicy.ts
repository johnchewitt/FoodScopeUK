/**
 * The slice of `@arcgis/core/config` this policy touches. Structural, so the policy can be
 * unit tested with a plain object instead of loading the SDK in jsdom.
 */
export interface ArcgisRequestConfig {
  apiKeys: { basemapStyles?: string };
  request: { useIdentity: boolean };
}

/**
 * How the app authenticates SDK requests (ADR-11).
 *
 * - The basemap key goes in `apiKeys.basemapStyles`. SDK 5.1 adds that key only to requests
 *   to the Esri basemap hosts (`basemaps-api` / `basemapstyles-api.arcgis.com`) that do not
 *   already carry a token. That still scopes it to the basemap service, and it covers every
 *   basemap request. A key set only on `BasemapStyle.apiKey` is copied onto the basemap's
 *   layers after they are created, so the view can start loading a layer without it: the
 *   request is refused (401) and the SDK prompts for an ArcGIS Online sign-in.
 * - `request.useIdentity` is off. This public site never asks visitors to sign in, so an
 *   authorisation failure must surface as a failed layer (shown in the UI), never as a
 *   username/password dialog.
 */
export function applyRequestPolicy(config: ArcgisRequestConfig, apiKey: string | null): void {
  config.request.useIdentity = false;
  if (apiKey) config.apiKeys.basemapStyles = apiKey;
  else delete config.apiKeys.basemapStyles;
}
