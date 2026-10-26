# FOODSCOPE UK

**Food Security & Supply Chain Intelligence** — a map-centred demonstrator showing where the UK's recorded food imports come from, how sourcing changes through the year, where supermarket provision and food-access vulnerability sit, and how exposed the system is to plausible disruptions. Built for ConsultingWhere with React 19, TypeScript, Vite and the ArcGIS Maps SDK for JavaScript 5.1.

> **Status:** Stages 1–6 merged and deployed. Five modules use real data:
> - **Food Origins** (Stage 2) and **Seasonal Supply** (Stage 3): HMRC Overseas Trade Statistics for sixteen commodities in five groups (fruit and vegetables, cereals, meat, dairy, and sugar, coffee and cocoa), monthly from January 2019 (snapshot 2026-10-26).
> - **UK Food Access** (Stage 4): about 19,000 GEOLYTIX grocery stores (June 2026), stores per 10,000 residents for the 361 councils (ONS mid-2025), straight-line proximity, and a basemap choice (dark grey, light grey, imagery at local scale).
> - **Local Authority Profiles** (Stage 5): a profile for any UK council, deep profiles for Belfast and Manchester (small-area accessibility, Priority Places for Food Index, deprivation within each nation, car availability), national supply context and a side-by-side comparison that never ranks across nations.
> - **UK Food Resilience — Risk Explorer** (Stage 6): three separate views, each with its own map, cards, charts and "Explain this risk": international supply exposure (partner concentration, HHI, monthly concentration, estimated exposure to one supplier, partners' national water stress), food logistics (DfT major ports, UKFSR port-of-entry and Short Straits shares, road corridors in Great Britain and Northern Ireland, railway lines in Northern Ireland, farming regions) and community food access (every council's priority places for food, ranked within its own nation). No score combines them.
> - **Scenario Lab** (Stage 7): transparent what-if calculations on the published baselines, each labelled Scenario-modelled with its assumptions, formula, boundary, limitations and a data-confidence rating: (A) a recorded import partner supplies less of a commodity for some months, with partner shares and concentration before and after and the connection narrowing on the map; (B) a supermarket closes anywhere in the UK, showing whose nearest supermarket changes and by how far in a straight line, from every small area's three nearest supermarkets computed in advance; (C) lower UK production on Defra's published supply balance; (D) a port handles less inward freight, with food exposure only where the data records it at the port. Named scenarios are saved in the browser, compared, shared as links and exported (CSV, JSON).
> - Other modules (Scenario Lab, Consulting Insights) still show what they will contain and when.
>
> See `docs/stage-reports/` (stage 6 is the latest) and `docs/reviews/2026-10-23-review.md`.
>
> Site: https://johnchewitt.github.io/FoodScopeUK/

## Quick start

Requirements: Node.js 24 LTS (22.12+ works), npm 10+, and for the data pipeline Python 3.12+ with [uv](https://docs.astral.sh/uv/).

```bash
npm ci
cp .env.example .env.local      # optional: add your ArcGIS API key here
npm run dev                     # http://localhost:5173/FoodScopeUK/
```

Without an API key the map shows Natural Earth country outlines on a navy background. With a key it adds Esri's dark grey basemap. How to create, store and rotate the key: [`docs/setup/arcgis-api-key.md`](docs/setup/arcgis-api-key.md). The key is never committed — CI reads it from the `ARCGIS_API_KEY` Actions secret.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check and production build (`BASE_PATH`, `VITE_ARCGIS_ASSETS`) |
| `npm run preview` | Serve `dist/` at http://localhost:4173/FoodScopeUK/ |
| `npm test` | Unit and component tests (Vitest) |
| `npm run e2e` | Browser tests (Playwright) against a preview of the current build |
| `npm run typecheck` / `lint` / `format` | TypeScript, ESLint, Prettier checks |
| `npm run check:banned` | Blocks deprecated ArcGIS APIs (widgets, React wrapper, `__esri`, AMD) |
| `npm run gen:types` | Regenerate TypeScript types from `schemas/` |
| `npm run build:reference` | Rebuild the Natural Earth reference outlines |

Browser tests without access to the Esri CDN: `VITE_ARCGIS_ASSETS=local npm run build && npm run e2e` (copies ArcGIS and Calcite assets into the build).

## Data pipeline

```bash
cd pipeline
uv sync
uv run pytest
uv run foodscope-pipeline publish   # rebuilds and validates public/data/manifest.json
```

The snapshot holds Natural Earth v5.1.2 reference geometry and the HMRC trade baskets. Refreshing trade data:

1. Push a branch named `data-refresh/<YYYY-MM-DD>` (or run **Refresh trade data (HMRC)** in the Actions tab).
2. The workflow calls the HMRC API (≤ 50 requests/minute), commits the raw responses to `pipeline/raw/hmrc/<date>/`, rebuilds the snapshot offline, reconciles the aggregation against raw rows, republishes the manifest and runs the pipeline tests.
3. Review and merge the pull request. Data never goes straight to `main`.

To rebuild an existing snapshot offline: `uv run foodscope-pipeline build-trade --snapshot 2026-10-23`.

Local data (stores, councils, population, small areas, context), the Risk Explorer data (`risk`) and the Scenario Lab's closure inputs (`scenario`) are built offline from raw files committed in `pipeline/raw/` (ADR-0020, ADR-0021, ADR-0023). The online fetches run on GitHub Actions when a `data/**` branch is pushed (`refresh-reference-data.yml`). Then:

```bash
uv run foodscope-pipeline build-local --snapshot 2026-10-24          # councils, stores, population
uv run foodscope-pipeline build-ni-grocers --snapshot 2026-10-24 --local-snapshot 2026-10-24
uv run foodscope-pipeline build-context --snapshot 2026-10-25 --reference-snapshot 2026-10-24 --local-snapshot 2026-10-24
uv run foodscope-pipeline build-areas --snapshot 2026-10-24 --context-snapshot 2026-10-25   # deep profiles
uv run foodscope-pipeline build-risk --snapshot 2026-10-25 --reference-snapshot 2026-10-24 --local-snapshot 2026-10-24   # Risk Explorer
uv run foodscope-pipeline build-scenario --snapshot 2026-10-26 --raw-snapshot 2026-10-26 --stage6-snapshot 2026-10-25 --reference-snapshot 2026-10-24 --local-snapshot 2026-10-24   # Scenario Lab (closure)
uv run foodscope-pipeline publish
```

## Deployment

GitHub Pages via `.github/workflows/deploy-pages.yml` on every push to `main`:

1. Repository **Settings → Pages → Source: GitHub Actions** (once).
2. Optional: add the `ARCGIS_API_KEY` Actions secret.
3. Merge to `main`. The workflow builds, deploys and smoke-tests the live site.

## Documentation

| Document | Contents |
|---|---|
| [Original brief](docs/00-ORIGINAL-BRIEF.md) | The commissioning brief, unchanged |
| [Specification](docs/01-SPECIFICATION.md) | Requirements, integrity principles, formulas, design system, acceptance criteria |
| [Architecture](docs/02-ARCHITECTURE.md) | Verified stack, decisions, structure, data pipeline, testing, CI/CD |
| [Data sources](docs/03-DATA-SOURCES.md) | Verified catalogue of every source, licences, caveats, verification log |
| [Roadmap](docs/04-ROADMAP.md) | Stages, verification gates, exit criteria, risks |
| [Decisions](docs/adr/README.md) | Architecture decision records |
| [Stage reports](docs/stage-reports/) | What each stage delivered and verified |
| [ArcGIS API key](docs/setup/arcgis-api-key.md) | Creating, storing and rotating the basemap key |
| [CLAUDE.md](CLAUDE.md) | Working instructions for Claude Code |

## Licensing and attribution

Code licence: to be confirmed by ConsultingWhere. Data shown in this build:
- Natural Earth (public domain; "Made with Natural Earth");
- HMRC Overseas Trade Statistics; ONS, NISRA, MHCLG and Defra statistics and boundaries (Open Government Licence v3.0; boundaries contain OS data © Crown copyright and database right);
- GEOLYTIX Grocery Retail Points (free open data with no named licence; attributed on the map as a courtesy);
- the Priority Places for Food Index v2.1 (CDRC / Leeds HASP, OGL v3.0);
- the Food Standards Agency food hygiene register for Northern Ireland (OGL v3.0);
- DfT port freight statistics, the UK Food Security Report 2024, Defra's June survey, OS Open Roads ("Contains OS data © Crown copyright and database right") and the Scottish Government's Data Zone lookup (Open Government Licence v3.0);
- FAO AQUASTAT level of water stress through the World Bank (CC BY 4.0) and EMODnet Human Activities port locations (Eurofish, Cogea; CC BY 4.0);
- the Esri basemap when a key is configured (attribution rendered by the map).

Full source terms: `docs/03-DATA-SOURCES.md`; every dataset's licence and attribution is also on the app's Evidence page.

## Known limitations (Stage 7)

- Food Origins and Seasonal Supply cover all sixteen planned commodities. Milk products and cocoa add unlike products by net mass (the value measure compares them on a common basis); Consulting Insights follows in Stage 8.
- Seasonal Supply shows imports only: Defra publishes UK production of most of these commodities annually, and its monthly meat and milk series are not verified yet, so none is shown and none is estimated from imports. Annual figures are national context in the profiles and the Risk Explorer where Defra publishes a supply balance.
- Months HMRC has not yet published are shown as missing, never estimated.
- Recorded import partner = HMRC's country of dispatch, not where food was grown. Connections on the map are symbolic, not shipping routes.
- Store counts and distances describe physical provision only, not affordability, choice or nutritional access. Distances are straight-line, not travel times.
- Small-area figures are published for Belfast and Manchester only; other councils follow in Release 2. Deprivation and the Priority Places for Food Index rank areas within each nation and are never compared across nations. Scotland's census (2022) and urban/rural classification are not included yet.
- In Northern Ireland GEOLYTIX maps ten retailers; other grocers from the FSA register are an optional layer, never counted.
- Risk Explorer: water stress is a national figure (FAO, mostly 2022), not the growing region; port tonnage is all cargo, not food (only UKFSR's published shares are food-specific); Northern Ireland's road corridors come from OpenStreetMap (community-mapped, not official; classes compare only approximately with Great Britain's OS Open Roads); railway lines cover Northern Ireland only (Translink, 2015); rail freight routes and distribution centres are not shown (no open official dataset). User-weighted composites (RK-05) follow in Release 2; no score combines the three views.
- Scenario Lab: every result is a static exposure calculation under the stated assumptions, not a forecast. Supply disruptions hold every other partner unchanged and assume no substitution unless you set one. Closures use straight-line distances from population-weighted centroids (not travel time; water crossings included; Republic of Ireland stores not in the data), Census populations (Scotland's from 2022) and deprivation deciles for England only. Production shocks use Defra's annual balances (consumption and stocks are not in them). Port disruptions use annual DfT tonnage spread evenly over months; food exposure is computed only where the data records it at the port. Saved scenarios stay in your browser.
- The Esri basemap and the HMRC API cannot be reached from the development sandbox; the live site is checked after each deploy, and HMRC and reference data are fetched by GitHub Actions.
- The initial JavaScript bundle is above the architecture budget; reduction is in `docs/backlog.md`.
