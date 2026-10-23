import { useEffect, useMemo } from "react";
import {
  resolveCommodity,
  useCountryPoints,
  useTradeIndex,
  useTradeSnapshotQuery,
  useUkAnchor,
} from "@/features/origins/useOrigins";
import { useAppStore } from "@/state/store";
import type { TradeIndex } from "@/types/generated/trade-index";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import { buildSeasonalModel, type SeasonalModel } from "./model";

export interface SeasonalData {
  status: "loading" | "error" | "ready";
  error: Error | null;
  index: TradeIndex | undefined;
  model: SeasonalModel | null;
  unknownCommodity: boolean;
  snapshot: TradeSnapshot | undefined;
}

/**
 * Loads the same trade index, basket and country points as Food Origins (TanStack Query shares
 * the cache) and builds the Seasonal model from the store's selection. Every Seasonal panel calls
 * this; the model is memoised so the timeline, cards, charts and map share one computation.
 */
export function useSeasonal(): SeasonalData {
  const commodity = useAppStore((s) => s.commodity);
  const year = useAppStore((s) => s.year);
  const month = useAppStore((s) => s.month);
  const compareYear = useAppStore((s) => s.compareYear);
  const compareMonth = useAppStore((s) => s.compareMonth);
  const measure = useAppStore((s) => s.measure);
  const partner = useAppStore((s) => s.partner);
  const flowCount = useAppStore((s) => s.flowCount);
  const heatmap = useAppStore((s) => s.heatmap);

  const index = useTradeIndex();
  const entry = resolveCommodity(index.data, commodity);
  const snapshot = useTradeSnapshotQuery(entry?.datasetId ?? null);
  const points = useCountryPoints();
  const ukAnchor = useUkAnchor(points.data);

  const model = useMemo(
    () =>
      snapshot.data && ukAnchor
        ? buildSeasonalModel(
            snapshot.data,
            { year, month, compareYear, compareMonth, measure, partner, flowCount, heatmap },
            ukAnchor,
          )
        : null,
    [snapshot.data, ukAnchor, year, month, compareYear, compareMonth, measure, partner, flowCount, heatmap],
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

/** Publishes the selected month's map model for the layer controllers (ADR-03: store → map). */
export function useSeasonalMapSync(model: SeasonalModel | null): void {
  const setOriginsMap = useAppStore((s) => s.setOriginsMap);
  const map = model?.map ?? null;
  useEffect(() => {
    setOriginsMap(map);
  }, [map, setOriginsMap]);
}
