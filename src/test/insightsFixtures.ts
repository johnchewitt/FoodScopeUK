/**
 * Real published files for the ConsultingWhere Insights tests (the manifest's current snapshots),
 * and the three report builders over them. Shared by the model, PDF and component tests.
 */
import { nationalImports } from "@/analysis/profile";
import { indexStores } from "@/features/access/model";
import { authorityInputs, commodityInputs } from "@/features/insights/assemble";
import { buildAuthorityReport } from "@/features/insights/authority";
import { buildCommodityReport } from "@/features/insights/commodity";
import type { AssessmentReport } from "@/features/insights/report";
import { buildScenarioReport, type ScenarioModel } from "@/features/insights/scenario";
import { councilRows, deepProfile } from "@/features/profiles/model";
import type { NationalRow } from "@/features/profiles/useProfile";
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
  type ClosureParts,
  type CouncilInfo,
} from "@/features/scenarios/model";
import type { ScenarioParams } from "@/state/scenarioParams";
import type { CouncilContext } from "@/types/generated/council-context";
import type { CouncilPpfi } from "@/types/generated/council-ppfi";
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import type { DataManifest } from "@/types/generated/manifest";
import type { RiskPortEntry } from "@/types/generated/risk-port-entry";
import type { RiskPorts } from "@/types/generated/risk-ports";
import type { RiskWaterStress } from "@/types/generated/risk-water-stress";
import type { ScenarioClosure } from "@/types/generated/scenario-closure";
import type { SmallAreaBoundaries } from "@/types/generated/small-areas";
import type { SmallAreaIndicators } from "@/types/generated/small-area-indicators";
import type { StoreCollection } from "@/types/generated/stores";
import type { TradeIndex } from "@/types/generated/trade-index";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import type { UkProduction } from "@/types/generated/uk-production";
import { readRepoJson } from "./files";

/*
 * Real published files (the manifest's current snapshots). Expected values are recomputed here
 * from the raw arrays, without the assessment code, and checked against the deep profiles'
 * figures that the Stage 5 report verified by hand (Manchester 14.08 %, Belfast 32.17 % beyond 1 km).
 */
const D = "public/data/snapshots";
export const manifest = readRepoJson<DataManifest>("public/data/manifest.json");
export const ladDoc = readRepoJson<CouncilIndicators>(`${D}/2026-10-24/local/lad-indicators.json`);
export const storesDoc = readRepoJson<StoreCollection>(`${D}/2026-10-24/local/stores.geojson`);
export const contextDoc = readRepoJson<CouncilContext>(`${D}/2026-10-26/context/council-context.json`);
export const productionDoc = readRepoJson<UkProduction>(`${D}/2026-10-26/context/uk-production.json`);
export const ppfiDoc = readRepoJson<CouncilPpfi>(`${D}/2026-10-25/risk/council-ppfi.json`);
export const water = readRepoJson<RiskWaterStress>(`${D}/2026-10-25/risk/water-stress.json`);
export const portEntry = readRepoJson<RiskPortEntry>(`${D}/2026-10-25/risk/port-entry.json`);
export const ports = readRepoJson<RiskPorts>(`${D}/2026-10-25/risk/ports.json`);
export const gb = readRepoJson<ScenarioClosure>(`${D}/2026-10-26/scenario/closure-gb.json`);
export const ni = readRepoJson<ScenarioClosure>(`${D}/2026-10-26/scenario/closure-ni.json`);
export const index = readRepoJson<TradeIndex>(`${D}/2026-10-26/trade/index.json`);
export const snapshots = new Map(
  index.commodities.map((c) => [c.id, readRepoJson<TradeSnapshot>(`public/data/${c.path}`)]),
);
export const stores = indexStores(storesDoc);
export const deepCodes = new Set(["E08000003", "N09000003"]);
export const councils = councilRows(ladDoc, contextDoc, deepCodes);
export const national: NationalRow[] = index.commodities.map((c) => ({
  basket: c.id,
  label: c.label,
  imports: nationalImports(snapshots.get(c.id)!, c.months.provisionalFrom),
  production: productionDoc.commodities.find((p) => p.basket === c.id) ?? null,
}));
const deep = (lad: string) =>
  deepProfile(
    readRepoJson<SmallAreaIndicators>(`${D}/2026-10-25/areas/${lad}/small-area-indicators.json`),
    readRepoJson<SmallAreaBoundaries>(`${D}/2026-10-25/areas/${lad}/small-areas.geojson`),
    stores,
  );
export const UK: [number, number] = [-2, 54];

/** The authority assessment's inputs from the real files (tests may alter a copy to probe a rule). */
export function authorityInputsFor(lad: string) {
  return authorityInputs(
    {
      lad: ladDoc,
      councils,
      context: contextDoc,
      stores,
      ppfi: ppfiDoc,
      closure: { gb, ni },
      deep: deepCodes.has(lad) ? deep(lad) : null,
      national,
    },
    lad,
    manifest,
    `https://example.test/?m=insights&lad=${lad}`,
  )!;
}

export function authority(lad: string): AssessmentReport {
  const inputs = authorityInputs(
    {
      lad: ladDoc,
      councils,
      context: contextDoc,
      stores,
      ppfi: ppfiDoc,
      closure: { gb, ni },
      deep: deepCodes.has(lad) ? deep(lad) : null,
      national,
    },
    lad,
    manifest,
    `https://example.test/?m=insights&lad=${lad}`,
  );
  return buildAuthorityReport(inputs!);
}

export function commodity(id: string, measure: "mass" | "value" = "mass"): AssessmentReport {
  const entry = index.commodities.find((c) => c.id === id)!;
  const group = index.groups?.find((g) => g.id === entry.group) ?? null;
  return buildCommodityReport(
    commodityInputs(
      { entry, group, snapshot: snapshots.get(id)!, water, production: productionDoc, portEntry },
      { period: "rolling12", year: null, month: null, measure },
      UK,
      manifest,
      `https://example.test/?m=insights&ia=commodity&c=${id}`,
    ),
  );
}

const parts: ClosureParts = { gb, ni };
const info = new Map<string, CouncilInfo>(
  ladDoc.councils.map((c) => [c.code, { code: c.code, name: c.name, nation: c.nation }]),
);

export function rebuildScenario(p: ScenarioParams): ScenarioModel | null {
  switch (p.kind) {
    case "import":
      return buildImportModel(snapshots.get(p.commodity)!, "Tomatoes", p, UK, 12, "scenario");
    case "production":
      return buildProductionModel(productionDoc, p.commodity, "Wheat", p);
    case "port":
      return buildPortModel(ports, portEntry, p, "scenario", "DfT");
    case "closure": {
      const ref = findStore(parts, p.store);
      return ref ? buildClosureModel(parts, ref, info, "scenario", "June 2026") : null;
    }
  }
}

export function scenario(params: ScenarioParams): AssessmentReport {
  const model = rebuildScenario(params)!;
  const methodology =
    model.kind === "import"
      ? importMethodology(model)
      : model.kind === "closure"
        ? closureMethodology(model)
        : model.kind === "production"
          ? productionMethodology(model)
          : portMethodology(model);
  return buildScenarioReport({
    params,
    model,
    methodology,
    rebuild: rebuildScenario,
    savedName: null,
    manifest,
    datasetIds: [],
    link: "https://example.test/?m=insights&ia=scenario",
  });
}

/** Scenario A of the Stage 7 checks: Spanish tomatoes, −30 % for three months from January 2025. */
export const SPAIN_TOMATOES = {
  kind: "import" as const,
  commodity: "tomatoes",
  partner: "ES",
  year: 2025,
  month: 1,
  reduction: 30,
  duration: 3,
  recovery: 0,
  substitution: 0,
  measure: "mass" as const,
};
