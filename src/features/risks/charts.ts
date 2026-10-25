/**
 * ECharts options for the Risk Explorer (Stage 6). Pure; colours mirror src/styles/tokens.css
 * (charts sit on the dark panel whatever the basemap). Semantic colour (Stage 6 brief): the warm
 * risk ramp shows vulnerability measures (concentration, water stress, exposure, priority places);
 * the teal ramp shows volumes and shares. Every chart has a text description and a table or list
 * beside it (AX-06), and colour is never the only cue (labels, axis values, tooltips).
 */
import type { EChartsCoreOption } from "echarts/core";
import { formatHhi, formatShare, formatTonnes, MONTHS_SHORT } from "@/analysis/format";
import {
  hhiClass,
  HHI_BREAKS,
  STRESS_CLASSES,
  STRESS_LABELS,
  type CommodityConcentration,
  type DisruptionExposure,
  type ExposureMatrix,
  type GroupSummary,
  type MonthConcentration,
  type StressExposure,
  type YearSummary,
} from "@/analysis/risk";
import { formatMonth, parseMonthKey, SHARE_BREAKS } from "@/analysis/trade";
import { BRAND, RISK_DARK, SHARE_CLASS_HEX } from "@/styles/palette";
import type { RiskPortEntry } from "@/types/generated/risk-port-entry";
import type { CouncilRiskRow } from "./model";

const TEXT = BRAND.text;
const MUTED = BRAND.muted;
const LINE = "rgba(73,234,216,0.16)";
const PANEL = "#073435";
const FONT = "IBM Plex Sans, system-ui, sans-serif";
const NONE = "#2a4a4d";

const tooltip = {
  backgroundColor: "rgba(7,25,35,0.95)",
  borderColor: LINE,
  textStyle: { color: TEXT, fontSize: 12 },
};

const axisLabel = { color: MUTED, fontSize: 10 };
const catLabel = { color: TEXT, fontSize: 10 };

export interface ChartSpec {
  option: EChartsCoreOption;
  description: string;
}

function hBars(
  labels: string[],
  values: (number | null)[],
  colours: string[],
  opts: {
    format: (v: number) => string;
    tooltip: (i: number) => string;
    markLine?: { value: number; label: string };
    bold?: number | null;
    max?: number;
  },
): EChartsCoreOption {
  return {
    textStyle: { fontFamily: FONT, color: MUTED },
    // Bars carry their own value labels, so the value axis keeps only its grid lines (its tick
    // labels collided in a narrow panel); the reference line is labelled above the plot.
    grid: { left: 4, right: 48, top: opts.markLine ? 18 : 6, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (p: { dataIndex: number }) => opts.tooltip(p.dataIndex),
    },
    xAxis: {
      type: "value",
      max: opts.max,
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
      axisLabel: {
        ...catLabel,
        width: 120,
        overflow: "truncate",
        formatter: (v: string, i: number) => (i === opts.bold ? `{b|${v}}` : v),
        rich: { b: { color: BRAND.green, fontWeight: 600, fontSize: 10 } },
      },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 14,
        data: values.map((v, i) => ({
          value: v,
          itemStyle: { color: colours[i], borderRadius: [0, 4, 4, 0] },
        })),
        label: {
          show: true,
          position: "right",
          color: TEXT,
          fontSize: 10,
          formatter: (p: { value: number | null }) => (p.value === null ? "no data" : opts.format(p.value)),
        },
        ...(opts.markLine
          ? {
              markLine: {
                symbol: "none",
                silent: true,
                lineStyle: { color: BRAND.amber, type: "dashed", width: 1 },
                label: {
                  color: BRAND.amber,
                  fontSize: 10,
                  position: "start",
                  formatter: opts.markLine.label,
                },
                data: [{ xAxis: opts.markLine.value }],
              },
            }
          : {}),
      },
    ],
  };
}

/**
 * ECharts requires a visualMap for heatmap series (a development-build check). The colours are
 * already decided per class, so the visualMap is hidden and maps a class index (the cell's fourth
 * value) to the same colour: no continuous colour scale is introduced.
 */
function classVisualMap(colours: readonly string[], extra: { value: number; color: string }[] = []) {
  return {
    type: "piecewise",
    show: false,
    seriesIndex: 0,
    dimension: 3,
    pieces: [...extra, ...colours.map((color, value) => ({ value, color }))],
  };
}
const GAP = -1;
const NONE_RECORDED = -2;

const riskColour = (cls: number | null) => (cls === null ? MUTED : (RISK_DARK[cls] ?? RISK_DARK[0]!));
const pctAxis = (v: number) => `${Math.round(v * 100)} %`;

// ---------------------------------------------------------------------------------------------
// Supply

/** Concentration by commodity (the five baskets, same period), most concentrated first; click to select. */
export function rankingOption(rows: readonly CommodityConcentration[], selected: string): ChartSpec | null {
  if (rows.length === 0) return null;
  const option = hBars(
    rows.map((r) => r.label),
    rows.map((r) => r.hhi),
    rows.map((r) => riskColour(hhiClass(r.hhi))),
    {
      format: (v) => formatHhi(v),
      bold: rows.findIndex((r) => r.id === selected),
      tooltip: (i) => {
        const r = rows[i]!;
        return `${r.label}: HHI ${formatHhi(r.hhi)}<br/>Top partner ${r.top?.name ?? "—"} ${formatShare(r.cr1)} · top 3 ${formatShare(r.cr3)}<br/>${r.partners} recorded partners<br/>Click to show this commodity`;
      },
    },
  );
  const description = `Partner concentration (HHI) by commodity, most concentrated first: ${rows
    .map((r) => `${r.label} ${formatHhi(r.hhi)}`)
    .join(", ")}.`;
  return { option, description };
}

/** Recorded imports by calendar year; a partial year is labelled with its months and drawn hatched. */
export function trendOption(
  years: readonly YearSummary[],
  measureLabel: string,
  fmt: (v: number) => string,
): ChartSpec | null {
  if (years.every((y) => y.total === 0)) return null;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 8, top: 14, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (p: { dataIndex: number }) => {
        const y = years[p.dataIndex]!;
        return `${y.year}${y.complete ? "" : ` (${y.months} months)`}: ${fmt(y.total)}${y.provisional ? "<br/>Includes provisional months" : ""}<br/>HHI ${formatHhi(y.hhi)} · ${y.partners} partners`;
      },
    },
    xAxis: {
      type: "category",
      data: years.map((y) => (y.complete ? String(y.year) : `${y.year}*`)),
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: catLabel,
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { ...axisLabel, formatter: (v: number) => fmt(v) },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 22,
        data: years.map((y) => ({
          value: y.total,
          itemStyle: {
            color: y.complete ? BRAND.cyan : "rgba(73,234,216,0.35)",
            borderColor: y.complete ? undefined : BRAND.cyan,
            borderType: "dashed",
            borderRadius: [4, 4, 0, 0],
            decal: y.complete
              ? undefined
              : {
                  symbol: "rect",
                  dashArrayX: [1, 0],
                  dashArrayY: [2, 4],
                  rotation: -0.8,
                  color: "rgba(7,25,35,0.6)",
                },
          },
        })),
      },
    ],
  };
  const description = `Recorded imports (${measureLabel}) by calendar year: ${years
    .map((y) => `${y.year}${y.complete ? "" : ` (${y.months} months)`} ${fmt(y.total)}`)
    .join(", ")}.`;
  return { option, description };
}

/** Partner × commodity matrix of shares (teal share classes, as the map); 0 = none recorded. */
export function matrixOption(m: ExposureMatrix): ChartSpec | null {
  if (m.partners.length === 0) return null;
  const data: [number, number, number | null][] = [];
  m.cells.forEach((row, y) => row.forEach((v, x) => data.push([x, y, v])));
  const shareClass = (v: number) => {
    let c = 0;
    for (const b of SHARE_BREAKS) if (v >= b) c += 1;
    return c;
  };
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 4, top: 4, bottom: 4, containLabel: true },
    visualMap: classVisualMap(SHARE_CLASS_HEX, [
      { value: GAP, color: PANEL },
      { value: NONE_RECORDED, color: NONE },
    ]),
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (p: { value: [number, number, number | null] }) => {
        const [x, y, v] = p.value;
        return `${m.partners[y]!.name} · ${m.commodities[x]!.label}: ${v === null ? "no data" : v === 0 ? "none recorded" : formatShare(v)}`;
      },
    },
    xAxis: {
      type: "category",
      position: "top",
      data: m.commodities.map((c) => c.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { ...catLabel, interval: 0 },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: m.partners.map((p) => p.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { ...catLabel, width: 110, overflow: "truncate" },
    },
    series: [
      {
        type: "heatmap",
        data: data.map(([x, y, v]) => ({
          value: [x, y, v, v === null ? GAP : v === 0 ? NONE_RECORDED : shareClass(v)],
          itemStyle: {
            color: v === null ? PANEL : v === 0 ? NONE : SHARE_CLASS_HEX[shareClass(v)],
            borderColor: PANEL,
            borderWidth: 2,
            borderRadius: 3,
          },
        })),
        label: {
          show: true,
          fontSize: 9,
          color: TEXT,
          formatter: (p: { value: [number, number, number | null] }) =>
            p.value[2] === null ? "" : p.value[2] === 0 ? "–" : `${Math.round(p.value[2] * 100)}`,
        },
      },
    ],
  };
  const description = `Share of each commodity's recorded imports (%) by partner, for each commodity's top partners: ${m.partners
    .map(
      (p, y) =>
        `${p.name} ${m.commodities.map((c, x) => `${c.label} ${m.cells[y]![x] === null ? "no data" : formatShare(m.cells[y]![x]!)}`).join(", ")}`,
    )
    .join("; ")}.`;
  return { option, description };
}

/** HHI by month (years × months) on the risk ramp; months without recorded imports are shown as gaps. */
export function monthlyHeatmapOption(rows: readonly MonthConcentration[]): ChartSpec | null {
  if (rows.length === 0) return null;
  const years = [...new Set(rows.map((r) => parseMonthKey(r.month).year))];
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 4, top: 4, bottom: 4, containLabel: true },
    visualMap: classVisualMap(RISK_DARK, [{ value: GAP, color: PANEL }]),
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (p: { dataIndex: number }) => {
        const r = rows[p.dataIndex]!;
        return r.hhi === null
          ? `${formatMonth(r.month)}: no recorded imports`
          : `${formatMonth(r.month)}${r.provisional ? " (provisional)" : ""}: HHI ${formatHhi(r.hhi)}<br/>${r.top!.name} ${formatShare(r.top!.share)} · ${r.partners} partners`;
      },
    },
    xAxis: {
      type: "category",
      position: "top",
      data: [...MONTHS_SHORT],
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: catLabel,
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: years.map(String),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: catLabel,
    },
    series: [
      {
        type: "heatmap",
        data: rows.map((r) => {
          const { year, month } = parseMonthKey(r.month);
          const cls = hhiClass(r.hhi);
          return {
            value: [month - 1, years.indexOf(year), r.hhi, cls ?? GAP],
            itemStyle: {
              color: cls === null ? PANEL : RISK_DARK[cls],
              borderColor: r.provisional ? MUTED : PANEL,
              borderWidth: r.provisional ? 1 : 2,
              borderType: r.provisional ? "dashed" : "solid",
              borderRadius: 3,
            },
          };
        }),
      },
    ],
  };
  const latest = rows[rows.length - 1]!;
  const peak = rows.filter((r) => r.hhi !== null).sort((a, b) => b.hhi! - a.hhi!)[0];
  const description = `Monthly partner concentration (HHI) from ${formatMonth(rows[0]!.month)} to ${formatMonth(latest.month)}, in classes of 1,000${peak ? `; highest ${formatHhi(peak.hhi)} in ${formatMonth(peak.month)}` : ""}.`;
  return { option, description };
}

export const HHI_CLASS_LABELS = [
  "Below 1,000",
  ...HHI_BREAKS.slice(0, -1).map(
    (b, i) => `${(b / 1000).toFixed(0)},000 – ${(HHI_BREAKS[i + 1]! / 1000).toFixed(0)},000`,
  ),
  "5,000 and over",
];

/** A partner's monthly share of recorded imports (estimated exposure), with the 50 % line. */
export function disruptionOption(d: DisruptionExposure, name: string): ChartSpec | null {
  if (d.monthsWithShare === 0) return null;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 8, top: 14, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (p: { dataIndex: number }) => {
        const m = d.months[p.dataIndex]!;
        return m.share === null
          ? `${formatMonth(m.month)}: no recorded imports`
          : `${formatMonth(m.month)}${m.provisional ? " (provisional)" : ""}: ${name} ${formatShare(m.share)} of recorded imports`;
      },
    },
    xAxis: {
      type: "category",
      data: d.months.map((m) => MONTHS_SHORT[parseMonthKey(m.month).month - 1]),
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: catLabel,
    },
    yAxis: {
      type: "value",
      max: 1,
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { ...axisLabel, formatter: pctAxis },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 18,
        data: d.months.map((m) => ({
          value: m.share,
          itemStyle: { color: RISK_DARK[3], borderRadius: [4, 4, 0, 0] },
        })),
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { color: BRAND.amber, type: "dashed", width: 1 },
          label: { color: BRAND.amber, fontSize: 10, formatter: "half" },
          data: [{ yAxis: 0.5 }],
        },
      },
    ],
  };
  const description = `${name}'s share of recorded imports by month: ${d.months
    .map((m) => `${formatMonth(m.month)} ${m.share === null ? "none recorded" : formatShare(m.share)}`)
    .join(", ")}.`;
  return { option, description };
}

/** Recorded imports by partners' national water-stress class (FAO), with no data apart. */
export function stressOption(s: StressExposure): ChartSpec {
  const keys = [...STRESS_CLASSES, "noData"] as const;
  const option = hBars(
    keys.map((k) => STRESS_LABELS[k]),
    keys.map((k) => s.byClass[k]),
    keys.map((k, i) => (k === "noData" ? MUTED : RISK_DARK[i + 1]!)),
    {
      format: (v) => formatShare(v),
      max: 1,
      tooltip: (i) => {
        const k = keys[i]!;
        return `${STRESS_LABELS[k]}: ${formatShare(s.byClass[k])} of recorded imports (${s.partners[k].length} partners)`;
      },
    },
  );
  const description = `Recorded imports by partners' national water-stress class: ${keys
    .map((k) => `${STRESS_LABELS[k]} ${formatShare(s.byClass[k])}`)
    .join(", ")}.`;
  return { option, description };
}

// ---------------------------------------------------------------------------------------------
// Logistics

/** UKFSR food, feed and drink imports by port of entry (latest year); the selected port's group emphasised. */
export function entryOption(entry: RiskPortEntry, selectedPort: string | null): ChartSpec {
  const e = entry.portOfEntry;
  const i = e.years.length - 1;
  const groups = e.groups;
  const option = hBars(
    groups.map((g) => g.label),
    groups.map((g) => g.values[i]! / 100),
    groups.map((g) =>
      selectedPort && g.locodes.includes(selectedPort) ? BRAND.green : g.locodes.length ? BRAND.cyan : MUTED,
    ),
    {
      format: (v) => formatShare(v),
      tooltip: (k) => {
        const g = groups[k]!;
        return `${g.label}: ${formatShare(g.values[i]! / 100)} of UK food, feed and drink import volume, ${e.years[i]}${g.locodes.length ? "<br/>Click to select the port on the map" : ""}`;
      },
    },
  );
  const description = `Share of UK food, feed and drink import volume by port of entry, ${e.years[i]} (UKFSR 2024): ${groups
    .map((g) => `${g.label} ${formatShare(g.values[i]! / 100)}`)
    .join(", ")}.`;
  return { option, description };
}

/** Short Straits share by food group (UKFSR 3_2_2b, latest year): a dependency, on the risk colour. */
export function shortStraitsOption(entry: RiskPortEntry): ChartSpec {
  const s = entry.shortStraits;
  const i = s.years.length - 1;
  const option = hBars(
    s.foods.map((f) => f.food),
    s.foods.map((f) => f.values[i]! / 100),
    s.foods.map(() => RISK_DARK[3]!),
    {
      format: (v) => formatShare(v),
      max: 1,
      tooltip: (k) =>
        `${s.foods[k]!.food}: ${formatShare(s.foods[k]!.values[i]! / 100)} of the group's import volume via Dover, Folkestone or the Channel Tunnel, ${s.years[i]}`,
    },
  );
  const description = `Share of each food group's import volume entering via Dover, Folkestone or the Channel Tunnel, ${s.years[i]}: ${s.foods
    .map((f) => `${f.food} ${formatShare(f.values[i]! / 100)}`)
    .join(", ")}.`;
  return { option, description };
}

/** A port's (or all ports') tonnage by year for the measure; missing years are gaps. */
export function portTrendOption(
  years: readonly number[],
  series: readonly (number | null)[],
  label: string,
): ChartSpec | null {
  if (series.every((v) => v === null)) return null;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 8, top: 14, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (p: { dataIndex: number }) => {
        const v = series[p.dataIndex];
        return `${years[p.dataIndex]}: ${v === null || v === undefined ? "not reported" : formatTonnes(v * 1000)}`;
      },
    },
    xAxis: {
      type: "category",
      data: years.map(String),
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: catLabel,
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { ...axisLabel, formatter: (v: number) => formatTonnes(v * 1000) },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 18,
        data: series.map((v) => ({ value: v, itemStyle: { color: BRAND.cyan, borderRadius: [4, 4, 0, 0] } })),
      },
    ],
  };
  const description = `${label} by year: ${years
    .map((y, i) => `${y} ${series[i] === null ? "not reported" : formatTonnes(series[i]! * 1000)}`)
    .join(", ")}.`;
  return { option, description };
}

/** A port's inward freight by region of loading, latest year (agricultural products or all cargo). */
export function portRegionsOption(
  rows: { region: string; value: number }[],
  label: string,
): ChartSpec | null {
  const shown = rows.filter((r) => r.value > 0);
  if (shown.length === 0) return null;
  const option = hBars(
    shown.map((r) => r.region),
    shown.map((r) => r.value * 1000),
    shown.map(() => BRAND.cyan),
    {
      format: (v) => formatTonnes(v),
      tooltip: (i) => `${shown[i]!.region}: ${formatTonnes(shown[i]!.value * 1000)}`,
    },
  );
  const description = `${label} by region of loading: ${shown.map((r) => `${r.region} ${formatTonnes(r.value * 1000)}`).join(", ")}.`;
  return { option, description };
}

/** Average delay on England's Strategic Road Network: 12-month (year-ending) line, monthly faint. */
export function srnOption(entry: RiskPortEntry): ChartSpec {
  const s = entry.srnDelay;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 8, top: 14, bottom: 4, containLabel: true },
    tooltip: { ...tooltip, trigger: "axis" },
    xAxis: {
      type: "category",
      data: s.months,
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: {
        ...catLabel,
        formatter: (v: string) => (v.endsWith("-01") ? v.slice(0, 4) : ""),
        interval: 0,
      },
    },
    yAxis: {
      type: "value",
      min: (v: { min: number }) => Math.floor(v.min - 0.5),
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { ...axisLabel, formatter: (v: number) => `${v} s` },
    },
    series: [
      {
        name: "Month",
        type: "line",
        symbol: "none",
        data: s.monthly,
        lineStyle: { color: MUTED, width: 1, opacity: 0.6 },
      },
      {
        name: "12 months to",
        type: "line",
        symbol: "none",
        connectNulls: false,
        data: s.yearEnding,
        lineStyle: { color: BRAND.cyan, width: 2 },
      },
    ],
  };
  let i = s.yearEnding.length - 1;
  while (i >= 0 && s.yearEnding[i] === null) i--;
  const description = `Average delay on England's Strategic Road Network, seconds per vehicle per mile, ${s.months[0]} to ${s.months[s.months.length - 1]}${i >= 0 ? `; ${s.yearEnding[i]} s in the 12 months to ${s.months[i]}` : ""}.`;
  return { option, description };
}

// ---------------------------------------------------------------------------------------------
// Community access

/** Councils of one nation by share (highest first), the selected council always included. */
export function councilRankingOption(
  ranking: readonly CouncilRiskRow[],
  selected: string | null,
  nationShare: number | null,
  limit = 12,
): ChartSpec | null {
  if (ranking.length === 0) return null;
  let rows = ranking.slice(0, limit);
  const sel = selected ? ranking.find((r) => r.code === selected) : undefined;
  if (sel && !rows.includes(sel)) rows = [...rows, sel];
  const option = hBars(
    rows.map((r) => `${r.rank ? `${r.rank.rank}${r.rank.tied ? "=" : ""}. ` : ""}${r.name}`),
    rows.map((r) => r.share),
    rows.map((r) => riskColour(r.cls)),
    {
      format: (v) => formatShare(v),
      max: 1,
      bold: sel ? rows.indexOf(sel) : null,
      markLine: nationShare === null ? undefined : { value: nationShare, label: "nation" },
      tooltip: (i) => {
        const r = rows[i]!;
        return `${r.name}: ${formatShare(r.share)} (${r.priority} of ${r.areas} small areas)${r.fewAreas ? "<br/>Few small areas: one area moves the share a lot" : ""}<br/>Click to select the council`;
      },
    },
  );
  const description = `Councils ranked within the nation by the share of their small areas in its highest-priority deciles: ${rows
    .map((r) => `${r.name} ${formatShare(r.share)}`)
    .join(", ")}${nationShare === null ? "" : `; the nation as a whole ${formatShare(nationShare)}`}.`;
  return { option, description };
}

/** The selected council's small areas by decile of the combined index (1 = highest priority). */
export function decileOption(deciles: readonly number[], nation: string): ChartSpec | null {
  if (deciles.every((d) => d === 0)) return null;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 8, top: 14, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (p: { dataIndex: number }) =>
        `Decile ${p.dataIndex + 1} of ${nation}: ${deciles[p.dataIndex]} small areas`,
    },
    xAxis: {
      type: "category",
      data: deciles.map((_, i) => String(i + 1)),
      name: `Decile within ${nation} (1 = highest priority)`,
      nameLocation: "middle",
      nameGap: 22,
      nameTextStyle: { color: MUTED, fontSize: 10 },
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: catLabel,
    },
    yAxis: { type: "value", minInterval: 1, splitLine: { lineStyle: { color: LINE } }, axisLabel },
    series: [
      {
        type: "bar",
        barMaxWidth: 16,
        data: deciles.map((v, i) => ({
          value: v,
          itemStyle: { color: i < 2 ? RISK_DARK[4] : MUTED, borderRadius: [4, 4, 0, 0] },
        })),
      },
    ],
  };
  const description = `Small areas by decile of the combined index within ${nation}: ${deciles
    .map((v, i) => `decile ${i + 1} ${v}`)
    .join(", ")}.`;
  return { option, description };
}

/** The selected council's share in deciles 1–2 for each measure, beside the nation's (about 20 %). */
export function domainsOption(
  rows: readonly { label: string; share: number | null }[],
  nationShare = 0.2,
): ChartSpec | null {
  if (rows.length === 0) return null;
  const option = hBars(
    rows.map((r) => r.label),
    rows.map((r) => r.share),
    rows.map((r) => (r.share === null ? MUTED : RISK_DARK[3]!)),
    {
      format: (v) => formatShare(v),
      max: 1,
      markLine: { value: nationShare, label: "20 %" },
      tooltip: (i) =>
        `${rows[i]!.label}: ${rows[i]!.share === null ? "no data in this nation" : `${formatShare(rows[i]!.share)} of the council's small areas in deciles 1–2`}`,
    },
  );
  const description = `Share of the council's small areas in the nation's deciles 1–2, by measure: ${rows
    .map((r) => `${r.label} ${r.share === null ? "no data" : formatShare(r.share)}`)
    .join(", ")}.`;
  return { option, description };
}

/** Median council share by urban/rural flag, England and Wales separately (never pooled). */
export function urbanRuralOption(groups: { nation: string; groups: GroupSummary[] }[]): ChartSpec | null {
  const rows = groups.flatMap((n) => n.groups.map((g) => ({ label: `${n.nation}: ${g.group}`, g })));
  if (rows.length === 0) return null;
  const option = hBars(
    rows.map((r) => r.label),
    rows.map((r) => r.g.median),
    rows.map(() => RISK_DARK[3]!),
    {
      format: (v) => formatShare(v),
      max: 0.6,
      markLine: { value: 0.2, label: "20 %" },
      tooltip: (i) =>
        `${rows[i]!.label}: median council ${formatShare(rows[i]!.g.median)} · all areas pooled ${formatShare(rows[i]!.g.pooled)} · ${rows[i]!.g.councils} councils`,
    },
  );
  const description = `Median share of council small areas in deciles 1–2, by ONS urban/rural flag: ${rows
    .map((r) => `${r.label} ${formatShare(r.g.median)} (${r.g.councils} councils)`)
    .join(", ")}.`;
  return { option, description };
}
