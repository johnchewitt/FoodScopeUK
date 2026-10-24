# foodscope-pipeline

Python pipeline that turns official sources into dated, validated data for the FOODSCOPE UK app (architecture §6). Online steps run only on GitHub Actions (the build sandbox cannot reach HMRC or ONS); everything else runs offline from the raw files committed in `raw/`, and rebuilds are byte-identical.

| Command | Online? | What it does |
|---|---|---|
| `uv run foodscope-pipeline ingest-hmrc --snapshot <date>` | yes (Actions: `refresh-trade-data.yml`) | HMRC OTS responses → `raw/hmrc/<date>/` (ADR-0016) |
| `uv run foodscope-pipeline build-trade --snapshot <date>` | no | raw HMRC cache → `../public/data/snapshots/<date>/trade/` |
| `uv run foodscope-pipeline fetch-ons --snapshot <date>` | yes (Actions: `refresh-reference-data.yml`, push to `data/**`) | ONS population tables, LAD 2022→2023 lookup, May 2025 BGC boundaries → `raw/ons/<date>/` (incremental) |
| `uv run foodscope-pipeline fetch-reference --snapshot <date>` | yes (Actions: `refresh-reference-data.yml`, push to `data/**`) | `fetch-ons` plus the Stage 5 files: ONS LSOA lookup, boundaries and centroids for Manchester; Nomis Census 2021 TS001 and TS045; MHCLG IoD 2025 File 7; NISRA Data Zone and SOA 2011 boundaries, Data Zone centroids, MS-A01, NIMDM 2017 → `raw/<publisher>/<date>/` (incremental; each publisher's folder is complete or unchanged) |
| `uv run foodscope-pipeline build-areas --snapshot <date> [--out <dir>]` | no | Small areas of the deep profiles (Manchester LSOAs, Belfast Data Zones and SOAs 2011): boundaries and Census 2021 / deprivation indicators → `<out>/snapshots/<date>/areas/` (default `public/data`) + `reports/areas-qa-<date>.json` |
| `uv run foodscope-pipeline build-local --snapshot <date>` | no | boundaries, stores, population → `../public/data/snapshots/<date>/local/` and reports in `reports/` (ADR-0020, ADR-0021) |
| `uv run foodscope-pipeline publish` | no | `../public/data/manifest.json` from every provenance sidecar under `public/data/reference/` and, for each data family (`trade`, `local`), its newest `public/data/snapshots/<date>/<family>/` (ADR-0021) |

Files provided by hand (GEOLYTIX retail points, the BFE boundary FileGDB, ONS S12) are kept in `raw/<source>/<edition>/` byte for byte, each with an `index.json` (original name, SHA-256, licence, attribution, when received). The build refuses a file that no longer matches.

Configuration that encodes decisions lives in `foodscope_pipeline/config/`: trade baskets and country crosswalk (Stage 2), store classes (decision D5) and council code changes.

```bash
cd pipeline
uv sync
uv run pytest            # includes offline rebuilds of the trade snapshot and the local datasets
```
