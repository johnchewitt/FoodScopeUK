/**
 * Local authority profile indicators (LP-02 – LP-07; spec §6.3, §6.6). Pure functions: no React,
 * ArcGIS or DOM imports. The feature (src/features/profiles) turns these into indicators with
 * provenance; the map draws the classes computed here.
 *
 * Integrity rules applied here:
 * - store counts and proximity are retail presence, not access, affordability or choice (P7);
 * - distances are straight-line, in the national grid of the area (British National Grid, or
 *   Irish Transverse Mercator in Northern Ireland), from Census 2021 population-weighted centroids;
 * - deprivation and PPFI deciles are within each nation and never compared across nations (P11);
 * - nothing is combined into a single score (P10).
 */
import type { GridCrs } from "./projection";
import { gridDistance, toGrid } from "./projection";
import { STORE_LAYERS, type StoreLayer } from "./retail";
import { aggregatePeriod, hhi, isProvisional, partnerShares, resolvePeriod, type MonthKey } from "./trade";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";

// ---------------------------------------------------------------------------------------------
// Retail network of one council (LP-03)

export interface NetworkStore {
  id: number;
  lad: string | null;
  layer: StoreLayer;
  retailer: string;
}

export interface RetailerRow {
  retailer: string;
  /** Stores of every type. */
  total: number;
  byLayer: Record<StoreLayer, number>;
}

export interface Concentration {
  /** Stores the measure is computed over (e.g. supermarkets only). */
  basis: readonly StoreLayer[];
  stores: number;
  /** HHI of retailer shares of those stores, 0–10,000; null without stores. */
  hhi: number | null;
  topRetailer: string | null;
  /** Largest retailer's share of those stores (0–1). */
  topShare: number | null;
  /** Three largest retailers' share (0–1). */
  top3Share: number | null;
  /** Retailers with at least one of those stores. */
  retailers: number;
}

export interface CouncilNetwork {
  lad: string;
  total: number;
  byLayer: Record<StoreLayer, number>;
  /** Every retailer with a store in the council, most stores first (ties by name). */
  retailers: RetailerRow[];
  /** Retail concentration of supermarkets, and of every store type. */
  supermarketConcentration: Concentration;
  allConcentration: Concentration;
}

function emptyLayers(): Record<StoreLayer, number> {
  return { supermarket: 0, convenience: 0, other: 0 };
}

/**
 * Retail concentration of the stores of the given types, by retailer. Shares are of mapped store
 * counts, not floorspace or sales: they describe the store network, not market share.
 */
export function concentration(rows: readonly RetailerRow[], basis: readonly StoreLayer[]): Concentration {
  const counts = rows
    .map((r) => ({ retailer: r.retailer, n: basis.reduce((s, l) => s + r.byLayer[l], 0) }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n || a.retailer.localeCompare(b.retailer));
  const stores = counts.reduce((s, r) => s + r.n, 0);
  if (stores === 0)
    return { basis, stores: 0, hhi: null, topRetailer: null, topShare: null, top3Share: null, retailers: 0 };
  const shares = counts.map((r) => r.n / stores);
  return {
    basis,
    stores,
    hhi: hhi(shares),
    topRetailer: counts[0]!.retailer,
    topShare: shares[0]!,
    top3Share: shares.slice(0, 3).reduce((s, x) => s + x, 0),
    retailers: counts.length,
  };
}

/** The council's stores by type and retailer, and its retail concentration (stores assigned to the council by the pipeline). */
export function councilNetwork(stores: readonly NetworkStore[], lad: string): CouncilNetwork {
  const byLayer = emptyLayers();
  const byRetailer = new Map<string, RetailerRow>();
  let total = 0;
  for (const s of stores) {
    if (s.lad !== lad) continue;
    total++;
    byLayer[s.layer]++;
    let row = byRetailer.get(s.retailer);
    if (!row) {
      row = { retailer: s.retailer, total: 0, byLayer: emptyLayers() };
      byRetailer.set(s.retailer, row);
    }
    row.total++;
    row.byLayer[s.layer]++;
  }
  const retailers = [...byRetailer.values()].sort(
    (a, b) => b.total - a.total || a.retailer.localeCompare(b.retailer),
  );
  return {
    lad,
    total,
    byLayer,
    retailers,
    supermarketConcentration: concentration(retailers, ["supermarket"]),
    allConcentration: concentration(retailers, STORE_LAYERS),
  };
}

/**
 * Retailers with a fixed chart colour (categorical slots 1–8): the eight with the most stores in
 * the UK in GEOLYTIX v46 (June 2026). A retailer keeps its colour in every council and in the
 * comparison; every other retailer is "Other retailers" (grey) in charts and listed in the table.
 */
export const RETAILER_SLOTS: readonly string[] = [
  "Tesco",
  "The Co-operative Group",
  "Spar",
  "Morrisons",
  "Sainsburys",
  "Asda",
  "Aldi",
  "Lidl",
];
export const OTHER_RETAILERS = "Other retailers";

/** Chart slices: the slotted retailers present in the council (in slot order), then "Other retailers". */
export function retailerSlices(
  rows: readonly RetailerRow[],
): { retailer: string; slot: number | null; stores: number; members: string[] }[] {
  const out: { retailer: string; slot: number | null; stores: number; members: string[] }[] = [];
  for (const [slot, name] of RETAILER_SLOTS.entries()) {
    const row = rows.find((r) => r.retailer === name);
    if (row && row.total > 0) out.push({ retailer: name, slot, stores: row.total, members: [name] });
  }
  const others = rows.filter((r) => !RETAILER_SLOTS.includes(r.retailer) && r.total > 0);
  if (others.length)
    out.push({
      retailer: OTHER_RETAILERS,
      slot: null,
      stores: others.reduce((s, r) => s + r.total, 0),
      members: others.map((r) => r.retailer),
    });
  return out;
}

// ---------------------------------------------------------------------------------------------
// Straight-line distance from small areas to stores (LP-03, LP-04; FA-02)

export interface GridPoint {
  x: number;
  y: number;
  crs: GridCrs;
}

export interface AreaPoint {
  code: string;
  /** Population-weighted centroid, WGS84. */
  centroid: [number, number];
}

/** The national grid for a council: Irish Transverse Mercator in Northern Ireland, British National Grid elsewhere. */
export function gridForCouncil(lad: string): GridCrs {
  return lad.startsWith("N") ? "EPSG:2157" : "EPSG:27700";
}

/**
 * Straight-line distance (metres) from each area's population-weighted centroid to the nearest
 * store, measured in the council's national grid among stores in the same grid. Areas with no
 * store in that grid get null (never zero).
 */
export function nearestDistances(
  areas: readonly AreaPoint[],
  stores: readonly GridPoint[],
  crs: GridCrs,
): Map<string, number | null> {
  const pts = stores.filter((s) => s.crs === crs);
  const out = new Map<string, number | null>();
  for (const a of areas) {
    const p = toGrid(a.centroid[0], a.centroid[1], crs);
    let best = Infinity;
    for (const s of pts) {
      const dx = s.x - p[0];
      if (Math.abs(dx) >= best) continue;
      const dy = s.y - p[1];
      if (Math.abs(dy) >= best) continue;
      const d = gridDistance(p, [s.x, s.y]);
      if (d < best) best = d;
    }
    out.set(a.code, Number.isFinite(best) ? best : null);
  }
  return out;
}

/** Straight-line thresholds for "population beyond" (spec D6: 1, 2 and 5 km). */
export const DISTANCE_THRESHOLDS_KM = [1, 2, 5] as const;

export interface Beyond {
  thresholdKm: number;
  population: number;
  areas: number;
  /** Share of the population of the areas with a distance (0–1); null when there is none. */
  share: number | null;
  /** Areas without a distance (no store in the grid), counted, never assumed near or far. */
  unknown: number;
}

/** Population living in areas whose centroid is more than `thresholdKm` straight-line from the nearest store. */
export function populationBeyond(
  areas: readonly { code: string; population: number }[],
  distances: ReadonlyMap<string, number | null>,
  thresholdKm: number,
): Beyond {
  let population = 0;
  let total = 0;
  let n = 0;
  let unknown = 0;
  for (const a of areas) {
    const d = distances.get(a.code);
    if (d === null || d === undefined) {
      unknown++;
      continue;
    }
    total += a.population;
    if (d > thresholdKm * 1000) {
      population += a.population;
      n++;
    }
  }
  return { thresholdKm, population, areas: n, share: total > 0 ? population / total : null, unknown };
}

// ---------------------------------------------------------------------------------------------
// Distributions and map classes (LP-04, LP-06)

export interface DecileRow {
  decile: number;
  areas: number;
  /** Population in those areas; null when the geography has no population (Northern Ireland SOAs). */
  population: number | null;
}

/** Areas (and population, when known) in each decile 1–10. Areas without a decile are left out and counted. */
export function decileDistribution(items: readonly { decile: number | null; population?: number | null }[]): {
  rows: DecileRow[];
  missing: number;
} {
  const rows: DecileRow[] = Array.from({ length: 10 }, (_, i) => ({
    decile: i + 1,
    areas: 0,
    population: 0,
  }));
  let missing = 0;
  let withoutPopulation = false;
  for (const it of items) {
    if (it.decile === null || !Number.isInteger(it.decile) || it.decile < 1 || it.decile > 10) {
      missing++;
      continue;
    }
    const row = rows[it.decile - 1]!;
    row.areas++;
    if (typeof it.population === "number") row.population! += it.population;
    else withoutPopulation = true;
  }
  if (withoutPopulation) for (const r of rows) r.population = null;
  return { rows, missing };
}

/**
 * Map class for a decile where decile 1 is the highest priority (or most deprived): five classes,
 * two deciles each, numbered so the highest priority is the last (most salient) class.
 */
export function decileClass(decile: number | null): number | null {
  if (decile === null || !Number.isInteger(decile) || decile < 1 || decile > 10) return null;
  return 4 - Math.floor((decile - 1) / 2);
}

export const DECILE_CLASS_LABELS = [
  "Deciles 9–10",
  "Deciles 7–8",
  "Deciles 5–6",
  "Deciles 3–4",
  "Deciles 1–2",
];

/**
 * Fixed class breaks (spec §7.4) for the small-area map, chosen on 25 Oct 2026 and kept fixed so
 * councils and editions compare: share of households with no car or van, and straight-line km to
 * the nearest supermarket. Values at a break fall in the class above it.
 */
export const NO_CAR_BREAKS = [0.15, 0.3, 0.45, 0.6] as const;
export const DISTANCE_BREAKS_KM = [0.5, 1, 2, 5] as const;

/** Class index 0…breaks.length; null without a value. */
export function breakClass(value: number | null | undefined, breaks: readonly number[]): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  let k = 0;
  while (k < breaks.length && value >= breaks[k]!) k++;
  return k;
}

/** Labels for break classes, e.g. ["under 15 %", "15 % to under 30 %", …, "60 % and over"]. */
export function breakLabels(breaks: readonly number[], fmt: (v: number) => string): string[] {
  const b = breaks.map(fmt);
  return [
    `under ${b[0]}`,
    ...b.slice(0, -1).map((v, i) => `${v} to under ${b[i + 1]}`),
    `${b[b.length - 1]} and over`,
  ];
}

/** Share of households with no car or van (0–1); null when households are unknown or zero. */
export function noCarShare(households: number | null, noCar: number | null): number | null {
  if (households === null || noCar === null || households <= 0) return null;
  return noCar / households;
}

/**
 * Areas whose centroid is more than `thresholdKm` straight-line from the nearest supermarket,
 * farthest first: "potentially underserved" by proximity only. Other measures (car availability,
 * PPFI) are shown beside them, never combined into a score (P10).
 */
export function beyondThreshold<T extends { code: string }>(
  areas: readonly T[],
  distances: ReadonlyMap<string, number | null>,
  thresholdKm: number,
): (T & { metres: number })[] {
  return areas
    .map((a) => ({ ...a, metres: distances.get(a.code) ?? null }))
    .filter((a): a is T & { metres: number } => a.metres !== null && a.metres > thresholdKm * 1000)
    .sort((a, b) => b.metres - a.metres || a.code.localeCompare(b.code));
}

// ---------------------------------------------------------------------------------------------
// Area overview (LP-02)

/** Residents per km² of land; null without population or area. */
export function density(population: number | null, landAreaKm2: number | null): number | null {
  if (population === null || landAreaKm2 === null || landAreaKm2 <= 0) return null;
  return population / landAreaKm2;
}

/** Councils matching a search: name or code, case- and accent-insensitive; names starting with the query first. */
export function searchCouncils<T extends { code: string; name: string }>(
  councils: readonly T[],
  query: string,
  limit = 12,
): T[] {
  const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const q = fold(query);
  if (!q) return [];
  const scored: { c: T; rank: number }[] = [];
  for (const c of councils) {
    const name = fold(c.name);
    const code = c.code.toLowerCase();
    let rank = -1;
    if (code === q) rank = 0;
    else if (name.startsWith(q)) rank = 1;
    else if (name.split(/[\s,-]+/).some((w) => w.startsWith(q))) rank = 2;
    else if (name.includes(q) || code.startsWith(q)) rank = 3;
    if (rank >= 0) scored.push({ c, rank });
  }
  scored.sort((a, b) => a.rank - b.rank || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((s) => s.c);
}

// ---------------------------------------------------------------------------------------------
// National context (LP-05): UK-wide recorded imports, never a council's own supply chain (P6)

export interface NationalImports {
  /** "12 months to …" label of the period. */
  periodLabel: string;
  /** Recorded imports allocated to countries over the period, tonnes. */
  tonnes: number;
  partners: number;
  topPartner: string | null;
  /** Largest recorded import partner's share by net mass (0–1). */
  topShare: number | null;
  /** HHI of partner shares by net mass, 0–10,000. */
  hhi: number | null;
  /** The period includes provisional months (HMRC revises them for up to 18 months). */
  provisional: boolean;
}

/**
 * The latest 12 months of recorded imports for one basket: partner count, the largest partner's
 * share and HHI by net mass (the Food Origins definitions, spec §6.2). National: the same for
 * every council.
 */
export function nationalImports(
  snapshot: TradeSnapshot,
  provisionalFrom: MonthKey | null,
): NationalImports | null {
  const period = resolvePeriod(
    { mode: "rolling12", year: null, month: null },
    { first: snapshot.months.first, last: snapshot.months.last },
  );
  const agg = aggregatePeriod(snapshot, period.available);
  const shares = partnerShares(agg.partners, "mass");
  if (shares.length === 0) return null;
  return {
    periodLabel: period.label,
    tonnes: agg.allocated.kg / 1000,
    partners: shares.length,
    topPartner: shares[0]!.name,
    topShare: shares[0]!.share,
    hhi: hhi(shares.map((s) => s.share)),
    provisional: period.available.some((m) => isProvisional(m, provisionalFrom)),
  };
}
