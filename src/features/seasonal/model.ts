/**
 * Seasonal Supply view model (SS-01 – SS-08): everything the timeline, KPI cards, charts, heatmap
 * and map draw for one commodity, year, month and measure. Pure (no React, ArcGIS or DOM), so it is
 * unit tested directly.
 *
 * The selected month is built with the Food Origins model (`buildOriginsModel`, single month), so
 * a month here shows exactly the figures Food Origins shows for that month; only the connection
 * width scale differs (fixed across months and years here, SS-02). Months that are not published
 * are never estimated: they get null values and an explicit state (P12).
 */
import {
  formatChange,
  formatGbp,
  formatHhi,
  formatShare,
  formatTonnes,
  MONTHS_SHORT,
} from "@/analysis/format";
import {
  comparability,
  isAvailable,
  likeForLike,
  maxMonthlyPartnerValue,
  maxMonthlyTotal,
  monthlyChanges,
  monthlyHhi,
  monthShareOfYear,
  monthShares,
  seasonalCodes,
  seasonality,
  shareChangePp,
  snapshotYears,
  topPartnersForYear,
  yearMatrix,
  yearMonthInfo,
  type CodeChange,
  type Comparability,
  type FlowScale,
  type LikeForLike,
  type MonthInfo,
  type SeasonalCode,
  type Seasonality,
  type YearMatrix,
} from "@/analysis/seasonal";
import {
  addMonths,
  comparisonBreaks,
  concentrationRatio,
  CURRENT_PRICES_NOTE,
  effectivePartners,
  formatMonth,
  formatMonthRange,
  inSentence,
  monthKey,
  parseMonthKey,
  seriesBreakCaution,
  type MonthKey,
} from "@/analysis/trade";
import { domesticProduction, type DomesticProductionStatus } from "@/content/domesticProduction";
import { buildOriginsModel, formatMeasure, frameFor, type OriginsModel } from "@/features/origins/model";
import type { OriginsMapModel } from "@/state/store";
import type { HeatmapMode, Measure } from "@/state/urlState";
import type { Indicator } from "@/types/indicator";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";

export interface SeasonalSelection {
  year: number | null;
  month: number | null;
  compareYear: number | null;
  compareMonth: number | null;
  measure: Measure;
  partner: string | null;
  flowCount: number;
  heatmap: HeatmapMode;
}

export const HEATMAP_ROWS = 10;
const SOURCE: [string, ...string[]] = ["S01"];
const COVERAGE = "UK recorded imports, all partners (EU and non-EU flows)";

export interface MonthSummary {
  month: number;
  key: MonthKey;
  label: string;
  info: MonthInfo;
  available: boolean;
  /** Why the month has no figures (not yet published, before the snapshot), else null. */
  unavailableText: string | null;
  total: number | null;
  /** The other measure (tonnes when the measure is value, and vice versa). */
  otherTotal: number | null;
  partners: number | null;
  top: { key: string; name: string; share: number } | null;
  cr3: number | null;
  hhi: number | null;
}

export interface HeatRow {
  key: string;
  name: string;
  /** Amount per month (tonnes or £); 0 = none recorded; null = month not available. */
  values: (number | null)[];
  shares: (number | null)[];
  /** Change in share vs the same month of the comparison year, percentage points. */
  changePp: (number | null)[];
  annual: number;
  kind: "partner" | "others" | "selected";
}

export interface SeasonalNotice {
  id: string;
  tone: "info" | "warn";
  text: string;
}

export interface SeasonalKpis {
  imports: Indicator<number>;
  importsDetail: string;
  change: Indicator<number>;
  changeLabel: string;
  changeDetail: string;
  /** The month-on-same-month comparison crosses an HMRC series break (P11); null when not. */
  changeCaution: string | null;
  top: Indicator<number>;
  topDetail: string;
  hhi: Indicator<number>;
  hhiDetail: string;
}

export interface MonthComparison {
  a: MonthSummary;
  b: MonthSummary;
  /** Partners in the top 8 of either month, by share in each (0 = none recorded, null = month not available). */
  partners: { key: string; name: string; a: number | null; b: number | null }[];
  title: string;
}

export interface SeasonalModel {
  commodity: TradeSnapshot["commodity"];
  measure: Measure;
  range: { first: MonthKey; last: MonthKey; provisionalFrom: MonthKey | null };
  years: number[];
  year: number;
  month: number;
  monthKey: MonthKey;
  monthLabel: string;
  monthInfo: MonthInfo;
  available: boolean;
  /** Explains why the selected month has no figures. */
  monthUnavailableText: string | null;
  compareYear: number | null;
  compareYearNote: string | null;
  compareMonth: number | null;
  months: MonthInfo[];
  compareMonths: MonthInfo[] | null;
  totals: (number | null)[];
  compareTotals: (number | null)[] | null;
  /** Fixed scale for the timeline's month bars (largest monthly total in the snapshot). */
  barScaleMax: number;
  hhi: (number | null)[];
  compareHhi: (number | null)[] | null;
  yoy: (number | null)[];
  likeForLike: LikeForLike | null;
  seasonality: Seasonality;
  compareSeasonality: Seasonality | null;
  heatmap: { mode: HeatmapMode; rows: HeatRow[]; othersCount: number; rankedOn: string };
  /** The selected month as a Food Origins model (null when the month is not available). */
  current: OriginsModel | null;
  summary: MonthSummary;
  monthComparison: MonthComparison | null;
  kpis: SeasonalKpis;
  flowScale: FlowScale | null;
  map: OriginsMapModel;
  notices: SeasonalNotice[];
  comparability: Comparability;
  codes: { changes: CodeChange[]; seasonal: SeasonalCode[]; all: TradeSnapshot["commodity"]["cn8"] };
  domestic: DomesticProductionStatus;
  /** Year selected in the URL was outside the snapshot and was replaced. */
  yearAdjusted: boolean;
}

function monthName(month: number): string {
  return MONTHS_SHORT[month - 1] ?? String(month);
}

function unavailableText(info: MonthInfo, range: { first: MonthKey; last: MonthKey }): string | null {
  if (info.state === "not_yet_published")
    return `${formatMonth(info.key)} is not yet published by HMRC (latest: ${formatMonth(range.last)})`;
  if (info.state === "before_snapshot")
    return `${formatMonth(info.key)} is before this snapshot (it starts ${formatMonth(range.first)})`;
  return null;
}

/** Consecutive runs of month numbers as text, e.g. [3,4,5,9] → "Mar–May, Sep". */
export function monthRunsText(months: readonly number[], year?: number): string {
  const sorted = [...months].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const m of sorted) {
    const last = runs[runs.length - 1];
    if (last && m === last[1] + 1) last[1] = m;
    else runs.push([m, m]);
  }
  const text = runs.map(([a, b]) => (a === b ? monthName(a) : `${monthName(a)}–${monthName(b)}`)).join(", ");
  return year === undefined ? text : `${text} ${year}`;
}

function ind(
  id: string,
  label: string,
  value: number | null,
  unit: string,
  provenance: Indicator["provenance"],
  referencePeriod: string,
  method: string,
  missing: Indicator["missingReason"],
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

function summarise(
  info: MonthInfo,
  model: OriginsModel | null,
  measure: Measure,
  range: { first: MonthKey; last: MonthKey },
): MonthSummary {
  const available = isAvailable(info) && model !== null;
  const top = model?.shares[0] ?? null;
  const other = measure === "mass" ? model?.current.gbp : model ? model.current.kg / 1000 : null;
  const total = model ? (measure === "mass" ? model.current.kg / 1000 : model.current.gbp) : null;
  return {
    month: info.month,
    key: info.key,
    label: formatMonth(info.key),
    info,
    available,
    unavailableText: unavailableText(info, range),
    total: available ? total : null,
    otherTotal: available ? (other ?? null) : null,
    partners: available ? (model?.shares.length ?? 0) : null,
    top: top ? { key: top.key, name: top.name, share: top.share } : null,
    cr3: model ? concentrationRatio(model.shares, 3) : null,
    hhi: available ? (model?.kpis.concentration.value ?? null) : null,
  };
}

function heatRows(
  matrix: YearMatrix,
  compare: YearMatrix | null,
  selected: string | null,
): { rows: HeatRow[]; othersCount: number } {
  const ranked = topPartnersForYear(matrix, HEATMAP_ROWS);
  const keys = [...ranked.keys];
  const selectedExtra = selected && !keys.includes(selected) && matrix.partners.has(selected);
  if (selectedExtra) keys.push(selected);
  const shares = monthShares(matrix);
  const cShares = compare ? monthShares(compare) : null;
  const avail = matrix.months.map(isAvailable);
  const cAvail = compare ? compare.months.map(isAvailable) : matrix.months.map(() => false);

  const rows: HeatRow[] = keys.map((key) => {
    const values = matrix.partners.get(key)!;
    const s = shares.get(key)!;
    const cs = cShares?.get(key);
    return {
      key,
      name: matrix.names.get(key) ?? key,
      values,
      shares: s,
      changePp: s.map((v, i) =>
        matrix.allocated[i] && compare?.allocated[i]
          ? shareChangePp(v, cs?.[i] ?? 0, avail[i]!, cAvail[i]!)
          : null,
      ),
      annual: values.reduce<number>((a, v) => a + (v ?? 0), 0),
      kind: key === selected && selectedExtra ? "selected" : "partner",
    };
  });

  // Everyone without a row of their own (the top partners and a selected partner), in both years.
  const topKeys = new Set(keys);
  const othersCount = ranked.othersCount - (selectedExtra ? 1 : 0);
  const othersOf = (m: YearMatrix) =>
    m.allocated.map((a, i) => {
      if (a === null || a === undefined) return null;
      let rest = a;
      for (const k of topKeys) rest -= m.partners.get(k)?.[i] ?? 0;
      return Math.max(0, rest);
    });
  if (othersCount > 0) {
    const values = othersOf(matrix);
    const cValues = compare ? othersOf(compare) : null;
    const share = (v: number | null, d: number | null | undefined) =>
      v === null || d === null || d === undefined || d <= 0 ? null : v / d;
    const s = values.map((v, i) => share(v, matrix.allocated[i]));
    rows.push({
      key: "__others",
      name: `All other partners (${othersCount})`,
      values,
      shares: s,
      changePp: s.map((v, i) => {
        const c = cValues ? share(cValues[i] ?? null, compare?.allocated[i]) : null;
        return v === null || c === null ? null : 100 * (v - c);
      }),
      annual: values.reduce<number>((a, v) => a + (v ?? 0), 0),
      kind: "others",
    });
  }
  return { rows, othersCount };
}

export function buildSeasonalModel(
  snapshot: TradeSnapshot,
  sel: SeasonalSelection,
  ukAnchor: [number, number],
): SeasonalModel {
  const range = { first: snapshot.months.first, last: snapshot.months.last };
  const years = snapshotYears(snapshot);
  const firstYear = years[0]!;
  const lastYear = years[years.length - 1]!;
  const last = parseMonthKey(range.last);
  const year = sel.year !== null && sel.year >= firstYear && sel.year <= lastYear ? sel.year : lastYear;
  const yearAdjusted = sel.year !== null && sel.year !== year;
  const month = sel.month ?? (year === last.year ? last.month : 12);
  const measure = sel.measure;

  // Comparison year: an earlier year in the snapshot (default: the year before).
  const defaultCompare = year - 1 >= firstYear ? year - 1 : null;
  let compareYear = defaultCompare;
  let compareYearNote: string | null = null;
  if (sel.compareYear !== null) {
    if (sel.compareYear < year && sel.compareYear >= firstYear) compareYear = sel.compareYear;
    else
      compareYearNote = `${sel.compareYear} cannot be compared with ${year}; the comparison year must be an earlier year in the snapshot`;
  }
  if (compareYear === null)
    compareYearNote = `No earlier year to compare with: the snapshot starts ${formatMonth(range.first)}`;

  const months = yearMonthInfo(snapshot, year);
  const info = months[month - 1]!;
  const available = isAvailable(info);
  const key = info.key;
  const monthLabel = formatMonth(key);
  const matrix = yearMatrix(snapshot, year, measure);
  const cMatrix = compareYear !== null ? yearMatrix(snapshot, compareYear, measure) : null;
  const flowScale = maxMonthlyPartnerValue(snapshot, measure);

  const monthModel = (m: number): OriginsModel | null =>
    isAvailable(months[m - 1]!)
      ? buildOriginsModel(
          snapshot,
          {
            period: "month",
            year,
            month: m,
            measure,
            partner: sel.partner,
            flowCount: sel.flowCount,
            ...(flowScale ? { flowScaleMax: flowScale.value } : {}),
            comparisonShift: 12 * (year - (compareYear ?? year - 1)),
          },
          ukAnchor,
        )
      : null;

  const current = monthModel(month);
  const summary = summarise(info, current, measure, range);
  const monthUnavailableText = unavailableText(info, range);

  const totals = matrix.total;
  const compareTotals = cMatrix?.total ?? null;
  const hhiSeries = monthlyHhi(matrix);
  const compareHhi = cMatrix ? monthlyHhi(cMatrix) : null;
  const yoy = compareTotals ? monthlyChanges(totals, compareTotals) : months.map(() => null);
  const lfl = compareTotals ? likeForLike(totals, compareTotals) : null;
  const season = seasonality(totals);
  const cSeason = compareTotals ? seasonality(compareTotals) : null;

  const heat = heatRows(matrix, cMatrix, sel.partner);
  const availableMonths = months.filter(isAvailable).map((m) => m.month);
  const rankedOn =
    availableMonths.length === 12
      ? `ranked by ${year} total`
      : availableMonths.length > 0
        ? `ranked by ${monthRunsText(availableMonths, year)} total`
        : "no published months";

  // --- Month comparison (SS-08) -------------------------------------------------------------
  let monthComparison: MonthComparison | null = null;
  if (sel.compareMonth !== null) {
    const bInfo = months[sel.compareMonth - 1]!;
    const bModel = sel.compareMonth === month ? current : monthModel(sel.compareMonth);
    const b = summarise(bInfo, bModel, measure, range);
    const pick = (m: OriginsModel | null) => (m ? m.shares.slice(0, 8) : []);
    const union = new Map<string, string>();
    for (const s of [...pick(current), ...pick(bModel)]) union.set(s.key, s.name);
    const shareIn = (m: OriginsModel | null, k: string) =>
      m ? (m.shares.find((s) => s.key === k)?.share ?? 0) : null;
    const partners = [...union.entries()]
      .map(([k, name]) => ({ key: k, name, a: shareIn(current, k), b: shareIn(bModel, k) }))
      .sort(
        (p, q) => Math.max(q.a ?? 0, q.b ?? 0) - Math.max(p.a ?? 0, p.b ?? 0) || p.key.localeCompare(q.key),
      );
    monthComparison = {
      a: summary,
      b,
      partners,
      title: `${monthName(month)} vs ${monthName(sel.compareMonth)} ${year}`,
    };
  }

  // --- KPIs ---------------------------------------------------------------------------------
  const missing: Indicator["missingReason"] = "not_published";
  const unit = measure === "mass" ? "t" : "GBP";
  const word = measure === "mass" ? "net mass" : "value";
  const monthTotal = available ? (totals[month - 1] ?? null) : null;
  const shareOfYear = available ? monthShareOfYear(totals, month) : null;
  const otherMeasure =
    available && current
      ? measure === "mass"
        ? formatGbp(current.current.gbp)
        : formatTonnes(current.current.kg / 1000)
      : "";
  const yearNote = season.complete
    ? shareOfYear !== null
      ? `${formatShare(shareOfYear)} of the ${year} total`
      : ""
    : availableMonths.length > 0
      ? `${year} incomplete (${monthRunsText(availableMonths)} published)`
      : "";
  const imports = ind(
    "seasonal.recorded_imports",
    "Recorded imports",
    monthTotal,
    unit,
    "measured",
    monthLabel,
    `Sum of HMRC recorded ${word} for the ${snapshot.commodity.hsScope} basket in ${monthLabel}, EU and non-EU import flows, all partners.`,
    missing,
  );
  const importsDetail = available
    ? [otherMeasure, yearNote].filter(Boolean).join(" · ")
    : (monthUnavailableText ?? "");

  const compKey = compareYear !== null ? monthKey(compareYear, month) : null;
  const compInfo = cMatrix?.months[month - 1] ?? null;
  const compTotal = compInfo && isAvailable(compInfo) ? (compareTotals?.[month - 1] ?? null) : null;
  const changeValue = available ? (yoy[month - 1] ?? null) : null;
  const changeLabel = compKey ? `Change vs ${formatMonth(compKey)}` : "Change vs a year earlier";
  const change = ind(
    "seasonal.change_vs_comparison_year",
    changeLabel,
    changeValue,
    "change",
    "derived",
    compKey ? `${monthLabel} vs ${formatMonth(compKey)}` : monthLabel,
    `Relative change in recorded ${word}: (${monthLabel} − same month of the comparison year) ÷ same month of the comparison year.${measure === "value" ? " Current prices: not adjusted for inflation." : ""}`,
    available && compKey ? "not_applicable" : missing,
  );
  const changeDetail = !available
    ? (monthUnavailableText ?? "")
    : compKey === null
      ? (compareYearNote ?? "")
      : compTotal === null
        ? `${formatMonth(compKey)} has no figures`
        : `${formatMonth(compKey)}: ${formatMeasure(compTotal, measure)}`;
  const changeBreaks = available && compKey && changeValue !== null ? comparisonBreaks(compKey, key) : [];
  const changeCaution = seriesBreakCaution(changeBreaks);
  const changeDetailText = changeBreaks.length ? `${changeDetail} · series break` : changeDetail;

  const topShare = current?.shares[0] ?? null;
  const top = ind(
    "seasonal.top_partner_share",
    topShare ? `Top recorded partner: ${topShare.name}` : "Top recorded partner",
    available ? (topShare?.share ?? null) : null,
    "share",
    "derived",
    monthLabel,
    `Largest partner's share of recorded ${word} allocated to countries in ${monthLabel}.`,
    available ? "not_applicable" : missing,
  );
  const cr3 = current ? concentrationRatio(current.shares, 3) : null;
  const topDetail = !available
    ? (monthUnavailableText ?? "")
    : topShare
      ? `${topShare.name}${cr3 !== null ? ` · top 3: ${formatShare(cr3)}` : ""}`
      : "No recorded imports this month";

  const monthHhi = available ? (hhiSeries[month - 1] ?? null) : null;
  const hhiInd = ind(
    "seasonal.monthly_hhi",
    "Monthly concentration (HHI)",
    monthHhi,
    "HHI",
    "derived",
    monthLabel,
    `Herfindahl–Hirschman Index of partner shares of recorded ${word} in ${monthLabel}: Σ(100 × share)², 0–10,000.`,
    available ? "not_applicable" : missing,
  );
  const yearHhi = hhiSeries.filter((h): h is number => h !== null);
  const nEff = effectivePartners(monthHhi);
  const hhiDetail = !available
    ? (monthUnavailableText ?? "")
    : [
        nEff !== null ? `Effective partners ${nEff.toFixed(1)}` : "",
        yearHhi.length > 1
          ? `${year} range ${formatHhi(Math.min(...yearHhi))}–${formatHhi(Math.max(...yearHhi))}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");

  // --- Notices (explicit handling of missing, partial and changing data) ----------------------
  const notices: SeasonalNotice[] = [];
  if (yearAdjusted)
    notices.push({
      id: "year-adjusted",
      tone: "warn",
      text: `The year in this link (${sel.year}) is outside the snapshot, so ${year} is shown`,
    });
  const unpublished = months.filter((m) => m.state === "not_yet_published").map((m) => m.month);
  if (unpublished.length)
    notices.push({
      id: "unpublished",
      tone: "info",
      text: `${monthRunsText(unpublished, year)} not yet published by HMRC (latest: ${formatMonth(range.last)}). These months are hatched and nothing is estimated for them`,
    });
  const before = months.filter((m) => m.state === "before_snapshot").map((m) => m.month);
  if (before.length)
    notices.push({
      id: "before",
      tone: "info",
      text: `${monthRunsText(before, year)} before this snapshot (it starts ${formatMonth(range.first)})`,
    });
  const nil = months.filter((m) => m.state === "nil").map((m) => m.month);
  if (nil.length)
    notices.push({
      id: "nil",
      tone: "info",
      text: `No recorded imports in ${monthRunsText(nil, year)} (published as nil)`,
    });
  if (!season.complete && availableMonths.length > 0)
    notices.push({
      id: "partial-year",
      tone: "info",
      text: `${year} is incomplete (${monthRunsText(availableMonths)} published): annual figures such as the peak month and a month's share of the year are not shown${
        lfl && compareYear !== null
          ? `, and the year-on-year total compares ${monthRunsText(lfl.months.map((i) => i + 1))} only`
          : ""
      }`,
    });
  const provisional = months.filter((m) => m.provisional).map((m) => m.month);
  if (provisional.length)
    notices.push({
      id: "provisional",
      tone: "info",
      text: `${monthRunsText(provisional, year)} provisional: HMRC revises data for up to 18 months after publication`,
    });
  if (compareYearNote && sel.compareYear !== null && compareYear !== sel.compareYear)
    notices.push({ id: "compare-year", tone: "warn", text: compareYearNote });

  if (measure === "value" && compareYear !== null)
    notices.push({ id: "current-prices", tone: "info", text: CURRENT_PRICES_NOTE.replace(/\.$/, "") });

  const comp = comparability(snapshot, year, compareYear);
  for (const b of comp.seriesBreaks)
    notices.push({
      id: `break-${b.month}`,
      tone: "warn",
      text: `Comparison crosses a series break in ${formatMonth(b.month)} (${inSentence(b.label)}): differences between ${compareYear} and ${year} may partly reflect how the data was collected`,
    });
  for (const c of comp.codeChanges) {
    const ended = c.ended.map((x) => x.code).join(", ");
    const started = c.started.map((x) => x.code).join(", ");
    notices.push({
      id: `codes-${c.month}`,
      tone: "info",
      text: `Commodity codes changed in ${formatMonth(c.month)}: ${ended} has no records after ${formatMonth(addMonths(c.month, -1))}; ${started} ${c.started.length > 1 ? "are" : "is"} recorded from ${formatMonth(c.month)}. The basket includes every code, so its totals are continuous`,
    });
  }
  const seasonal = seasonalCodes(snapshot);
  for (const c of seasonal.filter((x) => x.shareOfBasket >= 0.01))
    notices.push({
      id: `seasonal-code-${c.code}`,
      tone: "info",
      text: `Code ${c.code} (HMRC: “${c.description}”) holds ${formatShare(c.coverage)} of its recorded net mass in ${monthRunsText(c.months)} and ${formatShare(c.shareOfBasket)} of the basket since ${formatMonth(range.first)}. The basket includes every code, so its monthly totals do not switch with the code`,
    });

  // The map frames the year's leading partners, so it stays still while the months play.
  const meta = new Map(snapshot.partners.map((p) => [p.key, p]));
  const yearStarts = topPartnersForYear(matrix, Number.MAX_SAFE_INTEGER)
    .keys.map((k) => meta.get(k))
    .filter((p) => p !== undefined && p.key !== "GB" && p.geometry !== "none" && p.point !== null)
    .slice(0, Math.max(0, sel.flowCount))
    .map((p) => p!.point!);
  const frame = frameFor(snapshot.commodity.id, yearStarts, ukAnchor);
  const map: OriginsMapModel = current
    ? { ...current.map, frame }
    : { commodityId: snapshot.commodity.id, periodLabel: monthLabel, measure, partners: [], ukAnchor, frame };

  return {
    commodity: snapshot.commodity,
    measure,
    range: { ...range, provisionalFrom: snapshot.months.provisionalFrom },
    years,
    year,
    month,
    monthKey: key,
    monthLabel,
    monthInfo: info,
    available,
    monthUnavailableText,
    compareYear,
    compareYearNote,
    compareMonth: sel.compareMonth,
    months,
    compareMonths: cMatrix?.months ?? null,
    totals,
    compareTotals,
    barScaleMax: maxMonthlyTotal(snapshot, measure),
    hhi: hhiSeries,
    compareHhi,
    yoy,
    likeForLike: lfl,
    seasonality: season,
    compareSeasonality: cSeason,
    heatmap: { mode: sel.heatmap, rows: heat.rows, othersCount: heat.othersCount, rankedOn },
    current,
    summary,
    monthComparison,
    kpis: {
      imports,
      importsDetail,
      change,
      changeLabel,
      changeDetail: changeDetailText,
      changeCaution,
      top,
      topDetail,
      hhi: hhiInd,
      hhiDetail,
    },
    flowScale,
    map,
    notices,
    comparability: comp,
    codes: { changes: comp.codeChanges, seasonal, all: snapshot.commodity.cn8 },
    domestic: domesticProduction(snapshot.commodity.id),
    yearAdjusted,
  };
}

/** "Jan–Aug 2026 vs Jan–Aug 2025: +0.5 %" (like-for-like months only). */
export function likeForLikeText(model: SeasonalModel): string | null {
  const l = model.likeForLike;
  if (!l || model.compareYear === null) return null;
  const months = l.months.map((i) => i + 1);
  const span = (y: number) =>
    months.length === 12
      ? String(y)
      : formatMonthRange(monthKey(y, months[0]!), monthKey(y, months[months.length - 1]!));
  const contiguous = months.every((m, i) => i === 0 || m === months[i - 1]! + 1);
  const label = contiguous
    ? `${span(model.year)} vs ${span(model.compareYear)}`
    : `${monthRunsText(months)}: ${model.year} vs ${model.compareYear}`;
  return `${label}: ${formatChange(l.change)}`;
}
