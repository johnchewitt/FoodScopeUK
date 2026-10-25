import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { FarmMeasure } from "@/analysis/risk";
import {
  resolveCommodity,
  useCountryPoints,
  useTradeIndex,
  useUkAnchor,
} from "@/features/origins/useOrigins";
import {
  CONTEXT_COUNCILS_DATASET_ID,
  CONTEXT_PRODUCTION_DATASET_ID,
  LOCAL_BOUNDARIES_DATASET_ID,
  RISK_DATASET_IDS,
} from "@/map/layerIds";
import { datasetUrl, familySnapshot, findDataset, useManifest } from "@/services/data/queries";
import { useValidatedDataset, validatedDatasetQuery } from "@/services/data/useDataset";
import { validateTradeSnapshot } from "@/services/data/validate";
import { useAppStore, type AccessMapModel } from "@/state/store";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import {
  buildAccessRiskModel,
  buildLogisticsModel,
  buildSupplyModel,
  UK_FULL_EXTENT,
  type AccessRiskModel,
  type LogisticsModel,
  type SupplyModel,
} from "./model";
import {
  validateCouncilContext,
  validateCouncilPpfi,
  validateFarming,
  validatePortEntry,
  validatePorts,
  validateUkProduction,
  validateWaterStress,
} from "./validate";

/** Combines the per-basket snapshot queries; module-level so TanStack Query keeps the result stable. */
function combineSnapshots(results: { data?: TradeSnapshot; error: Error | null }[]) {
  return {
    data: results.map((r) => r.data),
    ready: results.length > 0 && results.every((r) => r.data !== undefined),
    error: results.find((r) => r.error)?.error ?? null,
  };
}

/**
 * International supply exposure (RK-02): the selected basket's model (shares, concentration,
 * exposure, water stress) plus every basket over the same period for the ranking and the matrix.
 * Shares the Food Origins selection (commodity, period, measure, partner) and its cached loads.
 */
export function useRiskSupply() {
  const commodity = useAppStore((s) => s.commodity);
  const period = useAppStore((s) => s.period);
  const year = useAppStore((s) => s.year);
  const month = useAppStore((s) => s.month);
  const measure = useAppStore((s) => s.measure);
  const partner = useAppStore((s) => s.partner);
  const flowCount = useAppStore((s) => s.flowCount);
  const fill = useAppStore((s) => s.riskFill);

  const manifest = useManifest();
  const index = useTradeIndex();
  const points = useCountryPoints();
  const ukAnchor = useUkAnchor(points.data);
  const water = useValidatedDataset(RISK_DATASET_IDS.waterStress, validateWaterStress);
  const production = useValidatedDataset(CONTEXT_PRODUCTION_DATASET_ID, validateUkProduction);
  const baskets = useMemo(() => index.data?.commodities ?? [], [index.data]);
  const snapshots = useQueries({
    queries: baskets.map((b) => ({
      ...validatedDatasetQuery(manifest.data, b.datasetId, validateTradeSnapshot),
      enabled: manifest.isSuccess,
    })),
    combine: combineSnapshots,
  });
  const entry = resolveCommodity(index.data, commodity);
  const snapshot = entry ? snapshots.data[baskets.findIndex((b) => b.id === entry.id)] : undefined;

  const model = useMemo<SupplyModel | null>(() => {
    if (!snapshot || !water.data || !ukAnchor || !snapshots.ready) return null;
    return buildSupplyModel(
      snapshot,
      baskets.map((b, i) => ({ id: b.id, label: b.label, snapshot: snapshots.data[i] })),
      water.data,
      { period, year, month, measure, partner, flowCount },
      fill,
      ukAnchor,
    );
  }, [
    snapshot,
    water.data,
    ukAnchor,
    snapshots,
    baskets,
    period,
    year,
    month,
    measure,
    partner,
    flowCount,
    fill,
  ]);

  const error = index.error ?? snapshots.error ?? water.error ?? points.error ?? null;
  return {
    status: error ? ("error" as const) : model ? ("ready" as const) : ("loading" as const),
    error,
    index: index.data,
    unknownCommodity: Boolean(index.data && entry && entry.id !== commodity),
    model,
    production: production.data?.commodities.find((c) => c.basket === entry?.id) ?? null,
    productionError: production.error,
    tradeSnapshot: familySnapshot(manifest.data, "trade"),
    waterDataset: findDataset(manifest.data, RISK_DATASET_IDS.waterStress),
    productionDataset: findDataset(manifest.data, CONTEXT_PRODUCTION_DATASET_ID),
  };
}

/** Logistics and infrastructure (RK-03): ports, port-of-entry evidence, road corridors, farming regions. */
export function useRiskLogistics() {
  const measure = useAppStore((s) => s.portMeasure);
  const port = useAppStore((s) => s.port);
  const roads = useAppStore((s) => s.roads);
  const rail = useAppStore((s) => s.rail);
  const farmLayer = useAppStore((s) => s.farmLayer);
  const manifest = useManifest();
  const ports = useValidatedDataset(RISK_DATASET_IDS.ports, validatePorts);
  const entry = useValidatedDataset(RISK_DATASET_IDS.portEntry, validatePortEntry);
  const farming = useValidatedDataset(RISK_DATASET_IDS.farming, validateFarming);
  const roadsDs = findDataset(manifest.data, RISK_DATASET_IDS.roads);
  const railDs = findDataset(manifest.data, RISK_DATASET_IDS.rail);
  const regionsDs = findDataset(manifest.data, RISK_DATASET_IDS.farmingRegions);
  const portsDs = findDataset(manifest.data, RISK_DATASET_IDS.ports);
  const farm = farmLayer === "off" ? null : (farmLayer as FarmMeasure);

  const model = useMemo<LogisticsModel | null>(() => {
    if (!ports.data || !entry.data || !portsDs) return null;
    return buildLogisticsModel(
      ports.data,
      entry.data,
      farming.data ?? null,
      { measure, port, roads, rail, farm },
      {
        roads: roadsDs ? { url: datasetUrl(roadsDs), copyright: roadsDs.attribution } : null,
        rail: railDs ? { url: datasetUrl(railDs), copyright: railDs.attribution } : null,
        regions: regionsDs ? { url: datasetUrl(regionsDs), copyright: regionsDs.attribution } : null,
        portsCopyright: portsDs.attribution,
      },
    );
  }, [
    ports.data,
    entry.data,
    farming.data,
    measure,
    port,
    roads,
    rail,
    farm,
    roadsDs,
    railDs,
    regionsDs,
    portsDs,
  ]);

  const error = ports.error ?? entry.error ?? (manifest.isError ? manifest.error : null);
  return {
    status: error ? ("error" as const) : model ? ("ready" as const) : ("loading" as const),
    error,
    farmingError: farming.error,
    model,
    sources: {
      ports: portsDs,
      entry: findDataset(manifest.data, RISK_DATASET_IDS.portEntry),
      roads: roadsDs,
      rail: railDs,
      farming: findDataset(manifest.data, RISK_DATASET_IDS.farming),
      regions: regionsDs,
    },
  };
}

/**
 * Community food access (RK-04): the Priority Places index by council, ranked within each nation,
 * with urban/rural context. The map draws the council boundaries in the Access layers' risk mode;
 * it needs only the boundaries from the manifest, never the stores file (no stores are drawn).
 */
export function useRiskAccess() {
  const measure = useAppStore((s) => s.ppfiMeasure);
  const lad = useAppStore((s) => s.lad);
  const rankNation = useAppStore((s) => s.rankNation);
  const manifest = useManifest();
  const doc = useValidatedDataset(RISK_DATASET_IDS.councilPpfi, validateCouncilPpfi);
  const context = useValidatedDataset(CONTEXT_COUNCILS_DATASET_ID, validateCouncilContext);
  const boundaries = findDataset(manifest.data, LOCAL_BOUNDARIES_DATASET_ID);

  const model = useMemo<AccessRiskModel | null>(
    () =>
      doc.data ? buildAccessRiskModel(doc.data, context.data ?? null, { measure, lad, rankNation }) : null,
    [doc.data, context.data, measure, lad, rankNation],
  );
  const map = useMemo<AccessMapModel | null>(
    () =>
      boundaries && model
        ? {
            mode: "risk",
            compareCouncils: [],
            grocers: null,
            storesUrl: "",
            storeWhere: "1=0",
            storesCopyright: "",
            frame: { key: "risk-access", bbox: UK_FULL_EXTENT },
            councilsUrl: datasetUrl(boundaries),
            councilsCopyright: boundaries.attribution,
            choropleth: model.choropleth,
            selectedStore: null,
            selectedCouncil: model.selected?.code ?? null,
            proximity: null,
          }
        : null,
    [boundaries, model],
  );
  const missingBoundaries = manifest.isSuccess && !boundaries;
  const error = doc.error ?? (manifest.isError ? manifest.error : null);
  return {
    status: error ? ("error" as const) : model ? ("ready" as const) : ("loading" as const),
    error,
    model,
    map,
    /** The council map cannot be drawn (boundaries missing from the manifest); the panels still work. */
    mapError: missingBoundaries,
    contextError: context.error,
    sources: {
      ppfi: findDataset(manifest.data, RISK_DATASET_IDS.councilPpfi),
      context: findDataset(manifest.data, CONTEXT_COUNCILS_DATASET_ID),
    },
  };
}

/** Publishes the supply view's trade map (ADR-03: store → map); the map layer is shared with Food Origins. */
export function useRiskSupplyMapSync(model: SupplyModel | null): void {
  const setOriginsMap = useAppStore((s) => s.setOriginsMap);
  useEffect(() => {
    setOriginsMap(model ? model.map : null);
  }, [model, setOriginsMap]);
}

export function useRiskLogisticsMapSync(model: LogisticsModel | null): void {
  const setRiskMap = useAppStore((s) => s.setRiskMap);
  useEffect(() => {
    setRiskMap(model ? model.map : null);
  }, [model, setRiskMap]);
  useEffect(() => () => setRiskMap(null), [setRiskMap]);
}

export function useRiskAccessMapSync(map: AccessMapModel | null): void {
  const setAccessMap = useAppStore((s) => s.setAccessMap);
  useEffect(() => {
    setAccessMap(map);
  }, [map, setAccessMap]);
  useEffect(() => () => setAccessMap(null), [setAccessMap]);
}
