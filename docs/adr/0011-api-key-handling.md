# ADR-0011 — Referrer-restricted API key injected at build

- Status: Accepted (Stage 1; amended 23 October 2026 after the first deploy)
- Date: 2026-10-23

## Decision
- The ArcGIS API key is never committed. CI reads the Actions secret `ARCGIS_API_KEY` and passes it to the build as `VITE_ARCGIS_API_KEY`; locally it lives in git-ignored `.env.local`.
- The key is registered at startup as `esriConfig.apiKeys.basemapStyles` (`src/services/arcgis/requestPolicy.ts`, applied from `src/app/bootstrapAssets.ts`). SDK 5.1 adds that key only to requests to the Esri basemap hosts (`basemaps-api.arcgis.com`, `basemapstyles-api.arcgis.com`) that carry no token, so it is still sent only to the Basemap styles service. It is **not** set as the global `esriConfig.apiKey`, which the SDK would send to every `*.arcgis.com` request.
- `esriConfig.request.useIdentity = false`: the public site never asks visitors to sign in. An authorisation failure appears as a failed basemap (Insights panel warning; country outlines switch to the offline style), not as an ArcGIS sign-in dialog.
- Referrers: `https://johnchewitt.github.io`, `http://localhost:5173`, `http://localhost:4173`; privileges: Basemap styles service only; expiry ≤ 1 year with key-2 rotation (`docs/setup/arcgis-api-key.md`).
- Without a key the app runs with the offline outline map and says so in the Insights panel.

## Why the amendment
Stage 1 set the key only on `BasemapStyle.apiKey`. In SDK 5.1.27 that key is copied onto the basemap's layers *after* they are created (`Basemap._loadFromStylesService`), and the view can start loading a layer before then. On the live site the first request for the dark grey style went out without a token, was refused (401), and the SDK's IdentityManager showed visitors an ArcGIS Online username/password dialog while the map stalled. The same key loaded the style when attached (HTTP 200 from the live origin), so the key and its privileges were not the cause. The request-level key closes the gap whichever component starts the load. A one-off check with synthetic 401 responses confirmed that a layer created without a key sends no token before the change and does send one after it, and that no sign-in prompt appears (Stage 1 report, post-merge fix).

## Consequences
The key is visible in the deployed bundle by design; referrer restriction and minimal privileges are the controls. The config schema rejects unknown keys, so an `apiKey` added to `config.json` by mistake fails validation. If a later release needs signed-in access to secured layers (ADR-11 in the architecture allows user OAuth), it must revisit `useIdentity` in a new ADR. The post-deploy smoke test now fails if the basemap does not load or a sign-in prompt appears.
