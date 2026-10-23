import type { Dataset } from "@/types/generated/manifest";
import { datasetUrl } from "./queries";
import { fetchJson } from "./fetchJson";

/**
 * Data access adapters (ADR-08). Feature code asks for a dataset by id; the adapter decides
 * where it comes from. Stage 1 implements the static snapshot adapter; the ArcGIS FeatureLayer
 * adapter (hosted layers configured in config.json) arrives with the supermarket layer in Stage 4.
 */
export interface DataSourceAdapter {
  readonly kind: "static-snapshot" | "arcgis-feature-layer";
  load(dataset: Dataset, signal?: AbortSignal): Promise<unknown>;
}

export const staticSnapshotAdapter: DataSourceAdapter = {
  kind: "static-snapshot",
  load: (dataset, signal) => fetchJson(datasetUrl(dataset), dataset.title, signal),
};
