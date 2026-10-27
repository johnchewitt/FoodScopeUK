/**
 * Assembles an assessment's inputs from the published documents (Stage 8). Pure, so the hook and
 * the tests build the same inputs from the same files; nothing here fetches.
 */
import { councilNetwork, populationBeyond, type NetworkStore } from "@/analysis/profile";
import { councilProvision } from "@/analysis/retail";
import { areaTotals } from "@/features/access/model";
import type { CouncilRow, DeepProfile } from "@/features/profiles/model";
import type { NationalRow } from "@/features/profiles/useProfile";
import { buildAccessRiskModel, buildSupplyModel } from "@/features/risks/model";
import type { CouncilContext } from "@/types/generated/council-context";
import type { CouncilPpfi } from "@/types/generated/council-ppfi";
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import type { DataManifest } from "@/types/generated/manifest";
import type { OriginsSelection } from "@/features/origins/model";
import type { RiskPortEntry } from "@/types/generated/risk-port-entry";
import type { RiskWaterStress } from "@/types/generated/risk-water-stress";
import type { ScenarioClosure } from "@/types/generated/scenario-closure";
import type { TradeIndex } from "@/types/generated/trade-index";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import type { UkProduction } from "@/types/generated/uk-production";
import type { AuthorityInputs } from "./authority";
import type { CommodityInputs } from "./commodity";
import { closurePreview, councilSmallAreas, partFor } from "./smallAreas";

export interface AuthorityDocs {
  lad: CouncilIndicators;
  councils: readonly CouncilRow[];
  context: CouncilContext | null;
  stores: readonly NetworkStore[];
  ppfi: CouncilPpfi | null;
  closure: { gb: ScenarioClosure; ni: ScenarioClosure } | null;
  deep: DeepProfile | null;
  national: NationalRow[] | null;
}

/** Datasets an authority assessment draws on (its sources list and snapshot ids, EX-01). */
export const AUTHORITY_DATASETS = [
  "local.lad_indicators",
  "local.stores",
  "context.council_context",
  "risk.council_ppfi",
  "scenario.closure_gb",
  "scenario.closure_ni",
  "context.uk_production",
  "trade.index",
] as const;

/** Share of a nation's residents more than `km` straight-line from a supermarket (small areas). */
export function nationBeyond(d: ScenarioClosure, nationLetter: string, km: number): number | null {
  const areas: { code: string; population: number }[] = [];
  const metres = new Map<string, number>();
  d.areas.code.forEach((code, i) => {
    const council = d.councils[d.areas.council[i]!];
    if (!council?.startsWith(nationLetter)) return;
    areas.push({ code, population: d.areas.population[i]! });
    metres.set(code, d.areas.distance[i]![0]!);
  });
  return populationBeyond(areas, metres, km).share;
}

/** Households with no car or van across a nation's councils (Census 2021); null without data. */
export function nationNoCarShare(councils: readonly CouncilRow[], nation: string): number | null {
  const rows = councils.filter((x) => x.nation === nation && x.context?.carAvailability);
  const hh = rows.reduce((s, x) => s + x.context!.carAvailability!.households, 0);
  const none = rows.reduce((s, x) => s + x.context!.carAvailability!.noCar, 0);
  return hh > 0 ? none / hh : null;
}

/** Datasets a commodity assessment draws on, besides the basket's own snapshot. */
export function commodityDatasets(basketDatasetId: string): string[] {
  return ["trade.index", basketDatasetId, "risk.water_stress", "context.uk_production", "risk.port_entry"];
}

export interface CommodityDocs {
  entry: TradeIndex["commodities"][number];
  group: { id: string; label: string } | null;
  snapshot: TradeSnapshot;
  water: RiskWaterStress;
  production: UkProduction | null;
  portEntry: RiskPortEntry | null;
}

/** The commodity assessment's inputs for an origins selection (period, year, month, measure). */
export function commodityInputs(
  docs: CommodityDocs,
  sel: Pick<OriginsSelection, "period" | "year" | "month" | "measure">,
  ukAnchor: [number, number],
  manifest: DataManifest | undefined,
  link: string,
): CommodityInputs {
  const supply = buildSupplyModel(
    docs.snapshot,
    [],
    docs.water,
    { ...sel, partner: null, flowCount: 12 },
    "share",
    ukAnchor,
  );
  return {
    basket: {
      id: docs.entry.id,
      label: docs.entry.label,
      definition: docs.entry.definition,
      hsScope: docs.entry.hsScope,
      group: docs.group,
    },
    snapshot: docs.snapshot,
    supply,
    production: docs.production?.commodities.find((c) => c.basket === docs.entry.id) ?? null,
    portEntry: docs.portEntry,
    manifest,
    datasetIds: commodityDatasets(docs.entry.datasetId),
    link,
  };
}

export function authorityInputs(
  docs: AuthorityDocs,
  lad: string,
  manifest: DataManifest | undefined,
  link: string,
): AuthorityInputs | null {
  const council = docs.councils.find((c) => c.code === lad);
  if (!council) return null;
  const network = councilNetwork(docs.stores, lad);
  const supermarkets = councilProvision(docs.lad, "supermarkets").find((r) => r.code === lad) ?? null;
  const totals = areaTotals(docs.lad, "supermarkets");
  const part = docs.closure ? partFor(docs.closure, lad) : null;
  const smallAreas = part ? councilSmallAreas(part, lad) : null;
  const risk = docs.ppfi
    ? buildAccessRiskModel(docs.ppfi, docs.context, { measure: "combined", lad, rankNation: null })
    : null;
  const datasetIds = [
    ...AUTHORITY_DATASETS,
    ...(council.deep ? [`areas.${lad.toLowerCase()}.indicators`] : []),
  ];
  return {
    council,
    network,
    supermarkets,
    nationRate: totals.nations.find((n) => n.nation === council.nation) ?? null,
    ukRate: totals.uk,
    smallAreas,
    nationBeyond1km: part ? nationBeyond(part, lad[0]!, 1) : null,
    closure: part ? closurePreview(part, lad) : null,
    ppfi: risk
      ? {
          combined: risk.selected,
          nationShare: risk.nationShares.get(council.nation) ?? null,
          domains: risk.selectedDomains,
        }
      : null,
    deep: docs.deep,
    nationNoCarShare: nationNoCarShare(docs.councils, council.nation),
    national: docs.national,
    manifest,
    datasetIds,
    link,
  };
}
