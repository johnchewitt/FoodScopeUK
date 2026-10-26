import { describe, expect, it } from "vitest";
import tomatoes from "../../public/data/snapshots/2026-10-23/trade/tomatoes.json";
import { readRepoJson } from "@/test/files";
import type { CouncilPpfi } from "@/types/generated/council-ppfi";
import type { RiskFarming } from "@/types/generated/risk-farming";
import type { RiskPorts } from "@/types/generated/risk-ports";
import type { RiskWaterStress } from "@/types/generated/risk-water-stress";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import {
  annualSummary,
  breakClass,
  councilPriority,
  disruptionExposure,
  exposureMatrix,
  FARM_BREAKS,
  FARM_MEASURES,
  farmDensity,
  groupSummary,
  hhiClass,
  monthlyConcentration,
  portSeries,
  priorityClass,
  proportionalRadius,
  rankByConcentration,
  rankWithinNation,
  stressClassOf,
  waterStressExposure,
  type CouncilPriority,
  type StressInfo,
} from "./risk";
import { aggregatePeriod, hhi, monthList, partnerShares, type PartnerShare } from "./trade";

const RISK = "public/data/snapshots/2026-10-25/risk";

/** Obviously synthetic snapshot: partners "A", "B", "C", an unallocated bucket, suppression, a nil month. */
function synthetic(): TradeSnapshot {
  const partner = (key: string, id: number, kind: "country" | "unallocated" = "country") => ({
    key,
    name: kind === "country" ? `Partner ${key}` : "Estimates",
    hmrcNames: [key],
    hmrcCountryIds: [id],
    kind,
    iso2: kind === "country" ? `${key}${key}` : null,
    geometry: (kind === "country" ? "polygon" : "none") as "polygon" | "none",
    point: kind === "country" ? ([0, 0] as [number, number]) : null,
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
    months: { first: "2024-01", last: "2025-03", provisionalFrom: "2025-01" },
    units: { mass: "kg", value: "GBP" },
    partners: [partner("A", 1), partner("B", 2), partner("C", 3), partner("hmrc-959", 959, "unallocated")],
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
    codeChanges: [],
  } as unknown as TradeSnapshot;
}

const share = (key: string, s: number, rank = 1): PartnerShare => ({
  key,
  name: `Partner ${key}`,
  rank,
  value: s,
  tonnes: s,
  gbp: s,
  share: s,
});

describe("monthly concentration (heatmap)", () => {
  const rows = monthlyConcentration(synthetic(), "mass");

  it("computes HHI, partners and the top partner for every month of the snapshot", () => {
    expect(rows).toHaveLength(15);
    const jan24 = rows[0]!;
    expect(jan24.hhi).toBeCloseTo(60 ** 2 + 40 ** 2, 9); // 5,200
    expect(jan24.partners).toBe(2);
    expect(jan24.top).toEqual({ key: "A", name: "Partner A", share: 0.6 });
    const jan25 = rows[12]!;
    expect(jan25.hhi).toBeCloseTo(30 ** 2 + 50 ** 2 + 20 ** 2, 9); // 3,800: unallocated excluded
    expect(jan25.top?.key).toBe("B");
    expect(jan25.provisional).toBe(true);
    expect(jan24.provisional).toBe(false);
  });

  it("gives a month with no recorded imports no HHI, never zero (P12)", () => {
    const mar25 = rows[14]!;
    expect(mar25.hhi).toBeNull();
    expect(mar25.partners).toBe(0);
    expect(mar25.top).toBeNull();
    // A month missing from the rows altogether (2024-02) is treated the same way.
    expect(rows[1]!.hhi).toBeNull();
  });

  it("uses the selected measure: value shares differ from mass shares", () => {
    const byValue = monthlyConcentration(synthetic(), "value", ["2024-01"])[0]!;
    expect(byValue.top?.key).toBe("B");
    expect(byValue.hhi).toBeCloseTo(25 ** 2 + 75 ** 2, 9);
  });

  it("matches the Seasonal Supply reference value for tomatoes in January 2025", () => {
    const jan = monthlyConcentration(tomatoes as unknown as TradeSnapshot, "mass", ["2025-01"])[0]!;
    // Stage 3 report, independent Python over the snapshot: HHI 2,736 for January 2025 (mass).
    expect(Math.round(jan.hhi!)).toBe(2736);
  });
});

describe("annual summary (import trend)", () => {
  it("totals every calendar year and flags incomplete and provisional years", () => {
    const years = annualSummary(synthetic(), "mass");
    expect(years.map((y) => [y.year, y.months, y.complete, y.provisional])).toEqual([
      [2024, 12, true, false],
      [2025, 3, false, true],
    ]);
    // 2025: A 31 t, B 50 t, C 20 t, unallocated 5 t; suppressed mass withheld (null) adds nothing.
    expect(years[1]!.total).toBeCloseTo(106, 9);
    expect(years[1]!.cr1).toBeCloseTo(50 / 101, 9);
    expect(years[1]!.cr3).toBeCloseTo(1, 9);
  });

  it("keeps a commodity continuous across its code change (tomatoes split, January 2025)", () => {
    const snap = tomatoes as unknown as TradeSnapshot;
    expect(snap.codeChanges).toEqual([
      { month: "2025-01", ended: ["07020000"], started: ["07020010", "07020091", "07020099"] },
    ]);
    const codes = snap.commodity.cn8.map((c) => c.code);
    for (const c of ["07020000", "07020010", "07020091", "07020099"]) expect(codes).toContain(c);
    const years = annualSummary(snap, "mass");
    const y2024 = years.find((y) => y.year === 2024)!;
    const y2025 = years.find((y) => y.year === 2025)!;
    // Both sides of the change are recorded in full years (no gap, no double count).
    expect(y2024.complete && y2025.complete).toBe(true);
    expect(y2025.total / y2024.total).toBeGreaterThan(0.8);
    expect(y2025.total / y2024.total).toBeLessThan(1.25);
    const months = monthlyConcentration(snap, "mass", ["2024-12", "2025-01"]);
    expect(months.every((m) => m.allocated > 0)).toBe(true);
    // The last year is partial and provisional.
    const last = years[years.length - 1]!;
    expect([last.year, last.months, last.complete, last.provisional]).toEqual([2026, 8, false, true]);
  });
});

describe("estimated exposure to one partner's disruption", () => {
  it("is the partner's observed share of recorded imports, month by month", () => {
    const e = disruptionExposure(synthetic(), "mass", "A", ["2025-01", "2025-02", "2025-03"]);
    expect(e.months.map((m) => m.share)).toEqual([0.3, 1, null]);
    expect(e.periodShare).toBeCloseTo(31 / 101, 9);
    expect(e.peak?.month).toBe("2025-02");
    expect(e.monthsAtLeastHalf).toBe(1);
    expect(e.monthsWithShare).toBe(2);
  });

  it("is zero, not missing, for a partner with no recorded imports in a month with trade", () => {
    const e = disruptionExposure(synthetic(), "mass", "C", ["2024-01"]);
    expect(e.months[0]!.share).toBe(0);
    expect(e.peak?.share).toBe(0);
  });

  it("has no share at all when nothing was recorded", () => {
    const e = disruptionExposure(synthetic(), "mass", "A", ["2025-03"]);
    expect(e.periodShare).toBeNull();
    expect(e.peak).toBeNull();
  });

  it("agrees with the Food Origins share over the same 12 months (Morocco, tomatoes)", () => {
    const snap = tomatoes as unknown as TradeSnapshot;
    const months = monthList("2025-09", "2026-08");
    const shares = partnerShares(aggregatePeriod(snap, months).partners, "mass");
    const ma = shares.find((s) => s.key === "MA")!;
    expect(disruptionExposure(snap, "mass", "MA", months).periodShare).toBeCloseTo(ma.share, 12);
  });
});

describe("commodity ranking and exposure matrix", () => {
  it("classes HHI in fixed 1,000-wide bands", () => {
    expect([0, 999, 1000, 2991.7, 5000, 10_000].map(hhiClass)).toEqual([0, 0, 1, 2, 5, 5]);
    expect(hhiClass(null)).toBeNull();
  });

  it("ranks by HHI, most concentrated first, no data last", () => {
    const rows = rankByConcentration([
      { id: "a", label: "A", hhi: 1000, cr1: 0.2, cr3: 0.5, partners: 9, top: null },
      { id: "b", label: "B", hhi: null, cr1: null, cr3: null, partners: 0, top: null },
      { id: "c", label: "C", hhi: 5000, cr1: 0.6, cr3: 0.9, partners: 3, top: null },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("lists the union of top partners with 0 for none recorded and null for a commodity without data", () => {
    const m = exposureMatrix(
      [
        { id: "x", label: "X", shares: [share("A", 0.7), share("B", 0.3, 2)] },
        { id: "y", label: "Y", shares: [share("C", 0.9), share("A", 0.1, 2)] },
        { id: "z", label: "Z", shares: [] },
      ],
      1,
    );
    expect(m.partners.map((p) => p.key)).toEqual(["C", "A"]);
    expect(m.cells).toEqual([
      [0, 0.9, null],
      [0.7, 0.1, null],
    ]);
  });
});

describe("water stress (S30)", () => {
  const doc = readRepoJson<RiskWaterStress>(`${RISK}/water-stress.json`);

  it("classes values on FAO's thresholds", () => {
    expect(stressClassOf(0)).toBe("none");
    expect(stressClassOf(24.999)).toBe("none");
    expect(stressClassOf(25)).toBe("low");
    expect(stressClassOf(50)).toBe("medium");
    expect(stressClassOf(75)).toBe("high");
    expect(stressClassOf(100)).toBe("high");
    expect(stressClassOf(100.001)).toBe("critical");
    expect(() => stressClassOf(-1)).toThrow();
  });

  it("agrees with the published class of every country", () => {
    for (const c of doc.countries) expect(stressClassOf(c.value), c.name).toBe(c.class);
    expect(doc.countries).toHaveLength(178);
  });

  it("splits recorded imports by partners' class, with no data kept apart", () => {
    const stress = new Map<string, StressInfo>([
      ["AA", { class: "critical", value: 120, year: 2022 }],
      ["BB", { class: "low", value: 30, year: 2022 }],
    ]);
    const e = waterStressExposure(
      [share("A", 0.5), share("B", 0.3, 2), share("C", 0.2, 3)],
      (k) => `${k}${k}`,
      stress,
    );
    expect(e.byClass.critical).toBe(0.5);
    expect(e.byClass.low).toBe(0.3);
    expect(e.byClass.noData).toBe(0.2);
    expect(e.highOrCritical).toBe(0.5);
    expect(e.partners.noData).toEqual(["C"]);
  });
});

describe("ports (S23)", () => {
  const doc = readRepoJson<RiskPorts>(`${RISK}/ports.json`);
  const regions = { domestic: doc.domesticRegion, unspecified: doc.unspecifiedRegion };

  it("sums inwards from abroad, agricultural products and roll-on/roll-off, keeping missing years", () => {
    const port = {
      inwardsByRegion: { EU: [1, null], [doc.domesticRegion]: [5, null], [doc.unspecifiedRegion]: [2, null] },
      inwardsByGroup: { "Ro-Ro Self Propelled": [3, null], Containers: [4, null] },
      agriculturalInwardsByRegion: { EU: [0.5, null], [doc.domesticRegion]: [9, null] },
    };
    expect(portSeries(port, "international", regions)).toEqual([1, null]);
    expect(portSeries(port, "agricultural", regions)).toEqual([0.5, null]);
    expect(portSeries(port, "roro", regions)).toEqual([3, null]);
  });

  it("reads Dover as almost all roll-on/roll-off with no agricultural dry bulk", () => {
    const dover = doc.ports.find((p) => p.name === "Dover")!;
    const last = doc.years.length - 1;
    expect(portSeries(dover, "agricultural", regions)[last]).toBe(0);
    const roro = portSeries(dover, "roro", regions)[last]!;
    const intl = portSeries(dover, "international", regions)[last]!;
    expect(roro).toBeGreaterThan(0.95 * intl);
  });

  it("scales symbol area with the value", () => {
    expect(proportionalRadius(100, 100)).toBe(26);
    expect(proportionalRadius(25, 100)).toBe(13);
    expect(proportionalRadius(0.0001, 100)).toBe(3);
    expect(proportionalRadius(0, 100)).toBe(0);
    expect(proportionalRadius(null, 100)).toBe(0);
  });
});

describe("farming regions (S31)", () => {
  const doc = readRepoJson<RiskFarming>(`${RISK}/farming.json`);

  it("divides by the region's area and classes on fixed breaks", () => {
    expect(farmDensity(500, 100)).toBe(5);
    expect(farmDensity(1, 0)).toBeNull();
    expect(farmDensity(-1, 10)).toBeNull();
    expect(breakClass(2, [2, 5, 10, 15])).toBe(1);
    expect(breakClass(1.99, [2, 5, 10, 15])).toBe(0);
    expect(breakClass(15, [2, 5, 10, 15])).toBe(4);
  });

  it("uses every class of every measure in the 2025 data", () => {
    for (const m of FARM_MEASURES) {
      const classes = new Set(
        doc.regions.map((r) => breakClass(farmDensity(r.values[m]!, r.areaKm2)!, FARM_BREAKS[m])),
      );
      expect([...classes].sort(), m).toEqual([0, 1, 2, 3, 4]);
    }
  });

  it("puts a fifth of the Eastern region under wheat", () => {
    const eastern = doc.regions.find((r) => r.name === "Eastern")!;
    expect(farmDensity(eastern.values.wheat!, eastern.areaKm2)).toBeCloseTo(429_936 / 19_130.1, 6);
  });
});

describe("Priority Places by council (S13)", () => {
  const doc = readRepoJson<CouncilPpfi>(`${RISK}/council-ppfi.json`);

  it("ranks within each nation, ties sharing a rank, councils without data unranked", () => {
    const rows: CouncilPriority[] = [
      { code: "E1", name: "a", nation: "England", areas: 10, priority: 5, share: 0.5 },
      { code: "E2", name: "b", nation: "England", areas: 10, priority: 3, share: 0.3 },
      { code: "E3", name: "c", nation: "England", areas: 10, priority: 3, share: 0.3 },
      { code: "E4", name: "d", nation: "England", areas: 10, priority: 1, share: 0.1 },
      { code: "W1", name: "e", nation: "Wales", areas: 10, priority: 0, share: 0 },
      { code: "N1", name: "f", nation: "Northern Ireland", areas: 10, priority: null, share: null },
    ];
    const ranks = rankWithinNation(rows);
    expect([1, 2, 3, 4].map((i) => ranks.get(`E${i}`)?.rank)).toEqual([1, 2, 2, 4]);
    expect(ranks.get("E2")?.tied).toBe(true);
    expect(ranks.get("E1")?.of).toBe(4);
    expect(ranks.get("W1")).toEqual({ rank: 1, of: 1, tied: false });
    expect(ranks.has("N1")).toBe(false);
  });

  it("classes shares on fixed breaks, with none and no data apart", () => {
    expect([0, 0.05, 0.1, 0.2, 0.3, 0.5, 1].map(priorityClass)).toEqual([0, 1, 2, 3, 4, 5, 5]);
    expect(priorityClass(null)).toBeNull();
  });

  it("computes shares from the published counts and keeps Northern Ireland's missing domains null", () => {
    const combined = councilPriority(doc.councils, "combined");
    const glasgow = combined.find((c) => c.code === "S12000049")!;
    expect(glasgow.share).toBeCloseTo(103 / 746, 12);
    const ni = councilPriority(doc.councils, "supermarket_accessibility").filter(
      (c) => c.nation === "Northern Ireland",
    );
    expect(ni).toHaveLength(11);
    expect(ni.every((c) => c.share === null)).toBe(true);
    const ranks = rankWithinNation(combined);
    expect(ranks.get("S12000049")?.of).toBe(32);
    expect(ranks.get("E08000003")?.of).toBe(296);
    // Each nation's councils hold about a fifth of its small areas in deciles 1–2.
    for (const n of doc.nations) {
      const rows = combined.filter((c) => c.nation === n.nation);
      const pooled = rows.reduce((s, c) => s + c.priority!, 0) / rows.reduce((s, c) => s + c.areas, 0);
      expect(pooled, n.nation).toBeCloseTo(0.2, 2);
    }
  });

  it("summarises groups by median and pooled share", () => {
    const rows: CouncilPriority[] = [
      { code: "a", name: "a", nation: "England", areas: 10, priority: 1, share: 0.1 },
      { code: "b", name: "b", nation: "England", areas: 30, priority: 9, share: 0.3 },
      { code: "c", name: "c", nation: "England", areas: 10, priority: 5, share: 0.5 },
      { code: "d", name: "d", nation: "England", areas: 10, priority: 2, share: 0.2 },
    ];
    const g = groupSummary(rows, (code) => (code === "d" ? "Rural" : code === "a" ? null : "Urban"));
    expect(g).toEqual([
      { group: "Rural", councils: 1, median: 0.2, pooled: 0.2 },
      { group: "Urban", councils: 2, median: 0.4, pooled: 14 / 40 },
    ]);
  });
});

/*
 * Reference values computed independently from the raw HMRC responses (pipeline/raw/hmrc/2026-10-23,
 * the /OTS aggregates, with the country crosswalk) by a separate Python script, without the pipeline's
 * or the app's code (docs/stage-reports/stage-6.md, "Hand checks"): latest 12 months, Sep 2025 – Aug
 * 2026, net mass.
 */
describe("supply statistics against the raw HMRC data", () => {
  const baskets = import.meta.glob("../../public/data/snapshots/2026-10-23/trade/*.json", {
    eager: true,
    import: "default",
  });
  const snap = (id: string) =>
    baskets[`../../public/data/snapshots/2026-10-23/trade/${id}.json`] as TradeSnapshot;
  const months = monthList("2025-09", "2026-08");
  const expected: Record<string, [number, number, string, number]> = {
    tomatoes: [25, 2991.676, "NL", 84.482],
    strawberries: [22, 2636.594, "ES", 82.305],
    bananas: [43, 1649.64, "CO", 60.463],
    potatoes: [16, 1949.755, "IE", 63.139],
    wheat: [35, 1433.959, "CA", 57.199],
  };

  it.each(Object.entries(expected))("%s: partners, HHI, top partner and top-three share", (id, values) => {
    const [partners, h, top, cr3] = values;
    const shares = partnerShares(aggregatePeriod(snap(id), months).partners, "mass");
    expect(shares).toHaveLength(partners);
    expect(hhi(shares.map((x) => x.share))).toBeCloseTo(h, 2);
    expect(shares[0]!.key).toBe(top);
    expect(100 * (shares[0]!.share + shares[1]!.share + shares[2]!.share)).toBeCloseTo(cr3, 2);
  });

  it("tomatoes: Spain's monthly share (estimated exposure) peaks in winter", () => {
    const e = disruptionExposure(snap("tomatoes"), "mass", "ES", months);
    const expected = [1.907, 4.465, 18.032, 18.862, 21.03, 23.816, 21.37, 14.112, 5.05, 1.134, 0.564, 1.056];
    e.months.forEach((m, i) => expect(100 * m.share!, m.month).toBeCloseTo(expected[i]!, 2));
    expect(e.peak?.month).toBe("2026-02");
    expect(e.monthsAtLeastHalf).toBe(0);
  });
});
