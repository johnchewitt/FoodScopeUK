/**
 * Seasonal Supply indicators (spec §5.2, §6.2 "Seasonality"). Pure functions: no React, ArcGIS
 * or DOM imports. Inputs are the same trade snapshots the Food Origins explorer uses, so a month
 * here and the same month in Food Origins are computed from identical records.
 *
 * Conventions:
 * - A calendar year is always 12 months, January first. Each month has a state: published (with
 *   records), nil (published, no recorded imports), not yet published, or before the snapshot.
 *   Values for months that are not published or before the snapshot are `null`, never 0 (P12).
 * - "Total" = all recorded imports (country partners + HMRC non-country categories + published
 *   suppressed amounts), as in the Food Origins KPI. Shares and HHI use trade allocated to
 *   countries only (§6.2).
 * - Annual figures (seasonality, a month's share of its year) need all 12 months; otherwise they
 *   are null with a reason. Year-on-year comparisons use like-for-like months only.
 */
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import type { SERIES_BREAKS } from "./trade";
import {
  hhi,
  isProvisional,
  monthDiff,
  monthKey,
  parseMonthKey,
  seriesBreaksWithin,
  type Measure,
  type MonthKey,
} from "./trade";

export type MonthState = "published" | "nil" | "not_yet_published" | "before_snapshot";

export interface MonthInfo {
  key: MonthKey;
  /** Calendar month 1–12. */
  month: number;
  state: MonthState;
  /** Inside HMRC's 18-month revision window (only for published or nil months). */
  provisional: boolean;
}

/** Published (with or without records): values are real numbers, possibly zero. */
export function isAvailable(info: MonthInfo): boolean {
  return info.state === "published" || info.state === "nil";
}

/** Years covered by the snapshot, earliest first. */
export function snapshotYears(snapshot: TradeSnapshot): number[] {
  const a = parseMonthKey(snapshot.months.first).year;
  const b = parseMonthKey(snapshot.months.last).year;
  return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
}

export function yearMonthInfo(snapshot: TradeSnapshot, year: number): MonthInfo[] {
  const { first, last, provisionalFrom } = snapshot.months;
  const nil = new Set(snapshot.nilMonths);
  return Array.from({ length: 12 }, (_, i) => {
    const key = monthKey(year, i + 1);
    let state: MonthState;
    if (monthDiff(key, first) > 0) state = "before_snapshot";
    else if (monthDiff(last, key) > 0) state = "not_yet_published";
    else state = nil.has(monthDiff(first, key)) ? "nil" : "published";
    const available = state === "published" || state === "nil";
    return { key, month: i + 1, state, provisional: available && isProvisional(key, provisionalFrom) };
  });
}

// ---------------------------------------------------------------------------------------------
// Year matrix: one calendar year, month × partner
// ---------------------------------------------------------------------------------------------

export interface YearMatrix {
  year: number;
  measure: Measure;
  months: MonthInfo[];
  /** All recorded imports per month; null when the month is not available. */
  total: (number | null)[];
  /** Trade allocated to country partners per month (share denominator); null when not available. */
  allocated: (number | null)[];
  /** Country partners with any trade in the year: value per month (0 = none recorded, null = month not available). */
  partners: Map<string, (number | null)[]>;
  names: Map<string, string>;
}

function measureOf(kg: number, gbp: number, measure: Measure): number {
  return measure === "mass" ? kg / 1000 : gbp;
}

export function yearMatrix(snapshot: TradeSnapshot, year: number, measure: Measure): YearMatrix {
  const months = yearMonthInfo(snapshot, year);
  const startIndex = monthDiff(snapshot.months.first, monthKey(year, 1));
  const avail = months.map(isAvailable);
  const blank = (): (number | null)[] => avail.map((a) => (a ? 0 : null));
  const total = blank();
  const allocated = blank();
  const partners = new Map<string, (number | null)[]>();
  const names = new Map<string, string>();

  for (const [m, p, kg, gbp] of snapshot.rows) {
    const i = m - startIndex;
    if (i < 0 || i > 11 || !avail[i]) continue;
    const partner = snapshot.partners[p];
    if (!partner) continue;
    const v = measureOf(kg, gbp, measure);
    total[i] = (total[i] ?? 0) + v;
    if (partner.kind !== "country") continue;
    allocated[i] = (allocated[i] ?? 0) + v;
    let series = partners.get(partner.key);
    if (!series) {
      series = blank();
      partners.set(partner.key, series);
      names.set(partner.key, partner.name);
    }
    series[i] = (series[i] ?? 0) + v;
  }
  for (const [m, , kg, gbp] of snapshot.suppressed) {
    if (m === null) continue;
    const i = m - startIndex;
    if (i < 0 || i > 11 || !avail[i]) continue;
    const v = measure === "mass" ? (kg === null ? 0 : kg / 1000) : (gbp ?? 0);
    total[i] = (total[i] ?? 0) + v;
  }
  return { year, measure, months, total, allocated, partners, names };
}

/** Share of the month's allocated trade, per partner and month (null where the month is unavailable or has none). */
export function monthShares(matrix: YearMatrix): Map<string, (number | null)[]> {
  const out = new Map<string, (number | null)[]>();
  for (const [key, values] of matrix.partners) {
    out.set(
      key,
      values.map((v, i) => {
        const d = matrix.allocated[i];
        return v === null || d === null || d === undefined || d <= 0 ? null : v / d;
      }),
    );
  }
  return out;
}

/** HHI per month (SS-06); null where the month is unavailable or has no allocated trade. */
export function monthlyHhi(matrix: YearMatrix): (number | null)[] {
  const shares = [...monthShares(matrix).values()];
  return matrix.months.map((_, i) => {
    const d = matrix.allocated[i];
    if (d === null || d === undefined || d <= 0) return null;
    return hhi(shares.map((s) => s[i] ?? 0).filter((s) => s > 0));
  });
}

export interface RankedPartners {
  keys: string[];
  /** Partners with trade in the year beyond the top N. */
  othersCount: number;
}

/** Partners ranked by their total over the year's available months (ties by key). */
export function topPartnersForYear(matrix: YearMatrix, n: number): RankedPartners {
  const ranked = [...matrix.partners.entries()]
    .map(([key, values]) => ({ key, sum: values.reduce<number>((s, v) => s + (v ?? 0), 0) }))
    .filter((r) => r.sum > 0)
    .sort((a, b) => b.sum - a.sum || a.key.localeCompare(b.key));
  const k = Math.max(0, Math.floor(n));
  return { keys: ranked.slice(0, k).map((r) => r.key), othersCount: Math.max(0, ranked.length - k) };
}

// ---------------------------------------------------------------------------------------------
// Year-on-year comparison
// ---------------------------------------------------------------------------------------------

/** Relative change per month; null where either year is unavailable or the base is zero. */
export function monthlyChanges(current: (number | null)[], previous: (number | null)[]): (number | null)[] {
  return current.map((c, i) => {
    const p = previous[i];
    if (c === null || p === null || p === undefined || p === 0) return null;
    return (c - p) / p;
  });
}

export interface LikeForLike {
  /** Calendar-month indexes (0–11) available in both years. */
  months: number[];
  current: number;
  previous: number;
  change: number | null;
}

/** Totals over the months available in both years (e.g. Jan–Aug 2026 vs Jan–Aug 2025). */
export function likeForLike(current: (number | null)[], previous: (number | null)[]): LikeForLike | null {
  const months = current
    .map((c, i) => (c !== null && previous[i] !== null && previous[i] !== undefined ? i : -1))
    .filter((i) => i >= 0);
  if (months.length === 0) return null;
  const cur = months.reduce((s, i) => s + (current[i] ?? 0), 0);
  const prev = months.reduce((s, i) => s + (previous[i] ?? 0), 0);
  return { months, current: cur, previous: prev, change: prev === 0 ? null : (cur - prev) / prev };
}

/** Change in share, percentage points; null where either share is unavailable. A partner absent in one month has share 0 there. */
export function shareChangePp(
  current: number | null | undefined,
  previous: number | null | undefined,
  currentAvailable: boolean,
  previousAvailable: boolean,
): number | null {
  if (!currentAvailable || !previousAvailable) return null;
  return 100 * ((current ?? 0) - (previous ?? 0));
}

// ---------------------------------------------------------------------------------------------
// Seasonality (§6.2): needs a complete year
// ---------------------------------------------------------------------------------------------

export interface Seasonality {
  complete: boolean;
  /** Months available (published or nil). */
  availableMonths: number;
  annual: number | null;
  peakMonth: number | null;
  peakShare: number | null;
  troughMonth: number | null;
  troughShare: number | null;
  /** Coefficient of variation of monthly totals (population standard deviation ÷ mean). */
  cv: number | null;
}

export function seasonality(total: (number | null)[]): Seasonality {
  const available = total.filter((v): v is number => v !== null);
  const complete = total.length === 12 && available.length === 12;
  const empty: Seasonality = {
    complete,
    availableMonths: available.length,
    annual: null,
    peakMonth: null,
    peakShare: null,
    troughMonth: null,
    troughShare: null,
    cv: null,
  };
  if (!complete) return empty;
  const annual = available.reduce((s, v) => s + v, 0);
  if (annual <= 0) return { ...empty, annual };
  let peak = 0;
  let trough = 0;
  available.forEach((v, i) => {
    if (v > available[peak]!) peak = i;
    if (v < available[trough]!) trough = i;
  });
  const mean = annual / 12;
  const sd = Math.sqrt(available.reduce((s, v) => s + (v - mean) ** 2, 0) / 12);
  return {
    complete,
    availableMonths: 12,
    annual,
    peakMonth: peak + 1,
    peakShare: available[peak]! / annual,
    troughMonth: trough + 1,
    troughShare: available[trough]! / annual,
    cv: sd / mean,
  };
}

/** One month's share of its calendar year; null unless all 12 months are available. */
export function monthShareOfYear(total: (number | null)[], month: number): number | null {
  const s = seasonality(total);
  const v = total[month - 1];
  if (!s.complete || s.annual === null || s.annual <= 0 || v === null || v === undefined) return null;
  return v / s.annual;
}

// ---------------------------------------------------------------------------------------------
// Fixed classes for the heatmap (P11, spec §7.4: identical breaks for every year)
// ---------------------------------------------------------------------------------------------

/** Tonnes per partner and month; the same for every commodity and year. */
export const MASS_BREAKS_T: readonly number[] = [10, 100, 1_000, 5_000, 20_000];
/** £ per partner and month; the same for every commodity and year. */
export const VALUE_BREAKS_GBP: readonly number[] = [10_000, 100_000, 1_000_000, 5_000_000, 20_000_000];
/**
 * Change in share, percentage points: two classes each side of a neutral −1 to +1 pp class.
 * (Three per side were tried; the inner steps of the two sides could not be told apart under
 * simulated deuteranopia on the dark panel — stage 3 report, colour checks.)
 */
export const CHANGE_BREAKS_PP: readonly number[] = [-5, -1, 1, 5];

/** Class 0–5 for a positive amount (0 = below the first break). */
export function amountClass(value: number, measure: Measure): number {
  const breaks = measure === "mass" ? MASS_BREAKS_T : VALUE_BREAKS_GBP;
  let c = 0;
  for (const b of breaks) if (value >= b) c += 1;
  return c;
}

/** Class 0–4 for a change in percentage points; 2 is the neutral class (−1 ≤ pp < +1). */
export function changeClass(pp: number): number {
  let c = 0;
  for (const b of CHANGE_BREAKS_PP) if (pp >= b) c += 1;
  return c;
}

// ---------------------------------------------------------------------------------------------
// Flow width scale fixed across months and years (SS-02)
// ---------------------------------------------------------------------------------------------

export interface FlowScale {
  value: number;
  key: string;
  name: string;
  month: MonthKey;
}

/**
 * The largest single-partner monthly value in the whole snapshot among partners that can be
 * drawn as a connection (map geometry, not the UK). Seasonal connection widths use it as the
 * 12 px end of the scale, so a width means the same tonnage (or £) in every month and year.
 */
export function maxMonthlyPartnerValue(snapshot: TradeSnapshot, measure: Measure): FlowScale | null {
  let best: { m: number; p: number; v: number } | null = null;
  for (const [m, p, kg, gbp] of snapshot.rows) {
    const partner = snapshot.partners[p];
    if (!partner || partner.kind !== "country" || partner.geometry === "none" || partner.key === "GB")
      continue;
    const v = measureOf(kg, gbp, measure);
    if (!best || v > best.v) best = { m, p, v };
  }
  if (!best || best.v <= 0) return null;
  const partner = snapshot.partners[best.p]!;
  const { year, month } = parseMonthKey(snapshot.months.first);
  const n = year * 12 + (month - 1) + best.m;
  return {
    value: best.v,
    key: partner.key,
    name: partner.name,
    month: monthKey(Math.floor(n / 12), (n % 12) + 1),
  };
}

/**
 * The largest monthly total of recorded imports in the snapshot: the fixed scale for the
 * timeline's month bars, so a bar means the same amount in every year.
 */
export function maxMonthlyTotal(snapshot: TradeSnapshot, measure: Measure): number {
  const totals = new Map<number, number>();
  for (const [m, , kg, gbp] of snapshot.rows)
    totals.set(m, (totals.get(m) ?? 0) + measureOf(kg, gbp, measure));
  for (const [m, , kg, gbp] of snapshot.suppressed) {
    if (m === null) continue;
    const v = measure === "mass" ? (kg === null ? 0 : kg / 1000) : (gbp ?? 0);
    totals.set(m, (totals.get(m) ?? 0) + v);
  }
  return Math.max(0, ...totals.values());
}

// ---------------------------------------------------------------------------------------------
// Commodity codes (nomenclature changes and seasonal codes)
// ---------------------------------------------------------------------------------------------

export interface CodeRef {
  code: string;
  description: string;
}

export interface CodeChange {
  month: MonthKey;
  ended: CodeRef[];
  started: CodeRef[];
}

function codeRefs(snapshot: TradeSnapshot, codes: readonly string[]): CodeRef[] {
  const byCode = new Map(snapshot.commodity.cn8.map((c) => [c.code, c.description]));
  return codes.map((code) => ({ code, description: byCode.get(code) ?? "" }));
}

/** Code changes recorded by the pipeline, optionally limited to months in [start, end]. */
export function codeChanges(snapshot: TradeSnapshot, start?: MonthKey, end?: MonthKey): CodeChange[] {
  return (snapshot.codeChanges ?? [])
    .filter(
      (c) =>
        (start === undefined || monthDiff(start, c.month) >= 0) &&
        (end === undefined || monthDiff(c.month, end) >= 0),
    )
    .map((c) => ({
      month: c.month,
      ended: codeRefs(snapshot, c.ended),
      started: codeRefs(snapshot, c.started),
    }));
}

export interface SeasonalCode extends CodeRef {
  /** Smallest set of calendar months holding at least `coverage` of the code's net mass. */
  months: number[];
  coverage: number;
  /** The code's share of the basket's net mass over the snapshot. */
  shareOfBasket: number;
}

/**
 * Codes whose recorded net mass is concentrated in a few calendar months (e.g. HMRC's "new
 * potatoes from 1 January to 30 June"), using the pipeline's per-calendar-month totals. A code
 * qualifies when it has records in at least 24 months and 99 % of its net mass falls within at
 * most nine calendar months.
 */
export function seasonalCodes(snapshot: TradeSnapshot, threshold = 0.99): SeasonalCode[] {
  const basketKg = snapshot.commodity.cn8.reduce(
    (s, c) => s + (c.netMassKgByCalendarMonth?.reduce((a, b) => a + b, 0) ?? 0),
    0,
  );
  const out: SeasonalCode[] = [];
  for (const c of snapshot.commodity.cn8) {
    const kg = c.netMassKgByCalendarMonth;
    if (!kg || (c.monthsRecorded ?? 0) < 24) continue;
    const total = kg.reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    const order = kg.map((v, i) => ({ v, m: i + 1 })).sort((a, b) => b.v - a.v || a.m - b.m);
    const months: number[] = [];
    let acc = 0;
    for (const { v, m } of order) {
      if (acc / total >= threshold) break;
      months.push(m);
      acc += v;
    }
    if (months.length > 9) continue;
    out.push({
      code: c.code,
      description: c.description,
      months: months.sort((a, b) => a - b),
      coverage: acc / total,
      shareOfBasket: basketKg > 0 ? total / basketKg : 0,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Comparability between two years (P11)
// ---------------------------------------------------------------------------------------------

export interface Comparability {
  /** Series breaks between the comparison year and the selected year (same calendar month). */
  seriesBreaks: typeof SERIES_BREAKS;
  /**
   * Commodity-code changes that affect the view: within the selected year when there is no
   * comparison; otherwise from February of the earlier year to December of the later one (a change
   * in January of the earlier year applies to both years alike).
   */
  codeChanges: CodeChange[];
}

export function comparability(
  snapshot: TradeSnapshot,
  year: number,
  compareYear: number | null,
): Comparability {
  if (compareYear === null) {
    return { seriesBreaks: [], codeChanges: codeChanges(snapshot, monthKey(year, 1), monthKey(year, 12)) };
  }
  const lo = Math.min(year, compareYear);
  const hi = Math.max(year, compareYear);
  return {
    seriesBreaks: seriesBreaksWithin(monthKey(lo, 1), monthKey(hi, 1)),
    codeChanges: codeChanges(snapshot, monthKey(lo, 2), monthKey(hi, 12)),
  };
}
