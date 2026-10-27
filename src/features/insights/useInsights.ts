/**
 * ConsultingWhere Insights data (Stage 8): each assessment is built from the hooks and published
 * files of the module it draws on, so the report, the map and the earlier modules show the same
 * figures (TanStack Query shares the loads). Nothing here fetches anything the modules do not.
 */
import { useMemo } from "react";
import { useProfile, useNationalContext } from "@/features/profiles/useProfile";
import {
  resolveCommodity,
  useCountryPoints,
  useTradeIndex,
  useTradeSnapshotQuery,
  useUkAnchor,
} from "@/features/origins/useOrigins";
import {
  validateCouncilPpfi,
  validatePortEntry,
  validatePorts,
  validateUkProduction,
  validateWaterStress,
} from "@/features/risks/validate";
import {
  closureMethodology,
  importMethodology,
  portMethodology,
  productionMethodology,
} from "@/features/scenarios/methodology";
import {
  buildClosureModel,
  buildImportModel,
  buildPortModel,
  buildProductionModel,
  findStore,
} from "@/features/scenarios/model";
import { useActiveScenario, useClosureData } from "@/features/scenarios/useScenario";
import { useSavedScenarios } from "@/features/scenarios/useSaved";
import { CONTEXT_PRODUCTION_DATASET_ID, RISK_DATASET_IDS } from "@/map/layerIds";
import { findDataset, useManifest } from "@/services/data/queries";
import { useValidatedDataset } from "@/services/data/useDataset";
import type { ScenarioParams } from "@/state/scenarioParams";
import { selectUrlState, useAppStore, type InsightsAssessmentState } from "@/state/store";
import { serializeUrlState, type InsightsKind } from "@/state/urlState";
import { authorityInputs, commodityInputs } from "./assemble";
import { buildAuthorityReport } from "./authority";
import { buildCommodityReport } from "./commodity";
import type { AssessmentReport } from "./report";
import { buildScenarioReport, type ScenarioModel } from "./scenario";

export type AssessmentStatus = "loading" | "error" | "empty" | "ready";

export interface AssessmentData {
  kind: InsightsKind;
  status: AssessmentStatus;
  error: Error | null;
  /** Why there is no report (no council selected, no supermarket picked, …). */
  emptyText: string | null;
  report: AssessmentReport | null;
}

/** The link that reproduces the current view: the app's address and the URL state (SH-04). */
export function useShareLink(): string {
  const qs = useAppStore((s) => serializeUrlState(selectUrlState(s)));
  return typeof window === "undefined" ? qs : `${window.location.origin}${window.location.pathname}${qs}`;
}

// ---------------------------------------------------------------------------------------------
// Local Authority Food Security Assessment

export function useAuthorityAssessment(enabled: boolean): AssessmentData {
  const p = useProfile();
  const n = useNationalContext();
  const manifest = useManifest();
  const ppfi = useValidatedDataset(enabled ? RISK_DATASET_IDS.councilPpfi : null, validateCouncilPpfi);
  const closure = useClosureData(enabled);
  const link = useShareLink();
  const lad = p.council?.code ?? null;

  const report = useMemo(() => {
    if (
      !enabled ||
      !lad ||
      !p.access.doc ||
      !p.councils ||
      !p.access.stores ||
      !ppfi.data ||
      !closure.parts ||
      !n.rows
    )
      return null;
    if (p.council?.deep && p.deep.status !== "ready") return null;
    const inputs = authorityInputs(
      {
        lad: p.access.doc,
        councils: p.councils,
        context: p.context,
        stores: p.access.stores,
        ppfi: ppfi.data,
        closure: closure.parts,
        deep: p.deep.deep,
        national: n.rows,
      },
      lad,
      manifest.data,
      link,
    );
    return inputs ? buildAuthorityReport(inputs) : null;
  }, [
    enabled,
    lad,
    p.access.doc,
    p.councils,
    p.access.stores,
    p.context,
    p.council,
    p.deep.status,
    p.deep.deep,
    ppfi.data,
    closure.parts,
    n.rows,
    manifest.data,
    link,
  ]);

  const error = p.error ?? n.error ?? ppfi.error ?? closure.error ?? null;
  return {
    kind: "authority",
    status: error ? "error" : !lad ? "empty" : report ? "ready" : "loading",
    error,
    emptyText: lad ? null : "Choose a council to build its assessment.",
    report,
  };
}

// ---------------------------------------------------------------------------------------------
// Commodity Supply Resilience Assessment

export function useCommodityAssessment(enabled: boolean): AssessmentData {
  const commodity = useAppStore((s) => s.commodity);
  const period = useAppStore((s) => s.period);
  const year = useAppStore((s) => s.year);
  const month = useAppStore((s) => s.month);
  const measure = useAppStore((s) => s.measure);
  const manifest = useManifest();
  const index = useTradeIndex();
  const entry = resolveCommodity(index.data, commodity);
  const snapshot = useTradeSnapshotQuery(enabled ? (entry?.datasetId ?? null) : null);
  const points = useCountryPoints();
  const ukAnchor = useUkAnchor(points.data);
  const water = useValidatedDataset(enabled ? RISK_DATASET_IDS.waterStress : null, validateWaterStress);
  const production = useValidatedDataset(
    enabled ? CONTEXT_PRODUCTION_DATASET_ID : null,
    validateUkProduction,
  );
  const portEntry = useValidatedDataset(enabled ? RISK_DATASET_IDS.portEntry : null, validatePortEntry);
  const link = useShareLink();

  const report = useMemo(() => {
    if (
      !enabled ||
      !entry ||
      !snapshot.data ||
      !water.data ||
      !production.data ||
      !portEntry.data ||
      !ukAnchor
    )
      return null;
    const group = index.data?.groups?.find((g) => g.id === entry.group) ?? null;
    return buildCommodityReport(
      commodityInputs(
        {
          entry,
          group,
          snapshot: snapshot.data,
          water: water.data,
          production: production.data,
          portEntry: portEntry.data,
        },
        { period, year, month, measure },
        ukAnchor,
        manifest.data,
        link,
      ),
    );
  }, [
    enabled,
    entry,
    index.data,
    snapshot.data,
    water.data,
    production.data,
    portEntry.data,
    ukAnchor,
    period,
    year,
    month,
    measure,
    manifest.data,
    link,
  ]);

  const error =
    index.error ??
    snapshot.error ??
    water.error ??
    production.error ??
    portEntry.error ??
    points.error ??
    null;
  return {
    kind: "commodity",
    status: error ? "error" : report ? "ready" : "loading",
    error,
    emptyText: null,
    report,
  };
}

// ---------------------------------------------------------------------------------------------
// Food Supply Disruption Scenario Assessment

/** Dataset ids a scenario assessment draws on, by kind. */
function scenarioDatasets(params: ScenarioParams, tradeDataset: string | undefined): string[] {
  switch (params.kind) {
    case "import":
      return ["trade.index", ...(tradeDataset ? [tradeDataset] : [])];
    case "closure":
      return ["scenario.closure_gb", "scenario.closure_ni", "local.lad_indicators", "local.stores"];
    case "production":
      return ["context.uk_production"];
    case "port":
      return [RISK_DATASET_IDS.ports, RISK_DATASET_IDS.portEntry];
  }
}

export function useScenarioAssessment(enabled: boolean): AssessmentData {
  const active = useActiveScenario();
  const { saved } = useSavedScenarios();
  const params = active.params;
  const flowCount = useAppStore((s) => s.flowCount);
  const manifest = useManifest();
  const index = useTradeIndex();
  const tradeEntry = params.kind === "import" ? resolveCommodity(index.data, params.commodity) : undefined;
  const snapshot = useTradeSnapshotQuery(enabled && tradeEntry ? tradeEntry.datasetId : null);
  const points = useCountryPoints();
  const ukAnchor = useUkAnchor(points.data);
  const productionDoc = useValidatedDataset(
    enabled && params.kind === "production" ? CONTEXT_PRODUCTION_DATASET_ID : null,
    validateUkProduction,
  );
  const portsDoc = useValidatedDataset(
    enabled && params.kind === "port" ? RISK_DATASET_IDS.ports : null,
    validatePorts,
  );
  const entryDoc = useValidatedDataset(
    enabled && params.kind === "port" ? RISK_DATASET_IDS.portEntry : null,
    validatePortEntry,
  );
  const closure = active.closure.data;
  const link = useShareLink();

  const model: ScenarioModel | null =
    params.kind === "import"
      ? active.import.model
      : params.kind === "closure"
        ? active.closure.model
        : params.kind === "production"
          ? active.production.model
          : active.port.model;

  const report = useMemo(() => {
    if (!enabled || !model) return null;
    const portsDs = findDataset(manifest.data, RISK_DATASET_IDS.ports);
    const prodLabel = (id: string) => index.data?.commodities.find((c) => c.id === id)?.label ?? id;
    const rebuild = (p: ScenarioParams): ScenarioModel | null => {
      switch (p.kind) {
        case "import":
          return snapshot.data && ukAnchor && tradeEntry
            ? buildImportModel(snapshot.data, tradeEntry.label, p, ukAnchor, flowCount, "scenario")
            : null;
        case "closure": {
          const ref = closure.parts ? findStore(closure.parts, p.store) : null;
          return ref && closure.parts
            ? buildClosureModel(closure.parts, ref, closure.councils, "scenario", "June 2026")
            : null;
        }
        case "production":
          return productionDoc.data
            ? buildProductionModel(productionDoc.data, p.commodity, prodLabel(p.commodity), p)
            : null;
        case "port":
          return portsDoc.data && entryDoc.data && portsDs
            ? buildPortModel(portsDoc.data, entryDoc.data, p, "scenario", portsDs.attribution)
            : null;
      }
    };
    const methodology =
      model.kind === "import"
        ? importMethodology(model)
        : model.kind === "closure"
          ? closureMethodology(model)
          : model.kind === "production"
            ? productionMethodology(model)
            : portMethodology(model);
    const savedName = saved.find((s) => JSON.stringify(s.params) === JSON.stringify(params))?.name ?? null;
    return buildScenarioReport({
      params,
      model,
      methodology,
      rebuild,
      savedName,
      manifest: manifest.data,
      datasetIds: scenarioDatasets(params, tradeEntry?.datasetId),
      link,
    });
  }, [
    enabled,
    model,
    params,
    saved,
    manifest.data,
    index.data,
    snapshot.data,
    ukAnchor,
    tradeEntry,
    flowCount,
    closure.parts,
    closure.councils,
    productionDoc.data,
    portsDoc.data,
    entryDoc.data,
    link,
  ]);

  const status =
    params.kind === "import"
      ? active.import.status
      : params.kind === "closure"
        ? active.closure.status
        : params.kind === "production"
          ? active.production.status
          : active.port.status;
  const error =
    params.kind === "import"
      ? active.import.error
      : params.kind === "closure"
        ? active.closure.error
        : params.kind === "production"
          ? active.production.error
          : active.port.error;
  const empty =
    params.kind === "closure" && !model && status === "ready"
      ? "Choose a supermarket to close in the Scenario Lab, or open a saved scenario."
      : params.kind === "port" && params.port === null && status === "ready"
        ? "Choose a port in the Scenario Lab, or open a saved scenario."
        : null;
  return {
    kind: "scenario",
    status: error ? "error" : report ? "ready" : empty ? "empty" : "loading",
    error: error ?? null,
    emptyText: empty,
    report,
  };
}

/** The published assessment (null until the sync has run). */
export function useInsightsAssessment(): InsightsAssessmentState | null {
  return useAppStore((s) => s.insightsAssessment);
}
