# Maintenance and data refresh

How to keep FOODSCOPE UK current and deployed (Stage 8 deliverable). Commands are run from the repository root unless marked `pipeline/`. Every data refresh reaches `main` by pull request, never directly.

## 1. Routine schedule

| When | What | How |
|---|---|---|
| Monthly, after HMRC's release (usually mid-month) | Trade data: new month, revisions of provisional months | §2 |
| When a source publishes a new edition | Stores (GEOLYTIX), population (ONS mid-year), PPFI, IoD, Defra balances, DfT ports, UKFSR, water stress | §3 |
| Before the key expires (at most yearly) | ArcGIS API key rotation | `docs/setup/arcgis-api-key.md` §5 |
| Monthly, and before any release | Dependency audit and updates | §5 |
| After any dependency change | Third-party notices | `node scripts/third-party-notices.mjs` (a test fails if it is stale) |
| After a data refresh or a change to the services copy | Generated review docs | `node scripts/docs-inventory.mjs` |
| Before 2026-11-03 at the earliest | certifi 2026.10.19 in the pipeline lock (security fix; B65) | §5 |

## 2. Trade data (HMRC, monthly)

The sandbox cannot reach `api.uktradeinfo.com`, so the online step runs on GitHub Actions.

1. Push a branch named `data-refresh/<YYYY-MM-DD>`, or run **Refresh trade data (HMRC)** (`refresh-trade-data.yml`) from the Actions tab.
2. The workflow calls the HMRC API at most 50 times a minute and follows `@odata.nextLink`. It splits long code lists into `<prefix>-cNN` queries (at most ten OR-ed codes per filter) and commits the raw responses to `pipeline/raw/hmrc/<date>/`.
3. It then rebuilds the snapshot offline (`build-trade`), reconciles the aggregation against the raw rows and checks the baskets against Defra's trade codes (`check-baskets`, gate G3). It republishes the manifest and runs the pipeline tests.
4. Review the pull request:
   - the reconciliation report;
   - months added and revised;
   - code changes;
   - `npm test` and the E2E run in CI.
5. Merge. The deploy workflow publishes the new snapshot.

Offline rebuild of an existing snapshot: `cd pipeline && uv run foodscope-pipeline build-trade --snapshot <date>`.

## 3. Reference and local data

Online fetches run on Actions when a `data/**` branch is pushed (`refresh-reference-data.yml`). The `fetch-reference --set` options are:
- `stage5`: ONS, Nomis, MHCLG, NISRA, FSA;
- `context`: ONS urban/rural, Defra production;
- `stage6`: World Bank, DfT, Defra, Scottish Government, EMODnet, ONS, OS;
- `trade`: Defra trade codes;
- `stage7`: small-area centroids.

Files that cannot be fetched (for example the GEOLYTIX download) are provided by hand:
- put them under `pipeline/raw/<source>-provided/<edition>/` with an `index.json` of checksums;
- check their embedded metadata for local paths or personal details first.

Rebuild offline in dependency order, then publish:

```bash
cd pipeline
uv run foodscope-pipeline build-local --snapshot <date>
uv run foodscope-pipeline build-ni-grocers --snapshot <date> --local-snapshot <date>
uv run foodscope-pipeline build-context --snapshot <date> --raw-snapshot <date> --reference-snapshot <date> --local-snapshot <date>
uv run foodscope-pipeline build-areas --snapshot <date> --context-snapshot <date>
uv run foodscope-pipeline build-risk --snapshot <date> --reference-snapshot <date> --local-snapshot <date>
uv run foodscope-pipeline build-scenario --snapshot <date> --raw-snapshot <date> --stage6-snapshot <date> --reference-snapshot <date> --local-snapshot <date>
uv run foodscope-pipeline publish
uv run pytest
```

`publish` takes each family from its newest snapshot (ADR-0021). After a refresh:
- run `npm test`, since several tests check figures against the published files;
- update the expected values only after recomputing them independently from the raw files, as the stage reports describe;
- run `node scripts/docs-inventory.mjs`.

**Stage 8 dependencies on the data:**
- The local authority assessment uses the `scenario` family's small areas for every council. When stores or populations change, rebuild `build-scenario`, or the assessment's small-area figures will lag the profile's.
- The tests compare the two for Belfast and Manchester.

## 4. Deployment (GitHub Pages)

- `.github/workflows/deploy-pages.yml` runs on every push to `main`. It:
  - builds with `BASE_PATH=/FoodScopeUK/` and `VITE_ARCGIS_ASSETS=cdn`;
  - passes the `ARCGIS_API_KEY` secret as `VITE_ARCGIS_API_KEY`;
  - uploads `dist/` and deploys it.
- One-off setup:
  - **Settings → Pages → Source: GitHub Actions**;
  - the `ARCGIS_API_KEY` Actions secret (referrer-restricted, basemap styles only).
- The key is public in the built site by design. Never put any other credential in a `VITE_` variable.
- After a deploy, check the live site:
  - the basemap loads without a sign-in prompt;
  - a PDF made from ConsultingWhere Insights shows the basemap, its credits and Esri's map-image notice;
  - the attribution bar lists the data on screen.

## 5. Dependencies

- **JavaScript.**
  - Versions are exact, with a lockfile. Run `npm audit` and `npm outdated` and update deliberately, one area at a time.
  - Do not change the major or minor version of `@arcgis/*`, Calcite, React, Vite or TypeScript without an ADR.
  - Releases younger than two weeks are avoided as a supply-chain guard.
  - Then rerun `node scripts/third-party-notices.mjs`.
- **Python.**
  - `pipeline/pyproject.toml` pins exact versions, and `[tool.uv] exclude-newer` refuses releases newer than its date.
  - To update, move the date forward deliberately (at least two weeks before today), run `uv lock --upgrade-package <name>`, then `uv run pytest`.
  - Audit with `uv export --format requirements-txt --no-hashes --no-emit-project > req.txt && uvx pip-audit -r req.txt`.
- **GitHub Actions.** Pin third-party actions to commit SHAs before Release 1 (B66).

## 6. Checks before merging anything

```bash
npm run typecheck && npm run lint && npm run format && npm run check:banned
npm test
VITE_ARCGIS_ASSETS=local npm run build && npm run build:e2e-basemap && npm run e2e
cd pipeline && uv run pytest
```

The E2E suite includes a PDF test:
- it downloads a report from the running app;
- it reads the report back with pdf.js;
- it compares the key figures, checksum and map extent with the page.
