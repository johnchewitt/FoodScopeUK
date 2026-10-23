import { useEffect, useMemo } from "react";
import { REFERENCE_POINTS_DATASET_ID } from "@/map/layerIds";
import { useValidatedDataset } from "@/services/data/useDataset";
import { validateCountryPoints, validateTradeIndex, validateTradeSnapshot } from "@/services/data/validate";
import { useAppStore } from "@/state/store";
import type { TradeIndex } from "@/types/generated/trade-index";
import { buildOriginsModel, type OriginsModel } from "./model";

export const TRADE_INDEX_ID = "trade.index";

export function useTradeIndex() {
  return useValidatedDataset(TRADE_INDEX_ID, validateTradeIndex);
}

export function useCountryPoints() {
  return useValidatedDataset(REFERENCE_POINTS_DATASET_ID, validateCountryPoints);
}

/** The basket for the URL's commodity id, falling back to the first basket if it is unknown. */
export function resolveCommodity(index: TradeIndex | undefined, id: string) {
  if (!index) return undefined;
  return index.commodities.find((c) => c.id === id) ?? index.commodities[0];
}

export interface OriginsData {
  status: "loading" | "error" | "ready";
  error: Error | null;
  index: TradeIndex | undefined;
  model: OriginsModel | null;
  /** The commodity in the URL is not in the snapshot (fell back to the first basket). */
  unknownCommodity: boolean;
  snapshot: ReturnType<typeof useTradeSnapshotQuery>["data"];
}

/** One commodity basket's trade snapshot, validated against its schema (shared with Seasonal Supply). */
export function useTradeSnapshotQuery(datasetId: string | null) {
  return useValidatedDataset(datasetId, validateTradeSnapshot);
}

/**
 * Loads the trade index, the selected basket and the country points, and builds the view model
 * from the store's selection. Every Origins panel calls this; TanStack Query caches the loads and
 * the model is memoised, so the map, cards, charts and table share one computation.
 */
export function useOrigins(): OriginsData {
  const commodity = useAppStore((s) => s.commodity);
  const period = useAppStore((s) => s.period);
  const year = useAppStore((s) => s.year);
  const month = useAppStore((s) => s.month);
  const measure = useAppStore((s) => s.measure);
  const partner = useAppStore((s) => s.partner);
  const flowCount = useAppStore((s) => s.flowCount);

  const index = useTradeIndex();
  const entry = resolveCommodity(index.data, commodity);
  const snapshot = useTradeSnapshotQuery(entry?.datasetId ?? null);
  const points = useCountryPoints();

  const ukAnchor = useUkAnchor(points.data);

  const model = useMemo(
    () =>
      snapshot.data && ukAnchor
        ? buildOriginsModel(snapshot.data, { period, year, month, measure, partner, flowCount }, ukAnchor)
        : null,
    [snapshot.data, ukAnchor, period, year, month, measure, partner, flowCount],
  );

  const error = index.error ?? snapshot.error ?? points.error ?? null;
  return {
    status: error ? "error" : model ? "ready" : "loading",
    error,
    index: index.data,
    model,
    unknownCommodity: Boolean(index.data && entry && entry.id !== commodity),
    snapshot: snapshot.data,
  };
}

/** The symbolic UK point for connections: Natural Earth's label point for the United Kingdom (not a port). */
export function useUkAnchor(points: ReturnType<typeof useCountryPoints>["data"]): [number, number] | null {
  return useMemo<[number, number] | null>(() => {
    const gb = points?.points.find((p) => p.iso_a2 === "GB");
    return gb ? [gb.lon, gb.lat] : null;
  }, [points]);
}

/** Publishes the map view model to the store for the layer controllers (ADR-03: store → map). */
export function useOriginsMapSync(model: OriginsModel | null): void {
  const setOriginsMap = useAppStore((s) => s.setOriginsMap);
  useEffect(() => {
    setOriginsMap(model ? model.map : null);
  }, [model, setOriginsMap]);
}
