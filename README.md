# FOODSCOPE UK

**Food Security & Supply Chain Intelligence** — a map-centred demonstrator showing where the UK's recorded food imports come from, how sourcing changes through the year, where supermarket provision and food-access vulnerability sit, and how exposed the system is to plausible disruptions. Built for ConsultingWhere with React 19, TypeScript, Vite and the ArcGIS Maps SDK for JavaScript 5.1.

> **Status:** Stage 3 — the **Food Origins explorer** (Stage 2) and the **Seasonal Supply Explorer** (Stage 3), with real HMRC Overseas Trade Statistics for tomatoes, strawberries, bananas, potatoes and wheat (monthly, January 2019 – August 2026; snapshot 2026-10-23).
> - Seasonal Supply plays through January–December and has a partner-by-month heatmap, monthly trend, year-on-year change and month-against-month comparison.
> - Other modules still show what they will contain and when.
>
> See `docs/stage-reports/stage-3.md`, and `docs/reviews/2026-10-23-review.md` for the review after Stage 3 (map framing, legend-true colours, comparability cautions, faster figures, KPI cards never hidden).
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

Code licence: to be confirmed by ConsultingWhere. Data shown in this build: Natural Earth (public domain; "Made with Natural Earth"); Esri basemap when a key is configured (attribution rendered by the map). Full source terms: `docs/03-DATA-SOURCES.md`.

## Known limitations (Stage 3)

- Food Origins and Seasonal Supply cover five of the 16 planned commodities; the others and the remaining modules follow in later stages.
- Seasonal Supply shows imports only. No verified monthly UK production series exists for these five commodities, so none is shown and none is estimated from imports.
- Months HMRC has not yet published (September–December 2026 in this snapshot) are shown as missing, never estimated.
- Recorded import partner = HMRC's country of dispatch, not where food was grown. Connections on the map are symbolic, not shipping routes.
- The Esri basemap and the HMRC API cannot be reached from the development sandbox; the post-deploy smoke test checks the basemap on the live site, and HMRC data is fetched by GitHub Actions.
- The initial JavaScript bundle (184 kB gzip) is above the 350 kB-uncompressed budget in the architecture; reduction is in `docs/backlog.md`.
