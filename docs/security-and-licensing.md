# Security, data integrity and licensing review (Stage 8)

Review date: 26–27 October 2026, on branch `stage/8-consulting-insights` (John's Stage 8 brief §9). This page covers what was checked, how, what was fixed, and **what remains open before publication**. "Checked here" means checked in the sandbox with the commands named. Items that need John's accounts (ArcGIS Location Platform, GitHub settings) are marked open.

## Summary

| Area | Result | Action taken | Open |
|---|---|---|---|
| API key in the client bundle | Only `VITE_ARCGIS_API_KEY` (plus Vite's `BASE_URL` and `DEV`) reaches the browser. The key is public by design and protected only by referrer restriction and minimal privileges. | None needed in code | **Confirm in ArcGIS Location Platform** that the key is basemap-styles only, referrer-restricted to `https://johnchewitt.github.io` and the two localhost ports, and within its expiry (see `docs/setup/arcgis-api-key.md`) |
| Secrets in the repository | No key, token or private key in tracked files or in the full git history (pattern scan for ArcGIS, GitHub, AWS, Slack and PEM private-key formats: 0 matches). `.env.local` is git-ignored; `.env.e2e-basemap` holds a stub (`e2e-stub-not-a-key`). | — | — |
| CI and deployment | The key reaches only the deploy build on `main` (secret `ARCGIS_API_KEY`). CI runs with `contents: read`; the data-refresh workflows have `contents: write` on their own branches and open pull requests (refreshes never reach `main` directly). | — | Pin third-party Actions to commit SHAs instead of major tags (B66) |
| ArcGIS service permissions | The app calls only the basemap styles service (with `esriConfig.request.useIdentity = false`, so no sign-in prompts). `config.json` lists no hosted layers. | — | — |
| JavaScript dependencies | `npm audit`: 0 vulnerabilities (all and production only). Versions are pinned exactly, with a lockfile. | pdfmake made a direct dependency at the locked 0.3.12 (it was already in the tree); pdfjs-dist 6.4.299 for tests only | pdfmake 0.3.13 (25 Oct 2026) is too new for the two-week rule; review after 8 Nov |
| Python pipeline dependencies | `pip-audit`: pytest 8.4.2 (PYSEC-2026-1845) and certifi 2026.7.22 (PYSEC-2026-4320) | pytest → 9.0.3 (318 pipeline tests pass) | **certifi 2026.10.19** is newer than the lock's `exclude-newer` guard. The pipeline's downloads use Python's `urllib` with the system trust store, not certifi (only pyproj depends on it). Update after 2026-11-03 (B65) |
| Client-side injection | No `dangerouslySetInnerHTML`, `innerHTML` assignment, `eval` or `new Function` in `src/`. React escapes text. ECharts tooltips are HTML. | Tooltip HTML now keeps only `<br>` and `<b>` (`safeTooltip.ts`, tested). CSV neutralises formula injection. Saved scenarios and reports are re-parsed and validated on load. | — |
| PDF generation | pdfmake's URL access policy refuses every external URL; images are data URLs; fonts are bundled files | — | Not a tagged PDF (pdfmake 0.3 has no structure tree) |
| Content Security Policy | GitHub Pages cannot send headers; there is no CSP meta tag | — | A CSP meta tag (workers, `blob:`, `wasm-unsafe-eval` for the SDK, Esri CDN and basemap hosts) needs testing against the live Esri services (B67) |
| Data provenance and accuracy | Every figure an `Indicator`; tests recompute the assessments' figures from the raw files independently (below) | — | Live checks with a real GPU and Esri basemaps (B48, B64) |
| Licensing and attribution | Data licences below; Esri terms for map images; OFL for IBM Plex; notices for 185 redistributed packages | Esri's map-image notice on exported images; data attributions in the CSV; `licenses/THIRD-PARTY-NOTICES.txt` linked from Help, with a test | **GEOLYTIX licence**: confirm the terms for client-facing reports (B68). **Branding**: no approved ConsultingWhere logo (D3). **Copy**: services and About text await approval (D7) |

## 1. API keys and environment configuration

- Vite exposes every `VITE_*` variable to the browser bundle. The app reads `VITE_ARCGIS_API_KEY` (`src/services/arcgis/env.ts`) and nothing else secret. The ArcGIS key is therefore **public** on the deployed site, as for any browser map.
  - Its protection is the credentials item's referrer list and its single privilege (basemap styles).
  - `esriConfig.apiKeys.basemapStyles` sends it only to the basemap service hosts (ADR-0011).
- No administrative credentials, OAuth secrets or publishing tokens exist in the app. Release 3's publishing credentials are planned for GitHub Actions secrets only.
- `public/config.json` holds public values only: a feature flag and an empty hosted-layer list.
- Checked here:

  ```bash
  git grep -nE "import\.meta\.env\.[A-Z_]+" src
  git grep -nIE "AAPK…|AAPT…|ghp_…|github_pat_|AKIA…|BEGIN … PRIVATE"
  git log --all -p | grep -cE "<same patterns>"
  ```

  The first finds three references (`BASE_URL` twice, `DEV` once). The second and third find nothing.

## 2. Repository contents

- `.env.local`, `dist/`, `dist-basemap/` and test outputs are ignored.
- Provided files: their embedded metadata was checked when each was committed (S38 is the example; CLAUDE.md rule).
- No personal paths or e-mail addresses are in tracked files. Checked with `git grep -nIE "/Users/|C:\\Users|@geolytical|@gmail\.com"`.

## 3. Dependencies and supply chain

- npm:
  - exact versions and a lockfile;
  - `npm audit` reports 0 (26 Oct 2026);
  - production licences are MIT, BSD, Apache-2.0, ISC, 0BSD, BlueOak, Unlicense, OFL-1.1 (fonts) and Esri's terms (`@arcgis/*`, Calcite, amCharts inside the SDK);
  - no copyleft licence is present.
- Python:
  - exact versions and `uv.lock`, with `exclude-newer` as a supply-chain guard;
  - `pip-audit` results and actions are as in the summary.
- GitHub Actions use major-version tags (`actions/checkout@v7` and others). Pinning to commit SHAs is recommended before Release 1 (B66).

## 4. Data integrity and calculation accuracy

What the Stage 8 tests recompute from the raw published files, without the assessment code (`src/features/insights/*.test.ts`):
- Manchester's supermarkets per 10,000 from the store file and council population.
- PPFI priority shares from the council file, and each nation's pooled share.
- Shares of residents beyond 1 km from the raw small-area arrays. They agree with the deep profiles' verified 14.08 % (Manchester) and 32.17 % (Belfast).
- The most relied-on supermarket and the residents affected by its closure.
- The largest partner's share of tomatoes over 12 months, from the snapshot rows.
- Seasonal dominance month by month.
- Scenario A's affected tonnes, which are linear in the reduction (Stage 7's verified 6,785.317 t).
- The PDF, read back with pdf.js (unit test and E2E), carries:
  - the key figures exactly as shown on screen;
  - every finding;
  - the checksum;
  - the data snapshots;
  - the visible map's extent.

## 5. Licensing and attribution

| Data | Licence | How it is credited |
|---|---|---|
| HMRC, Defra, ONS, NISRA, NRS, Scottish Government, MHCLG, DfT, OS (Open Roads, boundaries) (33 datasets) | Open Government Licence v3.0 | Dataset attribution in the map credits, the Evidence dialog, the PDF and the CSV |
| GEOLYTIX Grocery Retail Points v46 | GEOLYTIX open data: "completely free and open to use", no named licence | "Contains GEOLYTIX Grocery Retail Points data" everywhere the stores are used. **Open: confirm the terms for client-facing PDFs (B68)** |
| World Bank / FAO water stress (S30); EMODnet port locations | CC BY 4.0 | Credited in the Risk Explorer, the PDF and the CSV |
| OpenStreetMap roads, Northern Ireland (S38) | ODbL 1.0 | Own credit layer ("© OpenStreetMap contributors"); community-mapped, not official |
| Natural Earth outlines | Public domain | Credited in the map |
| Esri basemaps (S25) | Esri terms of use | "Powered by Esri" and the basemap's data providers in the map. In exported images and PDFs: the credits, "Powered by Esri" and Esri's recommended notice ("Map image is the intellectual property of Esri and is used herein under license…"). Inclusion in a report is a permitted use with attribution on or near the image (ArcGIS Online terms of use for static maps, read 26 Oct 2026) |
| IBM Plex Sans and Mono (app and PDF fonts) | SIL Open Font License 1.1 | Licence text in `licenses/THIRD-PARTY-NOTICES.txt`; embedding in PDFs is allowed |

## 6. Before publication: open items

1. **ArcGIS key.** Confirm in ArcGIS Location Platform: basemap styles privilege only, referrers `https://johnchewitt.github.io`, `http://localhost:5173` and `http://localhost:4173`, and expiry date.
2. **GEOLYTIX terms** for client-facing PDF reports that print store names and counts (B68).
3. **ConsultingWhere approvals.** Services and About copy (D7); logo and branding for the PDF (D3). Until then the PDF uses a text wordmark and the copy is marked "draft for approval".
4. **certifi** in the pipeline lock after 2026-11-03 (B65).
5. **Recommended hardening for Release 1:**
   - Actions pinned to SHAs (B66);
   - a tested CSP meta tag (B67);
   - live checks with a real GPU and the Esri basemaps, including a PDF made with the basemap on (B48, B64).
