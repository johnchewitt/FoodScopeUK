/**
 * Food Origins view model: everything the panels, KPI cards, charts and map draw for one
 * commodity, period and measure. Pure (no React, ArcGIS or DOM), so it is unit tested directly.
 * Every on-screen number is either an Indicator (KPI cards) or a table cell derived here from the
 * same snapshot, so the map, cards, charts and table always agree (FO-02, FO-05, FO-06).
 */
import { connectionsBBox, UK_EXTENT_110M, unionBBox } from "@/analysis/frame";
import { formatGbp, formatHhi, formatShare, formatTonnes } from "@/analysis/format";
import {
  addMonths,
  aggregatePeriod,
  comparisonBreaks,
  concentrationRatio,
  CURRENT_PRICES_NOTE,
  effectivePartners,
  flowWidths,
  formatMonth,
  formatMonthRange,
  hhi,
  isProvisional,
  isSmallBase,
  measureValue,
  monthDiff,
  partnerShares,
  relativeChange,
  resolvePeriod,
  seriesBreakCaution,
  shareChanges,
  shareClass,
  type Amount,
  type MonthKey,
  type PartnerShare,
  type ResolvedPeriod,
} from "@/analysis/trade";
import type { OriginsMapModel, OriginsMapPartner } from "@/state/store";
import type { Measure, PeriodMode } from "@/state/urlState";
import type { Indicator } from "@/types/indicator";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";

export interface OriginsSelection {
  period: PeriodMode;
  year: number | null;
  month: number | null;
  measure: Measure;
  partner: string | null;
  flowCount: number;
  /**
   * Fixed connection-width scale: the value drawn at 12 px (Seasonal Supply, SS-02). Default:
   * the period's largest connection (Food Origins compares partners within one period).
   */
  flowScaleMax?: number;
  /** Months back to the comparison period (default 12: the same period a year earlier). */
  comparisonShift?: number;
}

export interface PartnerRow {
  key: string;
  name: string;
  hmrcNames: string[];
  rank: number;
  tonnes: number;
  gbp: number;
  share: number;
  /** Year-on-year change in share, percentage points; null when no comparison is available. */
  changePp: number | null;
  geometry: "polygon" | "point" | "none";
  isFlow: boolean;
}

export interface NonCountryRow {
  key: string;
  label: string;
  tonnes: number | null;
  gbp: number | null;
  /** Share of all recorded imports in the period (including this row). */
  shareOfTotal: number | null;
  note: string;
}

export interface OriginsStatus {
  /** No month of the period is in the snapshot. */
  noData: boolean;
  /** Explains months of the period that are not available. */
  unavailableText: string | null;
  provisional: boolean;
  nilMonths: MonthKey[];
  smallBase: boolean;
  comparisonAvailable: boolean;
  comparisonLabel: string | null;
  /** Short form for KPI cards, e.g. "previous 12 months", "Aug 2025", "2024". */
  comparisonShort: string | null;
  comparisonNote: string | null;
  /** HMRC series breaks the year-on-year comparison crosses (P11); empty without a comparison. */
  seriesBreaks: { month: MonthKey; label: string }[];
  /** Caution shown wherever a comparison crossing a series break is displayed; null when none. */
  comparisonCaution: string | null;
  /** Value comparisons are in current prices (shown when the measure is value). */
  currentPricesNote: string | null;
}

export interface OriginsKpis {
  imports: Indicator<number>;
  importsDetail: string;
  partners: Indicator<number>;
  partnersDetail: string;
  top: Indicator<number>;
  topDetail: string;
  concentration: Indicator<number>;
  concentrationDetail: string;
  /** Shown on the cards whose detail compares periods when that comparison crosses a series break. */
  comparisonCaution: string | null;
}

export interface OriginsModel {
  commodity: TradeSnapshot["commodity"];
  range: { first: MonthKey; last: MonthKey; provisionalFrom: MonthKey | null };
  period: ResolvedPeriod;
  periodText: string;
  measure: Measure;
  status: OriginsStatus;
  current: Amount;
  comparison: Amount | null;
  shares: PartnerShare[];
  rows: PartnerRow[];
  nonCountry: NonCountryRow[];
  kpis: OriginsKpis;
  selected: { key: string; row: PartnerRow | null; name: string } | null;
  map: OriginsMapModel;
}

const SOURCE: [string, ...string[]] = ["S01"];
const COVERAGE = "UK recorded imports, all partners (EU and non-EU flows)";

function measureWord(measure: Measure): string {
  return measure === "mass" ? "net mass" : "value";
}

export function formatMeasure(value: number | null, measure: Measure): string {
  return measure === "mass" ? formatTonnes(value) : formatGbp(value);
}

function signedPercent(fraction: number): string {
  const pct = Math.round(fraction * 1000) / 10;
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "±";
  return `${sign}${Math.abs(pct).toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

function describeUnavailable(
  period: ResolvedPeriod,
  range: { first: MonthKey; last: MonthKey },
): string | null {
  if (period.unavailable.length === 0) return null;
  const future = period.unavailable.filter((m) => monthDiff(range.last, m) > 0);
  const past = period.unavailable.filter((m) => monthDiff(m, range.first) > 0);
  const parts: string[] = [];
  if (future.length)
    parts.push(
      `${formatMonthRange(future[0]!, future[future.length - 1]!)} not yet published by HMRC (latest: ${formatMonth(range.last)})`,
    );
  if (past.length)
    parts.push(
      `${formatMonthRange(past[0]!, past[past.length - 1]!)} before this snapshot (starts ${formatMonth(range.first)})`,
    );
  return parts.join("; ");
}

function ind(
  id: string,
  label: string,
  value: number | null,
  unit: string,
  provenance: Indicator["provenance"],
  referencePeriod: string,
  method: string,
  missing?: Indicator["missingReason"],
): Indicator<number> {
  return {
    id,
    label,
    value,
    unit,
    provenance,
    sourceIds: SOURCE,
    referencePeriod,
    coverage: COVERAGE,
    method,
    scope: "national_context",
    ...(value === null ? { missingReason: missing ?? "not_published" } : {}),
  };
}

/**
 * The map frame for a commodity: the whole UK and the drawn connections (fitted when the commodity
 * changes). Null when nothing is drawn.
 */
export function frameFor(
  commodityId: string,
  starts: [number, number][],
  ukAnchor: [number, number],
): OriginsMapModel["frame"] {
  const bbox = connectionsBBox(starts, ukAnchor);
  return bbox ? { key: commodityId, bbox: unionBBox(bbox, UK_EXTENT_110M) } : null;
}

export function buildOriginsModel(
  snapshot: TradeSnapshot,
  sel: OriginsSelection,
  ukAnchor: [number, number],
): OriginsModel {
  const range = { first: snapshot.months.first, last: snapshot.months.last };
  const period = resolvePeriod({ mode: sel.period, year: sel.year, month: sel.month }, range);
  const measure = sel.measure;
  const periodText =
    period.available.length > 0
      ? formatMonthRange(period.available[0]!, period.available[period.available.length - 1]!)
      : period.label;

  const agg = aggregatePeriod(snapshot, period.available);
  const shares = partnerShares(agg.partners, measure);

  // Comparison: the same available months one year earlier, only if all are in the snapshot.
  const compMonths = period.available.map((m) => addMonths(m, -(sel.comparisonShift ?? 12)));
  const comparisonAvailable =
    compMonths.length > 0 &&
    compMonths.every((m) => monthDiff(range.first, m) >= 0 && monthDiff(m, range.last) >= 0);
  const compAgg = comparisonAvailable ? aggregatePeriod(snapshot, compMonths) : null;
  const prevShares = compAgg ? partnerShares(compAgg.partners, measure) : null;
  const changes = shareChanges(shares, prevShares);
  const comparisonLabel = comparisonAvailable
    ? formatMonthRange(compMonths[0]!, compMonths[compMonths.length - 1]!)
    : null;
  const comparisonShort = !comparisonAvailable
    ? null
    : sel.period === "rolling12"
      ? "previous 12 months"
      : sel.period === "month"
        ? formatMonth(compMonths[0]!)
        : compMonths.length === 12
          ? compMonths[0]!.slice(0, 4)
          : comparisonLabel;
  const comparisonNote = comparisonAvailable
    ? null
    : period.available.length === 0
      ? null
      : `No comparison: the snapshot starts ${formatMonth(range.first)}`;

  const breaks = comparisonAvailable
    ? comparisonBreaks(compMonths[0]!, period.available[period.available.length - 1]!)
    : [];
  const comparisonCaution = seriesBreakCaution(breaks);

  const tonnes = agg.grandTotal.kg / 1000;
  const status: OriginsStatus = {
    noData: period.available.length === 0,
    unavailableText: describeUnavailable(period, range),
    provisional: period.available.some((m) => isProvisional(m, snapshot.months.provisionalFrom)),
    nilMonths: agg.nilMonths,
    smallBase: period.available.length > 0 && isSmallBase(agg.allocated.kg / 1000),
    comparisonAvailable,
    comparisonLabel,
    comparisonShort,
    comparisonNote,
    seriesBreaks: [...breaks],
    comparisonCaution,
    currentPricesNote: measure === "value" && comparisonAvailable ? CURRENT_PRICES_NOTE : null,
  };

  const partnerMeta = new Map(snapshot.partners.map((p) => [p.key, p]));
  const flowCandidates = shares.filter((s) => {
    const p = partnerMeta.get(s.key);
    return p && p.geometry !== "none" && s.key !== "GB";
  });
  const flows = flowCandidates.slice(0, Math.max(0, sel.flowCount));
  const widths = flowWidths(
    flows.map((f) => f.value),
    1.5,
    12,
    sel.flowScaleMax,
  );
  const flowWidth = new Map(flows.map((f, i) => [f.key, widths[i]!]));

  const rows: PartnerRow[] = shares.map((s) => {
    const p = partnerMeta.get(s.key)!;
    return {
      key: s.key,
      name: s.name,
      hmrcNames: p.hmrcNames,
      rank: s.rank,
      tonnes: s.tonnes,
      gbp: s.gbp,
      share: s.share,
      changePp: changes.get(s.key) ?? null,
      geometry: p.geometry,
      isFlow: flowWidth.has(s.key),
    };
  });

  const grand = measureValue(agg.grandTotal, measure);
  const shareOfTotal = (a: Amount | null) => (a && grand > 0 ? measureValue(a, measure) / grand : null);
  const nonCountry: NonCountryRow[] = agg.unallocated.map((u) => ({
    key: u.key,
    label: u.name,
    tonnes: u.kg / 1000,
    gbp: u.gbp,
    shareOfTotal: shareOfTotal(u),
    note: "Recorded by HMRC without a partner country",
  }));
  if (agg.suppressed.rows > 0) {
    const s = agg.suppressed;
    const amount =
      (measure === "mass" && s.kgWithheld) || (measure === "value" && s.gbpWithheld)
        ? null
        : { kg: s.kg ?? 0, gbp: s.gbp ?? 0 };
    nonCountry.push({
      key: "suppressed",
      label: "Suppressed by HMRC",
      tonnes: s.kgWithheld ? null : (s.kg ?? 0) / 1000,
      gbp: s.gbpWithheld ? null : s.gbp,
      shareOfTotal: shareOfTotal(amount),
      note: "Withheld at partner level for confidentiality; never redistributed (P12)",
    });
  }

  // KPI indicators (FO-05)
  const ref = periodText;
  const cn8 = snapshot.commodity.cn8.length;
  const missing = status.noData ? "not_published" : undefined;
  const currentValue = status.noData ? null : measureValue(agg.grandTotal, measure);
  const compValue = compAgg ? measureValue(compAgg.grandTotal, measure) : null;
  const change = relativeChange(currentValue, compValue);
  const h = hhi(shares.map((s) => s.share));
  const hPrev = prevShares ? hhi(prevShares.map((s) => s.share)) : null;
  const nEff = effectivePartners(h);
  const cr3 = concentrationRatio(shares, 3);
  const top = shares[0] ?? null;

  const imports = ind(
    "origins.recorded_imports",
    "Recorded imports",
    currentValue,
    measure === "mass" ? "t" : "GBP",
    "measured",
    ref,
    `Sum of HMRC recorded ${measureWord(measure)} for ${cn8} CN8 codes in ${snapshot.commodity.hsScope}, EU and non-EU import flows, all partners${measure === "mass" ? " (kg ÷ 1,000)" : " (CIF statistical value, current prices: not adjusted for inflation)"}.`,
    missing,
  );
  const other = measure === "mass" ? formatGbp(agg.grandTotal.gbp) : formatTonnes(tonnes);
  const breakTag = breaks.length ? " · series break" : "";
  const changeText =
    change !== null && comparisonShort
      ? `${signedPercent(change)} vs ${comparisonShort}${breakTag}`
      : (comparisonNote ?? "");
  const importsDetail = status.noData
    ? (status.unavailableText ?? "")
    : [changeText, other].filter(Boolean).join(" · ");

  const partners = ind(
    "origins.partner_count",
    "Recorded import partners",
    status.noData ? null : shares.length,
    "partners",
    "derived",
    ref,
    `Number of recorded import partner countries with recorded ${measureWord(measure)} in the period.`,
    missing,
  );
  const partnersDetail = nEff !== null ? `Effective number ${nEff.toFixed(1)} (10,000 ÷ HHI)` : "";

  const topInd = ind(
    "origins.top_partner_share",
    top ? `Top recorded partner: ${top.name}` : "Top recorded partner",
    status.noData ? null : (top?.share ?? null),
    "share",
    "derived",
    ref,
    `Largest partner's share of recorded ${measureWord(measure)} allocated to countries (suppressed and unallocated trade excluded).`,
    status.noData ? "not_published" : "not_applicable",
  );
  const topDetail = top ? `${top.name}${cr3 !== null ? ` · top 3: ${formatShare(cr3)}` : ""}` : "";

  const concentration = ind(
    "origins.hhi",
    "Partner concentration (HHI)",
    status.noData ? null : h,
    "HHI",
    "derived",
    ref,
    `Herfindahl–Hirschman Index of partner shares of recorded ${measureWord(measure)}: Σ(100 × share)², 0–10,000.`,
    status.noData ? "not_published" : "not_applicable",
  );
  const concentrationDetail =
    hPrev !== null && comparisonShort
      ? `${formatHhi(hPrev)} in ${comparisonShort}${breakTag}`
      : (comparisonNote ?? "");

  const selectedRow = sel.partner ? (rows.find((r) => r.key === sel.partner) ?? null) : null;
  const selectedMeta = sel.partner ? partnerMeta.get(sel.partner) : undefined;

  const mapPartners: OriginsMapPartner[] = shares.map((s) => {
    const p = partnerMeta.get(s.key)!;
    return {
      key: s.key,
      name: s.name,
      iso2: p.iso2,
      geometry: p.geometry,
      point: p.point,
      share: s.share,
      shareClass: shareClass(s.share),
      valueText: `${formatMeasure(s.value, measure)} · ${formatShare(s.share)}`,
      flow: flowWidth.has(s.key),
      flowWidth: flowWidth.get(s.key) ?? 0,
    };
  });

  return {
    commodity: snapshot.commodity,
    range: { ...range, provisionalFrom: snapshot.months.provisionalFrom },
    period,
    periodText,
    measure,
    status,
    current: agg.grandTotal,
    comparison: compAgg?.grandTotal ?? null,
    shares,
    rows,
    nonCountry,
    kpis: {
      imports,
      importsDetail,
      partners,
      partnersDetail,
      top: topInd,
      topDetail,
      concentration,
      concentrationDetail,
      comparisonCaution,
    },
    selected: sel.partner
      ? { key: sel.partner, row: selectedRow, name: selectedRow?.name ?? selectedMeta?.name ?? sel.partner }
      : null,
    map: {
      commodityId: snapshot.commodity.id,
      periodLabel: periodText,
      measure,
      partners: mapPartners,
      ukAnchor,
      frame: frameFor(
        snapshot.commodity.id,
        mapPartners.filter((p) => p.flow && p.point).map((p) => p.point!),
        ukAnchor,
      ),
    },
  };
}
