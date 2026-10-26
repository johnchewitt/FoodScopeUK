import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { validateLadIndicators } from "@/features/access/validate";
import {
  resolveCommodity,
  useCountryPoints,
  useTradeIndex,
  useTradeSnapshotQuery,
  useUkAnchor,
} from "@/features/origins/useOrigins";
import { validatePortEntry, validatePorts, validateUkProduction } from "@/features/risks/validate";
import {
  CONTEXT_PRODUCTION_DATASET_ID,
  LOCAL_BOUNDARIES_DATASET_ID,
  LOCAL_INDICATORS_DATASET_ID,
  RISK_DATASET_IDS,
  SCENARIO_DATASET_IDS,
} from "@/map/layerIds";
import { datasetUrl, findDataset, useManifest } from "@/services/data/queries";
import { useValidatedDataset, validatedDatasetQuery } from "@/services/data/useDataset";
import { validateTradeSnapshot as validateTradeSnapshotLazy } from "@/services/data/validate";
import type {
  ImportScenario,
  PortScenario,
  ProductionScenario,
  ScenarioParams,
} from "@/state/scenarioParams";
import { useAppStore, type AccessMapModel } from "@/state/store";
import type { ScenarioClosure } from "@/types/generated/scenario-closure";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import {
  buildClosureModel,
  buildImportModel,
  buildPortModel,
  buildProductionModel,
  CLOSURE_UK_FRAME,
  findStore,
  mergeAttributions,
  storeOptions,
  type ClosureModel,
  type ClosureParts,
  type CouncilInfo,
  type ImportModel,
  type PortModel,
  type ProductionModel,
} from "./model";
import { validateClosure } from "./validate";

/** The current scenario's parameters, from the store's URL fields (one selector per field). */
export function useScenarioParams(): ScenarioParams {
  const kind = useAppStore((s) => s.scenarioKind);
  const commodity = useAppStore((s) => s.commodity);
  const partner = useAppStore((s) => s.partner);
  const measure = useAppStore((s) => s.measure);
  const store = useAppStore((s) => s.store);
  const port = useAppStore((s) => s.port);
  const year = useAppStore((s) => s.scenarioYear);
  const month = useAppStore((s) => s.scenarioMonth);
  const reduction = useAppStore((s) => s.scenarioReduction);
  const duration = useAppStore((s) => s.scenarioDuration);
  const recovery = useAppStore((s) => s.scenarioRecovery);
  const substitution = useAppStore((s) => s.scenarioSubstitution);
  const productionReduction = useAppStore((s) => s.productionReduction);
  const portReduction = useAppStore((s) => s.portReduction);
  const portMonths = useAppStore((s) => s.portMonths);
  return useMemo<ScenarioParams>(() => {
    switch (kind) {
      case "import":
        return {
          kind,
          commodity,
          partner,
          year,
          month,
          reduction,
          duration,
          recovery,
          substitution,
          measure,
        };
      case "closure":
        return { kind, store };
      case "production":
        return { kind, commodity, reduction: productionReduction };
      case "port":
        return { kind, port, reduction: portReduction, months: portMonths };
    }
  }, [
    kind,
    commodity,
    partner,
    measure,
    store,
    port,
    year,
    month,
    reduction,
    duration,
    recovery,
    substitution,
    productionReduction,
    portReduction,
    portMonths,
  ]);
}

type Status = "loading" | "error" | "ready";

// ---------------------------------------------------------------------------------------------
// A — international supply disruption

export function useImportScenario(params: ImportScenario | null) {
  const flowCount = useAppStore((s) => s.flowCount);
  const view = useAppStore((s) => s.scenarioView);
  const manifest = useManifest();
  const index = useTradeIndex();
  const entry = params ? resolveCommodity(index.data, params.commodity) : undefined;
  const snapshot = useTradeSnapshotQuery(entry?.datasetId ?? null);
  const points = useCountryPoints();
  const ukAnchor = useUkAnchor(points.data);
  const model = useMemo<ImportModel | null>(
    () =>
      params && snapshot.data && ukAnchor && entry
        ? buildImportModel(snapshot.data, entry.label, params, ukAnchor, flowCount, view)
        : null,
    [params, snapshot.data, ukAnchor, entry, flowCount, view],
  );
  const error = index.error ?? snapshot.error ?? points.error ?? null;
  return {
    status: (error ? "error" : model ? "ready" : "loading") as Status,
    error,
    index: index.data,
    unknownCommodity: Boolean(params && index.data && entry && entry.id !== params.commodity),
    model,
    dataset: entry ? findDataset(manifest.data, entry.datasetId) : undefined,
  };
}

// ---------------------------------------------------------------------------------------------
// B — supermarket closure

/** Combines the two closure files (Great Britain, Northern Ireland); module-level for a stable result. */
function combineParts(results: { data?: ScenarioClosure; error: Error | null; isFetching: boolean }[]) {
  const [gb, ni] = results;
  return {
    parts: gb?.data && ni?.data ? ({ gb: gb.data, ni: ni.data } as ClosureParts) : null,
    error: results.find((r) => r.error)?.error ?? null,
    loaded: results.filter((r) => r.data !== undefined).length,
  };
}

/**
 * Loads the closure inputs only when Scenario B is open (5.8 MB, 1.6 MB compressed: every small
 * area and supermarket of the UK with their three nearest, precomputed by the pipeline so a
 * closure is one pass over the areas, ~2 ms, with no spatial search in the browser).
 */
export function useClosureData(enabled: boolean) {
  const manifest = useManifest();
  const ids = [SCENARIO_DATASET_IDS.closureGb, SCENARIO_DATASET_IDS.closureNi];
  const parts = useQueries({
    queries: ids.map((id) => ({
      ...validatedDatasetQuery(manifest.data, id, validateClosure),
      enabled: enabled && manifest.isSuccess,
    })),
    combine: combineParts,
  });
  const councilsDoc = useValidatedDataset(
    enabled ? LOCAL_INDICATORS_DATASET_ID : null,
    validateLadIndicators,
  );
  const councils = useMemo(() => {
    const map = new Map<string, CouncilInfo>();
    for (const c of councilsDoc.data?.councils ?? [])
      map.set(c.code, { code: c.code, name: c.name, nation: c.nation });
    return map;
  }, [councilsDoc.data]);
  const options = useMemo(
    () => (parts.parts && councilsDoc.data ? storeOptions(parts.parts, councils) : []),
    [parts.parts, councils, councilsDoc.data],
  );
  return {
    parts: parts.parts,
    councils,
    options,
    loaded: parts.loaded,
    total: ids.length,
    error: parts.error ?? councilsDoc.error ?? (manifest.isError ? manifest.error : null),
    datasets: ids.map((id) => findDataset(manifest.data, id)),
    boundaries: findDataset(manifest.data, LOCAL_BOUNDARIES_DATASET_ID),
    storesDataset: findDataset(manifest.data, "local.stores"),
  };
}

export function useClosureScenario(enabled: boolean) {
  const store = useAppStore((s) => s.store);
  const view = useAppStore((s) => s.scenarioView);
  const data = useClosureData(enabled);
  const period = data.datasets[0]?.referencePeriod.split(";").pop()?.trim() ?? "GEOLYTIX v46 (June 2026)";
  const ref = useMemo(() => (data.parts ? findStore(data.parts, store) : null), [data.parts, store]);
  const model = useMemo<ClosureModel | null>(
    () =>
      data.parts && ref && data.councils.size > 0
        ? buildClosureModel(data.parts, ref, data.councils, view, period)
        : null,
    [data.parts, ref, data.councils, view, period],
  );
  const ready = Boolean(data.parts && data.councils.size > 0);
  return {
    status: (data.error ? "error" : ready ? "ready" : "loading") as Status,
    error: data.error,
    data,
    model,
    /** A store id is in the URL but is not one of the supermarkets (e.g. a convenience store). */
    notSupermarket: ready && store !== null && ref === null,
  };
}

/** Blob URLs for the closure map's compact supermarket file, one per loaded pair of files. */
const blobUrls = new WeakMap<object, string>();

function supermarketsUrl(parts: ClosureParts): string {
  let url = blobUrls.get(parts);
  if (!url) {
    const features = (["gb", "ni"] as const).flatMap((part) =>
      parts[part].stores.id.map((id, i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [parts[part].stores.lon[i], parts[part].stores.lat[i]] },
        properties: { id, layer: "supermarket", retailer: parts[part].stores.retailer[i] },
      })),
    );
    url = URL.createObjectURL(
      new Blob([JSON.stringify({ type: "FeatureCollection", features })], { type: "application/geo+json" }),
    );
    blobUrls.set(parts, url);
  }
  return url;
}

// ---------------------------------------------------------------------------------------------
// C — domestic production shock

export function useProductionScenario(params: ProductionScenario | null) {
  const manifest = useManifest();
  const index = useTradeIndex();
  const doc = useValidatedDataset(params ? CONTEXT_PRODUCTION_DATASET_ID : null, validateUkProduction);
  const entry = params ? resolveCommodity(index.data, params.commodity) : undefined;
  const model = useMemo<ProductionModel | null>(
    () =>
      params && doc.data && entry ? buildProductionModel(doc.data, entry.id, entry.label, params) : null,
    [params, doc.data, entry],
  );
  const error = doc.error ?? index.error ?? null;
  return {
    status: (error ? "error" : model ? "ready" : "loading") as Status,
    error,
    index: index.data,
    model,
    dataset: findDataset(manifest.data, CONTEXT_PRODUCTION_DATASET_ID),
  };
}

// ---------------------------------------------------------------------------------------------
// D — port disruption

export function usePortScenario(params: PortScenario | null) {
  const view = useAppStore((s) => s.scenarioView);
  const manifest = useManifest();
  const ports = useValidatedDataset(params ? RISK_DATASET_IDS.ports : null, validatePorts);
  const entry = useValidatedDataset(params ? RISK_DATASET_IDS.portEntry : null, validatePortEntry);
  const portsDs = findDataset(manifest.data, RISK_DATASET_IDS.ports);
  const model = useMemo<PortModel | null>(
    () =>
      params && ports.data && entry.data && portsDs
        ? buildPortModel(ports.data, entry.data, params, view, portsDs.attribution)
        : null,
    [params, ports.data, entry.data, portsDs, view],
  );
  const error = ports.error ?? entry.error ?? null;
  return {
    status: (error ? "error" : model ? "ready" : "loading") as Status,
    error,
    model,
    datasets: { ports: portsDs, entry: findDataset(manifest.data, RISK_DATASET_IDS.portEntry) },
  };
}

// ---------------------------------------------------------------------------------------------
// The active scenario (one hook per panel; TanStack Query and useMemo share the work)

export function useActiveScenario() {
  const params = useScenarioParams();
  const imp = useImportScenario(params.kind === "import" ? params : null);
  const closure = useClosureScenario(params.kind === "closure");
  const production = useProductionScenario(params.kind === "production" ? params : null);
  const port = usePortScenario(params.kind === "port" ? params : null);
  return { params, import: imp, closure, production, port };
}

// ---------------------------------------------------------------------------------------------
// Map sync (ADR-03: store → map)

/** Publishes the active scenario's map; clears what it published when the kind or module changes. */
export function useScenarioMapSync(): void {
  const { params, import: imp, closure, port } = useActiveScenario();
  const setOriginsMap = useAppStore((s) => s.setOriginsMap);
  const setScenarioMap = useAppStore((s) => s.setScenarioMap);
  const setAccessMap = useAppStore((s) => s.setAccessMap);
  const setRiskMap = useAppStore((s) => s.setRiskMap);

  const importMap = params.kind === "import" ? (imp.model?.map ?? null) : null;
  useEffect(() => {
    if (params.kind === "import") setOriginsMap(importMap);
  }, [params.kind, importMap, setOriginsMap]);

  const parts = closure.data.parts;
  const boundaries = closure.data.boundaries;
  // The scenario's supermarkets and areas are drawn from the closure inputs: credit them (not only
  // GEOLYTIX) on the map, including the Census, Scottish Government and NISRA sources.
  const closureCredit = useMemo(
    () => mergeAttributions(closure.data.datasets.map((d) => d?.attribution)),
    [closure.data.datasets],
  );
  const storesDs = closure.data.storesDataset;
  const closureModel = params.kind === "closure" ? closure.model : null;
  const access = useMemo<AccessMapModel | null>(() => {
    if (params.kind !== "closure" || !parts || !boundaries) return null;
    return {
      mode: "scenario",
      compareCouncils: [],
      grocers: null,
      storesUrl: supermarketsUrl(parts),
      storeWhere: "1=1",
      storesCopyright:
        closureCredit || storesDs?.attribution || "Contains GEOLYTIX Grocery Retail Points data",
      frame: null,
      councilsUrl: datasetUrl(boundaries),
      councilsCopyright: boundaries.attribution,
      choropleth: null,
      selectedStore: closureModel
        ? { id: closureModel.store.id, lon: closureModel.store.point[0], lat: closureModel.store.point[1] }
        : null,
      selectedCouncil: closureModel?.store.council.code ?? null,
      proximity: null,
    };
  }, [params.kind, parts, boundaries, storesDs, closureCredit, closureModel]);
  useEffect(() => {
    if (params.kind === "closure") {
      setAccessMap(access);
      setScenarioMap(closureModel ? closureModel.map : CLOSURE_UK_FRAME);
    }
  }, [params.kind, access, closureModel, setAccessMap, setScenarioMap]);

  const portMap = params.kind === "port" ? (port.model?.map ?? null) : null;
  useEffect(() => {
    if (params.kind === "port") setRiskMap(portMap);
  }, [params.kind, portMap, setRiskMap]);

  // Leaving a kind (or the module) clears the maps it published.
  useEffect(
    () => () => {
      if (params.kind === "closure") {
        setScenarioMap(null);
        setAccessMap(null);
      }
      if (params.kind === "port") setRiskMap(null);
    },
    [params.kind, setScenarioMap, setAccessMap, setRiskMap],
  );
}

// ---------------------------------------------------------------------------------------------
// Comparison of saved scenarios (results recomputed from the current published data)

export type AnyScenarioModel = ImportModel | ClosureModel | ProductionModel | PortModel;

export interface ScenarioSummary {
  id: string;
  name: string;
  params: ScenarioParams;
  model: AnyScenarioModel | null;
  /** Why no model: still loading, or the scenario's data is not available. */
  note: string | null;
}

function combineSnapshots(results: { data?: TradeSnapshot; error: Error | null }[]) {
  return { data: results.map((r) => r.data), error: results.find((r) => r.error)?.error ?? null };
}

export function useScenarioSummaries(
  list: readonly { id: string; name: string; params: ScenarioParams }[],
): ScenarioSummary[] {
  const manifest = useManifest();
  const index = useTradeIndex();
  const points = useCountryPoints();
  const ukAnchor = useUkAnchor(points.data);
  const datasetIds = useMemo(
    () => [
      ...new Set(
        list
          .flatMap((s) => (s.params.kind === "import" ? [s.params.commodity] : []))
          .map((c) => resolveCommodity(index.data, c)?.datasetId)
          .filter((x): x is string => !!x),
      ),
    ],
    [list, index.data],
  );
  const snapshots = useQueries({
    queries: datasetIds.map((id) => ({
      ...validatedDatasetQuery(manifest.data, id, validateTradeSnapshotLazy),
      enabled: manifest.isSuccess,
    })),
    combine: combineSnapshots,
  });
  const closure = useClosureData(list.some((s) => s.params.kind === "closure"));
  const anyProduction = list.some((s) => s.params.kind === "production");
  const anyPort = list.some((s) => s.params.kind === "port");
  const production = useValidatedDataset(
    anyProduction ? CONTEXT_PRODUCTION_DATASET_ID : null,
    validateUkProduction,
  );
  const ports = useValidatedDataset(anyPort ? RISK_DATASET_IDS.ports : null, validatePorts);
  const entry = useValidatedDataset(anyPort ? RISK_DATASET_IDS.portEntry : null, validatePortEntry);
  const portsDs = findDataset(manifest.data, RISK_DATASET_IDS.ports);
  const period = closure.datasets[0]?.referencePeriod.split(";").pop()?.trim() ?? "GEOLYTIX v46 (June 2026)";

  return useMemo(
    () =>
      list.map((s): ScenarioSummary => {
        const p = s.params;
        const base = { id: s.id, name: s.name, params: p };
        const loading = { ...base, model: null, note: "Loading…" };
        switch (p.kind) {
          case "import": {
            const e = resolveCommodity(index.data, p.commodity);
            const i = e ? datasetIds.indexOf(e.datasetId) : -1;
            const snap = i >= 0 ? snapshots.data[i] : undefined;
            if (!e || !snap || !ukAnchor)
              return snapshots.error ? { ...base, model: null, note: "Trade data unavailable" } : loading;
            return {
              ...base,
              model: buildImportModel(snap, e.label, p, ukAnchor, 12, "scenario"),
              note: null,
            };
          }
          case "closure": {
            if (!closure.parts || closure.councils.size === 0)
              return closure.error ? { ...base, model: null, note: "Closure inputs unavailable" } : loading;
            const ref = findStore(closure.parts, p.store);
            if (!ref) return { ...base, model: null, note: "No supermarket picked" };
            return {
              ...base,
              model: buildClosureModel(closure.parts, ref, closure.councils, "scenario", period),
              note: null,
            };
          }
          case "production": {
            const e = resolveCommodity(index.data, p.commodity);
            if (!production.data || !e)
              return production.error ? { ...base, model: null, note: "Defra data unavailable" } : loading;
            return { ...base, model: buildProductionModel(production.data, e.id, e.label, p), note: null };
          }
          case "port": {
            if (!ports.data || !entry.data || !portsDs)
              return ports.error || entry.error
                ? { ...base, model: null, note: "Port data unavailable" }
                : loading;
            return {
              ...base,
              model: buildPortModel(ports.data, entry.data, p, "scenario", portsDs.attribution),
              note: null,
            };
          }
        }
      }),
    [
      list,
      datasetIds,
      index.data,
      snapshots.data,
      snapshots.error,
      ukAnchor,
      closure.parts,
      closure.councils,
      closure.error,
      production.data,
      production.error,
      ports.data,
      entry.data,
      ports.error,
      entry.error,
      portsDs,
      period,
    ],
  );
}
