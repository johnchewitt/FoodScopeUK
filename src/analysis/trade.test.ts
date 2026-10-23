import { describe, expect, it } from "vitest";
import tomatoes from "../../public/data/snapshots/2026-10-23/trade/tomatoes.json";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import { symbolicArc, toMercator } from "./arcs";
import {
  addMonths,
  aggregatePeriod,
  anchorMonth,
  concentrationRatio,
  effectivePartners,
  flowWidths,
  formatMonthRange,
  hhi,
  isProvisional,
  isSmallBase,
  monthDiff,
  monthList,
  monthlySeries,
  partnerShares,
  relativeChange,
  resolvePeriod,
  seriesBreaksWithin,
  shareChanges,
  shareClass,
  topNWithOthers,
  type PartnerTotal,
} from "./trade";

/** Obviously synthetic snapshot: partners "A", "B", "C", an unallocated bucket and suppression. */
function synthetic(overrides: Partial<TradeSnapshot> = {}): TradeSnapshot {
  return {
    schemaVersion: 1,
    id: "trade.synthetic",
    commodity: {
      id: "synthetic",
      label: "Synthetic",
      definition: "Synthetic test basket",
      hsScope: "HS 9999",
      cn8: [{ code: "99999999", commodityId: 99999999, description: "Synthetic" }],
    },
    flows: [{ id: 1, label: "EU imports" }],
    months: { first: "2024-01", last: "2025-03", provisionalFrom: "2025-01" },
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
        point: [0, 0],
      },
      {
        key: "B",
        name: "Partner B",
        hmrcNames: ["B"],
        hmrcCountryIds: [2],
        kind: "country",
        iso2: "BB",
        geometry: "point",
        point: [1, 1],
      },
      {
        key: "C",
        name: "Partner C",
        hmrcNames: ["C"],
        hmrcCountryIds: [3],
        kind: "country",
        iso2: "CC",
        geometry: "none",
        point: null,
      },
      {
        key: "hmrc-959",
        name: "Estimates",
        hmrcNames: ["Estimates"],
        hmrcCountryIds: [959],
        kind: "unallocated",
        iso2: null,
        geometry: "none",
        point: null,
      },
    ],
    // [monthIndex, partnerIndex, kg, £]; 2024-01 = index 0, 2025-01 = 12
    rows: [
      [0, 0, 60_000, 100],
      [0, 1, 40_000, 300],
      [12, 0, 30_000, 200],
      [12, 1, 50_000, 100],
      [12, 2, 20_000, 100],
      [12, 3, 5_000, 50],
      [13, 0, 1_000, 10],
    ],
    suppressed: [[12, 3, null, 70]],
    nilMonths: [14],
    ...overrides,
  };
}

const range = { first: "2024-01", last: "2025-03" };

describe("months", () => {
  it("adds, diffs and lists months across year boundaries", () => {
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2025-01", -13)).toBe("2023-12");
    expect(monthDiff("2024-11", "2025-02")).toBe(3);
    expect(monthList("2024-11", "2025-02")).toEqual(["2024-11", "2024-12", "2025-01", "2025-02"]);
    expect(monthList("2025-02", "2024-11")).toEqual([]);
    expect(formatMonthRange("2025-01", "2025-08")).toBe("Jan–Aug 2025");
    expect(formatMonthRange("2024-09", "2025-08")).toBe("Sep 2024 – Aug 2025");
  });

  it("treats a null selection as the latest published month and clamps outside the range", () => {
    expect(anchorMonth({ mode: "rolling12", year: null, month: null }, range)).toBe("2025-03");
    expect(anchorMonth({ mode: "month", year: 2030, month: 6 }, range)).toBe("2025-03");
    expect(anchorMonth({ mode: "month", year: 2019, month: 6 }, range)).toBe("2024-01");
    expect(anchorMonth({ mode: "month", year: 2024, month: null }, range)).toBe("2024-12");
  });
});

describe("resolvePeriod (FO-07)", () => {
  it("rolling 12 months ends at the anchor; comparison is one year earlier and partly unavailable", () => {
    const p = resolvePeriod({ mode: "rolling12", year: 2025, month: 3 }, range);
    expect(p.start).toBe("2024-04");
    expect(p.end).toBe("2025-03");
    expect(p.months).toHaveLength(12);
    expect(p.unavailable).toEqual([]);
    expect(p.comparison.start).toBe("2023-04");
    expect(p.comparison.available).toEqual(["2024-01", "2024-02", "2024-03"]);
    expect(p.comparison.unavailable).toHaveLength(9);
  });

  it("a calendar year that is not complete lists the unpublished months", () => {
    const p = resolvePeriod({ mode: "year", year: 2025, month: null }, range);
    expect(p.available).toEqual(["2025-01", "2025-02", "2025-03"]);
    expect(p.unavailable).toHaveLength(9);
    expect(p.label).toBe("Calendar year 2025");
  });

  it("single month", () => {
    const p = resolvePeriod({ mode: "month", year: 2025, month: 1 }, range);
    expect(p.months).toEqual(["2025-01"]);
    expect(p.comparison.months).toEqual(["2024-01"]);
  });
});

describe("aggregatePeriod", () => {
  it("sums partners, separates unallocated and suppressed trade, and lists nil months", () => {
    const a = aggregatePeriod(synthetic(), ["2025-01", "2025-02", "2025-03"]);
    expect(a.partners.map((p) => [p.key, p.kg])).toEqual([
      ["A", 31_000],
      ["B", 50_000],
      ["C", 20_000],
    ]);
    expect(a.unallocated).toEqual([
      { key: "hmrc-959", name: "Estimates", kind: "unallocated", kg: 5_000, gbp: 50 },
    ]);
    expect(a.suppressed).toEqual({ kg: null, gbp: 70, kgWithheld: true, gbpWithheld: false, rows: 1 });
    expect(a.allocated).toEqual({ kg: 101_000, gbp: 410 });
    expect(a.grandTotal).toEqual({ kg: 106_000, gbp: 530 });
    expect(a.nilMonths).toEqual(["2025-03"]);
  });

  it("returns empty totals for a period with no rows", () => {
    const a = aggregatePeriod(synthetic(), ["2024-06"]);
    expect(a.partners).toEqual([]);
    expect(a.allocated).toEqual({ kg: 0, gbp: 0 });
    expect(partnerShares(a.partners, "mass")).toEqual([]);
  });
});

describe("shares and concentration (§6.2)", () => {
  const partners: PartnerTotal[] = [
    { key: "A", name: "A", kind: "country", kg: 50_000, gbp: 10 },
    { key: "B", name: "B", kind: "country", kg: 30_000, gbp: 30 },
    { key: "C", name: "C", kind: "country", kg: 20_000, gbp: 0 },
    { key: "X", name: "X", kind: "unallocated", kg: 999_000, gbp: 999 },
  ];

  it("computes shares over allocated partners only, by mass or value", () => {
    const byMass = partnerShares(partners, "mass");
    expect(byMass.map((s) => [s.key, s.share])).toEqual([
      ["A", 0.5],
      ["B", 0.3],
      ["C", 0.2],
    ]);
    expect(byMass[0]?.tonnes).toBe(50);
    const byValue = partnerShares(partners, "value");
    expect(byValue.map((s) => s.key)).toEqual(["B", "A"]); // C has no value and is dropped
    expect(byValue[0]?.share).toBe(0.75);
  });

  it("breaks ties deterministically by key", () => {
    const tied = partnerShares(
      [
        { key: "B", name: "B", kind: "country", kg: 1000, gbp: 1 },
        { key: "A", name: "A", kind: "country", kg: 1000, gbp: 1 },
      ],
      "mass",
    );
    expect(tied.map((s) => s.key)).toEqual(["A", "B"]);
  });

  it("HHI, effective partners and concentration ratios", () => {
    const s = partnerShares(partners, "mass");
    const h = hhi(s.map((x) => x.share));
    expect(h).toBeCloseTo(3800, 6); // 50² + 30² + 20²
    expect(effectivePartners(h)).toBeCloseTo(10_000 / 3800, 9);
    expect(concentrationRatio(s, 1)).toBe(0.5);
    expect(concentrationRatio(s, 3)).toBeCloseTo(1, 12);
    expect(concentrationRatio(s, 10)).toBeCloseTo(1, 12);
    expect(hhi([1])).toBe(10_000); // single partner
    expect(effectivePartners(10_000)).toBe(1);
  });

  it("handles empty and zero inputs", () => {
    expect(hhi([])).toBeNull();
    expect(effectivePartners(null)).toBeNull();
    expect(effectivePartners(0)).toBeNull();
    expect(concentrationRatio([], 3)).toBeNull();
    expect(relativeChange(10, 0)).toBeNull();
    expect(relativeChange(null, 5)).toBeNull();
    expect(relativeChange(15, 10)).toBeCloseTo(0.5, 12);
  });

  it("share changes are in percentage points; a new partner counts from zero; no comparison gives null", () => {
    const now = partnerShares(partners, "mass");
    const before = partnerShares([{ key: "A", name: "A", kind: "country", kg: 100, gbp: 1 }], "mass");
    const d = shareChanges(now, before);
    expect(d.get("A")).toBeCloseTo(-50, 9);
    expect(d.get("B")).toBeCloseTo(30, 9);
    expect([...shareChanges(now, []).values()]).toEqual([null, null, null]);
    expect([...shareChanges(now, null).values()]).toEqual([null, null, null]);
  });

  it("top N with an aggregate of the rest", () => {
    const s = partnerShares(partners, "mass");
    const t = topNWithOthers(s, 2);
    expect(t.top.map((x) => x.key)).toEqual(["A", "B"]);
    expect(t.others).toEqual({ count: 1, value: 20, share: 0.2 });
    expect(topNWithOthers(s, 5).others).toBeNull();
    expect(topNWithOthers(s, 0).top).toEqual([]);
  });

  it("small base flag and fixed share classes", () => {
    expect(isSmallBase(99.9)).toBe(true);
    expect(isSmallBase(100)).toBe(false);
    expect([0, 0.0099, 0.01, 0.049, 0.05, 0.1, 0.25, 0.5, 1].map(shareClass)).toEqual([
      0, 0, 1, 1, 2, 3, 4, 5, 5,
    ]);
  });

  it("flow widths are linear in value within the clamps", () => {
    expect(flowWidths([100, 50, 0], 2, 10)).toEqual([10, 6, 2]);
    expect(flowWidths([0, 0], 2, 10)).toEqual([2, 2]);
    expect(flowWidths([], 2, 10)).toEqual([]);
  });
});

describe("monthly series, breaks and provisional months", () => {
  it("builds totals per month with selected partners and the remainder", () => {
    const s = monthlySeries(synthetic(), ["A"], "mass", { first: "2024-12", last: "2025-03" });
    expect(s.months).toEqual(["2024-12", "2025-01", "2025-02", "2025-03"]);
    expect(s.total).toEqual([0, 100, 1, 0]); // tonnes; unallocated excluded
    expect(s.byPartner.A).toEqual([0, 30, 1, 0]);
    expect(s.others).toEqual([0, 70, 0, 0]);
    expect(s.nil).toEqual([false, false, false, true]);
  });

  it("marks the January 2021 and January 2022 series breaks only when spanned", () => {
    expect(seriesBreaksWithin("2019-01", "2026-08").map((b) => b.month)).toEqual(["2021-01", "2022-01"]);
    expect(seriesBreaksWithin("2021-01", "2021-12")).toEqual([]);
    expect(seriesBreaksWithin("2021-06", "2022-01").map((b) => b.month)).toEqual(["2022-01"]);
  });

  it("flags provisional months", () => {
    expect(isProvisional("2025-02", "2025-03")).toBe(false);
    expect(isProvisional("2025-03", "2025-03")).toBe(true);
    expect(isProvisional("2026-08", null)).toBe(false);
  });
});

describe("symbolic arcs (P4)", () => {
  it("starts at the partner, ends at the UK anchor and bows away from the straight chord", () => {
    const from: [number, number] = [-6, 32];
    const to: [number, number] = [-2, 54];
    const arc = symbolicArc(from, to, 20, 0.2);
    expect(arc).toHaveLength(21);
    expect(arc[0]).toEqual(from);
    expect(arc[20]).toEqual(to);
    const mid = toMercator(arc[10]!);
    const a = toMercator(from);
    const b = toMercator(to);
    const chordMid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    expect(Math.hypot(mid[0] - chordMid[0]!, mid[1] - chordMid[1]!)).toBeGreaterThan(0);
    expect(mid[0]).toBeLessThan(chordMid[0]!); // travelling north, the curve bows to the west (left)
  });

  it("keeps longitudes continuous (no jump across the map) for distant partners", () => {
    const arc = symbolicArc([172.5, -41.8], [-2, 54], 48);
    for (let i = 1; i < arc.length; i++) expect(Math.abs(arc[i]![0] - arc[i - 1]![0])).toBeLessThan(30);
  });

  it("degenerate input returns the two points", () => {
    expect(symbolicArc([1, 1], [1, 1])).toEqual([
      [1, 1],
      [1, 1],
    ]);
  });
});

describe("real data: HMRC tomatoes (HS 0702), snapshot 2026-10-23", () => {
  const snap = tomatoes as unknown as TradeSnapshot;
  const sharesFor = (months: string[]) => partnerShares(aggregatePeriod(snap, months).partners, "mass");

  it("January 2025 total matches the reconciled HMRC figure", () => {
    const a = aggregatePeriod(snap, ["2025-01"]);
    expect(a.allocated.kg).toBe(33_060_038); // == pipeline reconciliation against raw /OTS rows
    expect(a.allocated.gbp).toBe(57_382_707);
  });

  it("partners shift between January and July 2025 (Morocco leads in winter, the Netherlands in summer)", () => {
    const jan = sharesFor(["2025-01"]);
    const jul = sharesFor(["2025-07"]);
    expect(jan.slice(0, 3).map((s) => s.key)).toEqual(["MA", "ES", "NL"]);
    expect(jan[0]!.share).toBeCloseTo(0.425184, 6);
    expect(jul.slice(0, 3).map((s) => s.key)).toEqual(["NL", "MA", "BE"]);
    expect(jul[0]!.share).toBeCloseTo(0.638065, 6);
    expect(hhi(jan.map((s) => s.share))).toBeCloseTo(2736.078, 2);
    expect(hhi(jul.map((s) => s.share))).toBeCloseTo(4684.377, 2);
  });

  it("12 months to August 2026 vs the previous 12 months", () => {
    const p = resolvePeriod({ mode: "rolling12", year: null, month: null }, snap.months);
    expect(p.start).toBe("2025-09");
    expect(p.end).toBe("2026-08");
    const now = sharesFor(p.available);
    const before = sharesFor(p.comparison.available);
    expect(now.length).toBe(25);
    expect(now[0]!.key).toBe("NL");
    expect(now[0]!.share).toBeCloseTo(0.43828, 5);
    expect(shareChanges(now, before).get("NL")).toBeCloseTo(100 * (0.43828 - 0.426998), 2);
    const totalNow = aggregatePeriod(snap, p.available).allocated.kg;
    const totalBefore = aggregatePeriod(snap, p.comparison.available).allocated.kg;
    expect(totalNow).toBe(391_081_340);
    expect(totalBefore).toBe(390_983_271);
  });
});
