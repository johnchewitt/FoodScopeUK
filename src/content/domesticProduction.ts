/**
 * UK seasonal production status per commodity (spec SS-07; docs/03-DATA-SOURCES.md §S05–S10).
 *
 * Domestic production is shown only where a verified monthly series exists. Defra's monthly
 * production statistics (S06–S08) cover meat, poultry and milk, none of the Food Origins baskets;
 * the annual sources for these baskets (S09, S10) are still "to verify". So nothing is shown, and
 * FOODSCOPE never estimates domestic supply from imports or divides one series by the other.
 */
export interface DomesticProductionStatus {
  /** "not_verified": a source is identified but not yet verified; "none_identified": no source in the inventory. */
  status: "not_verified" | "none_identified";
  sourceIds: string[];
  /** One or two sentences for the panel. */
  detail: string;
}

const HORTICULTURE =
  "The identified source is Defra's horticulture statistics (S09), which are annual, not monthly, and not yet verified for this build.";

const STATUS: Record<string, DomesticProductionStatus> = {
  tomatoes: { status: "not_verified", sourceIds: ["S09"], detail: HORTICULTURE },
  strawberries: { status: "not_verified", sourceIds: ["S09"], detail: HORTICULTURE },
  potatoes: { status: "not_verified", sourceIds: ["S09"], detail: HORTICULTURE },
  wheat: {
    status: "not_verified",
    sourceIds: ["S10"],
    detail:
      "The identified source is Defra's cereal and oilseed production statistics (S10), which are annual (harvest), not monthly, and not yet verified for this build.",
  },
  bananas: {
    status: "none_identified",
    sourceIds: [],
    detail: "The data inventory lists no UK production source for this commodity.",
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
