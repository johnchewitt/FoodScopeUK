/**
 * Indicators for UK Food Access cards (ADR-09, P1): every displayed value with its sources,
 * reference period, unit, coverage, method and provenance class.
 */
import { formatCount, formatPopulation } from "@/analysis/format";
import { PROVISION, STORE_LAYER_LABELS, type ProvisionMeasure, type StoreLayer } from "@/analysis/retail";
import type { Indicator } from "@/types/indicator";

export const STORES_PERIOD = "June 2026 (GEOLYTIX v46)";
export const RATE_PERIOD = "Stores June 2026; population mid-2025";

export function mappedStoresIndicator(
  value: number,
  layers: readonly StoreLayer[],
  retailers: readonly string[] | null,
): Indicator<number> {
  return {
    id: "access.mapped_stores",
    label: "Mapped stores",
    value,
    unit: "stores",
    provenance: "measured",
    sourceIds: ["S11"],
    referencePeriod: STORES_PERIOD,
    coverage: "United Kingdom, Guernsey, Jersey and the Isle of Man",
    method: `GEOLYTIX grocery stores shown on the map: ${
      layers.length
        ? layers.map((l) => STORE_LAYER_LABELS[l].label.toLowerCase()).join(", ")
        : "no store types"
    }; ${retailers === null ? "all retailers" : `${retailers.length} retailers`}. Wholesale and mainly non-food stores are not included.`,
    scope: "local",
  };
}

/** Stores per 10,000 residents for a council or an area total (spec §6.3). */
export function rateIndicator(
  measure: ProvisionMeasure,
  value: number | null,
  stores: number,
  population: number | null,
  area: string,
): Indicator<number> {
  return {
    id: `access.per10k.${measure}`,
    label: PROVISION[measure].label,
    value,
    unit: "stores per 10,000 residents",
    provenance: "derived",
    sourceIds: ["S11", "S14", "S18"],
    referencePeriod: RATE_PERIOD,
    coverage: area,
    method: `${formatCount(stores)} stores ÷ ${
      population === null ? "no population figure" : `${formatPopulation(population, "authority")} residents`
    } × 10,000 (ONS mid-2025 estimate, the same year for all four nations).`,
    scope: "local",
    ...(value === null ? { missingReason: "not_published" as const } : {}),
  };
}

/** Stores per km² of land (SM-08). */
export function densityIndicator(
  measure: ProvisionMeasure,
  value: number | null,
  stores: number,
  landAreaKm2: number | null,
  area: string,
): Indicator<number> {
  return {
    id: `access.per_km2.${measure}`,
    label: `${PROVISION[measure].short} per km²`,
    value,
    unit: "stores per km²",
    provenance: "derived",
    sourceIds: ["S11", "S14", "S18"],
    referencePeriod: RATE_PERIOD,
    coverage: area,
    method: `${formatCount(stores)} stores ÷ ${
      landAreaKm2 === null ? "no land area" : `${formatCount(landAreaKm2)} km²`
    } of land excluding inland water (ONS Standard Area Measurements; NISRA estimate for Northern Ireland).`,
    scope: "local",
    ...(value === null ? { missingReason: "not_published" as const } : {}),
  };
}
