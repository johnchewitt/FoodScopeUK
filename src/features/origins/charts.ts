/**
 * ECharts option builders for the Food Origins panel (pure; colours mirror src/styles/tokens.css
 * because ECharts needs concrete values).
 */
import type { EChartsCoreOption } from "echarts/core";
import { formatGbp, formatShare, formatTonnes } from "@/analysis/format";
import {
  formatMonth,
  monthlySeries,
  seriesBreaksWithin,
  type MonthKey,
  type PartnerShare,
} from "@/analysis/trade";
import type { Measure } from "@/state/urlState";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";

const CYAN = "#49ead8";
const GREEN = "#a1eb83";
const AMBER = "#e8b76b";
const TEXT = "#edf7f5";
const MUTED = "#8eadae";
const LINE = "rgba(73,234,216,0.16)";
const FONT = "IBM Plex Sans, system-ui, sans-serif";

function axisValue(v: number, measure: Measure): string {
  if (measure === "mass") return v >= 1000 ? `${Math.round(v / 1000)} kt` : `${Math.round(v)} t`;
  return v >= 1e6 ? `£${Math.round(v / 1e6)}m` : `£${Math.round(v / 1000)}k`;
}

export function formatMeasureValue(v: number, measure: Measure): string {
  return measure === "mass" ? formatTonnes(v) : formatGbp(v);
}

export interface TrendInput {
  snapshot: TradeSnapshot;
  measure: Measure;
  /** Partner highlighted as its own line (selected, else the top partner of the period). */
  focusKey: string | null;
  focusName: string | null;
  period: { start: MonthKey; end: MonthKey };
  provisionalFrom: MonthKey | null;
}

export interface TrendTableRow {
  month: string;
  total: string;
  focus: string | null;
}

/** Monthly recorded imports for the whole snapshot, with the selected period, provisional months and series breaks marked (FO-11). */
export function trendOption(input: TrendInput): {
  option: EChartsCoreOption;
  table: TrendTableRow[];
  description: string;
} {
  const { snapshot, measure, focusKey, focusName, period } = input;
  const s = monthlySeries(snapshot, focusKey ? [focusKey] : [], measure);
  const labels = s.months.map(formatMonth);
  const breaks = seriesBreaksWithin(s.months[0]!, s.months[s.months.length - 1]!);
  const markLines = breaks.map((b) => ({
    xAxis: formatMonth(b.month),
    label: { formatter: "Series break", color: AMBER, fontSize: 10, position: "insideEndTop" },
    lineStyle: { color: AMBER, type: "dashed", width: 1, opacity: 0.8 },
  }));
  const markAreas: unknown[] = [
    [
      { xAxis: formatMonth(period.start), itemStyle: { color: "rgba(73,234,216,0.12)" } },
      { xAxis: formatMonth(period.end) },
    ],
  ];
  if (input.provisionalFrom) {
    markAreas.push([
      {
        xAxis: formatMonth(input.provisionalFrom),
        itemStyle: { color: "rgba(232,183,107,0.06)" },
        label: { show: true, formatter: "Provisional", color: AMBER, fontSize: 10, position: "insideTop" },
      },
      { xAxis: labels[labels.length - 1] },
    ]);
  }
  const focus = focusKey ? s.byPartner[focusKey] : undefined;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 44, right: 10, top: 14, bottom: 26 },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(7,25,35,0.95)",
      borderColor: LINE,
      textStyle: { color: TEXT, fontSize: 12 },
      valueFormatter: (v: number) => formatMeasureValue(v, measure),
    },
    xAxis: {
      type: "category",
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 10, interval: 11, formatter: (v: string) => v.slice(4) },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { color: MUTED, fontSize: 10, formatter: (v: number) => axisValue(v, measure) },
    },
    series: [
      {
        name: "All recorded partners",
        type: "line",
        data: s.total,
        showSymbol: false,
        lineStyle: { color: CYAN, width: 1.5 },
        areaStyle: { color: "rgba(73,234,216,0.10)" },
        markLine: { symbol: "none", silent: true, data: markLines },
        markArea: { silent: true, data: markAreas },
      },
      ...(focus
        ? [
            {
              name: focusName ?? focusKey,
              type: "line",
              data: focus,
              showSymbol: false,
              lineStyle: { color: GREEN, width: 2 },
            },
          ]
        : []),
    ],
  };
  const table = s.months.map((m, i) => ({
    month: formatMonth(m),
    total: formatMeasureValue(s.total[i]!, measure),
    focus: focus ? formatMeasureValue(focus[i]!, measure) : null,
  }));
  const description =
    `Monthly recorded imports of ${snapshot.commodity.label.toLowerCase()} from ${formatMonth(s.months[0]!)} to ` +
    `${formatMonth(s.months[s.months.length - 1]!)}${focusName ? `, with ${focusName} shown separately` : ""}. ` +
    `Dashed lines mark series breaks in January 2021 and January 2022. A data table follows.`;
  return { option, table, description };
}

/** Horizontal bars: share of recorded imports for the top partners plus "All other partners". */
export function shareOption(
  shares: readonly PartnerShare[],
  selectedKey: string | null,
  n = 10,
): { option: EChartsCoreOption; description: string } | null {
  if (shares.length === 0) return null;
  const top = shares.slice(0, n);
  const rest = shares.slice(n);
  const items = [
    ...top.map((s) => ({ key: s.key, name: s.name, value: s.share })),
    ...(rest.length
      ? [
          {
            key: "__others",
            name: `All other partners (${rest.length})`,
            value: rest.reduce((a, s) => a + s.share, 0),
          },
        ]
      : []),
  ].reverse();
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 52, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(7,25,35,0.95)",
      borderColor: LINE,
      textStyle: { color: TEXT, fontSize: 12 },
      formatter: (p: { name: string; value: number }) => `${p.name}: ${formatShare(p.value)}`,
    },
    xAxis: { type: "value", max: 1, show: false },
    yAxis: {
      type: "category",
      data: items.map((i) => i.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: TEXT, fontSize: 11, width: 120, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 12,
        cursor: "pointer",
        data: items.map((i) => ({
          value: i.value,
          name: i.name,
          key: i.key,
          itemStyle: {
            color: i.key === "__others" ? MUTED : i.key === selectedKey ? GREEN : CYAN,
            opacity: selectedKey && i.key !== selectedKey ? 0.55 : 1,
            borderRadius: 3,
          },
        })),
        label: {
          show: true,
          position: "right",
          color: TEXT,
          fontSize: 11,
          formatter: (p: { value: number }) => formatShare(p.value),
        },
      },
    ],
  };
  const description = `Share of recorded imports by partner: ${top
    .slice(0, 5)
    .map((s) => `${s.name} ${formatShare(s.share)}`)
    .join(", ")}${shares.length > 5 ? ", and others" : ""}. The partner table below lists every value.`;
  return { option, description };
}
