/**
 * Indicators the assessments add to those of the earlier modules (Stage 8). Small-area figures come
 * from the Scenario Lab's UK-wide inputs, so every council has them (P1, P7: straight-line only).
 */
import { formatCount, formatKm, formatPopulation } from "@/analysis/format";
import type { Beyond } from "@/analysis/profile";
import { productionShareIndicator } from "@/features/profiles/indicators";
import type { UkProduction } from "@/types/generated/uk-production";
import type { Indicator } from "@/types/indicator";
import type { CouncilSmallAreas, ClosurePreview } from "./smallAreas";

const STORES = "June 2026 (GEOLYTIX v46)";

function areaSource(code: string): string {
  return code.startsWith("N") ? "S16" : code.startsWith("S") ? "S17" : "S15";
}

function censusText(s: CouncilSmallAreas): string {
  return s.censusYear === 2022 ? "Census 2022 (Scotland)" : "Census 2021";
}

function gridName(s: CouncilSmallAreas): string {
  return s.grid === "EPSG:2157" ? "Irish Transverse Mercator" : "British National Grid";
}

const NI_BORDER =
  " Supermarkets in the Republic of Ireland are not in the data, so distances near the border may be overstated.";

/** Residents more than `b.thresholdKm` straight-line from a supermarket, every council (P7). */
export function smallAreaBeyondIndicator(name: string, s: CouncilSmallAreas, b: Beyond): Indicator<number> {
  return {
    id: `insights.beyond.supermarket.${b.thresholdKm}`,
    label: `Residents more than ${formatKm(b.thresholdKm)} from the nearest supermarket (straight-line)`,
    value: b.share,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S11", areaSource(s.council), "S18"],
    referencePeriod: `${censusText(s)} population; supermarkets ${STORES}`,
    coverage: `${name}, ${formatCount(s.areas.length)} small areas`,
    method: `${formatPopulation(b.population, "small_area")} of ${formatPopulation(s.population, "small_area")} residents live in ${formatCount(b.areas)} small areas whose population-weighted centroid is more than ${formatKm(b.thresholdKm)} straight-line from the nearest supermarket (GEOLYTIX, 280 m² and over, any council), in the ${gridName(s)}. Straight-line proximity only: not walking, driving or public transport time, and not affordability.${s.part === "ni" ? NI_BORDER : ""}`,
    scope: "local",
    ...(b.share === null ? { missingReason: "not_applicable" as const } : {}),
  };
}

/** Residents in England's 20 % most deprived small areas (IoD 2025 deciles 1–2); England only (P11). */
export function deprivedShareIndicator(name: string, s: CouncilSmallAreas): Indicator<number> {
  return {
    id: "insights.deprivation.deciles_1_2",
    label: "Residents in England's 20 % most deprived small areas",
    value: s.deprived?.share ?? null,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S19", "S18"],
    referencePeriod: "English Indices of Deprivation 2025; Census 2021 population",
    coverage: `${name}, by small area`,
    method: s.deprived
      ? `${formatPopulation(s.deprived.population, "small_area")} of ${formatPopulation(s.population, "small_area")} residents live in LSOAs in deciles 1–2 of the IoD 2025 (ranked within England).`
      : "Deprivation deciles are attached to England's small areas only; Wales, Scotland and Northern Ireland rank their own areas with their own indices, which are not compared with England's.",
    scope: "local",
    comparabilityGroup: "ranked within England",
    ...(s.deprived ? {} : { missingReason: "not_covered" as const }),
  };
}

/**
 * Defra's UK production as a share of supply for a basket, as published (national context, S09/S10),
 * through the profiles' indicator; null when Defra publishes no balance for it.
 */
export function publishedProductionShare(
  label: string,
  prod: UkProduction["commodities"][number] | null | undefined,
): Indicator<number> | null {
  if (!prod || prod.status !== "published") return null;
  const share = prod.measures.find((m) => m.key === "productionShare");
  if (!share) return null;
  return productionShareIndicator(
    label,
    share.value / 100,
    prod.sourceId,
    `${prod.year}${prod.provisional ? " (provisional)" : ""}`,
    share.label,
    prod.scope,
  );
}

/** Closing the council's most relied-on supermarket (Scenario B): residents whose nearest changes. */
export function closurePreviewIndicator(
  name: string,
  p: ClosurePreview,
  s: CouncilSmallAreas,
): Indicator<number> {
  return {
    id: "insights.closure_preview.population",
    label: `Residents whose nearest supermarket would change if ${p.name} closed`,
    value: p.result.populationAffected,
    unit: "residents (small areas)",
    provenance: "scenario",
    sourceIds: ["S11", areaSource(s.council), "S18"],
    referencePeriod: `${censusText(s)} population; supermarkets ${STORES}`,
    coverage: `Small areas anywhere in ${s.part === "gb" ? "Great Britain" : "Northern Ireland"} whose nearest supermarket is ${p.name}`,
    method: `Scenario B (Stage 7) for the supermarket that is nearest for the most residents of ${name} (${formatPopulation(p.reliedOn, "small_area")}): each area whose nearest it is moves to its next nearest by straight line. A hypothetical closure under stated assumptions, not an expected event.`,
    scope: "local",
  };
}
