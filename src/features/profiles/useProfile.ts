import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { councilNetwork, nationalImports, type NationalImports } from "@/analysis/profile";
import { councilProvision, filterWhereClause, type Provision } from "@/analysis/retail";
import { useAccess } from "@/features/access/useAccess";
import { areaTotals } from "@/features/access/model";
import { useTradeIndex } from "@/features/origins/useOrigins";
import { areaDatasetIds, CONTEXT_COUNCILS_DATASET_ID, CONTEXT_PRODUCTION_DATASET_ID } from "@/map/layerIds";
import { familySnapshot, findDataset, useManifest } from "@/services/data/queries";
import { useValidatedDataset, validatedDatasetQuery } from "@/services/data/useDataset";
import { validateTradeSnapshot } from "@/services/data/validate";
import { useAppStore } from "@/state/store";
import type { DataManifest } from "@/types/generated/manifest";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import type { UkProduction } from "@/types/generated/uk-production";
import {
  councilRows,
  deepProfile,
  profileAreaMap,
  profileCouncilMap,
  type CouncilRow,
  type DeepProfile,
} from "./model";
import {
  validateAreaBoundaries,
  validateAreaIndicators,
  validateCouncilContext,
  validateUkProduction,
} from "./validate";

/** Councils with a published deep profile: those whose small-area files are in the data index. */
export function deepCouncils(manifest: DataManifest | undefined): Set<string> {
  const out = new Set<string>();
  for (const d of manifest?.datasets ?? []) {
    const m = /^areas\.([a-z]\d{8})\.indicators$/.exec(d.id);
    if (m) out.add(m[1]!.toUpperCase());
  }
  return out;
}

/** Deep profile cache: one join (and distance computation) per loaded dataset pair and store set. */
const deepCache = new WeakMap<object, { stores: object; value: DeepProfile }>();

/**
 * A deep profile's small areas (LP-04, LP-10), loaded only for that council (ADR-0023: one folder
 * per council), joined to the stores. `lad` null or without a deep profile: nothing is loaded.
 */
export function useDeepProfile(lad: string | null, enabled = true) {
  const manifest = useManifest();
  const deep = lad !== null && deepCouncils(manifest.data).has(lad);
  const ids = lad ? areaDatasetIds(lad) : null;
  const indicators = useValidatedDataset(enabled && deep ? ids!.indicators : null, validateAreaIndicators);
  const boundaries = useValidatedDataset(enabled && deep ? ids!.boundaries : null, validateAreaBoundaries);
  const a = useAccess();
  const value = useMemo(() => {
    if (!indicators.data || !boundaries.data || !a.stores) return null;
    const hit = deepCache.get(indicators.data);
    if (hit && hit.stores === a.stores) return hit.value;
    const v = deepProfile(indicators.data, boundaries.data, a.stores);
    deepCache.set(indicators.data, { stores: a.stores, value: v });
    return v;
  }, [indicators.data, boundaries.data, a.stores]);
  const error = indicators.error ?? boundaries.error ?? null;
  return {
    available: deep,
    status: !deep
      ? ("none" as const)
      : error
        ? ("error" as const)
        : value
          ? ("ready" as const)
          : ("loading" as const),
    error,
    deep: value,
    sources: {
      indicators: ids ? findDataset(manifest.data, ids.indicators) : undefined,
      boundaries: ids ? findDataset(manifest.data, ids.boundaries) : undefined,
    },
  };
}

export interface NationalRow {
  basket: string;
  label: string;
  imports: NationalImports | null;
  production: UkProduction["commodities"][number] | null;
}

/** National context (LP-05): the latest 12 months of recorded imports per basket, and Defra's UK production. */

/** Combines the per-basket snapshot queries; module-level so TanStack Query keeps the result stable. */
function combineSnapshots(results: { data?: TradeSnapshot; error: Error | null }[]) {
  return {
    data: results.map((r) => r.data),
    ready: results.length > 0 && results.every((r) => r.data !== undefined),
    error: results.find((r) => r.error)?.error ?? null,
  };
}

/** National context (LP-05): the latest 12 months of recorded imports per basket, and Defra's UK production. */
export function useNationalContext() {
  const manifest = useManifest();
  const index = useTradeIndex();
  const production = useValidatedDataset(CONTEXT_PRODUCTION_DATASET_ID, validateUkProduction);
  const baskets = useMemo(() => index.data?.commodities ?? [], [index.data]);
  const snapshots = useQueries({
    queries: baskets.map((b) => ({
      ...validatedDatasetQuery(manifest.data, b.datasetId, validateTradeSnapshot),
      enabled: manifest.isSuccess,
    })),
    combine: combineSnapshots,
  });
  const rows = useMemo<NationalRow[] | null>(() => {
    if (!snapshots.ready || !production.data) return null;
    return baskets.map((b, i) => ({
      basket: b.id,
      label: b.label,
      imports: nationalImports(snapshots.data[i]!, b.months.provisionalFrom),
      production: production.data!.commodities.find((c) => c.basket === b.id) ?? null,
    }));
  }, [snapshots, production.data, baskets]);
  const error = index.error ?? production.error ?? snapshots.error ?? null;
  return {
    status: error ? ("error" as const) : rows ? ("ready" as const) : ("loading" as const),
    error,
    rows,
    tradeSnapshot: familySnapshot(manifest.data, "trade"),
    productionDataset: findDataset(manifest.data, CONTEXT_PRODUCTION_DATASET_ID),
  };
}

/** Provision of one council for the profile (supermarkets and all grocery stores). */
function councilRates(rows: readonly Provision[] | null, code: string | null): Provision | null {
  if (!rows || !code) return null;
  return rows.find((r) => r.code === code) ?? null;
}

/**
 * Everything the profile shows for the selected council (LP-01 – LP-06): the council list and
 * context, the retail network from the GEOLYTIX stores (the Stage 4 data and layer), rates with
 * nation and UK comparators, and the deep profile when one is published. Panels, cards and the
 * map share one computation (TanStack Query caches the loads; derived values are memoised).
 */
export function useProfile() {
  const lad = useAppStore((s) => s.lad);
  const compare = useAppStore((s) => s.compare);
  const areaMeasure = useAppStore((s) => s.areaMeasure);
  const area = useAppStore((s) => s.area);
  const highlight = useAppStore((s) => s.areaHighlight);
  const storeLayers = useAppStore((s) => s.storeLayers);
  const retailers = useAppStore((s) => s.retailers);

  const manifest = useManifest();
  const a = useAccess();
  const contextQuery = useValidatedDataset(CONTEXT_COUNCILS_DATASET_ID, validateCouncilContext);
  const deepCodes = useMemo(() => deepCouncils(manifest.data), [manifest.data]);

  const councils = useMemo<CouncilRow[] | null>(
    () => (a.doc ? councilRows(a.doc, contextQuery.data ?? null, deepCodes) : null),
    [a.doc, contextQuery.data, deepCodes],
  );
  const council = useMemo(() => councils?.find((c) => c.code === lad) ?? null, [councils, lad]);
  const network = useMemo(
    () => (a.stores && council ? councilNetwork(a.stores, council.code) : null),
    [a.stores, council],
  );
  const supermarkets = useMemo(() => (a.doc ? councilProvision(a.doc, "supermarkets") : null), [a.doc]);
  const allStores = useMemo(() => (a.doc ? councilProvision(a.doc, "all") : null), [a.doc]);
  const totals = useMemo(
    () => (a.doc ? { supermarkets: areaTotals(a.doc, "supermarkets"), all: areaTotals(a.doc, "all") } : null),
    [a.doc],
  );
  const councilStores = useMemo(
    () => (a.stores && council ? a.stores.filter((s) => s.lad === council.code) : null),
    [a.stores, council],
  );

  const deep = useDeepProfile(council?.deep ? council.code : null);

  const map = useMemo(
    () =>
      a.map
        ? {
            ...profileCouncilMap(a.map, council?.code ?? null, council?.bbox ?? null, compare),
            storeWhere: filterWhereClause({ layers: storeLayers, retailers }),
          }
        : null,
    [a.map, council, compare, storeLayers, retailers],
  );
  const areaMap = useMemo(
    () =>
      deep.deep && deep.sources.boundaries
        ? profileAreaMap(
            deep.deep,
            areaMeasure,
            area,
            highlight?.codes ?? [],
            deep.sources.boundaries.attribution,
          )
        : null,
    [deep.deep, deep.sources.boundaries, areaMeasure, area, highlight],
  );

  const error = a.error ?? contextQuery.error ?? null;
  const ready = Boolean(councils && a.stores && map && contextQuery.data);
  return {
    status: error ? ("error" as const) : ready ? ("ready" as const) : ("loading" as const),
    error,
    access: a,
    councils,
    council,
    context: contextQuery.data ?? null,
    network,
    councilStores,
    rates: {
      supermarkets: councilRates(supermarkets, council?.code ?? null),
      all: councilRates(allStores, council?.code ?? null),
    },
    totals,
    deep,
    map,
    areaMap,
    sources: {
      context: findDataset(manifest.data, CONTEXT_COUNCILS_DATASET_ID),
      contextSnapshot: familySnapshot(manifest.data, "context"),
      localSnapshot: familySnapshot(manifest.data, "local"),
      areasSnapshot: familySnapshot(manifest.data, "areas"),
    },
  };
}

export type ProfileData = ReturnType<typeof useProfile>;

/** Publishes the profile's map models to the store for the layer controller (ADR-03: store → map). */
export function useProfileMapSync(p: ProfileData): void {
  const setAccessMap = useAppStore((s) => s.setAccessMap);
  const setProfileMap = useAppStore((s) => s.setProfileMap);
  useEffect(() => {
    setAccessMap(p.map);
  }, [p.map, setAccessMap]);
  useEffect(() => {
    setProfileMap(p.areaMap);
  }, [p.areaMap, setProfileMap]);
  useEffect(
    () => () => {
      setAccessMap(null);
      setProfileMap(null);
    },
    [setAccessMap, setProfileMap],
  );
}
