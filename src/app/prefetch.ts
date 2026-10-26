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
 * A start-up load that always completes. TanStack Query cancels a fetch whose queryFn used the
 * AbortSignal when its last observer unmounts; panels mounting and unmounting while the lazy
 * chunks arrive did that to the Scenario Lab's trade index and country points, which were then
 * requested twice (review of Stage 7). Same key, options and validator; only the signal is dropped.
 */
function startup<O extends { queryFn: (ctx: { signal?: AbortSignal }) => Promise<unknown> }>(options: O): O {
  return { ...options, queryFn: () => options.queryFn({}) };
}

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
  url: Pick<UrlState, "module" | "commodity"> & Partial<Pick<UrlState, "scenarioKind">>,
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
  // The Scenario Lab opens on Scenario A, a supply disruption on the trade map: the same trade
  // index, country points and basket snapshot (same query options and validators) as Food Origins,
  // so they start with the page instead of after the chunk (review of Stage 7).
  const scenarioTrade = url.module === "scenarios" && (url.scenarioKind ?? "import") === "import";
  if (!TRADE_MODULES.includes(url.module) && !scenarioTrade) {
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
    client.prefetchQuery(startup(validatedDatasetQuery(manifest, TRADE_INDEX_ID, validateTradeIndex))),
    client.prefetchQuery(
      startup(validatedDatasetQuery(manifest, REFERENCE_POINTS_DATASET_ID, validateCountryPoints)),
    ),
    findDataset(manifest, snapshotId)
      ? client.prefetchQuery(startup(validatedDatasetQuery(manifest, snapshotId, validateTradeSnapshot)))
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
      startup(
        validatedDatasetQuery(
          manifest,
          LOCAL_STORES_DATASET_ID,
          chunk.validateStores,
          adapterFor(config, LOCAL_STORES_DATASET_ID, chunk.STORE_FIELDS),
        ),
      ),
    ),
    client.prefetchQuery(
      startup(validatedDatasetQuery(manifest, LOCAL_INDICATORS_DATASET_ID, chunk.validateLadIndicators)),
    ),
  ]);
}
