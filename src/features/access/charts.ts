/**
 * ECharts option for the provision comparison (SM-09). Pure; colours mirror src/styles/tokens.css
 * (the chart sits on the dark panel whatever the basemap).
 */
import type { EChartsCoreOption } from "echarts/core";
import { formatCount, formatPer10k, formatPopulation } from "@/analysis/format";
import type { AreaTotal } from "@/analysis/retail";
import type { CouncilDetail, Nation } from "./model";

const CYAN = "#49ead8";
const GREEN = "#a1eb83";
const TEXT = "#edf7f5";
const MUTED = "#8eadae";
const LINE = "rgba(73,234,216,0.16)";
const FONT = "IBM Plex Sans, system-ui, sans-serif";

export interface ComparisonRow {
  key: string;
  label: string;
  kind: "council" | "nation" | "uk";
  stores: number;
  population: number | null;
  per10k: number | null;
}

/** The selected council (if any), the four nations and the UK, for one measure. */
export function comparisonRows(
  totals: { uk: AreaTotal; nations: (AreaTotal & { nation: Nation })[] },
  council: CouncilDetail | null,
  measure: keyof CouncilDetail["provision"],
): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  if (council) {
    const p = council.provision[measure];
    rows.push({
      key: council.code,
      label: council.name,
      kind: "council",
      stores: p.stores,
      population: council.population,
      per10k: p.per10k,
    });
  }
  for (const n of totals.nations)
    rows.push({
      key: n.nation,
      label: n.nation,
      kind: "nation",
      stores: n.stores,
      population: n.population,
      per10k: n.per10k,
    });
  rows.push({
    key: "UK",
    label: "United Kingdom",
    kind: "uk",
    stores: totals.uk.stores,
    population: totals.uk.population,
    per10k: totals.uk.per10k,
  });
  return rows;
}

export function comparisonOption(
  rows: readonly ComparisonRow[],
  councilNation: Nation | null,
  unitLabel: string,
): { option: EChartsCoreOption; description: string } | null {
  if (rows.length === 0) return null;
  const items = [...rows].reverse();
  const colour = (r: ComparisonRow) =>
    r.kind === "council" ? GREEN : r.kind === "uk" || r.key === councilNation ? CYAN : MUTED;
  const option: EChartsCoreOption = {
    textStyle: { fontFamily: FONT, color: MUTED },
    grid: { left: 4, right: 44, top: 4, bottom: 4, containLabel: true },
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(7,25,35,0.95)",
      borderColor: LINE,
      textStyle: { color: TEXT, fontSize: 12 },
      formatter: (p: { dataIndex: number }) => {
        const r = items[p.dataIndex]!;
        return `${r.label}: ${r.per10k === null ? "no population figure" : formatPer10k(r.per10k)} ${unitLabel}<br/>${formatCount(
          r.stores,
        )} stores ÷ ${r.population === null ? "—" : formatPopulation(r.population, "authority")} residents × 10,000`;
      },
    },
    xAxis: { type: "value", min: 0, show: false },
    yAxis: {
      type: "category",
      data: items.map((r) => r.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: TEXT, fontSize: 11, width: 120, overflow: "truncate" },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 12,
        data: items.map((r) => ({
          value: r.per10k ?? 0,
          itemStyle: { color: colour(r), borderRadius: 3, opacity: r.per10k === null ? 0 : 1 },
        })),
        label: {
          show: true,
          position: "right",
          color: TEXT,
          fontSize: 11,
          formatter: (p: { dataIndex: number }) => {
            const v = items[p.dataIndex]!.per10k;
            return v === null ? "no data" : formatPer10k(v);
          },
        },
      },
    ],
  };
  const description = `${unitLabel}: ${rows
    .map((r) => `${r.label} ${r.per10k === null ? "no data" : formatPer10k(r.per10k)}`)
    .join(", ")}. The table below gives each denominator.`;
  return { option, description };
}
