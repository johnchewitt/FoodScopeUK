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
