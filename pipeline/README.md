# foodscope-pipeline

Python pipeline that turns official sources into dated, validated data snapshots for the FOODSCOPE UK app (architecture §6).

Stage 1 contains the skeleton only:

- `publish` — builds `public/data/manifest.json` from published datasets (currently the static reference layer's provenance sidecar) and the source catalogue, then validates it against `schemas/manifest.schema.json`.
- `accounting` — per-step row accounting used by every future ingest.

Source ingests (HMRC, GEOLYTIX, ONS …) arrive in Stage 2.

```bash
cd pipeline
uv sync
uv run pytest
uv run foodscope-pipeline publish      # writes ../public/data/manifest.json
```
