# ADR-0008 — Data access through adapters

- Status: Accepted (Stage 1: static snapshot adapter only)
- Date: 2026-10-23

## Decision
Feature code requests datasets by id via `useDataset(id)`. A `DataSourceAdapter` decides where the data comes from: `staticSnapshotAdapter` (implemented), an ArcGIS FeatureLayer adapter configured through `config.json` `hostedLayers` (Stage 4), a proxy adapter (Release 3).

## Consequences
A ConsultingWhere-hosted copy of a dataset can replace the static snapshot without code changes, provided field mappings are supplied.
