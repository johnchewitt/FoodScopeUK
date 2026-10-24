/**
 * Retail provision indicators (spec §6.3, SM-03, SM-06, SM-08). Pure functions: no React, ArcGIS
 * or DOM imports.
 *
 * Store layers follow decision D5 (S11):
 * - **supermarket**: 280 m² and over, standard format (the default view);
 * - **convenience**: under 280 m², standard format;
 * - **other**: petrol forecourt, motorway services, station and airport, and hospital stores, of
 *   any size.
 * Wholesale and mainly non-food stores are not in the published data (John, 24 Oct 2026).
 *
 * Rates use ONS mid-2025 population and land area (S18), the same year for all four nations.
 * Crown Dependency stores have no council and no population in S18, so they are in no rate.
 */
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import type { SizeBand, StoreClass, StoreFormat } from "@/types/generated/stores";

export type StoreLayer = "supermarket" | "convenience" | "other";
export const STORE_LAYERS: readonly StoreLayer[] = ["supermarket", "convenience", "other"];
export const DEFAULT_STORE_LAYERS: readonly StoreLayer[] = ["supermarket"];

export const STORE_LAYER_LABELS: Record<StoreLayer, { label: string; detail: string }> = {
  supermarket: { label: "Supermarkets", detail: "280 m² and over, high street and out of town" },
  convenience: { label: "Convenience stores", detail: "Under 280 m², high street" },
  other: {
    label: "Forecourt, travel and hospital",
    detail: "Petrol forecourts, motorway services, stations, airports and hospitals",
  },
};

/** The map layer a store belongs to (D5): class from size band, format from fascia. */
export function storeLayer(storeClass: StoreClass | string, format: StoreFormat | string): StoreLayer {
  if (format !== "standard") return "other";
  return storeClass === "supermarket" ? "supermarket" : "convenience";
}

// ---------------------------------------------------------------------------------------------
// Council provision (SM-06, SM-08)

export type ProvisionMeasure = "supermarkets" | "convenience" | "all";
export const PROVISION_MEASURES: readonly ProvisionMeasure[] = ["supermarkets", "convenience", "all"];

/**
 * Fixed class breaks for stores per 10,000 residents (spec §7.4: series use fixed, manually defined
 * breaks). Chosen on 24 Oct 2026 as round numbers near the deciles and quintiles of the June 2026
 * GEOLYTIX edition over ONS mid-2025 population (UK: supermarkets 1.03, convenience 1.53, all 2.74),
 * and kept fixed for later editions so maps stay comparable. Six classes: below the first break,
 * between breaks, and at or above the last.
 */
export const PROVISION: Record<
  ProvisionMeasure,
  { label: string; short: string; layers: readonly StoreLayer[]; breaks: readonly number[] }
> = {
  supermarkets: {
    label: "Supermarkets per 10,000 residents",
    short: "Supermarkets",
    layers: ["supermarket"],
    breaks: [0.7, 0.85, 1, 1.15, 1.3],
  },
  convenience: {
    label: "Convenience stores per 10,000 residents",
    short: "Convenience stores",
    layers: ["convenience"],
    breaks: [1, 1.2, 1.4, 1.6, 2],
  },
  all: {
    label: "Grocery stores per 10,000 residents",
    short: "All grocery stores",
    layers: ["supermarket", "convenience", "other"],
    breaks: [2, 2.3, 2.6, 2.9, 3.3],
  },
};

/** Class index 0…breaks.length for a value; null (no-data class) when the value is missing. */
export function classIndex(value: number | null | undefined, breaks: readonly number[]): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  let k = 0;
  while (k < breaks.length && value >= breaks[k]!) k++;
  return k;
}

/** The store layer of each column of a council's `stores` array (indicator groups). */
export function groupLayers(doc: Pick<CouncilIndicators, "stores">): StoreLayer[] {
  const classOf = new Map(doc.stores.sizeBands.map((b) => [b.id, b.storeClass]));
  return doc.stores.groups.map((g) => storeLayer(classOf.get(g.sizeBand) ?? "", g.format));
}

/** Stores in the given layers, from one council's grouped counts. */
export function countInLayers(
  counts: readonly number[],
  layersOfGroups: readonly StoreLayer[],
  layers: readonly StoreLayer[],
): number {
  let n = 0;
  for (let i = 0; i < counts.length; i++) if (layers.includes(layersOfGroups[i]!)) n += counts[i]!;
  return n;
}

/** Stores per 10,000 residents; null without a population. */
export function per10k(count: number, population: number | null | undefined): number | null {
  if (!population || population <= 0) return null;
  return (count / population) * 10_000;
}

/** Stores per km² of land (excluding inland water); null without an area. */
export function perKm2(count: number, landAreaKm2: number | null | undefined): number | null {
  if (!landAreaKm2 || landAreaKm2 <= 0) return null;
  return count / landAreaKm2;
}

export interface Provision {
  code: string;
  name: string;
  nation: CouncilIndicators["councils"][number]["nation"];
  stores: number;
  population: number | null;
  landAreaKm2: number | null;
  per10k: number | null;
  perKm2: number | null;
  classIndex: number | null;
  note: string | null;
}

/** Provision by council for one measure (counts, rates, class). */
export function councilProvision(doc: CouncilIndicators, measure: ProvisionMeasure): Provision[] {
  const layersOfGroups = groupLayers(doc);
  const def = PROVISION[measure];
  return doc.councils.map((c) => {
    const stores = countInLayers(c.stores, layersOfGroups, def.layers);
    const rate = per10k(stores, c.population);
    return {
      code: c.code,
      name: c.name,
      nation: c.nation,
      stores,
      population: c.population,
      landAreaKm2: c.landAreaKm2,
      per10k: rate,
      perKm2: perKm2(stores, c.landAreaKm2),
      classIndex: classIndex(rate, def.breaks),
      note: c.note,
    };
  });
}

export interface AreaTotal {
  label: string;
  stores: number;
  population: number;
  landAreaKm2: number;
  councils: number;
  per10k: number | null;
  perKm2: number | null;
}

/** Totals over a set of councils (a nation or the UK); councils without population are skipped and counted. */
export function areaTotal(
  label: string,
  rows: readonly Provision[],
): AreaTotal & { withoutPopulation: number } {
  let stores = 0;
  let population = 0;
  let land = 0;
  let without = 0;
  for (const r of rows) {
    if (r.population === null || r.landAreaKm2 === null) {
      without++;
      continue;
    }
    stores += r.stores;
    population += r.population;
    land += r.landAreaKm2;
  }
  return {
    label,
    stores,
    population,
    landAreaKm2: land,
    councils: rows.length - without,
    per10k: per10k(stores, population),
    perKm2: perKm2(stores, land),
    withoutPopulation: without,
  };
}

// ---------------------------------------------------------------------------------------------
// Store filters (SM-03)

export interface StoreFilter {
  layers: readonly StoreLayer[];
  /** Retailers shown; null = every retailer. */
  retailers: readonly string[] | null;
}

export interface FilterableStore {
  layer: StoreLayer;
  retailer: string;
}

export function storeMatches(store: FilterableStore, filter: StoreFilter): boolean {
  if (!filter.layers.includes(store.layer)) return false;
  return filter.retailers === null || filter.retailers.includes(store.retailer);
}

/** SQL where clause for the map layer (fields `layer`, `retailer`); "1=0" when nothing is shown. */
export function filterWhereClause(filter: StoreFilter): string {
  if (filter.layers.length === 0 || (filter.retailers !== null && filter.retailers.length === 0))
    return "1=0";
  const quote = (v: string) => `'${v.replace(/'/g, "''")}'`;
  const parts: string[] = [];
  if (filter.layers.length < STORE_LAYERS.length)
    parts.push(`layer IN (${[...filter.layers].sort().map(quote).join(", ")})`);
  if (filter.retailers !== null)
    parts.push(`retailer IN (${[...filter.retailers].sort().map(quote).join(", ")})`);
  return parts.length ? parts.join(" AND ") : "1=1";
}

/** Store counts per retailer within the shown layers, most stores first (ties by name). */
export function retailerCounts(
  stores: readonly FilterableStore[],
  layers: readonly StoreLayer[],
): { retailer: string; stores: number }[] {
  const counts = new Map<string, number>();
  for (const s of stores) {
    if (!layers.includes(s.layer)) continue;
    counts.set(s.retailer, (counts.get(s.retailer) ?? 0) + 1);
  }
  return [...counts]
    .map(([retailer, n]) => ({ retailer, stores: n }))
    .sort((a, b) => b.stores - a.stores || a.retailer.localeCompare(b.retailer));
}

// ---------------------------------------------------------------------------------------------
// Store search (SM-05): name, town or postcode, within the dataset

export interface SearchableStore {
  id: number;
  name: string;
  town: string | null;
  postcode: string | null;
}

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const POSTCODE_START = /^[a-z]{1,2}\d/;

/**
 * Stores whose postcode starts with the query, or whose name or town contains it.
 * Ranked: postcode match, then name starting with the query, then town match, then other name
 * matches; ties alphabetical. Queries shorter than two characters return nothing.
 */
export function searchStores<T extends SearchableStore>(
  stores: readonly T[],
  query: string,
  limit = 20,
): T[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const qCompact = q.replace(/ /g, "");
  const postcodeLike = POSTCODE_START.test(qCompact);
  const scored: { s: T; rank: number }[] = [];
  for (const s of stores) {
    const pc = s.postcode ? fold(s.postcode) : "";
    const name = fold(s.name);
    const town = s.town ? fold(s.town) : "";
    // A space in the query separates the outward code ("ZZ1 2" is not "ZZ12 …"); without one, spaces are ignored.
    const pcMatch = q.includes(" ") ? pc.startsWith(q) : pc.replace(/ /g, "").startsWith(qCompact);
    let rank = -1;
    if (postcodeLike && pcMatch) rank = 0;
    else if (name.startsWith(q)) rank = 1;
    else if (town === q || town.startsWith(q)) rank = 2;
    else if (name.includes(q)) rank = 3;
    if (rank >= 0) scored.push({ s, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || a.s.name.localeCompare(b.s.name) || a.s.id - b.s.id);
  return scored.slice(0, limit).map((x) => x.s);
}

/** Size band labels (D5) for detail cards and legends. */
export const SIZE_BAND_LABELS: Record<SizeBand, string> = {
  lt280: "Under 280 m²",
  "280to1400": "280 to 1,400 m²",
  "1400to2800": "1,400 to 2,800 m²",
  ge2800: "2,800 m² and over",
};

export const FORMAT_LABELS: Record<StoreFormat, string> = {
  standard: "High street and out of town",
  forecourt: "Petrol forecourt",
  motorway: "Motorway services",
  travel: "Station and airport",
  hospital: "Hospital",
};
