/**
 * Trade indicators for the Food Origins explorer (spec §6.2). Pure functions: no React, ArcGIS
 * or DOM imports. Inputs are trade snapshots written by the pipeline (schema trade-snapshot).
 *
 * Terminology (P3): a "partner" is the recorded import partner — HMRC's country of dispatch —
 * which may differ from the country where the food was grown.
 */
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";

export type Measure = "mass" | "value";
export type PeriodMode = "month" | "rolling12" | "year";
/** Month key "YYYY-MM". */
export type MonthKey = string;

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
export const MONTHS_SHORT_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Series breaks in GB–EU import data (S01, FO-11): EU exit and customs-based collection. */
export const SERIES_BREAKS: readonly { month: MonthKey; label: string }[] = [
  { month: "2021-01", label: "EU exit: end of transition period" },
  { month: "2022-01", label: "GB imports from the EU from customs declarations" },
];
/** Shares computed on totals below this are flagged "small base" (spec §6.4). */
export const SMALL_BASE_TONNES = 100;
/** Fixed choropleth class breaks for partner share (spec §7.4: fixed, manually defined). */
export const SHARE_BREAKS: readonly number[] = [0.01, 0.05, 0.1, 0.25, 0.5];

// ---------------------------------------------------------------------------------------------
// Months
// ---------------------------------------------------------------------------------------------

export function monthKey(year: number, month: number): MonthKey {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: MonthKey): { year: number; month: number } {
  const m = MONTH_KEY.exec(key);
  if (!m) throw new Error(`invalid month key: ${key}`);
  return { year: Number(m[1]), month: Number(m[2]) };
}

export function addMonths(key: MonthKey, delta: number): MonthKey {
  const { year, month } = parseMonthKey(key);
  const n = year * 12 + (month - 1) + delta;
  return monthKey(Math.floor(n / 12), (n % 12) + 1);
}

/** Number of months from `a` to `b` (b − a). */
export function monthDiff(a: MonthKey, b: MonthKey): number {
  const pa = parseMonthKey(a);
  const pb = parseMonthKey(b);
  return (pb.year - pa.year) * 12 + (pb.month - pa.month);
}

export function monthList(first: MonthKey, last: MonthKey): MonthKey[] {
  const n = monthDiff(first, last);
  return n < 0 ? [] : Array.from({ length: n + 1 }, (_, i) => addMonths(first, i));
}

export function formatMonth(key: MonthKey): string {
  const { year, month } = parseMonthKey(key);
  return `${MONTHS_SHORT_EN[month - 1]} ${year}`;
}

export function formatMonthRange(start: MonthKey, end: MonthKey): string {
  if (start === end) return formatMonth(start);
  const a = parseMonthKey(start);
  const b = parseMonthKey(end);
  if (a.year === b.year) return `${MONTHS_SHORT_EN[a.month - 1]}–${MONTHS_SHORT_EN[b.month - 1]} ${b.year}`;
  return `${formatMonth(start)} – ${formatMonth(end)}`;
}

// ---------------------------------------------------------------------------------------------
// Periods (FO-07)
// ---------------------------------------------------------------------------------------------

export interface MonthRange {
  first: MonthKey;
  last: MonthKey;
}

export interface PeriodSelection {
  mode: PeriodMode;
  year: number | null;
  month: number | null;
}

export interface MonthSet {
  start: MonthKey;
  end: MonthKey;
  months: MonthKey[];
  /** Months inside the snapshot range. */
  available: MonthKey[];
  /** Months outside it: before the first month or not yet published. */
  unavailable: MonthKey[];
}

export interface ResolvedPeriod extends MonthSet {
  mode: PeriodMode;
  label: string;
  /** Same months one year earlier (FO-05 change vs same period previous year). */
  comparison: MonthSet;
  /** The month the timeline points at (end of a rolling period, or the selected month). */
  anchor: MonthKey;
}

function monthSet(start: MonthKey, end: MonthKey, range: MonthRange): MonthSet {
  const months = monthList(start, end);
  const inRange = (m: MonthKey) => monthDiff(range.first, m) >= 0 && monthDiff(m, range.last) >= 0;
  return {
    start,
    end,
    months,
    available: months.filter(inRange),
    unavailable: months.filter((m) => !inRange(m)),
  };
}

/** Null year/month mean "latest published"; a selection beyond the range is clamped to it. */
export function anchorMonth(sel: PeriodSelection, range: MonthRange): MonthKey {
  const last = parseMonthKey(range.last);
  const year = sel.year ?? last.year;
  const month = sel.month ?? (sel.year === null || sel.year === last.year ? last.month : 12);
  let key = monthKey(year, month);
  if (monthDiff(key, range.first) > 0) key = range.first;
  if (monthDiff(range.last, key) > 0) key = range.last;
  return key;
}

export function resolvePeriod(sel: PeriodSelection, range: MonthRange): ResolvedPeriod {
  const anchor = anchorMonth(sel, range);
  let start: MonthKey;
  let end: MonthKey;
  let label: string;
  if (sel.mode === "month") {
    start = end = anchor;
    label = formatMonth(anchor);
  } else if (sel.mode === "rolling12") {
    end = anchor;
    start = addMonths(anchor, -11);
    label = `12 months to ${formatMonth(anchor)}`;
  } else {
    const firstYear = parseMonthKey(range.first).year;
    const lastYear = parseMonthKey(range.last).year;
    const year =
      sel.year !== null && sel.year >= firstYear && sel.year <= lastYear
        ? sel.year
        : parseMonthKey(anchor).year;
    start = monthKey(year, 1);
    end = monthKey(year, 12);
    label = `Calendar year ${year}`;
  }
  const current = monthSet(start, end, range);
  const comparison = monthSet(addMonths(start, -12), addMonths(end, -12), range);
  return { ...current, mode: sel.mode, label, comparison, anchor };
}

// ---------------------------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------------------------

export interface Amount {
  kg: number;
  gbp: number;
}

export interface PartnerTotal extends Amount {
  key: string;
  name: string;
  kind: "country" | "unallocated";
}

export interface SuppressedTotal {
  /** Published quantity; null when every suppressed row withholds it. */
  kg: number | null;
  gbp: number | null;
  /** True if any suppressed row in the period withholds quantity (or value). */
  kgWithheld: boolean;
  gbpWithheld: boolean;
  rows: number;
}

export interface PeriodAggregate {
  months: MonthKey[];
  /** Recorded import partners that are countries, in snapshot order (unsorted). */
  partners: PartnerTotal[];
  /** HMRC categories that are not a country (stores and provisions, estimates, …). */
  unallocated: PartnerTotal[];
  suppressed: SuppressedTotal;
  allocated: Amount;
  unallocatedTotal: Amount;
  /** Allocated + unallocated + published suppressed amounts. */
  grandTotal: Amount;
  /** Months in the period with no recorded import rows at all. */
  nilMonths: MonthKey[];
}

function snapshotMonthIndex(snapshot: TradeSnapshot, key: MonthKey): number {
  return monthDiff(snapshot.months.first, key);
}

export function aggregatePeriod(snapshot: TradeSnapshot, months: readonly MonthKey[]): PeriodAggregate {
  const wanted = new Set(months.map((m) => snapshotMonthIndex(snapshot, m)));
  const totals = new Map<number, Amount>();
  for (const [m, p, kg, gbp] of snapshot.rows) {
    if (!wanted.has(m)) continue;
    const t = totals.get(p) ?? { kg: 0, gbp: 0 };
    t.kg += kg;
    t.gbp += gbp;
    totals.set(p, t);
  }
  const partners: PartnerTotal[] = [];
  const unallocated: PartnerTotal[] = [];
  snapshot.partners.forEach((p, i) => {
    const t = totals.get(i);
    if (!t) return;
    const entry = { key: p.key, name: p.name, kind: p.kind, kg: t.kg, gbp: t.gbp };
    (p.kind === "country" ? partners : unallocated).push(entry);
  });

  const suppressed: SuppressedTotal = { kg: null, gbp: null, kgWithheld: false, gbpWithheld: false, rows: 0 };
  for (const [m, , kg, gbp] of snapshot.suppressed) {
    if (m === null || !wanted.has(m)) continue;
    suppressed.rows += 1;
    if (kg === null) suppressed.kgWithheld = true;
    else suppressed.kg = (suppressed.kg ?? 0) + kg;
    if (gbp === null) suppressed.gbpWithheld = true;
    else suppressed.gbp = (suppressed.gbp ?? 0) + gbp;
  }

  const sum = (list: PartnerTotal[]): Amount =>
    list.reduce((a, p) => ({ kg: a.kg + p.kg, gbp: a.gbp + p.gbp }), { kg: 0, gbp: 0 });
  const allocated = sum(partners);
  const unallocatedTotal = sum(unallocated);
  const nil = new Set(snapshot.nilMonths);
  return {
    months: [...months],
    partners,
    unallocated,
    suppressed,
    allocated,
    unallocatedTotal,
    grandTotal: {
      kg: allocated.kg + unallocatedTotal.kg + (suppressed.kg ?? 0),
      gbp: allocated.gbp + unallocatedTotal.gbp + (suppressed.gbp ?? 0),
    },
    nilMonths: months.filter((m) => nil.has(snapshotMonthIndex(snapshot, m))),
  };
}

/** Tonnes for mass, pounds for value. */
export function measureValue(a: Amount, measure: Measure): number {
  return measure === "mass" ? a.kg / 1000 : a.gbp;
}

// ---------------------------------------------------------------------------------------------
// Shares and concentration (§6.2)
// ---------------------------------------------------------------------------------------------

export interface PartnerShare {
  key: string;
  name: string;
  rank: number;
  /** Tonnes or £ per the measure. */
  value: number;
  tonnes: number;
  gbp: number;
  /** Fraction (0–1) of recorded imports allocated to countries. */
  share: number;
}

/**
 * Partner shares over allocated partners only (suppressed and unallocated trade excluded and
 * reported separately, P12). Sorted by value descending, ties by key for determinism. Partners
 * with a zero value for the measure are dropped. Empty when the allocated total is zero.
 */
export function partnerShares(partners: readonly PartnerTotal[], measure: Measure): PartnerShare[] {
  const rows = partners
    .filter((p) => p.kind === "country")
    .map((p) => ({ p, value: measureValue(p, measure) }))
    .filter((r) => r.value > 0);
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (total <= 0) return [];
  return rows
    .sort((a, b) => b.value - a.value || a.p.key.localeCompare(b.p.key))
    .map((r, i) => ({
      key: r.p.key,
      name: r.p.name,
      rank: i + 1,
      value: r.value,
      tonnes: r.p.kg / 1000,
      gbp: r.p.gbp,
      share: r.value / total,
    }));
}

/** HHI = Σ (100·s)², 0–10,000. Null when there are no shares. */
export function hhi(shares: readonly number[]): number | null {
  if (shares.length === 0) return null;
  return shares.reduce((s, x) => s + (100 * x) ** 2, 0);
}

/** Effective number of partners = 10,000 / HHI. */
export function effectivePartners(h: number | null): number | null {
  return h === null || h <= 0 ? null : 10_000 / h;
}

/** CRk: sum of the k largest shares (fewer partners: sum of all). Null when there are none. */
export function concentrationRatio(shares: readonly PartnerShare[], k: number): number | null {
  if (shares.length === 0) return null;
  return shares.slice(0, k).reduce((s, p) => s + p.share, 0);
}

/**
 * Year-on-year change in share, percentage points. Null for every partner when the comparison
 * period has no recorded imports (or is unavailable); a partner absent last year had share 0.
 */
export function shareChanges(
  current: readonly PartnerShare[],
  previous: readonly PartnerShare[] | null,
): Map<string, number | null> {
  const out = new Map<string, number | null>();
  const prev = previous && previous.length > 0 ? new Map(previous.map((p) => [p.key, p.share])) : null;
  for (const p of current) out.set(p.key, prev ? 100 * (p.share - (prev.get(p.key) ?? 0)) : null);
  return out;
}

/** Relative change (fraction). Null when the base is zero or missing. */
export function relativeChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

export interface TopN {
  top: PartnerShare[];
  others: { count: number; value: number; share: number } | null;
}

export function topNWithOthers(shares: readonly PartnerShare[], n: number): TopN {
  const k = Math.max(0, Math.floor(n));
  const top = shares.slice(0, k);
  const rest = shares.slice(k);
  if (rest.length === 0) return { top, others: null };
  return {
    top,
    others: {
      count: rest.length,
      value: rest.reduce((s, p) => s + p.value, 0),
      share: rest.reduce((s, p) => s + p.share, 0),
    },
  };
}

export function isSmallBase(totalTonnes: number): boolean {
  return totalTonnes < SMALL_BASE_TONNES;
}

/** Choropleth class 0–5 for a share using the fixed breaks (0 = below 1 %). */
export function shareClass(share: number): number {
  let c = 0;
  for (const b of SHARE_BREAKS) if (share >= b) c += 1;
  return c;
}

/**
 * Flow line widths (FO-03): linear in value between `minPx` and `maxPx`. By default the largest
 * value shown gets `maxPx` (Food Origins: one period at a time). With `scaleMax` (Seasonal Supply)
 * the scale is fixed, so the same width means the same amount in every month and year; values
 * above it are clamped. Zero or negative values get `minPx`.
 */
export function flowWidths(values: readonly number[], minPx = 1.5, maxPx = 12, scaleMax?: number): number[] {
  const max = scaleMax !== undefined && scaleMax > 0 ? scaleMax : Math.max(0, ...values);
  if (max <= 0) return values.map(() => minPx);
  return values.map((v) => (v <= 0 ? minPx : minPx + ((maxPx - minPx) * Math.min(v, max)) / max));
}

// ---------------------------------------------------------------------------------------------
// Time series (charts)
// ---------------------------------------------------------------------------------------------

export interface MonthlySeries {
  months: MonthKey[];
  /** Allocated total per month (tonnes or £). */
  total: number[];
  /** Per selected partner. */
  byPartner: Record<string, number[]>;
  /** Allocated total minus the selected partners. */
  others: number[];
  nil: boolean[];
}

export function monthlySeries(
  snapshot: TradeSnapshot,
  partnerKeys: readonly string[],
  measure: Measure,
  range?: MonthRange,
): MonthlySeries {
  const first = range?.first ?? snapshot.months.first;
  const last = range?.last ?? snapshot.months.last;
  const months = monthList(first, last);
  const offset = snapshotMonthIndex(snapshot, first);
  const total = months.map(() => 0);
  const byPartner: Record<string, number[]> = Object.fromEntries(
    partnerKeys.map((k) => [k, months.map(() => 0)]),
  );
  const keyOf = snapshot.partners.map((p) => (p.kind === "country" ? p.key : null));
  for (const [m, p, kg, gbp] of snapshot.rows) {
    const i = m - offset;
    if (i < 0 || i >= months.length) continue;
    const key = keyOf[p];
    if (key === null || key === undefined) continue;
    const v = measure === "mass" ? kg / 1000 : gbp;
    total[i]! += v;
    const series = byPartner[key];
    if (series) series[i]! += v;
  }
  const others = total.map((t, i) => t - partnerKeys.reduce((s, k) => s + (byPartner[k]?.[i] ?? 0), 0));
  const nilSet = new Set(snapshot.nilMonths);
  return { months, total, byPartner, others, nil: months.map((_, i) => nilSet.has(i + offset)) };
}

/** Series breaks that fall strictly inside (start, end]. */
export function seriesBreaksWithin(start: MonthKey, end: MonthKey): typeof SERIES_BREAKS {
  return SERIES_BREAKS.filter((b) => monthDiff(start, b.month) > 0 && monthDiff(b.month, end) >= 0);
}

/**
 * Series breaks that affect a comparison between two periods (P11): every break after the first
 * month of the comparison period and up to the last month of the current period. Such a break
 * means part of the difference may come from how HMRC collected the data, not from trade.
 * Empty when there is no comparison.
 */
export function comparisonBreaks(
  comparisonStart: MonthKey | null,
  currentEnd: MonthKey | null,
): typeof SERIES_BREAKS {
  if (!comparisonStart || !currentEnd) return [];
  return seriesBreaksWithin(comparisonStart, currentEnd);
}

/** A label inside a sentence: first letter lower-cased unless it starts an acronym ("EU", "GB"). */
export function inSentence(label: string): string {
  return /^[A-Z][A-Z]/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

/** Visible caution for a comparison that crosses series breaks; null when there is none. */
export function seriesBreakCaution(breaks: typeof SERIES_BREAKS): string | null {
  if (breaks.length === 0) return null;
  const list = breaks.map((b) => `${formatMonth(b.month)} (${inSentence(b.label)})`).join(" and ");
  return `Comparison crosses the HMRC series break${breaks.length > 1 ? "s" : ""} in ${list}: part of the difference may reflect how the data was collected.`;
}

/** Value (£) comparisons are in current prices: HMRC statistical values are not inflation adjusted. */
export const CURRENT_PRICES_NOTE =
  "Values are HMRC statistical values (CIF) in current prices, not adjusted for inflation: a change in £ includes price changes as well as changes in quantity.";

export function isProvisional(month: MonthKey, provisionalFrom: MonthKey | null): boolean {
  return provisionalFrom !== null && monthDiff(provisionalFrom, month) >= 0;
}
