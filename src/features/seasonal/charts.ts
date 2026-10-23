/**
 * ECharts option builders for Seasonal Supply (pure). Colours mirror src/styles/tokens.css because
 * ECharts needs concrete values. Series keep stable ids so charts animate in place when the month
 * changes (ChartFrame `merge`), and every chart has a table alternative (AX-06).
 */
import type { EChartsCoreOption } from "echarts/core";
import { formatChange, formatHhi, formatShare, MONTHS_SHORT } from "@/analysis/format";
import { isAvailable, type MonthInfo } from "@/analysis/seasonal";
import { formatMonth, monthDiff, monthKey } from "@/analysis/trade";
import { formatMeasure } from "@/features/origins/model";
import type { Measure } from "@/state/urlState";
import type { SeasonalModel } from "./model";

const CYAN = "#49ead8";
const AMBER = "#e8b76b";
const TEXT = "#edf7f5";
const MUTED = "#8eadae";
const LINE = "rgba(73,234,216,0.16)";
const GAP_FILL = "rgba(142,173,174,0.10)";
const FONT = "IBM Plex Sans, system-ui, sans-serif";
const MONTHS = [...MONTHS_SHORT];

function axisValue(v: number, measure: Measure): string {
  if (measure === "mass") return v >= 1000 ? `${Math.round(v / 1000)} kt` : `${Math.round(v)} t`;
  return v >= 1e6 ? `£${Math.round(v / 1e6)}m` : `£${Math.round(v / 1000)}k`;
}

const tooltipBase = {
  backgroundColor: "rgba(7,25,35,0.95)",
  borderColor: LINE,
  textStyle: { color: TEXT, fontSize: 12 },
};

/** Grey bands (with a label) over months that have no figures; ECharts category areas. */
function gapAreas(months: MonthInfo[]): unknown[] {
  const out: unknown[] = [];
  let start: number | null = null;
  months.forEach((m, i) => {
    const gap = !isAvailable(m);
    if (gap && start === null) start = i;
    if ((!gap || i === months.length - 1) && start !== null) {
      const end = gap ? i : i - 1;
      const state = months[start]!.state;
      out.push([
        {
          xAxis: MONTHS[start],
          itemStyle: { color: GAP_FILL },
          label: {
            show: true,
            formatter: state === "not_yet_published" ? "Not yet\npublished" : "Before\nsnapshot",
            color: MUTED,
            fontSize: 10,
            position: "insideTop",
          },
        },
        { xAxis: MONTHS[end] },
      ]);
      start = null;
    }
  });
  return out;
}

function selectedMonthLine(month: number) {
  return {
    xAxis: MONTHS[month - 1],
    label: { show: false },
    lineStyle: { color: TEXT, type: "solid", width: 1, opacity: 0.55 },
  };
}

const xMonths = {
  type: "category",
  data: MONTHS,
  boundaryGap: false,
  axisLine: { lineStyle: { color: LINE } },
  axisTick: { show: false },
  axisLabel: { color: MUTED, fontSize: 10, interval: 0, formatter: (v: string) => v.slice(0, 1) },
};

export interface SeriesTableRow {
  month: string;
  year: string;
  compare: string;
  change: string;
}

function fmtOrDash(v: number | null | undefined, measure: Measure, info?: MonthInfo): string {
  if (info && !isAvailable(info)) return info.state === "not_yet_published" ? "Not yet published" : "—";
  return v === null || v === undefined ? "—" : formatMeasure(v, measure);
}

/** Monthly recorded imports: selected year (cyan) and comparison year (grey), Jan–Dec. */
export function trendOption(model: SeasonalModel): {
  option: EChartsCoreOption;
  table: SeriesTableRow[];
  description: string;
} {
  const { measure, year, compareYear, months } = model;
  const markLines: unknown[] = [selectedMonthLine(model.month)];
  for (const c of model.codes.changes) {
    const inYear = monthDiff(monthKey(year, 2), c.month) >= 0 && monthDiff(c.month, monthKey(year, 12)) >= 0;
    if (inYear)
      markLines.push({
        xAxis: MONTHS[Number(c.month.slice(5)) - 1],
        label: { formatter: "Codes changed", color: MUTED, fontSize: 10, position: "insideEndTop" },
        lineStyle: { color: MUTED, type: "dotted", width: 1 },
      });
  }
  const provisional = months.filter((m) => m.provisional);
  const areas = gapAreas(months);
  if (provisional.length)
    areas.push([
      {
        xAxis: MONTHS[provisional[0]!.month - 1],
        itemStyle: { color: "rgba(232,183,107,0.06)" },
        label: { show: true, formatter: "Provisional", color: AMBER, fontSize: 10, position: "insideBottom" },
      },
      { xAxis: MONTHS[provisional[provisional.length - 1]!.month - 1] },
    ]);
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 44, right: 12, top: 16, bottom: 24 },
    legend: { show: false },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      valueFormatter: (v: number | null) => (v === null || v === undefined ? "—" : formatMeasure(v, measure)),
    },
    xAxis: xMonths,
    yAxis: {
      type: "value",
      min: 0,
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { color: MUTED, fontSize: 10, formatter: (v: number) => axisValue(v, measure) },
    },
    series: [
      {
        id: "year",
        name: String(year),
        type: "line",
        data: model.totals.map((v) => (v === null ? "-" : v)),
        connectNulls: false,
        showSymbol: true,
        symbolSize: 5,
        lineStyle: { color: CYAN, width: 2 },
        itemStyle: { color: CYAN },
        areaStyle: { color: "rgba(73,234,216,0.10)" },
        markLine: { symbol: "none", silent: true, data: markLines },
        markArea: { silent: true, data: areas },
      },
      ...(model.compareTotals && compareYear !== null
        ? [
            {
              id: "compare",
              name: String(compareYear),
              type: "line",
              data: model.compareTotals.map((v) => (v === null ? "-" : v)),
              connectNulls: false,
              showSymbol: false,
              lineStyle: { color: MUTED, width: 1.5 },
              itemStyle: { color: MUTED },
            },
          ]
        : []),
    ],
  };
  const table = months.map((m, i) => ({
    month: formatMonth(m.key),
    year: fmtOrDash(model.totals[i], measure, m),
    compare: model.compareMonths ? fmtOrDash(model.compareTotals?.[i], measure, model.compareMonths[i]) : "—",
    change: model.yoy[i] === null ? "—" : formatChange(model.yoy[i]),
  }));
  const peak = model.seasonality.peakMonth;
  const description =
    `Monthly recorded imports of ${model.commodity.label.toLowerCase()} in ${year}` +
    (compareYear !== null ? ` compared with ${compareYear}` : "") +
    (peak ? `; the peak month is ${MONTHS[peak - 1]}` : "") +
    ". Months without published figures are left empty. A data table follows.";
  return { option, table, description };
}

/** Year-on-year change by month (diverging: cyan higher, amber lower). */
export function yoyOption(model: SeasonalModel): {
  option: EChartsCoreOption;
  description: string;
} | null {
  if (model.compareYear === null) return null;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 44, right: 12, top: 12, bottom: 24 },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number | null) => (v === null || v === undefined ? "—" : formatChange(v / 100)),
    },
    xAxis: { ...xMonths, boundaryGap: true },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { color: MUTED, fontSize: 10, formatter: (v: number) => `${v} %` },
    },
    series: [
      {
        id: "yoy",
        name: `${model.year} vs ${model.compareYear}`,
        type: "bar",
        barMaxWidth: 12,
        data: model.yoy.map((v, i) =>
          v === null
            ? "-"
            : {
                value: Math.round(v * 1000) / 10,
                itemStyle: {
                  color: v >= 0 ? CYAN : AMBER,
                  opacity: i === model.month - 1 ? 1 : 0.7,
                  borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3],
                  borderColor: i === model.month - 1 ? TEXT : "transparent",
                  borderWidth: i === model.month - 1 ? 1 : 0,
                },
              },
        ),
      },
    ],
  };
  const known = model.yoy
    .map((v, i) => (v === null ? null : `${MONTHS[i]} ${formatChange(v)}`))
    .filter((x): x is string => x !== null);
  const description = `Change in recorded imports from ${model.compareYear} to ${model.year}, month by month: ${known.join(", ")}. Months without figures in either year have no bar.`;
  return { option, description };
}

/** Monthly concentration (SS-06): HHI by month for both years. */
export function hhiOption(model: SeasonalModel): { option: EChartsCoreOption; description: string } {
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 44, right: 12, top: 12, bottom: 24 },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      valueFormatter: (v: number | null) => (v === null || v === undefined ? "—" : formatHhi(v)),
    },
    xAxis: xMonths,
    yAxis: {
      type: "value",
      min: 0,
      max: (v: { max: number }) => Math.min(10_000, Math.ceil((v.max * 1.1) / 1000) * 1000),
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { color: MUTED, fontSize: 10, formatter: (v: number) => formatHhi(v) },
    },
    series: [
      {
        id: "year",
        name: String(model.year),
        type: "line",
        data: model.hhi.map((v) => (v === null ? "-" : v)),
        connectNulls: false,
        symbolSize: 5,
        lineStyle: { color: CYAN, width: 2 },
        itemStyle: { color: CYAN },
        markLine: { symbol: "none", silent: true, data: [selectedMonthLine(model.month)] },
        markArea: { silent: true, data: gapAreas(model.months) },
      },
      ...(model.compareHhi && model.compareYear !== null
        ? [
            {
              id: "compare",
              name: String(model.compareYear),
              type: "line",
              data: model.compareHhi.map((v) => (v === null ? "-" : v)),
              connectNulls: false,
              showSymbol: false,
              lineStyle: { color: MUTED, width: 1.5 },
              itemStyle: { color: MUTED },
            },
          ]
        : []),
    ],
  };
  const known = model.hhi.filter((h): h is number => h !== null);
  const description =
    known.length > 0
      ? `Partner concentration (HHI) by month in ${model.year}, from ${formatHhi(Math.min(...known))} to ${formatHhi(Math.max(...known))}${model.compareYear !== null ? `, with ${model.compareYear} for comparison` : ""}.`
      : `No published months in ${model.year}.`;
  return { option, description };
}

/** Partner shares in the two compared months (SS-08): grouped horizontal bars. */
export function monthCompareOption(model: SeasonalModel): {
  option: EChartsCoreOption;
  description: string;
} | null {
  const c = model.monthComparison;
  if (!c || c.partners.length === 0) return null;
  const rows = [...c.partners].reverse();
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 40, top: 22, bottom: 4, containLabel: true },
    legend: {
      top: 0,
      left: 0,
      itemWidth: 10,
      itemHeight: 8,
      textStyle: { color: TEXT, fontSize: 11 },
      data: [c.a.label, c.b.label],
    },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number | null) => (v === null || v === undefined ? "—" : formatShare(v)),
    },
    xAxis: { type: "value", max: 1, show: false },
    yAxis: {
      type: "category",
      data: rows.map((p) => p.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: TEXT, fontSize: 11, width: 110, overflow: "truncate" },
    },
    series: [
      {
        id: "a",
        name: c.a.label,
        type: "bar",
        barMaxWidth: 8,
        barGap: "30%",
        itemStyle: { color: CYAN, borderRadius: 3 },
        data: rows.map((p) => (p.a === null ? "-" : p.a)),
      },
      {
        id: "b",
        name: c.b.label,
        type: "bar",
        barMaxWidth: 8,
        itemStyle: { color: MUTED, borderRadius: 3 },
        data: rows.map((p) => (p.b === null ? "-" : p.b)),
      },
    ],
  };
  const description = `Share of recorded imports by partner in ${c.a.label} and ${c.b.label}: ${c.partners
    .slice(0, 4)
    .map((p) => `${p.name} ${formatShare(p.a)} and ${formatShare(p.b)}`)
    .join("; ")}. The table below lists every value.`;
  return { option, description };
}

/** One partner's recorded imports by month in the selected year (selected month highlighted). */
export function partnerMonthsOption(
  model: SeasonalModel,
  key: string,
): { option: EChartsCoreOption; values: (number | null)[]; description: string } | null {
  const row = model.heatmap.rows.find((r) => r.key === key);
  if (!row) return null;
  const values = row.values;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 40, right: 8, top: 8, bottom: 22 },
    tooltip: {
      ...tooltipBase,
      trigger: "axis",
      valueFormatter: (v: number | null) =>
        v === null || v === undefined ? "—" : formatMeasure(v, model.measure),
    },
    xAxis: { ...xMonths, boundaryGap: true },
    yAxis: {
      type: "value",
      min: 0,
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { color: MUTED, fontSize: 10, formatter: (v: number) => axisValue(v, model.measure) },
    },
    series: [
      {
        id: "partner",
        name: row.name,
        type: "bar",
        barMaxWidth: 10,
        data: values.map((v, i) =>
          v === null
            ? "-"
            : {
                value: v,
                itemStyle: {
                  color: CYAN,
                  opacity: i === model.month - 1 ? 1 : 0.55,
                  borderRadius: [3, 3, 0, 0],
                },
              },
        ),
        markArea: { silent: true, data: gapAreas(model.months) },
      },
    ],
  };
  const description = `Recorded imports from ${row.name} by month in ${model.year}: ${values
    .map((v, i) => `${MONTHS[i]} ${fmtOrDash(v, model.measure, model.months[i])}`)
    .join(", ")}.`;
  return { option, values, description };
}
