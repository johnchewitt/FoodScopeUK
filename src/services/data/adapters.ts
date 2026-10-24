import type { Dataset } from "@/types/generated/manifest";
import { datasetUrl } from "./queries";
import { fetchJson, timeoutForBytes } from "./fetchJson";

/**
 * Data access adapters (ADR-08). Feature code asks for a dataset by id; the adapter decides
 * where it comes from: the static snapshot (default) or, for a dataset listed in config.json's
 * `hostedLayers`, an ArcGIS FeatureLayer (`featureLayerAdapter`, Stage 4, SM-01).
 */
export interface DataSourceAdapter {
  readonly kind: "static-snapshot" | "arcgis-feature-layer";
  load(dataset: Dataset, signal?: AbortSignal): Promise<unknown>;
}

export const staticSnapshotAdapter: DataSourceAdapter = {
  kind: "static-snapshot",
  load: (dataset, signal) =>
    fetchJson(datasetUrl(dataset), dataset.title, signal, timeoutForBytes(dataset.bytes)),
};
