# ADR-0011 — Referrer-restricted API key injected at build

- Status: Accepted (Stage 1)
- Date: 2026-10-23

## Decision
- The ArcGIS API key is never committed. CI reads the Actions secret `ARCGIS_API_KEY` and passes it to the build as `VITE_ARCGIS_API_KEY`; locally it lives in git-ignored `.env.local`.
- The key is attached only to the basemap style (`BasemapStyle.apiKey`), not set globally on `esriConfig`, so it is sent only to the Basemap styles service.
- Referrers: `https://johnchewitt.github.io`, `http://localhost:5173`, `http://localhost:4173`; privileges: Basemap styles service only; expiry ≤ 1 year with key-2 rotation (`docs/setup/arcgis-api-key.md`).
- Without a key the app runs with the offline outline map and says so in the Insights panel.

## Consequences
The key is visible in the deployed bundle by design; referrer restriction and minimal privileges are the controls. The config schema rejects unknown keys, so an `apiKey` added to `config.json` by mistake fails validation.
