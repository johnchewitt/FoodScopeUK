/**
 * Report charts (Stage 8): one ECharts option per `ReportChart`, drawn dark in the panel and light
 * in the PDF from the same values. One value axis per chart (never two scales); observed values
 * teal, baseline teal, scenario warm, as in the Scenario Lab; direct labels on bars and a text
 * description for every chart (AX-06). Pure: no React, ArcGIS or DOM.
 */
import type { EChartsCoreOption } from "echarts/core";
import {
  formatCount,
  formatGbp,
  formatHhi,
  formatKm,
  formatPopulation,
  formatShare,
  formatTonnes,
} from "@/analysis/format";
import { BRAND, LIGHT_SEQ, RISK_DARK, RISK_LIGHT, SHARE_CLASS_HEX } from "@/styles/palette";
import type { ChartFormat, ReportChart } from "./report";

export type ChartTheme = "dark" | "light";

interface Theme {
  text: string;
  muted: string;
  line: string;
  observed: string;
  baseline: string;
  comparison: string;
  scenario: string;
}

const THEMES: Record<ChartTheme, Theme> = {
  dark: {
    text: BRAND.text,
    muted: BRAND.muted,
    line: "rgba(73,234,216,0.16)",
    observed: SHARE_CLASS_HEX[4]!,
    baseline: SHARE_CLASS_HEX[3]!,
    comparison: BRAND.muted,
    scenario: RISK_DARK[4],
  },
  // White page: teal and burnt orange from the light-basemap ramps (≥ 4.5:1 on white for text use).
  light: {
    text: "#17262c",
    muted: "#4c5f66",
    line: "#d5dfe2",
    observed: LIGHT_SEQ[3],
    baseline: LIGHT_SEQ[2],
    comparison: "#8a9aa0",
    scenario: RISK_LIGHT[2],
  },
};

const FONT = "IBM Plex Sans, system-ui, sans-serif";

export function chartColours(theme: ChartTheme): Theme {
  return THEMES[theme];
}

export function formatChartValue(v: number | null, format: ChartFormat): string {
  if (v === null || !Number.isFinite(v)) return "no data";
  switch (format) {
    case "tonnes":
      return formatTonnes(v);
    case "gbp":
      return formatGbp(v);
    case "share":
      return formatShare(v);
    case "km":
      return formatKm(v);
    case "hhi":
      return formatHhi(v);
    case "population":
      return formatPopulation(v, "small_area");
    case "percent":
      return `${v.toFixed(1)} %`;
    case "count":
      return formatCount(v);
  }
}

/** Height that fits the chart's rows (horizontal bars) or a fixed plot (columns, lines). */
export function chartHeight(c: ReportChart): number {
  if (c.kind === "bar" || c.kind === "pairedBar") {
    const rows = c.categories.length * (c.kind === "pairedBar" ? 1.6 : 1);
    return Math.round(Math.max(96, 28 + rows * 24));
  }
  return 190;
}

function colourOf(role: ReportChart["series"][number]["role"], t: Theme): string {
  return role === "scenario"
    ? t.scenario
    : role === "baseline"
      ? t.baseline
      : role === "comparison"
        ? t.comparison
        : t.observed;
}

export function reportChartOption(
  c: ReportChart,
  theme: ChartTheme,
  opts: { animation?: boolean; legend?: boolean } = {},
): EChartsCoreOption {
  const t = THEMES[theme];
  const fmt = (v: number | null) => formatChartValue(v, c.format);
  const horizontal = c.kind === "bar" || c.kind === "pairedBar";
  const valueAxis = {
    type: "value",
    splitNumber: 3,
    splitLine: { lineStyle: { color: t.line } },
    axisLabel: horizontal
      ? { show: false }
      : { color: t.muted, fontSize: 10, formatter: (v: number) => fmt(v) },
  };
  const categoryAxis = {
    type: "category",
    data: c.categories,
    axisLine: { lineStyle: { color: t.line } },
    axisTick: { show: false },
    ...(horizontal
      ? {
          inverse: true,
          axisLabel: { color: t.text, fontSize: 10, interval: 0, width: 128, overflow: "truncate" },
        }
      : { axisLabel: { color: t.muted, fontSize: 10, interval: c.categories.length > 12 ? "auto" : 0 } }),
  };
  const labelled = horizontal || c.categories.length <= 8;
  const series = c.series.map((s) => {
    const colour = colourOf(s.role, t);
    if (c.kind === "line")
      return {
        type: "line",
        name: s.name,
        data: s.values,
        symbol: "circle",
        symbolSize: 8,
        lineStyle: { width: 2, color: colour },
        itemStyle: { color: colour, borderColor: theme === "dark" ? BRAND.navy : "#ffffff", borderWidth: 2 },
        connectNulls: false,
      };
    return {
      type: "bar",
      name: s.name,
      barMaxWidth: horizontal ? 12 : 22,
      barGap: "25%",
      data: s.values.map((v) => ({
        value: v,
        itemStyle: { color: colour, borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] },
      })),
      label: {
        show: labelled,
        position: horizontal ? "right" : "top",
        color: t.text,
        fontSize: 9,
        formatter: (p: { value: number | null }) => fmt(p.value),
      },
    };
  });
  return {
    animation: opts.animation ?? true,
    animationDuration: 300,
    textStyle: { fontFamily: FONT, color: t.muted },
    // The PDF has no HTML legend: draw one (LegendComponent is registered by the PDF writer only).
    ...(opts.legend && c.series.length > 1
      ? {
          legend: {
            top: 0,
            left: 0,
            itemWidth: 12,
            itemHeight: 8,
            textStyle: { color: t.text, fontSize: 10 },
          },
        }
      : {}),
    grid: horizontal
      ? {
          left: 4,
          right: 64,
          top: opts.legend && c.series.length > 1 ? 24 : 4,
          bottom: 4,
          containLabel: true,
        }
      : {
          left: 8,
          right: 12,
          top: opts.legend && c.series.length > 1 ? 32 : 18,
          bottom: 4,
          containLabel: true,
        },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: horizontal || c.kind === "column" ? "shadow" : "line" },
      backgroundColor: theme === "dark" ? "rgba(7,25,35,0.95)" : "#ffffff",
      borderColor: t.line,
      textStyle: { color: t.text, fontSize: 12 },
      formatter: (ps: { dataIndex: number; seriesName: string; value: number | null }[]) => {
        const i = ps[0]?.dataIndex ?? 0;
        return [
          c.categories[i],
          ...ps.map((p) => `${c.series.length > 1 ? `${p.seriesName}: ` : ""}${fmt(p.value)}`),
        ].join("<br/>");
      },
    },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series,
  };
}
