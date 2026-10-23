import { describe, expect, it } from "vitest";
import tomatoes from "../../../public/data/snapshots/2026-10-23/trade/tomatoes.json";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import { provenanceProblems } from "@/types/indicator";
import { buildOriginsModel, type OriginsSelection } from "./model";

const real = tomatoes as unknown as TradeSnapshot;
const UK: [number, number] = [-2.1163, 54.4027];
const base: OriginsSelection = {
  period: "rolling12",
  year: null,
  month: null,
  measure: "mass",
  partner: null,
  flowCount: 12,
};

describe("buildOriginsModel — real HMRC tomatoes snapshot", () => {
  const m = buildOriginsModel(real, base, UK);

  it("defaults to the latest 12 complete months with a full comparison year", () => {
    expect(m.period.start).toBe("2025-09");
    expect(m.period.end).toBe("2026-08");
    expect(m.periodText).toBe("Sep 2025 – Aug 2026");
    expect(m.status.comparisonAvailable).toBe(true);
    expect(m.status.comparisonShort).toBe("previous 12 months");
    expect(m.status.provisional).toBe(true);
    expect(m.status.unavailableText).toBeNull();
  });

  it("KPI indicators carry full provenance and the reconciled values", () => {
    for (const k of [m.kpis.imports, m.kpis.partners, m.kpis.top, m.kpis.concentration])
      expect(provenanceProblems(k)).toEqual([]);
    expect(m.kpis.imports.value).toBeCloseTo(391_081.34, 6);
    expect(m.kpis.imports.provenance).toBe("measured");
    expect(m.kpis.imports.unit).toBe("t");
    expect(m.kpis.partners.value).toBe(25);
    expect(m.kpis.top.value).toBeCloseTo(0.43828, 5);
    expect(m.kpis.top.label).toBe("Top recorded partner: Netherlands");
    expect(m.kpis.concentration.value).toBeCloseTo(2991.676, 2);
    expect(m.kpis.importsDetail).toBe("£679.5m · ±0.0 % vs previous 12 months");
    expect(m.kpis.topDetail).toBe("Netherlands · top 3: 84.5 %");
  });

  it("table rows, map partners and connections agree", () => {
    expect(m.rows).toHaveLength(25);
    expect(m.rows[0]).toMatchObject({ key: "NL", rank: 1, isFlow: true });
    expect(m.map.partners).toHaveLength(25);
    const flows = m.map.partners.filter((p) => p.flow);
    expect(flows).toHaveLength(12);
    expect(flows[0]!.flowWidth).toBe(12); // largest partner gets the maximum width
    expect(Math.min(...flows.map((f) => f.flowWidth))).toBeGreaterThanOrEqual(1.5);
    expect(m.map.ukAnchor).toEqual(UK);
    expect(m.nonCountry).toEqual([]); // no suppressed or unallocated tomato trade in this snapshot
  });

  it("value measure re-ranks shares by £", () => {
    const v = buildOriginsModel(real, { ...base, measure: "value" }, UK);
    expect(v.kpis.imports.unit).toBe("GBP");
    expect(v.kpis.imports.value).toBe(679_457_563);
    expect(v.shares[0]!.key).toBe("NL");
    expect(v.shares[0]!.share).toBeCloseTo(0.469987, 5);
  });

  it("single month compares with the same month a year earlier", () => {
    const jan = buildOriginsModel(real, { ...base, period: "month", year: 2025, month: 1 }, UK);
    expect(jan.periodText).toBe("Jan 2025");
    expect(jan.status.comparisonShort).toBe("Jan 2024");
    expect(jan.shares[0]!.key).toBe("MA");
    expect(jan.current.kg).toBe(33_060_038);
  });

  it("the first year has no comparison and says why", () => {
    const y = buildOriginsModel(real, { ...base, period: "year", year: 2019 }, UK);
    expect(y.status.comparisonAvailable).toBe(false);
    expect(y.status.comparisonNote).toBe("No comparison: the snapshot starts Jan 2019");
    expect(y.rows.every((r) => r.changePp === null)).toBe(true);
    expect(y.kpis.importsDetail).toContain("No comparison: the snapshot starts Jan 2019");
  });

  it("a partial calendar year names the unpublished months", () => {
    const y = buildOriginsModel(real, { ...base, period: "year", year: 2026 }, UK);
    expect(y.periodText).toBe("Jan–Aug 2026");
    expect(y.status.unavailableText).toBe("Sep–Dec 2026 not yet published by HMRC (latest: Aug 2026)");
    expect(y.status.comparisonShort).toBe("Jan–Aug 2025");
  });

  it("a selected partner with no imports in the period is reported, not dropped", () => {
    const anyPartner = real.partners.find((p) => p.key === "NR")!;
    expect(anyPartner).toBeDefined();
    const jul = buildOriginsModel(
      real,
      { ...base, period: "month", year: 2025, month: 7, partner: "NR" },
      UK,
    );
    expect(jul.selected).toEqual({ key: "NR", row: null, name: anyPartner.name });
    const sel = buildOriginsModel(real, { ...base, partner: "ES" }, UK);
    expect(sel.selected?.row?.rank).toBe(3);
  });

  it("flow count is respected and never draws the UK or partners without geometry", () => {
    const three = buildOriginsModel(real, { ...base, flowCount: 3 }, UK);
    expect(three.map.partners.filter((p) => p.flow).map((p) => p.key)).toEqual(["NL", "MA", "ES"]);
    expect(three.rows.filter((r) => r.isFlow)).toHaveLength(3);
  });
});

describe("buildOriginsModel — synthetic edge cases", () => {
  const synthetic: TradeSnapshot = {
    schemaVersion: 1,
    id: "trade.synthetic",
    commodity: {
      id: "synthetic",
      label: "Synthetic",
      definition: "Synthetic",
      hsScope: "HS 9999",
      cn8: [{ code: "99999999", commodityId: 1, description: "x" }],
    },
    flows: [{ id: 1, label: "EU imports" }],
    months: { first: "2024-01", last: "2024-03", provisionalFrom: null },
    units: { mass: "kg", value: "GBP" },
    partners: [
      {
        key: "A",
        name: "Partner A",
        hmrcNames: ["A"],
        hmrcCountryIds: [1],
        kind: "country",
        iso2: "AA",
        geometry: "polygon",
        point: [0, 10],
      },
      {
        key: "B",
        name: "Partner B",
        hmrcNames: ["B"],
        hmrcCountryIds: [2],
        kind: "country",
        iso2: "BB",
        geometry: "none",
        point: null,
      },
      {
        key: "hmrc-977",
        name: "Confidential country",
        hmrcNames: ["Confidential Country"],
        hmrcCountryIds: [977],
        kind: "unallocated",
        iso2: null,
        geometry: "none",
        point: null,
      },
    ],
    rows: [
      [0, 0, 50_000, 100],
      [0, 1, 30_000, 60],
      [0, 2, 20_000, 40],
      [1, 0, 40, 1],
    ],
    suppressed: [[0, 2, 10_000, 30]],
    nilMonths: [2],
  };

  it("lists unallocated and suppressed trade separately with shares of all trade", () => {
    const m = buildOriginsModel(synthetic, { ...base, period: "month", year: 2024, month: 1 }, UK);
    expect(m.shares.map((s) => [s.key, s.share])).toEqual([
      ["A", 0.625],
      ["B", 0.375],
    ]);
    expect(m.nonCountry.map((r) => [r.key, r.shareOfTotal])).toEqual([
      ["hmrc-977", 20 / 110],
      ["suppressed", 10 / 110],
    ]);
    expect(m.kpis.imports.value).toBe(110); // tonnes, including unallocated and published suppressed trade
    expect(m.map.partners.find((p) => p.key === "B")?.flow).toBe(false); // no geometry → no connection
  });

  it("flags a small base and a nil month", () => {
    const feb = buildOriginsModel(synthetic, { ...base, period: "month", year: 2024, month: 2 }, UK);
    expect(feb.status.smallBase).toBe(true);
    const mar = buildOriginsModel(synthetic, { ...base, period: "month", year: 2024, month: 3 }, UK);
    expect(mar.status.nilMonths).toEqual(["2024-03"]);
    expect(mar.rows).toEqual([]);
    expect(mar.kpis.imports.value).toBe(0);
    expect(mar.kpis.top.value).toBeNull();
    expect(mar.kpis.top.missingReason).toBe("not_applicable");
    expect(provenanceProblems(mar.kpis.top)).toEqual([]);
  });
});
