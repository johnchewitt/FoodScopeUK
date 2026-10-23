import { describe, expect, it } from "vitest";
import bananasJson from "../../public/data/snapshots/2026-10-23/trade/bananas.json";
import potatoesJson from "../../public/data/snapshots/2026-10-23/trade/potatoes.json";
import tomatoesJson from "../../public/data/snapshots/2026-10-23/trade/tomatoes.json";
import wheatJson from "../../public/data/snapshots/2026-10-23/trade/wheat.json";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import {
  amountClass,
  changeClass,
  codeChanges,
  comparability,
  likeForLike,
  maxMonthlyPartnerValue,
  monthlyChanges,
  monthlyHhi,
  monthShareOfYear,
  monthShares,
  seasonalCodes,
  seasonality,
  shareChangePp,
  snapshotYears,
  topPartnersForYear,
  yearMatrix,
  yearMonthInfo,
} from "./seasonal";
import { flowWidths } from "./trade";

const tomatoes = tomatoesJson as unknown as TradeSnapshot;
const bananas = bananasJson as unknown as TradeSnapshot;
const potatoes = potatoesJson as unknown as TradeSnapshot;
const wheat = wheatJson as unknown as TradeSnapshot;

/**
 * Obviously synthetic snapshot: Jan 2024 – Mar 2025, partners "A", "B", "C" (no geometry) and an
 * unallocated bucket. Mar 2025 is a nil month; Feb 2025 has suppressed trade.
 */
function synthetic(overrides: Partial<TradeSnapshot> = {}): TradeSnapshot {
  const partner = (key: string, geometry: "polygon" | "point" | "none", i: number) => ({
    key,
    name: `Partner ${key}`,
    hmrcNames: [key],
    hmrcCountryIds: [i] as [number],
    kind: "country" as const,
    iso2: `${key}${key}`,
    geometry,
    point: geometry === "none" ? null : ([i, i] as [number, number]),
  });
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
    months: { first: "2024-01", last: "2025-03", provisionalFrom: "2025-02" },
    units: { mass: "kg", value: "GBP" },
    partners: [
      partner("A", "polygon", 1),
      partner("B", "point", 2),
      partner("C", "none", 3),
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
    // [monthIndex, partnerIndex, kg, £]; Jan 2024 = 0, Jan 2025 = 12
    rows: [
      [0, 0, 60_000, 600],
      [0, 1, 40_000, 400],
      [6, 0, 10_000, 100],
      [6, 2, 90_000, 900],
      [12, 0, 30_000, 300],
      [12, 1, 50_000, 500],
      [12, 3, 20_000, 200],
      [13, 0, 1_000, 10],
    ],
    suppressed: [[13, 2, 4_000, 40]],
    nilMonths: [14],
    ...overrides,
  };
}

describe("month states", () => {
  const s = synthetic();
  it("labels published, nil, unpublished and pre-snapshot months explicitly", () => {
    const y2025 = yearMonthInfo(s, 2025);
    expect(y2025.map((m) => m.state).slice(0, 4)).toEqual([
      "published",
      "published",
      "nil",
      "not_yet_published",
    ]);
    expect(y2025.filter((m) => m.state === "not_yet_published")).toHaveLength(9);
    expect(y2025.map((m) => m.provisional).slice(0, 4)).toEqual([false, true, true, false]);
    expect(yearMonthInfo(s, 2023).every((m) => m.state === "before_snapshot")).toBe(true);
  });
  it("lists the snapshot's years", () => {
    expect(snapshotYears(s)).toEqual([2024, 2025]);
    expect(snapshotYears(tomatoes)).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
  });
});

describe("year matrix", () => {
  const s = synthetic();
  it("uses null for unavailable months and 0 for published months without trade", () => {
    const m = yearMatrix(s, 2025, "mass");
    // Jan: A 30 + B 50 allocated, + 20 t unallocated; Feb: A 1 t + 4 t suppressed; Mar: nil.
    expect(m.total.slice(0, 4)).toEqual([100, 5, 0, null]);
    expect(m.allocated.slice(0, 4)).toEqual([80, 1, 0, null]);
    expect(m.partners.get("A")!.slice(0, 4)).toEqual([30, 1, 0, null]);
    expect(m.partners.get("B")!.slice(0, 4)).toEqual([50, 0, 0, null]);
    expect(m.partners.has("hmrc-959")).toBe(false);
  });
  it("measures value in pounds", () => {
    expect(yearMatrix(s, 2025, "value").total.slice(0, 2)).toEqual([1000, 50]);
  });
  it("is empty (all null) for a year before the snapshot", () => {
    const m = yearMatrix(s, 2023, "mass");
    expect(m.total.every((v) => v === null)).toBe(true);
    expect(m.partners.size).toBe(0);
  });
  it("computes shares over allocated trade only, with null where there is no denominator", () => {
    const shares = monthShares(yearMatrix(s, 2025, "mass"));
    expect(shares.get("A")![0]).toBeCloseTo(30 / 80, 12);
    expect(shares.get("A")![1]).toBe(1);
    expect(shares.get("A")![2]).toBeNull(); // nil month: no denominator
    expect(shares.get("A")![3]).toBeNull(); // not yet published
  });
  it("computes HHI per month", () => {
    const h = monthlyHhi(yearMatrix(s, 2025, "mass"));
    expect(h[0]).toBeCloseTo((100 * 30) ** 2 / 80 ** 2 + (100 * 50) ** 2 / 80 ** 2, 9);
    expect(h[1]).toBe(10_000); // single partner
    expect(h[2]).toBeNull();
    expect(h[3]).toBeNull();
  });
  it("ranks partners over the year's available months", () => {
    const m = yearMatrix(s, 2024, "mass");
    expect(topPartnersForYear(m, 2)).toEqual({ keys: ["C", "A"], othersCount: 1 });
    expect(topPartnersForYear(m, 0)).toEqual({ keys: [], othersCount: 3 });
  });
});

describe("year-on-year and seasonality", () => {
  it("returns null changes where either month is missing or the base is zero", () => {
    expect(monthlyChanges([110, 50, null, 5], [100, 0, 10, null])).toEqual([0.1, null, null, null]);
  });
  it("compares like-for-like months only", () => {
    const r = likeForLike([10, 20, null], [5, 5, 100])!;
    expect(r.months).toEqual([0, 1]);
    expect(r.current).toBe(30);
    expect(r.previous).toBe(10);
    expect(r.change).toBe(2);
    expect(likeForLike([null], [1])).toBeNull();
  });
  it("share changes need both months; an absent partner had share 0", () => {
    expect(shareChangePp(0.5, 0.25, true, true)).toBe(25);
    expect(shareChangePp(0.5, undefined, true, true)).toBe(50);
    expect(shareChangePp(0.5, 0.25, true, false)).toBeNull();
  });
  it("needs a complete year for peak share, CV and a month's share of the year", () => {
    const partial = [1, 2, 3, null, null, null, null, null, null, null, null, null];
    expect(seasonality(partial)).toMatchObject({ complete: false, availableMonths: 3, peakShare: null });
    expect(monthShareOfYear(partial, 2)).toBeNull();
    const flat = Array(12).fill(10) as number[];
    expect(seasonality(flat)).toMatchObject({ complete: true, peakMonth: 1, cv: 0 });
    expect(monthShareOfYear(flat, 5)).toBeCloseTo(1 / 12, 12);
    const zero = Array(12).fill(0) as number[];
    expect(seasonality(zero)).toMatchObject({ complete: true, annual: 0, peakShare: null, cv: null });
    expect(monthShareOfYear(zero, 1)).toBeNull();
  });
});

describe("fixed classes (P11)", () => {
  it("classes amounts with the same breaks for every year and commodity", () => {
    expect(
      [0.4, 10, 99, 100, 999, 1_000, 4_999, 5_000, 19_999, 20_000, 90_000].map((v) => amountClass(v, "mass")),
    ).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    expect(amountClass(1_000_000, "value")).toBe(3);
  });
  it("classes changes symmetrically around a neutral class", () => {
    expect([-30, -5.01, -5, -1.5, -1, 0, 0.99, 1, 4.9, 5, 40].map(changeClass)).toEqual([
      0, 0, 1, 1, 2, 2, 2, 3, 3, 4, 4,
    ]);
  });
});

describe("fixed connection width scale (SS-02)", () => {
  it("uses the largest drawable monthly partner value, ignoring partners without geometry", () => {
    // Partner C (90 t, Jul 2024) has no geometry, so A's 60 t in Jan 2024 sets the scale.
    expect(maxMonthlyPartnerValue(synthetic(), "mass")).toEqual({
      value: 60,
      key: "A",
      name: "Partner A",
      month: "2024-01",
    });
    expect(maxMonthlyPartnerValue(synthetic({ rows: [] }), "mass")).toBeNull();
  });
  it("keeps widths comparable between months", () => {
    // Same 30 t is the same width whether or not it is the month's largest flow.
    expect(flowWidths([30], 1.5, 12, 60)).toEqual([6.75]);
    expect(flowWidths([60, 30], 1.5, 12, 60)).toEqual([12, 6.75]);
    expect(flowWidths([90], 1.5, 12, 60)).toEqual([12]); // clamped
    expect(flowWidths([30])).toEqual([12]); // Food Origins default: relative to the period
  });
});

describe("commodity codes", () => {
  it("returns no code history for snapshots without it", () => {
    expect(codeChanges(synthetic())).toEqual([]);
    expect(seasonalCodes(synthetic())).toEqual([]);
  });
});

// Expected values below were computed independently from the committed snapshot in Python
// (stage report §"Reference values"), not with these functions.
describe("real data: HMRC snapshot 2026-10-23", () => {
  const t2025 = yearMatrix(tomatoes, 2025, "mass");
  const t2024 = yearMatrix(tomatoes, 2024, "mass");
  const t2026 = yearMatrix(tomatoes, 2026, "mass");

  it("tomatoes 2025: monthly totals reconcile with the API (Jan 2025 = 33,060,038 kg)", () => {
    expect(t2025.total[0]).toBeCloseTo(33_060.038, 6);
    expect(t2025.total[6]).toBeCloseTo(33_168.836, 6);
    expect(t2025.months.every((m) => m.state === "published")).toBe(true);
  });

  it("tomatoes 2025: seasonality of a complete year", () => {
    const s = seasonality(t2025.total);
    expect(s.complete).toBe(true);
    expect(s.annual).toBeCloseTo(389_778.841, 3);
    expect(s.peakMonth).toBe(4);
    expect(s.peakShare).toBeCloseTo(0.09596, 5);
    expect(s.troughMonth).toBe(9);
    expect(s.cv).toBeCloseTo(0.08116, 5);
    expect(monthShareOfYear(t2025.total, 7)).toBeCloseTo(0.0851, 4);
  });

  it("tomatoes: HHI rises from January to July 2025 as the Netherlands takes over from Morocco", () => {
    const h = monthlyHhi(t2025);
    expect(h[0]).toBeCloseTo(2736.08, 1);
    expect(h[6]).toBeCloseTo(4684.38, 1);
    const shares = monthShares(t2025);
    expect(shares.get("MA")![0]).toBeCloseTo(0.4252, 4);
    expect(shares.get("NL")![6]).toBeCloseTo(0.6381, 4);
  });

  it("tomatoes: year-on-year by month and like-for-like for the partial year 2026", () => {
    const yoy = monthlyChanges(t2025.total, t2024.total);
    expect(yoy[6]).toBeCloseTo(0.02153, 5);
    expect(yoy[0]).toBeCloseTo(-0.08993, 5);
    expect(t2026.months.slice(8).every((m) => m.state === "not_yet_published")).toBe(true);
    expect(seasonality(t2026.total).complete).toBe(false);
    const lfl = likeForLike(t2026.total, t2025.total)!;
    expect(lfl.months).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(lfl.current).toBeCloseTo(269_216.06, 2);
    expect(lfl.previous).toBeCloseTo(267_913.561, 2);
    expect(lfl.change).toBeCloseTo(0.00486, 5);
  });

  it("fixed width scale: the largest drawable monthly partner value", () => {
    expect(maxMonthlyPartnerValue(tomatoes, "mass")).toMatchObject({ key: "NL", month: "2026-07" });
    expect(maxMonthlyPartnerValue(tomatoes, "mass")!.value).toBeCloseTo(24_806.216, 3);
    expect(maxMonthlyPartnerValue(bananas, "mass")).toMatchObject({ key: "CO", month: "2025-12" });
    expect(maxMonthlyPartnerValue(wheat, "mass")).toMatchObject({ key: "DE", month: "2024-11" });
  });

  it("commodity-code changes: tomatoes Jan 2025, bananas Jan 2024", () => {
    const t = codeChanges(tomatoes);
    expect(t).toHaveLength(1);
    expect(t[0]!.month).toBe("2025-01");
    expect(t[0]!.ended.map((c) => c.code)).toEqual(["07020000"]);
    expect(t[0]!.started.map((c) => c.code)).toEqual(["07020010", "07020091", "07020099"]);
    expect(codeChanges(bananas, "2024-01", "2024-12")[0]!.started.map((c) => c.code)).toEqual([
      "08039011",
      "08039019",
    ]);
    expect(codeChanges(bananas, "2024-02", "2024-12")).toEqual([]);
  });

  it("comparability: series breaks and code changes between the two years", () => {
    expect(comparability(tomatoes, 2025, 2024).codeChanges.map((c) => c.month)).toEqual(["2025-01"]);
    expect(comparability(tomatoes, 2025, 2024).seriesBreaks).toEqual([]);
    expect(comparability(tomatoes, 2022, 2021).seriesBreaks.map((b) => b.month)).toEqual(["2022-01"]);
    expect(comparability(tomatoes, 2022, 2020).seriesBreaks.map((b) => b.month)).toEqual([
      "2021-01",
      "2022-01",
    ]);
    // Bananas changed in Jan 2024, so 2025 vs 2024 compares like with like at code level.
    expect(comparability(bananas, 2025, 2024).codeChanges).toEqual([]);
    expect(comparability(bananas, 2024, 2023).codeChanges.map((c) => c.month)).toEqual(["2024-01"]);
    expect(comparability(tomatoes, 2025, null).codeChanges.map((c) => c.month)).toEqual(["2025-01"]);
  });

  it("seasonal codes: only new potatoes (99.6 % of net mass January–June)", () => {
    expect(seasonalCodes(tomatoes)).toEqual([]);
    expect(seasonalCodes(wheat)).toEqual([]);
    const p = seasonalCodes(potatoes);
    expect(p.map((c) => c.code)).toEqual(["07019050"]);
    expect(p[0]!.months).toEqual([1, 2, 3, 4, 5, 6]);
    expect(p[0]!.coverage).toBeCloseTo(0.996, 3);
    expect(p[0]!.shareOfBasket).toBeCloseTo(0.1079, 4);
  });
});
