/**
 * Risk Explorer indicators (Stage 6; spec §5.6 RK-02 – RK-04, §6.2). Pure functions: no React,
 * ArcGIS or DOM imports. Inputs are the published `trade` and `risk` datasets.
 *
 * Integrity rules (spec P2, P8, P10, P12): concentration describes recorded import partners (HMRC's
 * country of dispatch), never where food is grown; "exposure" is a partner's observed share of
 * recorded imports, never a prediction of a shortage; water stress is a national figure for the
 * whole country; no function here combines indicators into one score.
 */
import {
  aggregatePeriod,
  concentrationRatio,
  hhi,
  isProvisional,
  measureValue,
  monthKey,
  monthList,
  parseMonthKey,
  partnerShares,
  type Measure,
  type MonthKey,
  type PartnerShare,
} from "./trade";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";

// ---------------------------------------------------------------------------------------------
// International supply exposure (RK-02)
// ---------------------------------------------------------------------------------------------

export interface MonthConcentration {
  month: MonthKey;
  /** Recorded imports allocated to partner countries (tonnes or £). */
  allocated: number;
  partners: number;
  /** HHI of partner shares (0–10,000); null when nothing was recorded (a nil month). */
  hhi: number | null;
  top: { key: string; name: string; share: number } | null;
  provisional: boolean;
}

/** HHI, partner count and largest partner for each month (the monthly concentration heatmap). */
export function monthlyConcentration(
  snapshot: TradeSnapshot,
  measure: Measure,
  months: readonly MonthKey[] = monthList(snapshot.months.first, snapshot.months.last),
): MonthConcentration[] {
  return months.map((month) => {
    const agg = aggregatePeriod(snapshot, [month]);
    const shares = partnerShares(agg.partners, measure);
    const top = shares[0];
    return {
      month,
      allocated: measureValue(agg.allocated, measure),
      partners: shares.length,
      hhi: hhi(shares.map((s) => s.share)),
      top: top ? { key: top.key, name: top.name, share: top.share } : null,
      provisional: isProvisional(month, snapshot.months.provisionalFrom),
    };
  });
}

export interface YearSummary {
  year: number;
  /** All recorded imports (allocated, unallocated and unsuppressed), tonnes or £. */
  total: number;
  /** Months of the year in the snapshot (12 for a complete year). */
  months: number;
  complete: boolean;
  provisional: boolean;
  partners: number;
  hhi: number | null;
  cr1: number | null;
  cr3: number | null;
}

/** Calendar-year totals and concentration for every year in the snapshot (the import trend). */
export function annualSummary(snapshot: TradeSnapshot, measure: Measure): YearSummary[] {
  const all = monthList(snapshot.months.first, snapshot.months.last);
  const years = [...new Set(all.map((m) => parseMonthKey(m).year))];
  return years.map((year) => {
    const months = all.filter((m) => parseMonthKey(m).year === year);
    const agg = aggregatePeriod(snapshot, months);
    const shares = partnerShares(agg.partners, measure);
    return {
      year,
      total: measureValue(agg.grandTotal, measure),
      months: months.length,
      complete: months.length === 12,
      provisional: months.some((m) => isProvisional(m, snapshot.months.provisionalFrom)),
      partners: shares.length,
      hhi: hhi(shares.map((s) => s.share)),
      cr1: concentrationRatio(shares, 1),
      cr3: concentrationRatio(shares, 3),
    };
  });
}

/**
 * Fixed HHI classes for the concentration heatmap and ranking (spec §7.4: manual breaks, the same in
 * every view): below 1,000, then 1,000-wide bands to 5,000 and over. Numbers only; no class is
 * called "high" or "low" (antitrust thresholds do not transfer to supply).
 */
export const HHI_BREAKS = [1000, 2000, 3000, 4000, 5000] as const;

export function hhiClass(h: number | null): number | null {
  if (h === null || !Number.isFinite(h)) return null;
  let c = 0;
  for (const b of HHI_BREAKS) if (h >= b) c += 1;
  return c;
}

export interface CommodityConcentration {
  id: string;
  label: string;
  hhi: number | null;
  cr1: number | null;
  cr3: number | null;
  partners: number;
  top: { key: string; name: string } | null;
}

/** Commodities by partner concentration, most concentrated first (no data last, then by label). */
export function rankByConcentration(rows: readonly CommodityConcentration[]): CommodityConcentration[] {
  return [...rows].sort((a, b) => {
    if (a.hhi === null || b.hhi === null) return a.hhi === null ? (b.hhi === null ? 0 : 1) : -1;
    return b.hhi - a.hhi || a.label.localeCompare(b.label);
  });
}

export interface ExposureMatrix {
  commodities: { id: string; label: string }[];
  partners: { key: string; name: string }[];
  /** cells[partner][commodity]: share 0–1 (0 = none recorded); null when the commodity has no data. */
  cells: (number | null)[][];
}

/**
 * Commodity × partner matrix of shares of recorded imports: the union of each commodity's top
 * `top` partners, ordered by their largest share across commodities (ties by key).
 */
export function exposureMatrix(
  inputs: readonly { id: string; label: string; shares: readonly PartnerShare[] }[],
  top = 6,
): ExposureMatrix {
  const best = new Map<string, { name: string; share: number }>();
  for (const c of inputs)
    for (const s of c.shares.slice(0, top)) {
      const prev = best.get(s.key);
      if (!prev || s.share > prev.share) best.set(s.key, { name: s.name, share: s.share });
    }
  const partners = [...best.entries()]
    .sort((a, b) => b[1].share - a[1].share || a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ key, name: v.name }));
  const cells = partners.map((p) =>
    inputs.map((c) => {
      if (c.shares.length === 0) return null;
      return c.shares.find((s) => s.key === p.key)?.share ?? 0;
    }),
  );
  return { commodities: inputs.map((c) => ({ id: c.id, label: c.label })), partners, cells };
}

export interface DisruptionMonth {
  month: MonthKey;
  /** The partner's share of recorded imports allocated to countries; null in a nil month. */
  share: number | null;
  partnerValue: number;
  allocated: number;
  provisional: boolean;
}

export interface DisruptionExposure {
  partnerKey: string;
  months: DisruptionMonth[];
  /** The partner's share over the whole set of months (null when nothing was recorded). */
  periodShare: number | null;
  peak: DisruptionMonth | null;
  /** Months in which the partner supplied at least half of recorded imports. */
  monthsAtLeastHalf: number;
  monthsWithShare: number;
}

/**
 * Estimated exposure to a disruption of one recorded partner: its observed share of recorded
 * imports, month by month. It is not a shortage: other partners, stocks or UK production may
 * substitute, and nothing here assumes they would or would not (the Scenario Lab models that).
 */
export function disruptionExposure(
  snapshot: TradeSnapshot,
  measure: Measure,
  partnerKey: string,
  months: readonly MonthKey[],
): DisruptionExposure {
  const rows: DisruptionMonth[] = months.map((month) => {
    const agg = aggregatePeriod(snapshot, [month]);
    const allocated = measureValue(agg.allocated, measure);
    const p = agg.partners.find((x) => x.key === partnerKey);
    const partnerValue = p ? measureValue(p, measure) : 0;
    return {
      month,
      share: allocated > 0 ? partnerValue / allocated : null,
      partnerValue,
      allocated,
      provisional: isProvisional(month, snapshot.months.provisionalFrom),
    };
  });
  const withShare = rows.filter((r) => r.share !== null);
  const totalAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  const totalPartner = rows.reduce((s, r) => s + r.partnerValue, 0);
  const peak = withShare.reduce<DisruptionMonth | null>(
    (best, r) => (best === null || (r.share ?? 0) > (best.share ?? 0) ? r : best),
    null,
  );
  return {
    partnerKey,
    months: rows,
    periodShare: totalAllocated > 0 ? totalPartner / totalAllocated : null,
    peak,
    monthsAtLeastHalf: withShare.filter((r) => (r.share ?? 0) >= 0.5).length,
    monthsWithShare: withShare.length,
  };
}

/** FAO SDG 6.4.2 classes of water stress (S30), lowest first. */
export const STRESS_CLASSES = ["none", "low", "medium", "high", "critical"] as const;
export type StressClass = (typeof STRESS_CLASSES)[number];

export const STRESS_LABELS: Record<StressClass | "noData", string> = {
  none: "No stress (below 25 %)",
  low: "Low (25–50 %)",
  medium: "Medium (50–75 %)",
  high: "High (75–100 %)",
  critical: "Critical (above 100 %)",
  noData: "No data",
};

/**
 * FAO class of a water-stress value (% of available freshwater withdrawn). A value on a threshold
 * takes the higher class, except 100 %, which is high (critical is above 100 %). Mirrors the
 * pipeline (config/risk.json); the published class is used for display.
 */
export function stressClassOf(value: number): StressClass {
  if (!Number.isFinite(value) || value < 0) throw new Error(`invalid water stress ${value}`);
  if (value < 25) return "none";
  if (value < 50) return "low";
  if (value < 75) return "medium";
  if (value <= 100) return "high";
  return "critical";
}

export interface StressInfo {
  class: StressClass;
  value: number;
  year: number;
}

export interface StressExposure {
  /** Share of recorded imports from partners in each class, and from partners without a value. */
  byClass: Record<StressClass | "noData", number>;
  /** Share from partners in the high or critical classes. */
  highOrCritical: number;
  partners: Record<StressClass | "noData", string[]>;
}

/**
 * How recorded imports split across partners' national water-stress classes. A partner's class
 * describes its whole country; this says where recorded partners sit, not how the produce was grown.
 */
export function waterStressExposure(
  shares: readonly PartnerShare[],
  iso2Of: (key: string) => string | null,
  stress: ReadonlyMap<string, StressInfo>,
): StressExposure {
  const byClass: Record<StressClass | "noData", number> = {
    none: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
    noData: 0,
  };
  const partners: Record<StressClass | "noData", string[]> = {
    none: [],
    low: [],
    medium: [],
    high: [],
    critical: [],
    noData: [],
  };
  for (const s of shares) {
    const iso2 = iso2Of(s.key);
    const info = iso2 ? stress.get(iso2) : undefined;
    const cls = info ? info.class : "noData";
    byClass[cls] += s.share;
    partners[cls].push(s.key);
  }
  return { byClass, highOrCritical: byClass.high + byClass.critical, partners };
}

// ---------------------------------------------------------------------------------------------
// Logistics and infrastructure (RK-03)
// ---------------------------------------------------------------------------------------------

/** Port tonnage measures (DfT PORT0499, thousand tonnes). */
export const PORT_MEASURES = ["international", "agricultural", "roro"] as const;
export type PortMeasure = (typeof PORT_MEASURES)[number];

/** The subset of a published port the functions need. */
export interface PortSeriesInput {
  inwardsByRegion: Record<string, (number | null)[]>;
  inwardsByGroup: Record<string, (number | null)[]>;
  agriculturalInwardsByRegion: Record<string, (number | null)[]>;
}

export interface PortRegions {
  domestic: string;
  unspecified: string;
}

export const RO_RO_GROUPS = ["Ro-Ro Self Propelled", "Ro-Ro Non-Self Propelled"] as const;

function sumAt(
  record: Record<string, (number | null)[]>,
  i: number,
  include: (key: string) => boolean,
): number | null {
  let total = 0;
  let any = false;
  for (const [key, series] of Object.entries(record)) {
    if (!include(key)) continue;
    const v = series[i];
    if (v === null || v === undefined) continue;
    any = true;
    total += v;
  }
  return any ? total : null;
}

/**
 * A port's yearly series for a measure (thousand tonnes); null for a year the port did not report.
 * - international: inwards loaded abroad (excludes UK coastwise and unspecified origins);
 * - agricultural: inwards of agricultural products (grain, soya, tapioca…) loaded abroad;
 * - roro: inwards in roll-on/roll-off units, any origin (DfT records no commodity for them).
 */
export function portSeries(
  port: PortSeriesInput,
  measure: PortMeasure,
  regions: PortRegions,
): (number | null)[] {
  const n = Object.values(port.inwardsByRegion)[0]?.length ?? 0;
  const abroad = (key: string) => key !== regions.domestic && key !== regions.unspecified;
  return Array.from({ length: n }, (_, i) => {
    if (measure === "international") return sumAt(port.inwardsByRegion, i, abroad);
    if (measure === "agricultural") return sumAt(port.agriculturalInwardsByRegion, i, abroad);
    return sumAt(port.inwardsByGroup, i, (g) => (RO_RO_GROUPS as readonly string[]).includes(g));
  });
}

/** Symbol radius in px for a value: area proportional to the value (√ scaling), from the largest. */
export function proportionalRadius(value: number | null, max: number, minPx = 3, maxPx = 26): number {
  if (value === null || !(value > 0) || !(max > 0)) return 0;
  return Math.max(minPx, maxPx * Math.sqrt(Math.min(value, max) / max));
}

/** Farming measures (Defra June survey, S31) and their densities over the region's area. */
export const FARM_MEASURES = ["wheat", "cattle", "sheep", "pigs", "poultry"] as const;
export type FarmMeasure = (typeof FARM_MEASURES)[number];

/**
 * Density of a farming measure over the region's area: livestock and poultry per km²; for wheat
 * (hectares) the same quotient is the percentage of the region's area under wheat, because
 * 1 km² = 100 ha: (ha ÷ (km² × 100)) × 100 % = ha ÷ km². Null without a positive area.
 */
export function farmDensity(value: number, areaKm2: number): number | null {
  if (!(areaKm2 > 0) || !Number.isFinite(value) || value < 0) return null;
  return value / areaKm2;
}

/**
 * Fixed class breaks per measure (four breaks, five classes), set by hand on the 2025 values of the
 * 11 regions so that each class is used (spec §7.4: manual breaks, the same in every view).
 */
export const FARM_BREAKS: Record<FarmMeasure, readonly [number, number, number, number]> = {
  wheat: [2, 5, 10, 15],
  cattle: [20, 30, 50, 70],
  sheep: [50, 100, 150, 250],
  pigs: [5, 10, 20, 60],
  poultry: [250, 500, 1000, 1500],
};

export const FARM_UNITS: Record<FarmMeasure, string> = {
  wheat: "% of the region's area",
  cattle: "cattle per km²",
  sheep: "sheep per km²",
  pigs: "pigs per km²",
  poultry: "birds per km²",
};

/** Class 0–4 of a value against four ascending breaks (a value on a break takes the higher class). */
export function breakClass(value: number, breaks: readonly number[]): number {
  let c = 0;
  for (const b of breaks) if (value >= b) c += 1;
  return c;
}

// ---------------------------------------------------------------------------------------------
// Community food access (RK-04): Priority Places for Food Index by council
// ---------------------------------------------------------------------------------------------

export interface PriorityCount {
  priority: number;
  areas: number;
}

export interface CouncilPriorityInput {
  code: string;
  name: string;
  nation: string;
  areas: number;
  values: Record<string, PriorityCount | null>;
}

export interface CouncilPriority {
  code: string;
  name: string;
  nation: string;
  areas: number;
  priority: number | null;
  /** Share of the council's small areas in the nation's deciles 1–2; null when the measure has no data. */
  share: number | null;
}

/** Each council's share of small areas in its nation's highest-priority deciles for one measure. */
export function councilPriority(
  councils: readonly CouncilPriorityInput[],
  measure: string,
): CouncilPriority[] {
  return councils.map((c) => {
    const v = c.values[measure] ?? null;
    return {
      code: c.code,
      name: c.name,
      nation: c.nation,
      // The measure's own denominator where it has data (equal to the council's areas in the
      // published file, but the schema does not enforce it), so pooled shares stay consistent.
      areas: v ? v.areas : c.areas,
      priority: v ? v.priority : null,
      share: v && v.areas > 0 ? v.priority / v.areas : null,
    };
  });
}

export interface NationRank {
  rank: number;
  /** Councils ranked in the same nation (those with data). */
  of: number;
  /** True when another council in the nation has the same share. */
  tied: boolean;
}

/**
 * Ranks councils within their own nation only (P11), highest share first, by standard competition
 * ranking (equal shares share a rank: 1, 2, 2, 4). Councils without data are not ranked.
 */
export function rankWithinNation(rows: readonly CouncilPriority[]): Map<string, NationRank> {
  const out = new Map<string, NationRank>();
  const nations = [...new Set(rows.map((r) => r.nation))];
  for (const nation of nations) {
    const ranked = rows
      .filter((r) => r.nation === nation && r.share !== null)
      .sort((a, b) => b.share! - a.share! || a.code.localeCompare(b.code));
    for (const r of ranked) {
      const first = ranked.findIndex((x) => x.share === r.share);
      const tied = ranked.filter((x) => x.share === r.share).length > 1;
      out.set(r.code, { rank: first + 1, of: ranked.length, tied });
    }
  }
  return out;
}

/**
 * Fixed classes of the priority share (spec §7.4): 0 = none of the council's areas; then below
 * 10 %, 10–20 %, 20–30 %, 30–50 %, 50 % and over. By construction about 20 % of each nation's
 * areas are in its deciles 1–2, so class 3 starts at the nation's own average.
 */
export const PRIORITY_BREAKS = [0.1, 0.2, 0.3, 0.5] as const;

export function priorityClass(share: number | null): number | null {
  if (share === null || !Number.isFinite(share)) return null;
  if (share <= 0) return 0;
  return 1 + breakClass(share, PRIORITY_BREAKS);
}

/** Councils with fewer small areas than this get a "few areas" caution (a share moves in big steps). */
export const FEW_AREAS = 10;

export interface GroupSummary {
  group: string;
  councils: number;
  /** Median of the councils' shares (councils with data). */
  median: number | null;
  /** Share of all the group's small areas that are in deciles 1–2 (pooled). */
  pooled: number | null;
}

/** Median and pooled shares for groups of councils (e.g. urban and rural, within one nation). */
export function groupSummary(
  rows: readonly CouncilPriority[],
  groupOf: (code: string) => string | null,
): GroupSummary[] {
  const groups = new Map<string, CouncilPriority[]>();
  for (const r of rows) {
    const g = groupOf(r.code);
    if (g === null || r.share === null) continue;
    groups.set(g, [...(groups.get(g) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([group, list]) => {
      const shares = list.map((r) => r.share!).sort((a, b) => a - b);
      const mid = Math.floor(shares.length / 2);
      const median = shares.length % 2 ? shares[mid]! : (shares[mid - 1]! + shares[mid]!) / 2;
      const areas = list.reduce((s, r) => s + r.areas, 0);
      const priority = list.reduce((s, r) => s + (r.priority ?? 0), 0);
      return { group, councils: list.length, median, pooled: areas > 0 ? priority / areas : null };
    })
    .sort((a, b) => a.group.localeCompare(b.group));
}

/** Months of a calendar year present in a list (for "to Aug" labels). */
export function yearMonths(year: number, months: readonly MonthKey[]): MonthKey[] {
  const keys = new Set(Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1)));
  return months.filter((m) => keys.has(m));
}
