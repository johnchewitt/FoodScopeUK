/**
 * Before-and-after charts for the Scenario Lab (Stage 7). Pure ECharts options. Two series on one
 * axis and unit only: the baseline (teal, as published) and the scenario (warm, Scenario-modelled),
 * so colour and the HTML legend under each chart say which is which; every chart has a text
 * description and its values in the results table beside it (AX-06).
 */
import type { EChartsCoreOption } from "echarts/core";
import { formatGbp, formatKm, formatPopulation, formatShare, formatTonnes } from "@/analysis/format";
import { formatMonth, type PartnerShare } from "@/analysis/trade";
import { overMonths, UNITISED_GROUPS, type ImportDisruptionResult } from "@/analysis/scenario";
import { BRAND, RISK_DARK, SHARE_CLASS_HEX } from "@/styles/palette";
import type { Measure } from "@/state/urlState";
import type { AffectedRow, ClosureModel, PortModel, ProductionModel } from "./model";

export const BASELINE_COLOUR = SHARE_CLASS_HEX[3]!;
export const SCENARIO_COLOUR = RISK_DARK[4];

const TEXT = BRAND.text;
const MUTED = BRAND.muted;
const LINE = "rgba(73,234,216,0.16)";
const FONT = "IBM Plex Sans, system-ui, sans-serif";
const tooltip = {
  backgroundColor: "rgba(7,25,35,0.95)",
  borderColor: LINE,
  textStyle: { color: TEXT, fontSize: 12 },
};

export interface ChartSpec {
  option: EChartsCoreOption;
  description: string;
  /** Pixels: callers size horizontal charts to their rows. */
  height: number;
}

/** Paired horizontal bars, baseline and scenario per category (one unit). */
function pairedBars(
  labels: string[],
  baseline: (number | null)[],
  scenario: (number | null)[],
  format: (v: number) => string,
  tooltipRow: (i: number) => string,
): EChartsCoreOption {
  const bar = (name: string, values: (number | null)[], colour: string) => ({
    type: "bar",
    name,
    barMaxWidth: 10,
    barGap: "20%",
    data: values.map((v) => ({ value: v, itemStyle: { color: colour, borderRadius: [0, 3, 3, 0] } })),
    label: {
      show: true,
      position: "right",
      color: TEXT,
      fontSize: 9,
      formatter: (p: { value: number | null }) => (p.value === null ? "no data" : format(p.value)),
    },
  });
  return {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 56, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (p: { dataIndex: number }[]) => tooltipRow(p[0]?.dataIndex ?? 0),
    },
    xAxis: {
      type: "value",
      splitNumber: 3,
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { show: false },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: labels,
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: { color: TEXT, fontSize: 10, interval: 0, width: 116, overflow: "truncate" },
    },
    series: [bar("Baseline", baseline, BASELINE_COLOUR), bar("Scenario", scenario, SCENARIO_COLOUR)],
  };
}

const rowsHeight = (n: number) => Math.max(90, 26 + n * 30);

// ---------------------------------------------------------------------------------------------
// A

export function importMonthsChart(r: ImportDisruptionResult, measure: Measure): ChartSpec | null {
  const used = r.months.filter((m) => m.inSnapshot);
  if (used.length === 0) return null;
  const fmt = (v: number) => (measure === "mass" ? formatTonnes(v) : formatGbp(v));
  const labels = used.map((m) => formatMonth(m.month));
  const base = used.map((m) => m.partnerBaseline);
  const after = used.map((m) => m.partnerBaseline - m.affected);
  return {
    height: rowsHeight(used.length),
    description: `Recorded imports from ${r.partnerName ?? r.partner} by month, baseline and scenario: ${labels
      .map((l, i) => `${l} ${fmt(base[i]!)} to ${fmt(after[i]!)}`)
      .join("; ")}.`,
    option: pairedBars(labels, base, after, fmt, (i) => {
      const m = used[i]!;
      return `${labels[i]}<br/>Baseline ${fmt(m.partnerBaseline)} of ${fmt(m.total)}<br/>Scenario ${fmt(
        m.partnerBaseline - m.affected,
      )} (reduction ${Math.round(m.effective * 100)} %)${m.provisional ? "<br/>Provisional" : ""}`;
    }),
  };
}

export function importSharesChart(r: ImportDisruptionResult, top = 8): ChartSpec | null {
  if (r.sharesBefore.length === 0) return null;
  const keys = r.sharesBefore.slice(0, top).map((s) => s.key);
  if (!keys.includes(r.partner) && r.sharesBefore.some((s) => s.key === r.partner)) keys.push(r.partner);
  const find = (list: PartnerShare[], k: string) => list.find((s) => s.key === k)?.share ?? 0;
  const labels = keys.map((k) => r.sharesBefore.find((s) => s.key === k)!.name);
  const before = keys.map((k) => find(r.sharesBefore, k));
  const after = keys.map((k) => (r.sharesAfter.length ? find(r.sharesAfter, k) : null));
  return {
    height: rowsHeight(keys.length),
    description: `Partner shares of recorded imports, baseline and scenario (other partners unchanged): ${labels
      .map((l, i) => `${l} ${formatShare(before[i])} to ${formatShare(after[i])}`)
      .join("; ")}.`,
    option: pairedBars(
      labels,
      before,
      after,
      (v) => formatShare(v),
      (i) => {
        return `${labels[i]}<br/>Baseline ${formatShare(before[i])}<br/>Scenario ${formatShare(after[i])}`;
      },
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// B

export function closureDistanceChart(rows: AffectedRow[], top = 12): ChartSpec | null {
  const list = rows.slice(0, top);
  if (list.length === 0) return null;
  const labels = list.map((a) => a.name);
  return {
    height: rowsHeight(list.length),
    description: `Straight-line distance to the nearest supermarket before and after the closure, for the ${list.length} most affected small areas: ${list
      .map((a) => `${a.name} ${formatKm(a.beforeKm)} to ${formatKm(a.afterKm)}`)
      .join("; ")}.`,
    option: pairedBars(
      labels,
      list.map((a) => a.beforeKm),
      list.map((a) => a.afterKm),
      (v) => formatKm(v),
      (i) => {
        const a = list[i]!;
        return `${a.name} (${a.council})<br/>${formatPopulation(a.population, "small_area")} residents<br/>Before ${formatKm(a.beforeKm)} · after ${formatKm(a.afterKm)}${a.newStore ? `<br/>New nearest: ${a.newStore}` : ""}<br/>Straight-line, not travel time`;
      },
    ),
  };
}

export function closureThresholdChart(m: ClosureModel): ChartSpec {
  const t = m.result.councilDistances.thresholds;
  const labels = t.map((x) => `More than ${x.metres / 1000} km`);
  return {
    height: rowsHeight(t.length),
    description: `Residents of ${m.store.council.name} more than 1, 2 and 5 km in a straight line from a supermarket, before and after: ${t
      .map(
        (x) =>
          `${x.metres / 1000} km ${formatPopulation(x.before, "small_area")} to ${formatPopulation(x.after, "small_area")}`,
      )
      .join("; ")}.`,
    option: pairedBars(
      labels,
      t.map((x) => x.before),
      t.map((x) => x.after),
      (v) => formatPopulation(v, "small_area"),
      (i) =>
        `${labels[i]} (straight-line)<br/>Baseline ${formatPopulation(t[i]!.before, "small_area")}<br/>Scenario ${formatPopulation(t[i]!.after, "small_area")}`,
    ),
  };
}

export function closureRetailerChart(m: ClosureModel, top = 8): ChartSpec | null {
  const before = m.result.retailerBefore.retailers.slice(0, top);
  if (before.length === 0) return null;
  const after = new Map(m.result.retailerAfter.retailers.map((r) => [r.retailer, r.count]));
  const labels = before.map((r) => r.retailer);
  return {
    height: rowsHeight(labels.length),
    description: `Supermarkets by retailer in ${m.store.council.name}, before and after the closure: ${before
      .map((r) => `${r.retailer} ${r.count} to ${after.get(r.retailer) ?? 0}`)
      .join("; ")}.`,
    option: pairedBars(
      labels,
      before.map((r) => r.count),
      before.map((r) => after.get(r.retailer) ?? 0),
      (v) => String(Math.round(v)),
      (i) => `${labels[i]}<br/>Baseline ${before[i]!.count}<br/>Scenario ${after.get(labels[i]!) ?? 0}`,
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// C

export function productionChart(m: ProductionModel): ChartSpec | null {
  const rows = m.rows.filter((r) => r.baseline.unit === "t");
  if (rows.length === 0) return null;
  const labels = rows.map((r) => r.label.replace(/ \(.*\)$/, ""));
  return {
    height: rowsHeight(rows.length),
    description: `Defra's UK supply balance for ${m.label.toLowerCase()}, baseline and scenario: ${rows
      .map((r, i) => `${labels[i]} ${formatTonnes(r.baseline.value)} to ${formatTonnes(r.scenario.value)}`)
      .join("; ")}.`,
    option: pairedBars(
      labels,
      rows.map((r) => r.baseline.value),
      rows.map((r) => r.scenario.value),
      (v) => formatTonnes(v),
      (i) =>
        `${rows[i]!.label}<br/>Baseline ${formatTonnes(rows[i]!.baseline.value)}<br/>Scenario ${formatTonnes(rows[i]!.scenario.value)}`,
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// D

/** "1 month", "3 months", "the year": the disruption window of Scenario D. */
export function portWindowLabel(months: number): string {
  return months >= 12 ? "the year" : `${months} month${months === 1 ? "" : "s"}`;
}

/**
 * Tonnage by cargo group over the disruption window (DfT annual tonnage × months ÷ 12, an even
 * spread), baseline and scenario: the same window as the cards and results table, so a one-month
 * disruption is never drawn as a whole year's reduction.
 */
export function portGroupChart(m: PortModel, reduction: number, months: number): ChartSpec | null {
  const s = m.selected;
  if (!s) return null;
  const groups = s.byGroup.filter((g) => g.value !== null && g.value > 0);
  if (groups.length === 0) return null;
  const labels = groups.map((g) => g.group);
  const r = reduction / 100;
  const base = groups.map((g) => overMonths(g.value, months)!);
  const after = groups.map((g) => overMonths(g.value, months, r)!);
  const kt = (v: number) => formatTonnes(v * 1000);
  const span = portWindowLabel(months);
  return {
    height: rowsHeight(groups.length),
    description: `${s.name}'s inward tonnage by cargo group over ${span} (${m.year} annual tonnage${months < 12 ? ` × ${months} ÷ 12, an even spread` : ""}, any origin), baseline and with every group reduced by ${reduction} %: ${groups
      .map((g, i) => `${g.group} ${kt(base[i]!)} to ${kt(after[i]!)}`)
      .join("; ")}.`,
    option: pairedBars(labels, base, after, kt, (i) => {
      const unitised = (UNITISED_GROUPS as readonly string[]).includes(labels[i]!);
      return `${labels[i]} over ${span} (${m.year}${months < 12 ? ", even spread" : ""})<br/>Baseline ${kt(base[i]!)}<br/>Scenario ${kt(after[i]!)}${unitised ? "<br/>Contents not recorded by DfT" : ""}`;
    }),
  };
}
