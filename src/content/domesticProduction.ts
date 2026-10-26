/**
 * UK seasonal production status per commodity (spec SS-07; docs/03-DATA-SOURCES.md §S05–S10).
 *
 * Domestic production is shown only where a verified monthly series exists. Defra's monthly
 * production statistics (S06–S08) cover meat, poultry and milk: since 26 Oct 2026 (the sixteen
 * baskets) they concern beef, sheep meat, poultry and the dairy baskets, but they are not verified
 * yet (SS-07, Release 2). The other sources (S09, S10) are annual. So Seasonal Supply shows no
 * monthly production; the annual figures appear as national context in Local Authority Profiles and
 * the Risk Explorer. FOODSCOPE never estimates domestic supply from imports or divides one series by
 * the other.
 */
export interface DomesticProductionStatus {
  /**
   * "annual_only": a verified source exists but publishes annual figures only; "monthly_not_verified":
   * Defra publishes a monthly series (S06–S08) that is not verified for the app yet;
   * "none_identified": no production source in the inventory.
   */
  status: "annual_only" | "monthly_not_verified" | "none_identified";
  sourceIds: string[];
  /** One or two sentences for the panel. */
  detail: string;
}

const HORTICULTURE =
  "Defra's horticulture statistics (S09) publish UK production once a year, not monthly. The 2025 figure is shown as national context in Local Authority Profiles.";

const NOT_GROWN =
  "Defra publishes no UK production statistics for this commodity: its trade codes class every code it lists under these headings as non-indigenous, not grown in the UK on a commercially viable scale (S05).";

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
  bananas: { status: "none_identified", sourceIds: ["S05"], detail: NOT_GROWN },
  apples: { status: "annual_only", sourceIds: ["S09"], detail: HORTICULTURE },
  sugar: {
    status: "annual_only",
    sourceIds: ["S10"],
    detail:
      "Defra's Agriculture in the UK (S10) publishes sugar production and supply (refined basis) once a year, not monthly. The 2025 figure is shown as national context in Local Authority Profiles.",
  },
  beef: {
    status: "monthly_not_verified",
    sourceIds: ["S06", "S10"],
    detail:
      "Defra publishes monthly cattle slaughter and beef production statistics (S06), not yet verified for this app (planned for Release 2). Defra's annual supply balance (S10) is shown as national context in Local Authority Profiles.",
  },
  "sheep-goat": {
    status: "monthly_not_verified",
    sourceIds: ["S06", "S10"],
    detail:
      "Defra publishes monthly sheep slaughter and mutton and lamb production statistics (S06), not yet verified for this app (planned for Release 2). Defra's annual supply balance for mutton and lamb (S10) is shown as national context in Local Authority Profiles.",
  },
  poultry: {
    status: "monthly_not_verified",
    sourceIds: ["S07", "S10"],
    detail:
      "Defra publishes monthly poultry slaughterhouse statistics (S07), not yet verified for this app (planned for Release 2). Defra's annual supply balance (S10) is shown as national context in Local Authority Profiles.",
  },
  "milk-products": {
    status: "monthly_not_verified",
    sourceIds: ["S08"],
    detail:
      "Defra publishes monthly milk utilisation by dairies (S08), not yet verified for this app (planned for Release 2). No annual supply balance for these products is used.",
  },
  cheese: {
    status: "monthly_not_verified",
    sourceIds: ["S08"],
    detail:
      "Defra publishes monthly milk utilisation by dairies (S08), not yet verified for this app (planned for Release 2). No annual supply balance for cheese is used.",
  },
  oranges: { status: "none_identified", sourceIds: ["S05"], detail: NOT_GROWN },
  rice: { status: "none_identified", sourceIds: ["S05"], detail: NOT_GROWN },
  coffee: { status: "none_identified", sourceIds: ["S05"], detail: NOT_GROWN },
  cocoa: { status: "none_identified", sourceIds: ["S05"], detail: NOT_GROWN },
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
