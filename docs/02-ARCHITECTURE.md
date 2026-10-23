# FOODSCOPE UK — Architecture

| | |
|---|---|
| **Document** | 02 — Architecture |
| **Version** | 0.1 — planning baseline, 23 October 2026 |
| **Status** | Draft; decisions marked *ADR* are proposed until accepted at the end of Stage 1 |

---

## 1. System overview

FOODSCOPE UK is a **static-first** application: a React single-page app served from GitHub Pages, reading versioned data snapshots that a separate Python pipeline builds from official sources on a schedule. Nothing in the browser needs a secret or calls a rate-limited government API directly.

```mermaid
flowchart LR
  subgraph Sources["Official & open sources"]
    HMRC["HMRC uktradeinfo API<br/>(OData, 60 req/min)"]
    DEFRA["Defra publications<br/>(ODS/CSV)"]
    GEO["GEOLYTIX Retail Points<br/>(quarterly CSV)"]
    ONS["ONS / NRS / NISRA<br/>boundaries & statistics"]
    CDRC["PPFI (HASP Leeds)"]
    DFT["DfT port freight"]
    NE["Natural Earth countries"]
  end

  subgraph Pipeline["Data pipeline (Python, GitHub Actions)"]
    ING["ingest/*<br/>download + provenance"]
    VAL["validate<br/>schemas, CRS, accounting"]
    DER["derive<br/>aggregates, joins, distances"]
    PUB["publish<br/>snapshot + manifest"]
  end

  subgraph Hosting["GitHub Pages (static)"]
    APP["React 19 SPA<br/>ArcGIS Maps SDK 5.1"]
    DATA["data/snapshots/(date)/<br/>JSON + GeoJSON + manifest.json"]
    CFG["config.json<br/>(runtime, no secrets)"]
  end

  subgraph Optional["Optional services"]
    AGOL["ArcGIS Online hosted<br/>FeatureLayers"]
    BASE["Esri basemap styles<br/>(referrer-restricted key)"]
    API["Serverless proxy<br/>(Release 3: LLM, live trade)"]
  end

  Sources --> ING --> VAL --> DER --> PUB --> DATA
  APP --> DATA
  APP --> CFG
  APP --> BASE
  APP -. configurable .-> AGOL
  APP -. Release 3 .-> API
```

### 1.1 Why static-first

- **Rate limits and paging**: the HMRC API allows 60 requests per minute per user and pages at 40,000 records (verified, §S01). A public demo must not depend on that at runtime.
- **CORS**: browser access to `api.uktradeinfo.com` is unverified. A pipeline avoids the question entirely.
- **Reproducibility and provenance**: every figure on screen traces to a dated snapshot with checksums, which is what a government audience needs.
- **Cost and security**: GitHub Pages is free, static and has no server to secure.

---

## 2. Verified technology stack

Versions checked on the npm registry on **23 October 2026**. The lockfile pins exact versions; the table shows the intended range.

| Concern | Package | Version | Notes |
|---|---|---|---|
| Mapping core | `@arcgis/core` | **5.1.27** (`~5.1.27`) | ESM only. 5.1 released June 2026; minor releases have no breaking changes (Esri). 5.2 is in `rc`. |
| Map components | `@arcgis/map-components` | **5.1.27** (`~5.1.27`) | Peer deps: `@arcgis/core ^5.1.0`, `@esri/calcite-components ^5.1.1`. Ships React JSX typings at `@arcgis/map-components/types/react`. |
| Common components | `@arcgis/common-components` | 5.1.27 | Transitive dependency of map components; declared directly so its asset path can be set in local-asset mode (ADR-0014). |
| Design system | `@esri/calcite-components` | **5.1.2** (`~5.1.2`) | Esri's version matrix pairs SDK 5.1 with Calcite 5.1; npm `latest` is 5.2.0, so **pin to 5.1.x** to stay aligned. |
| UI framework | `react`, `react-dom` | 19.3.1 (`^19.3.0`) | React 19 supports custom elements natively. |
| Build | `vite` | 8.3.5 (`^8.3.0`) | |
| | `@vitejs/plugin-react` | 6.1.2 | Requires Vite ^8. |
| Language | `typescript` | **6.0.3** (`~6.0.3`) | npm `latest` is 7.0.2, but `typescript-eslint` 8.72 supports `<6.1.0`. **Do not use TS 7** until the lint toolchain supports it. |
| Lint | `eslint` 10.x, `typescript-eslint` 8.72 | | Flat config. |
| Charts | `echarts` | 6.1.0 | Imported from `echarts/core` with only the charts/components used; thin in-house `useEChart` hook (no wrapper dependency). |
| Server state | `@tanstack/react-query` | 5.104.x | Static snapshots: `staleTime: Infinity`. |
| Client state | `zustand` | 5.0.x | Slices + URL sync middleware. |
| Icons | `lucide-react` | 1.61.x | |
| Geometry helpers | `@turf/*` modular packages | 7.4.x | Only where the ArcGIS geometry operators are unsuitable (e.g. pure-function tests). |
| Validation | `ajv` | 8.20.x | Runtime validation of loaded snapshots against JSON Schema. |
| Types from schemas | `json-schema-to-typescript` | 16.x | Generates `src/types/generated/*`. |
| PDF | `jspdf` | 4.2.x | Programmatic layout (not DOM screenshots). |
| Unit tests | `vitest` | 5.0.x | jsdom for components; pure node for analysis. |
| Component tests | `@testing-library/react` | 16.3.x | |
| E2E | `@playwright/test` | 1.64.x | Chromium with software WebGL in CI. |
| Fonts | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` | 5.3.0 | Self-hosted. |
| Build helpers | `vite-plugin-static-copy` 4.1.1, `prettier` 3.9, `@axe-core/playwright` 4.14 | dev | Local asset copy, formatting, accessibility checks. |
| Reference geometry | `world-atlas` 2.0.2 + `topojson-client` 3.1.0 | dev | Natural Earth 4.1.0 1:110m outlines converted by `scripts/build-reference-layers.mjs` (S24). |
| Pipeline | Python 3.12, `uv`, `geopandas`, `shapely` 2, `pyproj`, `duckdb`, `httpx`, `pydantic`, `jsonschema` | pinned in `pipeline/uv.lock` | Network routing libraries (`osmnx`, `r5py`) added only in Release 3. |

### 2.1 ArcGIS 5.x facts that shape the code (verified)

- All widgets were **deprecated in 5.0**; Esri targets removal as early as Q1 2027. FOODSCOPE uses **map components only** (`<arcgis-map>`, `<arcgis-legend>`, `<arcgis-search>`, `<arcgis-zoom>`, `<arcgis-scale-bar>`, `<arcgis-time-slider>` etc.) or bespoke React controls.
- AMD/`require()` and the `__esri` type namespace are deprecated in 5.0 and removed in 6.0 — use ESM imports and named types only.
- `@arcgis/map-components-react` is still published (5.1.27) but Esri staff state it is not necessary for React 19. The brief excludes it; FOODSCOPE uses the custom elements directly.
- Component registration: `import "@arcgis/map-components/components/arcgis-map";` (package exports `./components/*`).
- JSX typing: add `/// <reference types="@arcgis/map-components/types/react" />` to `src/vite-env.d.ts`.
- Event props in JSX use the lowercase-prefixed custom event form, e.g. `onarcgisViewReadyChange`, `onarcgisReady` (confirmed in the package's React typings).
- 5.1 adds `CIMSymbolAnimationMoveAlongLine` (beta) for animating markers along lines — candidate for flow animation (ADR-05).
- 2D feature layers support clustering via feature reduction; client-side `GeoJSONLayer`/`FeatureLayer` sources are sufficient for ~20k points.
- *Verified in Stage 1*: a `MapView` whose map has no basemap never becomes ready unless `constraints.lods` is set (Esri's `MapViewConstraints` docs say so); `MapHost` supplies Web Mercator LODs from `TileInfo.create()`.
- *Verified in Stage 1*: runtime assets default to `js.arcgis.com/5.1.27/…` and `js.arcgis.com/calcite-components/5.1.2/`; each package exposes `setAssetPath` (core: `esriConfig.assetsPath`) for self-hosting (ADR-0014).

---

## 3. Architecture decision records (summary)

| ADR | Decision | Rationale | Consequences |
|---|---|---|---|
| **ADR-01** | Static-first hosting with pipeline-built snapshots | §1.1 | Data latency = pipeline cadence; "live" mode only via optional proxy in Release 3 |
| **ADR-02** | ArcGIS map components used directly in React 19; no widgets; no React wrapper | Brief §3; 5.0 deprecations | Need a small typed bridge for view access and events |
| **ADR-03** | **One-way sync**: Zustand store is the source of truth; map controllers subscribe and mutate ArcGIS layers; ArcGIS events dispatch store actions | Brief step 8 (keep map and React state synchronised) | No ArcGIS objects in React state; controllers are testable in isolation |
| **ADR-04** | Single 2D `MapView` in Web Mercator for all modules; `<arcgis-scene>` globe added in Release 2 for Food Origins only | Smooth global→local flights, one basemap | Quantities never encoded by country area; equal-area exports deferred |
| **ADR-05** | Flows as client-side polyline graphics: great-circle arcs (geodetic densify) from partner representative point to a UK anchor; width linear in net mass with clamps; animation via CIM symbol animation, spike in Stage 3 with static fallback | Honest, performant, reduced-motion friendly | Arcs are symbolic (P4); anchor is a single UK point, not ports |
| **ADR-06** | **JSON Schema is the canonical data contract** (`/schemas`); pipeline validates with `jsonschema`/pydantic, app generates TS types and validates at load with ajv | Two languages, one contract | Schema changes are versioned and tested on both sides |
| **ADR-07** | Python pipeline for data; TypeScript for the app | GeoPandas/DuckDB/pyproj are the right tools for boundaries, reprojection and spatial joins | Two toolchains; CI runs both |
| **ADR-08** | Data access through adapters: `StaticSnapshotAdapter` (default), `ArcGISFeatureLayerAdapter` (URL from `config.json`); future `ProxyAdapter` | Brief §7 and §15 configurability | Feature code never knows where data came from |
| **ADR-09** | Every value travels in an `Indicator<T>` envelope with provenance; `<Metric>` refuses to render without it (dev assertion, prod fallback "source unavailable") | P1/P2 | Slightly more verbose data structures |
| **ADR-10** | PDF built programmatically from the same `ProfileModel` as the screen; checksum in footer | Brief §9H exact match | Layout code for PDF separate from React layout |
| **ADR-11** | Auth: referrer-restricted ArcGIS Location Platform API key for basemaps, **never committed**: injected at build time from the GitHub Actions secret `ARCGIS_API_KEY` (local dev: git-ignored `.env.local`); hosted layers public or via user OAuth sign-in; publishing credentials only in CI secrets | Brief §3, §15. The key is visible in the deployed bundle by design (client apps must send it), so referrer restriction and minimal privileges are the real controls; keeping it out of git avoids leaking it in history and eases rotation | Keys expire after at most one year — rotation runbook in `docs/setup/arcgis-api-key.md`; local dev uses `localhost` referrers |
| **ADR-12** | Release 1 uses straight-line proximity only; network times are pre-computed in the pipeline in Release 3 (no bulk client-side routing with an embedded key) | Accessibility honesty (P7), cost control | UI must label proximity measures clearly |
| **ADR-13** | Query-string state, no path routing | GitHub Pages has no rewrites; deep links needed for demos | `?m=origins&c=tomatoes&y=2025&mo=7` style URLs |
| **ADR-14** | SDK assets from the Esri CDN in production; `VITE_ARCGIS_ASSETS=local` copies them into the build for tests/offline | Esri recommends the CDN; self-hosting adds ~130 MB; sandboxes cannot reach the CDN | Two build modes; CI E2E uses local mode, post-deploy smoke test covers CDN mode |

Full ADR texts live in `docs/adr/` (one file per decision, MADR format; index in `docs/adr/README.md`).

---

## 4. Repository structure

Adapted from brief §18. Folders marked † are created in later stages.

```text
FoodScopeUK/                       # repository root
├── CLAUDE.md                      # instructions for Claude Code (read first)
├── README.md                      # setup, data, refresh, licensing, limitations
├── docs/
│   ├── 00-ORIGINAL-BRIEF.md
│   ├── 01-SPECIFICATION.md
│   ├── 02-ARCHITECTURE.md
│   ├── 03-DATA-SOURCES.md
│   ├── 04-ROADMAP.md
│   ├── adr/                       # one MADR file per decision
│   └── stage-reports/             # what each stage delivered and verified
├── schemas/                       # JSON Schema: canonical data contracts (ADR-06)
├── pipeline/                      # Python data pipeline (uv project)
│   ├── pyproject.toml / uv.lock
│   ├── foodscope_pipeline/
│   │   ├── sources/               # one module per source (hmrc.py, geolytix.py, ons.py…)
│   │   ├── derive/                # aggregation, spatial joins, distances
│   │   ├── publish.py             # writes snapshot + manifest.json
│   │   └── accounting.py          # rows in/out per stage
│   ├── config/commodities.yaml    # commodity baskets (§6.1 of spec)
│   └── tests/
├── public/
│   ├── config.json                # runtime config (no secrets)
│   ├── data/
│   │   ├── manifest.json          # current snapshot pointer + source catalogue
│   │   └── snapshots/<YYYY-MM-DD>/…
│   └── assets/                    # brand, commodity icons
├── src/
│   ├── main.tsx
│   ├── vite-env.d.ts              # includes ArcGIS React JSX type reference
│   ├── app/                       # App shell, providers, URL sync, error boundaries
│   ├── components/
│   │   ├── layout/                # TopBar, Sidebar, InsightsPanel, TimelineBar
│   │   ├── dashboard/             # KpiCard, Metric, SourceBadge, ProvenanceBadge
│   │   ├── maps/                  # MapHost (<arcgis-map>), MapLegend, MapStatusTray
│   │   ├── charts/                # useEChart, Heatmap, TrendLine, BarCompare
│   │   ├── controls/              # CommoditySelector, MonthStepper, RetailerFilter…
│   │   └── states/                # Skeleton, EmptyState, ErrorState, StaleBanner
│   ├── features/
│   │   ├── food-origins/
│   │   ├── seasonal-supply/
│   │   ├── supermarkets/
│   │   ├── food-access/
│   │   ├── authority-profiles/
│   │   ├── vulnerabilities/       †
│   │   ├── scenarios/
│   │   ├── consulting-insights/
│   │   └── ask-foodscope/         †
│   ├── map/                       # MapController, layer controllers, layer registry
│   ├── services/
│   │   ├── config/                # load + validate config.json
│   │   ├── data/                  # adapters (static, feature layer), manifest loader
│   │   └── arcgis/                # view access, goTo choreography, screenshot
│   ├── analysis/                  # PURE functions: shares, HHI, distances, scenarios
│   ├── state/                     # Zustand slices + URL sync
│   ├── content/                   # workstreams.json, caveats.json, glossary.json
│   ├── styles/                    # tokens.css, calcite-theme.css, glass.css
│   └── types/                     # domain types + generated/
├── tests/
│   ├── fixtures/                  # REAL source samples with retrieval date
│   ├── unit/ …                    # (or co-located *.test.ts)
│   └── e2e/                       # Playwright
├── .github/workflows/
│   ├── ci.yml                     # typecheck, lint, unit, build, e2e
│   ├── deploy-pages.yml           # build + deploy to GitHub Pages
│   └── refresh-data.yml           # scheduled pipeline → PR with data diff
├── package.json / package-lock.json
├── vite.config.ts / tsconfig.json / eslint.config.js / playwright.config.ts
└── .env.example                   # build-time vars only (no secrets)
```

Rules:

- `src/analysis/` never imports ArcGIS, React or browser APIs. It is where correctness lives and where tests concentrate.
- `src/features/<module>/` owns its panels, hooks and a `layers.ts` that declares which layer controllers it activates.
- `src/map/` is the only place that creates or mutates ArcGIS layers.

---

## 5. Front-end design

### 5.1 State model (Zustand)

```ts
type ModuleId = "origins" | "seasonal" | "access" | "risks" | "profiles" | "scenarios" | "insights";

interface AppState {
  ui:        { module: ModuleId; sidebarOpen: boolean; insightsOpen: boolean; motion: "auto" | "reduced"; };
  selection: { commodity: CommodityId; year: number; month: number | null; period: "month" | "rolling12" | "year";
               compareYear: number | null; lad: GssCode | null; compareLads: GssCode[]; storeId: string | null; };
  filters:   { retailers: string[]; storeClasses: StoreClass[]; thresholdsKm: number[]; metric: "mass" | "value"; };
  scenario:  { id: ScenarioId | null; params: Record<string, number | string>; };
  // actions…
}
```

- Only serialisable values live in the store. ArcGIS objects (view, layers, graphics) live in controllers.
- A URL-sync middleware mirrors `ui.module`, `selection`, `filters` and `scenario` to the query string (ADR-13) with debounce, and hydrates them on load.
- Derived data (partner shares, KPIs) is computed with memoised selectors over TanStack Query results — never stored.

### 5.2 Indicator envelope (ADR-09)

```ts
type ProvenanceClass = "measured" | "official_estimate" | "derived" | "scenario" | "illustrative";

interface Indicator<T = number> {
  id: string;                    // e.g. "trade.import_mass_t"
  label: string;
  value: T | null;               // null = missing; reason required
  missingReason?: "suppressed" | "not_published" | "not_applicable" | "not_covered" | "small_base";
  unit: string;                  // "t", "GBP", "%", "per 10k residents", "km (straight-line)"
  provenance: ProvenanceClass;
  sourceIds: string[];           // keys into the manifest catalogue (S01…)
  referencePeriod: string;       // "2025-07", "mid-2025", "2021 Census"
  coverage: string;              // "UK", "England & Wales", "Belfast LGD"
  method: string;                // short text + link to method doc anchor
  scope: "local" | "national_context";
  comparabilityGroup?: string;   // e.g. "deprivation:england-iod2025"
  quality?: string;              // revisions, small base, etc.
}
```

### 5.3 Map architecture

```mermaid
flowchart TB
  Store[(Zustand store)] -- subscribe --> MC[MapController]
  MC --> LR[Layer registry]
  LR --> L1[CountriesLayerCtl]
  LR --> L2[FlowsLayerCtl]
  LR --> L3[LadBoundaryLayerCtl]
  LR --> L4[SupermarketsLayerCtl]
  LR --> L5[SmallAreaLayerCtl]
  LR --> L6[ScenarioOverlayCtl]
  MapHost["MapHost.tsx<br/>arcgis-map element, onarcgisViewReadyChange"] -- view ready --> MC
  MC -- hitTest / click / extent --> Actions[store actions]
  Actions --> Store
```

- `MapHost` (lazy-loaded) renders `<arcgis-map>` once, never re-mounts on module change, and hands the view to `MapController` on `arcgisViewReadyChange`. It owns the loading overlay, a 30-second timeout error, a WebGL2 check and `arcgisViewReadyError` handling.
- Each layer controller implements `activate(view)`, `update(state, data)`, `deactivate()` and owns its layer IDs. Controllers are idempotent: `update` with the same inputs makes no changes (cheap equality check), which prevents feedback loops.
- Layer z-order (bottom→top): basemap · small-area choropleth · LAD boundaries · country choropleth · flows · stores · scenario overlays · selection highlight.
- Camera choreography lives in `services/arcgis/goTo.ts` (global extent, UK extent, LAD extent with padding for open panels); durations come from motion settings.
- Map clicks call `hitTest` and dispatch typed actions (`selectCountry`, `selectLad`, `selectStore`).

### 5.4 Data access

- `manifest.json` lists the current snapshot ID and, per dataset, path, schema ID, checksum, source IDs and reference period.
- `useDataset(id)` (TanStack Query) → adapter → fetch → ajv validate → typed result. Validation failure surfaces as an error state naming the dataset.
- Adapters per ADR-08. The `ArcGISFeatureLayerAdapter` reads layer URLs and field mappings from `config.json`, so a ConsultingWhere-published copy of a dataset can replace the static snapshot without code changes, provided its fields map to the same schema.

### 5.5 Error handling

- Error boundary per region (sidebar, insights, each chart). The map region has its own boundary and status tray listing failed layers.
- All fetches have timeouts and typed error causes (network, validation, not found, quota).
- Stale data banner when a source's reference period is older than expected cadence + grace (cadence in manifest).

### 5.6 PDF export (ADR-10)

`ProfileModel` (pure data) → `renderProfilePdf(model, assets)` using jsPDF: cover, overview, indicators table with provenance classes, map image (`view.takeScreenshot()`), chart images (ECharts `getDataURL`), insights, sources & limitations appendix. A SHA-256 of the serialised model is printed in the footer and shown in the UI next to the Export button.

---

## 6. Data pipeline design

### 6.1 Stages

| Stage | Responsibility | Output |
|---|---|---|
| `ingest` | Download each source with provenance (URL, query, retrieval time, HTTP status, checksum, licence). HMRC client throttles to ≤ 50 req/min and follows `@odata.nextLink`. | `pipeline/cache/raw/<source>/<date>/…` (git-ignored) |
| `validate` | Schema and value checks (types, ranges, codes), CRS assertions, geometry validity, duplicate keys; accounting log of rows in/out. | `…/staged/*.parquet` + accounting report |
| `derive` | Commodity aggregation, partner monthly tables, country crosswalk, point-in-polygon store→LAD/small area, nearest-store distances, LAD indicators | `…/derived/*.parquet` |
| `publish` | Write compact JSON/GeoJSON per schema, deterministic ordering, gzip-friendly; write `manifest.json`; generalise geometries for the web | `public/data/snapshots/<date>/…` |

Every stage is idempotent and re-runnable from cached raw inputs. Each run writes an accounting report (rows/features in → out per step, rejects with reasons) to `docs/stage-reports/data-runs/`.

### 6.2 Snapshot layout (proposed)

```text
public/data/
├── manifest.json
└── snapshots/2026-11-xx/
    ├── catalogue.json                  # source records (S01…) incl. licence & attribution
    ├── trade/commodities.json          # baskets + labels + CN8 lists
    ├── trade/partners/<commodity>.json # monthly × partner: mass_t, value_gbp, flags; 2019-01 → latest
    ├── trade/countries.json            # HMRC CountryId ↔ ISO2 ↔ geometry key crosswalk
    ├── geo/countries.geojson           # Natural Earth, generalised, with representative points
    ├── geo/lad_2025.geojson            # ONS LAD May 2025 BGC, further generalised, WGS84
    ├── retail/stores.geojson           # GEOLYTIX snapshot (fields as delivered + derived lad code)
    ├── lad/indicators.json             # per LAD: population, store counts, per-10k, area
    ├── areas/<LADCODE>/small_areas.geojson
    ├── areas/<LADCODE>/indicators.json # PPFI, deprivation, car availability, distances…
    ├── production/<series>.json        # Defra monthly/annual series
    └── context/national.json           # UKFSR/pocketbook context figures with citations
```

### 6.3 CRS policy

- Store and publish in WGS84 (EPSG:4326) for the web.
- Compute distances and areas in projected CRS: EPSG:27700 (Great Britain), EPSG:2157 Irish Transverse Mercator (Northern Ireland). Never compute distances in degrees.
- Reprojection of NI sources (often Irish Grid EPSG:29902 or ITM) is explicit and logged; the source CRS is read from file metadata, never assumed.

### 6.4 Scheduling

- `refresh-data.yml` runs monthly a few days after HMRC's OTS release (exact schedule set once the release calendar is checked) and quarterly for GEOLYTIX; it opens a pull request with the new snapshot and a diff summary (rows, totals per commodity, changed reference periods). A human merges — data never auto-deploys.

---

## 7. Testing strategy

| Layer | Tooling | What is tested |
|---|---|---|
| Analysis | Vitest (node) | Every formula in spec §6 with hand-calculated fixtures; edge cases (empty, zero totals, suppressed, single partner, NaN) |
| Contracts | Vitest + ajv; pytest + jsonschema | Snapshot files validate against schemas on both sides; **real** API samples in `tests/fixtures/` with retrieval date |
| Reconciliation | pytest | Selected published totals (e.g. one commodity/month) re-queried from HMRC match pipeline output |
| Components | Vitest + Testing Library (jsdom; `<arcgis-map>` mocked) | Data states, provenance badges present, keyboard behaviour |
| Map controllers | Vitest with a fake view/layer interface | Idempotent updates, correct layer IDs, store→layer sync |
| E2E | Playwright (Chromium, software WebGL) | Map ready, commodity/month change, filters, LAD zoom, profile render, scenario run, export file produced |
| Visual/responsive | Playwright screenshots at 1920×1080, 1366×768, 1024×768, 390×844 | Layout regressions (reviewed, not pixel-strict) |
| Accessibility | `@axe-core/playwright` | No serious/critical violations on each module |

---

## 8. CI/CD and hosting

- **ci.yml** (PR + main): `npm ci` → banned-import check → Prettier → generated types up to date → typecheck → lint → unit/component tests → build with local ArcGIS assets → Playwright (Chromium, SwiftShader WebGL) against `vite preview`; pipeline job: `uv sync --locked` → `pytest`.
- **deploy-pages.yml** (main): build in CDN mode with `BASE_PATH=/FoodScopeUK/` and the `ARCGIS_API_KEY` secret → upload artifact → `actions/deploy-pages` → Playwright smoke test against the live URL (`PLAYWRIGHT_BASE_URL`).
- **Repository and URL**: `github.com/johnchewitt/FoodScopeUK` → `https://johnchewitt.github.io/FoodScopeUK/`.
- **Base path**: `vite.config.ts` reads `BASE_PATH` (default `/FoodScopeUK/`, matching the repository name's casing; `/` for a custom domain). All runtime fetches use `import.meta.env.BASE_URL`. Stage 1 smoke test also loads the lower-case URL variant to confirm assets resolve.
- **Pages source**: repository Settings → Pages → Source = "GitHub Actions" (set once in Stage 1).
- **API key injection**: `deploy-pages.yml` passes `secrets.ARCGIS_API_KEY` to the build as `VITE_ARCGIS_API_KEY`; if the secret is absent the app runs with the key-free fallback map and logs a console warning.
- **Caching**: snapshot paths are immutable (dated), so browsers can cache them; `manifest.json` and `config.json` are small and always revalidated.

---

## 9. Security and privacy

- No secrets in the repository; `config.json` holds only public values (layer URLs, feature flags). The ArcGIS API key is injected at build time (ADR-11).
- API key referrers: `https://johnchewitt.github.io`, `http://localhost:5173` (dev) and `http://localhost:4173` (preview). Esri advises against path-based referrers, so the key is usable by any site on that GitHub Pages origin — FOODSCOPE gets its own credentials item so it can be rotated or revoked independently. Privileges limited to the Basemap styles service (add geocoding only if Search uses Esri geocoding).
- Release 3 serverless functions (LLM, live trade proxy) hold secrets server-side, rate-limit callers, and log no personal data.
- No analytics or cookies by default.
- Dependencies: lockfiles committed; `npm audit` and `pip-audit` in CI (informational failures reviewed).

---

## 10. Performance budget

| Item | Budget |
|---|---|
| Initial JS (gzip, excluding lazy ArcGIS chunks) | ≤ 350 kB |
| Initial data (manifest, config, countries, LAD boundaries, 1 commodity) | ≤ 2.5 MB gzip |
| Stores layer | ≤ 2 MB gzip (properties trimmed to fields used) |
| Small-area data | loaded per LAD, ≤ 1 MB gzip per authority |
| Commodity switch (cached) | < 300 ms to updated map + KPIs |

Measured in CI with bundle-size reporting; regressions over 10 % fail the build after Stage 8.

**Stage 1 measurement (production build)**: initial JS `index` chunk 605.8 kB (183.7 kB gzip) — over the 350 kB budget, mainly React, Calcite (dialog, panel, switch, loader) and Ajv; the ArcGIS `MapHost` chunk (1.15 MB, 275 kB gzip) loads lazily. Reduction is tracked in `docs/backlog.md`.
