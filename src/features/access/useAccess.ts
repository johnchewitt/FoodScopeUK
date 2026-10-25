import { useEffect, useMemo } from "react";
import {
  councilProvision,
  filterWhereClause,
  PROVISION,
  type ProvisionMeasure,
  type StoreLayer,
} from "@/analysis/retail";
import {
  LOCAL_BOUNDARIES_DATASET_ID,
  LOCAL_INDICATORS_DATASET_ID,
  LOCAL_STORES_DATASET_ID,
  REGISTER_GROCERS_DATASET_ID,
} from "@/map/layerIds";
import { adapterFor } from "@/services/data/featureLayerAdapter";
import { datasetUrl, familySnapshot, findDataset, useAppConfig, useManifest } from "@/services/data/queries";
import { useValidatedDataset } from "@/services/data/useDataset";
import { useAppStore, type AccessMapModel } from "@/state/store";
import type { Dataset } from "@/types/generated/manifest";
import {
  accessPoint,
  areaTotals,
  grocerPoints,
  choroplethFor,
  councilDetail,
  indexStores,
  layerCounts,
  proximityView,
  shownStores,
  storesFrame,
  storesGeoJson,
  STORE_FIELDS,
  type AccessStore,
} from "./model";
import { validateLadIndicators, validateNiGrocers, validateStores } from "./validate";

/**
 * Every panel, card and the map call useAccess; these module-level caches make them share one
 * computation per input (the store index projects 19,183 points; proximity measures them all).
 */
const indexCache = new WeakMap<object, AccessStore[]>();
const countsCache = new WeakMap<object, ReturnType<typeof layerCounts>>();
let shownCache: { stores: AccessStore[]; key: string; value: AccessStore[] } | null = null;
let nearbyCache: { shown: AccessStore[]; key: string; value: ReturnType<typeof proximityView> } | null = null;

function cached<K extends object, V>(cache: WeakMap<K, V>, key: K, make: () => V): V {
  let v = cache.get(key);
  if (v === undefined) {
    v = make();
    cache.set(key, v);
  }
  return v;
}

function shownFor(stores: AccessStore[], layers: readonly StoreLayer[], retailers: readonly string[] | null) {
  const key = JSON.stringify([layers, retailers]);
  if (shownCache?.stores !== stores || shownCache.key !== key)
    shownCache = {
      stores,
      key,
      value: shownStores(stores, { layers, retailers }),
    };
  return shownCache.value;
}

function nearbyFor(shown: AccessStore[], point: [number, number] | null, n: number, km: number) {
  const key = JSON.stringify([point, n, km]);
  if (nearbyCache?.shown !== shown || nearbyCache.key !== key)
    nearbyCache = { shown, key, value: proximityView(shown, point, n, km) };
  return nearbyCache.value;
}

/** Blob URLs for the map's compact store file, one per loaded dataset (the data is cached for the session). */
const blobUrls = new WeakMap<object, string>();

function blobUrlFor(key: object, stores: readonly AccessStore[]): string {
  let url = blobUrls.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([storesGeoJson(stores)], { type: "application/geo+json" }));
    blobUrls.set(key, url);
  }
  return url;
}

export interface AccessSources {
  stores: Dataset | undefined;
  indicators: Dataset | undefined;
  boundaries: Dataset | undefined;
  /** NI grocers from the FSA register (S29), when listed. */
  grocers: Dataset | undefined;
  snapshot: string | null;
  /** "static-snapshot" or "arcgis-feature-layer" (SM-01). */
  storesFrom: string;
}

/**
 * Loads the stores (static snapshot, or the hosted layer named in config.json), the council
 * indicators and the boundary URL, and builds everything UK Food Access shows from the store's
 * selection. TanStack Query caches the loads and the derived values are memoised, so panels,
 * cards and the map share one computation.
 */
export function useAccess() {
  const storeLayers = useAppStore((s) => s.storeLayers);
  const retailers = useAppStore((s) => s.retailers);
  const councilLayer = useAppStore((s) => s.councilLayer);
  const lad = useAppStore((s) => s.lad);
  const selectedId = useAppStore((s) => s.store);
  const proximityPoint = useAppStore((s) => s.proximityPoint);
  const proximityCount = useAppStore((s) => s.proximityCount);
  const proximityRadiusKm = useAppStore((s) => s.proximityRadiusKm);
  const niGrocers = useAppStore((s) => s.niGrocers);

  const manifest = useManifest();
  const config = useAppConfig();
  const configSettled = config.isSuccess || config.isError;
  const adapter = useMemo(
    () => adapterFor(config.data, LOCAL_STORES_DATASET_ID, STORE_FIELDS),
    [config.data],
  );
  const storesQuery = useValidatedDataset(
    configSettled ? LOCAL_STORES_DATASET_ID : null,
    validateStores,
    adapter,
  );
  const indicatorsQuery = useValidatedDataset(LOCAL_INDICATORS_DATASET_ID, validateLadIndicators);
  // The FSA register layer (S29) is loaded only when it is switched on.
  const grocersQuery = useValidatedDataset(niGrocers ? REGISTER_GROCERS_DATASET_ID : null, validateNiGrocers);

  const sources: AccessSources = {
    stores: findDataset(manifest.data, LOCAL_STORES_DATASET_ID),
    indicators: findDataset(manifest.data, LOCAL_INDICATORS_DATASET_ID),
    boundaries: findDataset(manifest.data, LOCAL_BOUNDARIES_DATASET_ID),
    grocers: findDataset(manifest.data, REGISTER_GROCERS_DATASET_ID),
    snapshot: familySnapshot(manifest.data, "local"),
    storesFrom: adapter.kind,
  };

  const stores = useMemo(
    () =>
      storesQuery.data ? cached(indexCache, storesQuery.data, () => indexStores(storesQuery.data!)) : null,
    [storesQuery.data],
  );
  const frame = useMemo(() => (stores ? storesFrame(stores) : null), [stores]);
  const doc = indicatorsQuery.data ?? null;
  const filter = useMemo(() => ({ layers: storeLayers, retailers }), [storeLayers, retailers]);
  const shown = useMemo(
    () => (stores ? shownFor(stores, filter.layers, filter.retailers) : null),
    [stores, filter],
  );
  const counts = useMemo(
    () => (stores ? cached(countsCache, stores, () => layerCounts(stores)) : null),
    [stores],
  );
  const measure: ProvisionMeasure = councilLayer === "off" ? "supermarkets" : councilLayer;
  const provision = useMemo(() => (doc ? councilProvision(doc, measure) : null), [doc, measure]);
  const totals = useMemo(() => (doc ? areaTotals(doc, measure) : null), [doc, measure]);
  const council = useMemo(() => (doc ? councilDetail(doc, lad) : null), [doc, lad]);
  const selected = useMemo(
    () => (stores && selectedId !== null ? (stores.find((s) => s.id === selectedId) ?? null) : null),
    [stores, selectedId],
  );
  const nearby = useMemo(
    () => (shown ? nearbyFor(shown, proximityPoint, proximityCount, proximityRadiusKm) : null),
    [shown, proximityPoint, proximityCount, proximityRadiusKm],
  );
  const grocers = useMemo(
    () =>
      niGrocers && grocersQuery.data && sources.grocers
        ? { points: grocerPoints(grocersQuery.data), copyright: sources.grocers.attribution }
        : null,
    [niGrocers, grocersQuery.data, sources.grocers],
  );

  const map = useMemo<AccessMapModel | null>(() => {
    if (!stores || !storesQuery.data || !provision || !sources.boundaries || !sources.stores) return null;
    return {
      mode: "access",
      compareCouncils: [],
      grocers,
      storesUrl: blobUrlFor(storesQuery.data, stores),
      storeWhere: filterWhereClause(filter),
      storesCopyright: sources.stores.attribution,
      frame,
      councilsUrl: datasetUrl(sources.boundaries),
      councilsCopyright: sources.boundaries.attribution,
      choropleth: councilLayer === "off" ? null : choroplethFor(provision, measure),
      selectedStore: selected ? accessPoint(selected) : null,
      selectedCouncil: council ? council.code : null,
      proximity: nearby
        ? {
            point: nearby.point,
            radiusM: nearby.radiusM,
            ring: nearby.ring,
            nearest: nearby.nearest.map((n) => accessPoint(n.store)),
          }
        : null,
    };
  }, [
    stores,
    storesQuery.data,
    frame,
    provision,
    sources.boundaries,
    sources.stores,
    filter,
    councilLayer,
    measure,
    selected,
    council,
    nearby,
    grocers,
  ]);

  const error = storesQuery.error ?? indicatorsQuery.error ?? (manifest.isError ? manifest.error : null);
  const ready = Boolean(stores && doc && map);
  return {
    status: error ? ("error" as const) : ready ? ("ready" as const) : ("loading" as const),
    error,
    sources,
    stores,
    doc,
    shown,
    counts,
    measure,
    measureDef: PROVISION[measure],
    councilLayer,
    provision,
    totals,
    council,
    selected,
    nearby,
    map,
    grocers,
    grocersDoc: grocersQuery.data ?? null,
    grocersStatus: !niGrocers
      ? ("off" as const)
      : grocersQuery.isError
        ? ("error" as const)
        : grocersQuery.data
          ? ("ready" as const)
          : ("loading" as const),
  };
}

export type AccessData = ReturnType<typeof useAccess>;

/** Publishes the map view model to the store for the layer controller (ADR-03: store → map). */
export function useAccessMapSync(map: AccessMapModel | null): void {
  const setAccessMap = useAppStore((s) => s.setAccessMap);
  useEffect(() => {
    setAccessMap(map);
  }, [map, setAccessMap]);
  useEffect(() => () => setAccessMap(null), [setAccessMap]);
}
