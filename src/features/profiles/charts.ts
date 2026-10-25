/**
 * ECharts options for Local Authority Profiles (LP-03, LP-04, LP-06). Pure; colours mirror
 * src/styles/tokens.css (charts sit on the dark panel whatever the basemap). Every chart has a
 * text description and a table beside it (AX-06); categorical colours follow the retailer, never
 * its rank (dataviz: colour follows the entity).
 */
import type { EChartsCoreOption } from "echarts/core";
import { formatCount, formatPopulation, formatShare } from "@/analysis/format";
import { type DecileRow } from "@/analysis/profile";
import { CATEGORICAL, CATEGORICAL_OTHER, MAP_COLOURS, SHARE_CLASS_HEX } from "@/styles/palette";

const TEXT = "#edf7f5";
const MUTED = "#8eadae";
const LINE = "rgba(73,234,216,0.16)";
const PANEL = "#073435";
const FONT = "IBM Plex Sans, system-ui, sans-serif";

const tooltip = {
  backgroundColor: "rgba(7,25,35,0.95)",
  borderColor: LINE,
  textStyle: { color: TEXT, fontSize: 12 },
};

export interface Slice {
  retailer: string;
  slot: number | null;
  stores: number;
  members: string[];
}

export function sliceColour(slot: number | null): string {
  return slot === null ? CATEGORICAL_OTHER : (CATEGORICAL[slot] ?? CATEGORICAL_OTHER);
}

/** Retailer donut (LP-03): mapped stores of every type by retailer; a 2 px panel gap between slices. */
export function retailerDonutOption(
  slices: readonly Slice[],
  total: number,
): { option: EChartsCoreOption; description: string } | null {
  if (total === 0 || slices.length === 0) return null;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (p: { dataIndex: number }) => {
        const s = slices[p.dataIndex]!;
        const detail =
          s.members.length > 1
            ? `<br/>${s.members.slice(0, 8).join(", ")}${s.members.length > 8 ? ", …" : ""}`
            : "";
        return `${s.retailer}: ${formatCount(s.stores)} stores (${formatShare(s.stores / total)})${detail}<br/>Click to show only ${s.members.length > 1 ? "these retailers" : "this retailer"} on the map`;
      },
    },
    series: [
      {
        type: "pie",
        radius: ["52%", "80%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: PANEL, borderWidth: 2, borderRadius: 3 },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
        data: slices.map((s) => ({
          name: s.retailer,
          value: s.stores,
          itemStyle: { color: sliceColour(s.slot) },
        })),
      },
    ],
    graphic: [
      {
        type: "text",
        left: "center",
        top: "center",
        style: {
          text: `${formatCount(total)}\nstores`,
          fill: TEXT,
          fontSize: 13,
          fontWeight: 600,
          align: "center",
          lineHeight: 16,
        },
      },
    ],
  };
  const description = `Mapped grocery stores by retailer: ${slices
    .map((s) => `${s.retailer} ${formatCount(s.stores)}`)
    .join(", ")}; ${formatCount(total)} in all.`;
  return { option, description };
}

/**
 * Areas by decile (1 = highest priority or most deprived), coloured on the panel ramp by the map
 * class of the decile pair (the legend shows the map's own colours); click a bar to outline those
 * areas on the map.
 */
export function decileBarsOption(
  rows: readonly DecileRow[],
  label: string,
  by: "areas" | "population",
  /** What decile 1 means for this index (PPFI: highest priority; deprivation: most deprived). */
  axisName = "Decile (1 = highest priority)",
): { option: EChartsCoreOption; description: string } | null {
  if (rows.every((r) => r.areas === 0)) return null;
  // Map classes 0–4 use sequential colours 1–5; decile 1–2 is class 4 (most salient).
  const colourOf = (decile: number) => SHARE_CLASS_HEX[1 + (4 - Math.floor((decile - 1) / 2))]!;
  const value = (r: DecileRow) => (by === "population" ? (r.population ?? 0) : r.areas);
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 8, top: 18, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (p: { dataIndex: number }) => {
        const r = rows[p.dataIndex]!;
        return `Decile ${r.decile}: ${formatCount(r.areas)} areas${r.population === null ? "" : `, ${formatPopulation(r.population, "small_area")} residents`}<br/>Click to outline them on the map`;
      },
    },
    xAxis: {
      type: "category",
      data: rows.map((r) => String(r.decile)),
      name: axisName,
      nameLocation: "middle",
      nameGap: 22,
      nameTextStyle: { color: MUTED, fontSize: 10 },
      axisLine: { lineStyle: { color: LINE } },
      axisTick: { show: false },
      axisLabel: { color: TEXT, fontSize: 10 },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: LINE } },
      axisLabel: { color: MUTED, fontSize: 10 },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 18,
        data: rows.map((r) => ({
          value: value(r),
          itemStyle: { color: colourOf(r.decile), borderRadius: [4, 4, 0, 0] },
        })),
      },
    ],
  };
  const description = `${label}: ${by === "population" ? "residents" : "small areas"} in each decile within the nation, decile 1 to 10: ${rows
    .map((r) =>
      by === "population" ? formatPopulation(r.population ?? 0, "small_area") : formatCount(r.areas),
    )
    .join(", ")}.`;
  return { option, description };
}

/** Population by straight-line distance class to the nearest supermarket (map classes). */
export function distanceClassesOption(
  rows: readonly { label: string; population: number; areas: number; classIndex: number }[],
): { option: EChartsCoreOption; description: string } | null {
  if (rows.every((r) => r.areas === 0)) return null;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 40, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      ...tooltip,
      trigger: "item",
      formatter: (p: { dataIndex: number }) => {
        const r = rows[p.dataIndex]!;
        return `${r.label}: ${formatPopulation(r.population, "small_area")} residents in ${formatCount(r.areas)} areas<br/>Click to outline them on the map`;
      },
    },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: rows.map((r) => r.label),
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: TEXT, fontSize: 10 },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 12,
        data: rows.map((r) => ({
          value: r.population,
          itemStyle: { color: MAP_COLOURS.dark.seq[1 + r.classIndex] ?? SHARE_CLASS_HEX[5], borderRadius: 3 },
        })),
        label: {
          show: true,
          position: "right",
          color: TEXT,
          fontSize: 10,
          formatter: (p: { dataIndex: number }) =>
            formatPopulation(rows[p.dataIndex]!.population, "small_area"),
        },
      },
    ],
  };
  const description = `Residents by straight-line distance from their small area's population-weighted centroid to the nearest supermarket: ${rows
    .map((r) => `${r.label} ${formatPopulation(r.population, "small_area")}`)
    .join(", ")}.`;
  return { option, description };
}
