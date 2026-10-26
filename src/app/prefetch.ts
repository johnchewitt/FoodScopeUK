import type { QueryClient } from "@tanstack/react-query";
import { TRADE_INDEX_ID } from "@/features/origins/useOrigins";
import { loadAccess } from "@/features/access/load";
import { preloadProfiles } from "@/features/profiles/load";
import { preloadRisks } from "@/features/risks/load";
import { preloadScenarios } from "@/features/scenarios/load";
import { preloadSeasonal } from "@/features/seasonal/load";
import {
  LOCAL_INDICATORS_DATASET_ID,
  LOCAL_STORES_DATASET_ID,
  REFERENCE_POINTS_DATASET_ID,
} from "@/map/layerIds";
import { adapterFor } from "@/services/data/featureLayerAdapter";
import { configQuery, findDataset, manifestQuery } from "@/services/data/queries";
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
  if (url.module === "access") return prefetchAccess(client);
  // Local Authority Profiles reads the same stores and council indicators, plus its own chunk.
  if (url.module === "profiles") {
    preloadProfiles();
    return prefetchAccess(client);
  }
  // The Risk Explorer's chunk carries its own validators; its data loads with the view.
  if (url.module === "risks") preloadRisks();
  // The Scenario Lab's chunk (models, validators, charts); its data loads with the scenario.
  if (url.module === "scenarios") preloadScenarios();
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

/**
 * UK Food Access: the chunk (with its validators), the data index and config.json load together;
 * then the stores (8.5 MB, the long pole) and the council indicators, through the same query
 * options and adapter as useAccess, so the panels find them in the cache.
 */
async function prefetchAccess(client: QueryClient): Promise<void> {
  let manifest, config, chunk;
  try {
    [manifest, chunk] = await Promise.all([client.fetchQuery(manifestQuery), loadAccess()]);
  } catch {
    return;
  }
  try {
    config = await client.fetchQuery(configQuery);
  } catch {
    config = undefined;
  }
  await Promise.all([
    client.prefetchQuery(
      validatedDatasetQuery(
        manifest,
        LOCAL_STORES_DATASET_ID,
        chunk.validateStores,
        adapterFor(config, LOCAL_STORES_DATASET_ID, chunk.STORE_FIELDS),
      ),
    ),
    client.prefetchQuery(
      validatedDatasetQuery(manifest, LOCAL_INDICATORS_DATASET_ID, chunk.validateLadIndicators),
    ),
  ]);
}
