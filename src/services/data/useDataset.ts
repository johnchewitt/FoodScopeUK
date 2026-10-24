import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { DataManifest } from "@/types/generated/manifest";
import { staticSnapshotAdapter, type DataSourceAdapter } from "./adapters";
import { DataLoadError } from "./errors";
import { findDataset, useManifest } from "./queries";

export type Validator<T> = (data: unknown) => { ok: boolean; value?: T; errors: string[] };

/**
 * Query options for a validated manifest dataset. Shared by `useValidatedDataset` and the startup
 * prefetch (src/services/data/prefetch.ts), so both read and fill the same cache entry.
 */
export function validatedDatasetQuery<T>(
  manifest: DataManifest | undefined,
  id: string | null,
  validate: Validator<T>,
  adapter: DataSourceAdapter = staticSnapshotAdapter,
) {
  return {
    queryKey: ["dataset", id, adapter.kind, "validated"] as const,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    queryFn: async ({ signal }: { signal?: AbortSignal }): Promise<T> => {
      const dataset = id ? findDataset(manifest, id) : undefined;
      if (!dataset) throw new DataLoadError("not_found", id ?? "dataset", "not listed in manifest");
      const raw = await adapter.load(dataset, signal);
      const result = validate(raw);
      if (!result.ok || result.value === undefined) {
        throw new DataLoadError("validation", dataset.title, "schema validation failed", result.errors);
      }
      return result.value;
    },
  };
}

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
  validate: Validator<T>,
  adapter: DataSourceAdapter = staticSnapshotAdapter,
): UseQueryResult<T, Error> {
  const manifest = useManifest();
  return useQuery({
    ...validatedDatasetQuery(manifest.data, id, validate, adapter),
    enabled: manifest.isSuccess && id !== null,
  });
}
