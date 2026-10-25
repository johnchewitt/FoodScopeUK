/**
 * Indicators for Local Authority Profiles (ADR-09, P1): every displayed value with its sources,
 * reference period, unit, coverage, method and provenance class. National figures carry
 * scope "national_context" so <Metric> labels them (P6).
 */
import { formatCount, formatKm, formatPopulation } from "@/analysis/format";
import type { Beyond, Concentration } from "@/analysis/profile";
import { STORE_LAYER_LABELS } from "@/analysis/retail";
import type { Indicator } from "@/types/indicator";
import type { CouncilRow } from "./model";

export const STORES_PERIOD = "June 2026 (GEOLYTIX v46)";
export const POPULATION_PERIOD = "Mid-2025";
export const CENSUS_PERIOD = "Census 2021 (21 March 2021)";

function area(c: CouncilRow): string {
  return `${c.name} (${c.nation})`;
}

function missing(value: number | string | null) {
  return value === null ? { missingReason: "not_published" as const } : {};
}

export function populationIndicator(c: CouncilRow): Indicator<number> {
  return {
    id: "profile.population",
    label: "Residents",
    value: c.population,
    unit: "residents",
    provenance: "official_estimate",
    sourceIds: ["S18"],
    referencePeriod: POPULATION_PERIOD,
    coverage: area(c),
    method:
      "ONS mid-2025 population estimate for the council (NRS and NISRA figures for Scotland and Northern Ireland), the same year for all four nations.",
    scope: "local",
    ...missing(c.population),
  };
}

export function landAreaIndicator(c: CouncilRow): Indicator<number> {
  return {
    id: "profile.land_area",
    label: "Land area",
    value: c.landAreaKm2,
    unit: "km²",
    provenance: "official_estimate",
    sourceIds: ["S18"],
    referencePeriod: POPULATION_PERIOD,
    coverage: area(c),
    method:
      "Land area excluding inland water, as published with the mid-2025 estimates (ONS; NISRA's estimate for Northern Ireland). Not the boundary area drawn on the map.",
    scope: "local",
    ...missing(c.landAreaKm2),
  };
}

export function densityIndicator(c: CouncilRow, value: number | null): Indicator<number> {
  return {
    id: "profile.density",
    label: "Population density",
    value,
    unit: "residents per km²",
    provenance: "derived",
    sourceIds: ["S18"],
    referencePeriod: POPULATION_PERIOD,
    coverage: area(c),
    method: `${formatPopulation(c.population, "authority")} residents ÷ ${c.landAreaKm2 === null ? "no land area" : `${formatCount(c.landAreaKm2)} km²`} of land.`,
    scope: "local",
    ...missing(value),
  };
}

export function urbanRuralIndicator(c: CouncilRow): Indicator<string> {
  const u = c.context?.urbanRural ?? null;
  return {
    id: "profile.urban_rural",
    label: "Urban/rural class",
    value: u ? u.name : null,
    unit: "class",
    provenance: "measured",
    sourceIds: ["S21"],
    referencePeriod: "2021 classification (Census 2021 populations)",
    coverage: area(c),
    method: u
      ? `ONS 2021 Rural Urban Classification of councils (code ${u.code}): where most of the population lives, and whether it is nearer to or further from a major town or city.${u.basis ? ` ${u.basis}` : ""}`
      : "No council-level classification is published for this nation, or it is not yet included.",
    scope: "local",
    comparabilityGroup: "nation-specific classification",
    ...(u ? {} : { missingReason: "not_covered" as const }),
  };
}

export function noCarIndicator(c: CouncilRow): Indicator<number> {
  const car = c.context?.carAvailability ?? null;
  const value = car && car.households > 0 ? car.noCar / car.households : null;
  return {
    id: "profile.no_car",
    label: "Households with no car or van",
    value,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S20"],
    referencePeriod: CENSUS_PERIOD,
    coverage: area(c),
    method: car
      ? `${formatCount(car.noCar)} of ${formatCount(car.households)} households (Census 2021).${car.basis ? ` ${car.basis}` : ""}`
      : "Not included for this nation (Scotland's census was in 2022).",
    scope: "local",
    ...(value === null ? { missingReason: "not_covered" as const } : {}),
  };
}

/**
 * GEOLYTIX maps ten retailers in Northern Ireland; symbol groups common there are not in it (S29
 * analysis), so NI store figures are not fully like for like with Great Britain's (P11).
 */
export const NI_STORE_COVERAGE =
  "In Northern Ireland GEOLYTIX maps ten retailers; symbol groups common there (SuperValu, Mace, Vivo and others) and independent grocers are not in it, so Northern Ireland's store counts and rates may be lower, and its straight-line distances longer, than like-for-like figures for Great Britain.";

const niNote = (c: CouncilRow) => (c.code.startsWith("N") ? ` ${NI_STORE_COVERAGE}` : "");

export function storesIndicator(c: CouncilRow, total: number): Indicator<number> {
  return {
    id: "profile.stores",
    label: "Mapped grocery stores",
    value: total,
    unit: "stores",
    provenance: "measured",
    sourceIds: ["S11", "S14"],
    referencePeriod: STORES_PERIOD,
    coverage: area(c),
    method:
      "GEOLYTIX stores whose location falls inside the council's full-extent boundary (May 2025); a store up to 50 m outside every boundary takes the nearest council. Every type: supermarkets, convenience stores and forecourt, travel and hospital stores." +
      niNote(c),
    scope: "local",
  };
}

export function retailersIndicator(c: CouncilRow, count: number): Indicator<number> {
  return {
    id: "profile.retailers",
    label: "Retailers represented",
    value: count,
    unit: "retailers",
    provenance: "derived",
    sourceIds: ["S11"],
    referencePeriod: STORES_PERIOD,
    coverage: area(c),
    method:
      "Distinct GEOLYTIX retailer names among the council's mapped stores (fascias of one retailer count once).",
    scope: "local",
  };
}

export function concentrationIndicator(c: CouncilRow, k: Concentration): Indicator<number> {
  const basis =
    k.basis.length === 1
      ? STORE_LAYER_LABELS[k.basis[0]!].label.toLowerCase()
      : "grocery stores of every type";
  return {
    id: `profile.concentration.${k.basis.join("-")}`,
    label: "Largest retailer's share",
    value: k.topShare,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S11"],
    referencePeriod: STORES_PERIOD,
    coverage: area(c),
    method: k.topRetailer
      ? `${k.topRetailer}: its share of the council's ${formatCount(k.stores)} mapped ${basis}. A count of stores, not floorspace or sales, so not market share.`
      : `No mapped ${basis} in the council.`,
    scope: "local",
    ...(k.topShare === null ? { missingReason: "not_applicable" as const } : {}),
  };
}

export function hhiIndicator(c: CouncilRow, k: Concentration): Indicator<number> {
  return {
    id: `profile.hhi.${k.basis.join("-")}`,
    label: "Retailer concentration (HHI)",
    value: k.hhi,
    unit: "HHI",
    provenance: "derived",
    sourceIds: ["S11"],
    referencePeriod: STORES_PERIOD,
    coverage: area(c),
    method:
      "Herfindahl–Hirschman Index of retailer shares of the council's mapped stores (Σ share² × 10,000; 10,000 = one retailer). Store counts, not sales.",
    scope: "local",
    ...(k.hhi === null ? { missingReason: "not_applicable" as const } : {}),
  };
}

export function beyondIndicator(c: CouncilRow, b: Beyond, what: "supermarket" | "store"): Indicator<number> {
  const target = what === "supermarket" ? "the nearest supermarket" : "the nearest grocery store of any type";
  return {
    id: `profile.beyond.${what}.${b.thresholdKm}`,
    label: `Residents more than ${formatKm(b.thresholdKm)} from ${target} (straight-line)`,
    value: b.share,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S11", c.code.startsWith("N") ? "S16" : "S15", "S18"],
    referencePeriod: `${CENSUS_PERIOD} population; stores ${STORES_PERIOD}`,
    coverage: `${area(c)}, by small area`,
    method: `${formatPopulation(b.population, "small_area")} residents in ${formatCount(b.areas)} small areas whose population-weighted centroid is more than ${formatKm(b.thresholdKm)} straight-line from ${target}, measured in the ${c.code.startsWith("N") ? "Irish Transverse Mercator" : "British National Grid"} grid. Straight-line proximity only: not walking, driving or public transport time, and not affordability.${b.unknown ? ` ${b.unknown} areas without a distance are left out.` : ""}${niNote(c)}`,
    scope: "local",
    ...(b.share === null ? { missingReason: "not_applicable" as const } : {}),
  };
}

export function decileShareIndicator(
  c: CouncilRow,
  id: string,
  label: string,
  value: number | null,
  sourceId: string,
  method: string,
  within: string,
  period: string,
): Indicator<number> {
  return {
    id,
    label,
    value,
    unit: "share",
    provenance: "derived",
    sourceIds: [sourceId],
    referencePeriod: period,
    coverage: `${area(c)}, by small area`,
    method,
    scope: "local",
    comparabilityGroup: `ranked within ${within}`,
    ...(value === null ? { missingReason: "not_applicable" as const } : {}),
  };
}

/** UK recorded imports for a basket over 12 months (national context, P6). */
export function nationalTopShareIndicator(
  label: string,
  value: number | null,
  partner: string | null,
  period: string,
): Indicator<number> {
  return {
    id: `profile.national.top_share.${label.toLowerCase()}`,
    label: `${label}: largest recorded import partner`,
    value,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S01"],
    referencePeriod: period,
    coverage: "United Kingdom (national context)",
    method: `${partner ?? "—"}: its share of UK recorded imports by net mass (HMRC, country of dispatch). The same for every council: not the council's own supply chain.`,
    scope: "national_context",
    ...(value === null ? { missingReason: "not_published" as const } : {}),
  };
}

export function productionShareIndicator(
  label: string,
  value: number | null,
  sourceId: string,
  period: string,
  measureLabel: string,
): Indicator<number> {
  return {
    id: `profile.national.production.${label.toLowerCase()}`,
    label: `${label}: UK production share of supply`,
    value,
    unit: "share",
    provenance: "official_estimate",
    sourceIds: [sourceId],
    referencePeriod: period,
    coverage: "United Kingdom (national context)",
    method: `${measureLabel}, as published by Defra (annual). National: not a council figure, and never combined with monthly trade.`,
    scope: "national_context",
    ...(value === null ? { missingReason: "not_published" as const } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Small-area card (LP-04, LP-06): every value through an Indicator (P1, ADR-09)

const isNiArea = (code: string) => code.startsWith("N20") || code.startsWith("95");

export function areaResidentsIndicator(code: string, name: string, residents: number): Indicator<number> {
  return {
    id: `area.${code}.residents`,
    label: "Residents (Census 2021)",
    value: residents,
    unit: "residents (small areas)",
    provenance: "measured",
    sourceIds: ["S18"],
    referencePeriod: CENSUS_PERIOD,
    coverage: name,
    method: `Usual residents, Census 2021 (${isNiArea(code) ? "NISRA MS-A01" : "ONS TS001"}). Small-area counts are perturbed for confidentiality.`,
    scope: "local",
  };
}

export function areaNoCarIndicator(
  code: string,
  name: string,
  households: number | null,
  noCar: number | null,
  share: number | null,
): Indicator<number> {
  return {
    id: `area.${code}.no-car`,
    label: "Households with no car or van",
    value: share,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S20"],
    referencePeriod: CENSUS_PERIOD,
    coverage: name,
    method:
      households !== null && noCar !== null
        ? `${formatCount(noCar)} of ${formatCount(households)} households (Census 2021).`
        : "No car availability published for this area.",
    scope: "local",
    ...(share === null ? { missingReason: "not_covered" as const } : {}),
  };
}

export function areaDistanceIndicator(code: string, name: string, metres: number | null): Indicator<number> {
  const ni = isNiArea(code);
  return {
    id: `area.${code}.to-supermarket`,
    label: "Nearest supermarket (straight-line)",
    value: metres === null ? null : metres / 1000,
    unit: "km (straight-line)",
    provenance: "derived",
    sourceIds: ["S11", ni ? "S16" : "S15"],
    referencePeriod: `Stores ${STORES_PERIOD}; centroids Census 2021`,
    coverage: name,
    method: `Straight-line distance from the area's Census 2021 population-weighted centroid to the nearest mapped supermarket (280 m² and over), in the ${ni ? "Irish Transverse Mercator" : "British National Grid"} grid. Not a travel time.${ni ? ` ${NI_STORE_COVERAGE}` : ""}`,
    scope: "local",
    ...(metres === null ? { missingReason: "not_applicable" as const } : {}),
  };
}

export function areaClassIndicator(
  code: string,
  name: string,
  label: string,
  value: string | null,
  sourceId: string,
  period: string,
  method: string,
  provenance: "measured" | "derived" = "measured",
  within?: string,
): Indicator<string> {
  return {
    id: `area.${code}.${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    label,
    value,
    unit: "class",
    provenance,
    sourceIds: [sourceId],
    referencePeriod: period,
    coverage: name,
    method,
    scope: "local",
    ...(within ? { comparabilityGroup: `ranked within ${within}` } : {}),
    ...(value === null ? { missingReason: "not_covered" as const } : {}),
  };
}
