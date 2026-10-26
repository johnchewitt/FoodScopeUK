import { describe, expect, it } from "vitest";
import type { MonthConcentration } from "@/analysis/risk";
import { RISK_DARK } from "@/styles/palette";
import { councilRankingOption, domainsOption, monthlyHeatmapOption, rankingOption } from "./charts";
import type { CouncilRiskRow } from "./model";

// Synthetic inputs (obviously fake partners and councils) for the pure chart builders.

type Series = {
  data: { value: unknown; itemStyle: Record<string, unknown> }[];
  label?: { formatter: (p: { value: number | null }) => string };
};
const seriesOf = (option: unknown) => (option as { series: Series[] }).series[0]!;
const yLabels = (option: unknown) => (option as { yAxis: { data: string[] } }).yAxis.data;

const month = (m: string, hhi: number | null, provisional = false): MonthConcentration => ({
  month: m,
  allocated: hhi === null ? 0 : 100,
  partners: hhi === null ? 0 : 2,
  hhi,
  top: hhi === null ? null : { key: "A", name: "Partner A", share: 0.6 },
  provisional,
});

const council = (code: string, share: number | null, rank: number | null, tied = false): CouncilRiskRow => ({
  code,
  name: `Council ${code}`,
  nation: "England",
  areas: 100,
  priority: share === null ? null : Math.round(share * 100),
  share,
  rank: rank === null ? null : { rank, of: 20, tied },
  cls: share === null ? null : 3,
  fewAreas: false,
});

describe("risk charts", () => {
  it("draw a month without recorded imports as a gap, never an interpolated value", () => {
    const spec = monthlyHeatmapOption([
      month("2025-01", 5200),
      month("2025-02", null),
      month("2025-03", 900, true),
    ])!;
    const cells = seriesOf(spec.option).data;
    expect(cells[0]!.itemStyle.color).toBe(RISK_DARK[5]);
    expect(cells[1]!.value).toEqual([1, 0, null, -1]);
    // The hidden visualMap maps the class index to the same colours (no continuous scale).
    const vm = (spec.option as { visualMap: { pieces: { value: number; color: string }[]; show: boolean } })
      .visualMap;
    expect(vm.show).toBe(false);
    expect(vm.pieces.find((x) => x.value === 5)?.color).toBe(RISK_DARK[5]);
    expect(cells[1]!.itemStyle.color).not.toBe(RISK_DARK[0]);
    // Provisional months are marked by a dashed border, not by colour.
    expect(cells[2]!.itemStyle.borderType).toBe("dashed");
    expect(cells[2]!.itemStyle.color).toBe(RISK_DARK[0]);
    expect(spec.description).toMatch(/highest 5,200 in Jan 2025/);
  });

  it("returns no chart for empty input", () => {
    expect(rankingOption([], "x")).toBeNull();
    expect(monthlyHeatmapOption([])).toBeNull();
    expect(councilRankingOption([], null, null)).toBeNull();
    expect(domainsOption([])).toBeNull();
  });

  it("always shows the selected council, emphasised, with ranks and ties", () => {
    const ranking = Array.from({ length: 14 }, (_, i) => council(`E${i}`, 0.5 - i * 0.02, i + 1, i === 3));
    const spec = councilRankingOption(ranking, "E13", 0.2, 12)!;
    const labels = yLabels(spec.option);
    expect(labels).toHaveLength(13);
    expect(labels[3]).toBe("4=. Council E3");
    expect(labels.at(-1)).toBe("14. Council E13");
    expect(spec.description).toMatch(/the nation as a whole 20\.0 %/);
  });

  it("labels a measure without data as no data, not zero", () => {
    const spec = domainsOption([
      { label: "Measure A", share: 0 },
      { label: "Measure B", share: null },
    ])!;
    const s = seriesOf(spec.option);
    expect(s.label!.formatter({ value: 0 })).toBe("0.0 %");
    expect(s.label!.formatter({ value: null })).toBe("no data");
    expect(spec.description).toBe(
      "Share of the council's small areas in the nation's deciles 1–2, by measure: Measure A 0.0 %, Measure B no data.",
    );
  });
});
