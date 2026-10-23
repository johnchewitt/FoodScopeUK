import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { staticSnapshotAdapter, type DataSourceAdapter } from "./adapters";
import { DataLoadError } from "./errors";
import { findDataset, useManifest } from "./queries";

/**
 * Loads a dataset listed in the manifest through an adapter (ADR-08).
 * Callers validate the payload against the dataset's schema before use.
 */
export function useDataset(
  id: string,
  adapter: DataSourceAdapter = staticSnapshotAdapter,
): UseQueryResult<unknown, Error> {
  const manifest = useManifest();
  return useQuery({
    queryKey: ["dataset", id, adapter.kind],
    enabled: manifest.isSuccess,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: ({ signal }) => {
      const dataset = findDataset(manifest.data, id);
      if (!dataset) throw new DataLoadError("not_found", id, "not listed in manifest");
      return adapter.load(dataset, signal);
    },
  });
}

/**
 * Loads a manifest dataset and validates it against its schema before use (ADR-06, ADR-08).
 * A payload that fails validation is rejected with a typed error, never shown.
 */
export function useValidatedDataset<T>(
  id: string | null,
  validate: (data: unknown) => { ok: boolean; value?: T; errors: string[] },
  adapter: DataSourceAdapter = staticSnapshotAdapter,
): UseQueryResult<T, Error> {
  const manifest = useManifest();
  return useQuery({
    queryKey: ["dataset", id, adapter.kind, "validated"],
    enabled: manifest.isSuccess && id !== null,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async ({ signal }) => {
      const dataset = id ? findDataset(manifest.data, id) : undefined;
      if (!dataset) throw new DataLoadError("not_found", id ?? "dataset", "not listed in manifest");
      const raw = await adapter.load(dataset, signal);
      const result = validate(raw);
      if (!result.ok || result.value === undefined) {
        throw new DataLoadError("validation", dataset.title, "schema validation failed", result.errors);
      }
      return result.value;
    },
  });
}
