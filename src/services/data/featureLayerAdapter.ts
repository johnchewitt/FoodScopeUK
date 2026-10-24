import type { AppConfig, HostedLayer } from "@/types/generated/config";
import type { Dataset } from "@/types/generated/manifest";
import { staticSnapshotAdapter, type DataSourceAdapter } from "./adapters";
import { DataLoadError } from "./errors";
import { fetchJson } from "./fetchJson";

/** Most pages read from one hosted layer (2,000 features each by default: 100,000 features). */
export const MAX_PAGES = 50;

interface GeoJsonPage {
  type?: string;
  features?: {
    type?: string;
    id?: unknown;
    geometry?: unknown;
    properties?: Record<string, unknown> | null;
  }[];
  properties?: { exceededTransferLimit?: boolean };
  exceededTransferLimit?: boolean;
  error?: { message?: string };
}

/**
 * Reads every feature of an ArcGIS FeatureLayer (`hostedLayers` in config.json, ADR-08, SM-01) and
 * returns them in the canonical schema's shape, so the same validation and the same feature code
 * run whether the data comes from the static snapshot or a hosted layer:
 * - pages through `query?where=1=1&outFields=*&f=geojson` with `resultOffset` until the service
 *   stops reporting `exceededTransferLimit` (at most MAX_PAGES pages);
 * - renames properties with `fieldMap` (canonical name → hosted field name); unmapped canonical
 *   names are read as they are;
 * - sets each feature's `id` from its canonical `id` property.
 * The result is validated against the dataset's schema by the caller; a hosted layer that does not
 * match the schema is rejected, never shown.
 */
export function featureLayerAdapter(
  hosted: HostedLayer,
  canonicalFields: readonly string[],
): DataSourceAdapter {
  const base = hosted.url.replace(/\/+$/, "");
  return {
    kind: "arcgis-feature-layer",
    async load(dataset: Dataset, signal?: AbortSignal) {
      const features: unknown[] = [];
      let offset = 0;
      for (let page = 0; page < MAX_PAGES; page++) {
        const url = `${base}/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson&resultOffset=${offset}`;
        const doc = (await fetchJson(url, `${dataset.title} (hosted layer)`, signal)) as GeoJsonPage;
        if (doc.error)
          throw new DataLoadError("http", dataset.title, doc.error.message ?? "hosted layer error");
        const batch = doc.features ?? [];
        for (const f of batch) {
          const props: Record<string, unknown> = {};
          const source = f.properties ?? {};
          for (const name of canonicalFields) {
            const field = hosted.fieldMap?.[name] ?? name;
            props[name] = field in source ? source[field] : null;
          }
          features.push({ type: "Feature", id: props.id, geometry: f.geometry, properties: props });
        }
        offset += batch.length;
        const more = doc.properties?.exceededTransferLimit ?? doc.exceededTransferLimit ?? false;
        if (!more || batch.length === 0) return { type: "FeatureCollection", features };
      }
      throw new DataLoadError("http", dataset.title, `more than ${MAX_PAGES} pages from the hosted layer`);
    },
  };
}

/**
 * The adapter for a dataset: the hosted FeatureLayer when config.json lists one for its id
 * (`hostedLayers`), otherwise the static snapshot. Feature code calls this instead of choosing.
 */
export function adapterFor(
  config: AppConfig | undefined,
  datasetId: string,
  canonicalFields: readonly string[],
): DataSourceAdapter {
  const hosted = config?.hostedLayers[datasetId];
  return hosted ? featureLayerAdapter(hosted, canonicalFields) : staticSnapshotAdapter;
}
