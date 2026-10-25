/**
 * UK seasonal production status per commodity (spec SS-07; docs/03-DATA-SOURCES.md §S05–S10).
 *
 * Domestic production is shown only where a verified monthly series exists. Defra's monthly
 * production statistics (S06–S08) cover meat, poultry and milk, none of the Food Origins baskets;
 * the sources for these baskets (S09, S10; verified 25 Oct 2026) are annual. So Seasonal Supply
 * shows no monthly production; the annual figures appear as national context in Local Authority
 * Profiles. FOODSCOPE never estimates domestic supply from imports or divides one series by the other.
 */
export interface DomesticProductionStatus {
  /**
   * "annual_only": a verified source exists but publishes annual figures only; "none_identified":
   * no source in the inventory.
   */
  status: "annual_only" | "none_identified";
  sourceIds: string[];
  /** One or two sentences for the panel. */
  detail: string;
}

const HORTICULTURE =
  "Defra's horticulture statistics (S09) publish UK production once a year, not monthly. The 2025 figure is shown as national context in Local Authority Profiles.";

const STATUS: Record<string, DomesticProductionStatus> = {
  tomatoes: { status: "annual_only", sourceIds: ["S09"], detail: HORTICULTURE },
  strawberries: { status: "annual_only", sourceIds: ["S09"], detail: HORTICULTURE },
  potatoes: {
    status: "annual_only",
    sourceIds: ["S10"],
    detail:
      "Defra's Agriculture in the UK (S10) publishes potato production and supply once a year, not monthly. The 2025 figure is shown as national context in Local Authority Profiles.",
  },
  wheat: {
    status: "annual_only",
    sourceIds: ["S10"],
    detail:
      "Defra's Agriculture in the UK (S10) publishes wheat production and supply once a year (harvest), not monthly. The 2025 figure is shown as national context in Local Authority Profiles.",
  },
  bananas: {
    status: "none_identified",
    sourceIds: [],
    detail: "Defra publishes no UK production statistics for this commodity.",
  },
};

export const DOMESTIC_PRODUCTION_RULE =
  "Imports are never used to estimate UK production, and no monthly “domestic share of supply” is calculated from incompatible statistics.";

export function domesticProduction(commodityId: string): DomesticProductionStatus {
  return (
    STATUS[commodityId] ?? {
      status: "none_identified",
      sourceIds: [],
      detail: "No verified UK production series is listed for this commodity.",
    }
  );
}
