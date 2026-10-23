# ArcGIS API key — setup and rotation runbook

FOODSCOPE UK needs an ArcGIS API key so the map can load Esri basemaps. The key is created by a person (not by Claude Code or CI) and is **never committed to the repository**.

Steps checked against Esri's developer documentation on 23 October 2026. Esri's screens change; if a label differs, follow the closest equivalent.

## 1. Create the key (ArcGIS Location Platform)

1. Sign in (or create a free account) at **https://location.arcgis.com** and open **My portal** from the dashboard.
2. Go to **Content → My content → New item → Developer credentials**.
3. Choose **API key credentials** → **Next**.
4. Where the credentials will be used: **Public application** (never a private-application option for a browser app) → **Next**.
5. Item access: **No item access** → **Next**.
6. Privileges: under *Basemaps*, tick **Basemap styles service** only → **Next**. (Add *Geocoding* later only if Search is switched to Esri geocoding.)
7. Expiration and referrers:
   - Expiration: up to **one year** (Esri's maximum). Note the date in your calendar.
   - Referrers: `https://johnchewitt.github.io`, `http://localhost:5173`, `http://localhost:4173`. Esri advises against path-based referrers, so do not add `/FoodScopeUK/`.
   - Expiration and referrers cannot be edited later without invalidating the key — get them right now.
8. Title it e.g. **FOODSCOPE UK – basemaps**, save, then choose to generate the key and copy it. **Esri shows the key only once**; if you lose it, regenerate it from the item page.

Using an ArcGIS Online organisational account instead (e.g. ConsultingWhere's) works the same way from *Content → New item → Developer credentials*, but needs a Creator user type or higher with the *Generate API keys* privilege.

## 2. Store the key

**For the deployed site** — GitHub → `johnchewitt/FoodScopeUK` → **Settings → Secrets and variables → Actions → New repository secret**:

- Name: `ARCGIS_API_KEY`
- Value: the key

The deploy workflow passes it to the build as `VITE_ARCGIS_API_KEY`. Re-run the deploy workflow after adding or changing it.

**For local development** — create `.env.local` in the repository root (git-ignored):

```bash
VITE_ARCGIS_API_KEY=<paste key here>
```

Do not paste the key into chats, issues, commit messages or stage reports.

## 3. What the restriction does and doesn't do

- The key is sent from the browser, so anyone can see it in the deployed site. That is normal for client-side map apps; the protection is the **referrer restriction** plus **minimal privileges** (basemaps only).
- Referrers are checked by origin, so the key would also work for any other site under `johnchewitt.github.io`. Each app should still have its **own credentials item** so it can be rotated or revoked without affecting the others.

## 4. Usage and cost

ArcGIS Location Platform's pricing page (checked 23 Oct 2026) lists 2 million basemap tiles in the free allowance, then a per-1,000-tile charge. Check the dashboard's usage and billing sections periodically, and only enable pay-as-you-go deliberately.

## 5. Rotation (before expiry, at most yearly)

Each API key credentials item supports two keys (API key 1 and API key 2):

1. On the credentials item page, generate **API key 2** with a new expiration date.
2. Update the `ARCGIS_API_KEY` secret (and your `.env.local`) and re-run the deploy workflow.
3. Confirm the live site loads its basemap, then let key 1 expire or invalidate it.

If a key is ever suspected to be misused: **invalidate** it on the item page, generate a new one, update the secret, redeploy.

## References

- Esri — Create an API key (Location Platform): https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/tutorials/create-an-api-key/location-platform/
- Esri — API key credentials (rotation, referrers): https://developers.arcgis.com/documentation/security-and-authentication/api-key-authentication/api-key-credentials/location-platform/
- ArcGIS Location Platform pricing: https://location.arcgis.com/pricing/
