import type { QueryClient } from "@tanstack/react-query";
import { TRADE_INDEX_ID } from "@/features/origins/useOrigins";
import { preloadSeasonal } from "@/features/seasonal/load";
import { REFERENCE_POINTS_DATASET_ID } from "@/map/layerIds";
import { findDataset, manifestQuery } from "@/services/data/queries";
import { validatedDatasetQuery } from "@/services/data/useDataset";
import { validateCountryPoints, validateTradeIndex, validateTradeSnapshot } from "@/services/data/validate";
import type { UrlState } from "@/state/urlState";

const TRADE_MODULES: readonly string[] = ["origins", "seasonal"];

/**
 * Starts loading the first view's data before React renders and before the ArcGIS SDK is
 * requested (performance: the figures must not wait behind ~400 map modules).
 *
 * The data index is fetched first; the trade index, the country label points and the selected
 * commodity's snapshot then load in parallel instead of one after another. Every request goes
 * through the same query options as the hooks (same cache keys, same schema validation), so the
 * components simply find the data already there. Failures are left to the hooks, which show their
 * normal error states.
 */
export async function prefetchStartupData(
  client: QueryClient,
  url: Pick<UrlState, "module" | "commodity">,
): Promise<void> {
  if (!TRADE_MODULES.includes(url.module)) {
    await client.prefetchQuery(manifestQuery);
    return;
  }
  // Seasonal Supply's panels are a separate chunk: request it alongside the data.
  if (url.module === "seasonal") preloadSeasonal();
  let manifest;
  try {
    manifest = await client.fetchQuery(manifestQuery);
  } catch {
    return;
  }
  const snapshotId = `trade.${url.commodity}`;
  await Promise.all([
    client.prefetchQuery(validatedDatasetQuery(manifest, TRADE_INDEX_ID, validateTradeIndex)),
    client.prefetchQuery(validatedDatasetQuery(manifest, REFERENCE_POINTS_DATASET_ID, validateCountryPoints)),
    findDataset(manifest, snapshotId)
      ? client.prefetchQuery(validatedDatasetQuery(manifest, snapshotId, validateTradeSnapshot))
      : Promise.resolve(),
  ]);
}
