import { describe, expect, it } from "vitest";
import { readRepoJson } from "@/test/files";
import type { ScenarioClosure } from "@/types/generated/scenario-closure";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import {
  closureImpact,
  effectiveReduction,
  importDisruption,
  increaseClass,
  portDisruption,
  productionShock,
  retailerMix,
  scenarioWindow,
  weightedMean,
  weightedMedian,
  type ClosureInput,
} from "./scenario";
import { aggregatePeriod, hhi, partnerShares } from "./trade";

/** Obviously synthetic snapshot: partners "A" and "B", an unallocated bucket, a suppressed row, a nil month. */
function synthetic(): TradeSnapshot {
  const partner = (key: string, id: number, kind: "country" | "unallocated" = "country") => ({
    key,
    name: kind === "country" ? `Partner ${key}` : "Estimates",
    hmrcNames: [key],
    hmrcCountryIds: [id] as [number],
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
    months: { first: "2024-01", last: "2024-06", provisionalFrom: "2024-05" },
    units: { mass: "kg", value: "GBP" },
    partners: [partner("A", 1), partner("B", 2), partner("hmrc-959", 959, "unallocated")],
    // [month index, partner index, kg, £]
    rows: [
      [0, 0, 6000, 600],
      [0, 1, 4000, 800],
      [0, 2, 1000, 100],
      [1, 0, 3000, 300],
      [1, 1, 1000, 200],
      // month 2: B only (A records nothing)
      [2, 1, 2000, 400],
      // month 3: nil month (no rows)
      [4, 0, 1000, 100],
      [4, 1, 1000, 100],
      [5, 0, 500, 50],
    ],
    suppressed: [[1, 0, null, 50]],
    nilMonths: [3],
  };
}

describe("effectiveReduction (spec §6.5)", () => {
  it("holds the reduction for the duration, then recovers linearly, then ends", () => {
    const r = 0.6;
    const values = [0, 1, 2, 3, 4, 5].map((t) => effectiveReduction(t, r, 2, 2));
    expect(values[0]).toBe(0.6);
    expect(values[1]).toBe(0.6);
    expect(values[2]).toBeCloseTo(0.4); // r × (1 − 1/3)
    expect(values[3]).toBeCloseTo(0.2); // r × (1 − 2/3)
    expect(values[4]).toBe(0);
    expect(effectiveReduction(-1, r, 2, 2)).toBe(0);
  });

  it("recovers immediately with no recovery months", () => {
    expect([0, 1, 2].map((t) => effectiveReduction(t, 0.5, 2, 0))).toEqual([0.5, 0.5, 0]);
  });

  it("windows the disruption and recovery months", () => {
    expect(scenarioWindow("2024-11", 2, 2)).toEqual(["2024-11", "2024-12", "2025-01", "2025-02"]);
    expect(scenarioWindow("2024-01", 0, 0)).toEqual(["2024-01"]);
  });
});

describe("importDisruption (Scenario A)", () => {
  const snapshot = synthetic();
  const base = {
    partner: "A",
    start: "2024-01",
    reduction: 0.3,
    substitution: 0,
    duration: 1,
    recovery: 0,
    measure: "mass" as const,
  };

  it("affected = baseline partner volume × reduction; residual = total − affected; share = affected ÷ total", () => {
    const r = importDisruption(snapshot, base);
    // January: A 6 t, B 4 t (allocated 10 t; the unallocated 1 t is not a partner country).
    expect(r.partnerBaseline).toBeCloseTo(6);
    expect(r.total).toBeCloseTo(10);
    expect(r.affected).toBeCloseTo(1.8);
    expect(r.residual).toBeCloseTo(8.2);
    expect(r.shareAffected).toBeCloseTo(0.18);
    expect(r.unreplaced).toBeCloseTo(1.8);
    expect(r.partnerName).toBe("Partner A");
  });

  it("is the baseline at zero disruption", () => {
    const r = importDisruption(snapshot, { ...base, reduction: 0, duration: 3 });
    expect(r.affected).toBe(0);
    expect(r.residual).toBeCloseTo(r.total);
    expect(r.sharesAfter).toEqual(r.sharesBefore);
    expect(r.hhiAfter).toBeCloseTo(r.hhiBefore!);
    expect(r.shareAffected).toBe(0);
  });

  it("removes the partner entirely at full disruption", () => {
    const r = importDisruption(snapshot, { ...base, reduction: 1 });
    expect(r.affected).toBeCloseTo(6);
    expect(r.residual).toBeCloseTo(4);
    expect(r.partnerShareAfter).toBe(0);
    expect(r.sharesAfter.map((s) => s.key)).toEqual(["B"]);
    expect(r.hhiAfter).toBeCloseTo(10_000);
  });

  it("leaves no partner when the only partner is fully disrupted", () => {
    const r = importDisruption(snapshot, { ...base, start: "2024-06", reduction: 1 });
    expect(r.total).toBeCloseTo(0.5);
    expect(r.residual).toBeCloseTo(0);
    expect(r.sharesAfter).toEqual([]);
    expect(r.hhiAfter).toBeNull();
    expect(r.partnerShareAfter).toBeNull();
  });

  it("recomputes shares and HHI with every other partner unchanged", () => {
    const r = importDisruption(snapshot, { ...base, reduction: 0.5 });
    // A 3 t, B 4 t after.
    expect(r.sharesAfter.map((s) => [s.key, s.share])).toEqual([
      ["B", 4 / 7],
      ["A", 3 / 7],
    ]);
    expect(r.hhiAfter).toBeCloseTo(hhi([4 / 7, 3 / 7])!);
    expect(r.hhiBefore).toBeCloseTo(hhi([0.6, 0.4])!);
  });

  it("applies the substitution assumption only to the unreplaced amount", () => {
    const r = importDisruption(snapshot, { ...base, substitution: 0.25 });
    expect(r.affected).toBeCloseTo(1.8);
    expect(r.unreplaced).toBeCloseTo(1.35);
    expect(r.unreplacedShare).toBeCloseTo(0.135);
    expect(r.residual).toBeCloseTo(8.2);
  });

  it("handles missing observations: a month without the partner, a nil month, months beyond the snapshot", () => {
    const r = importDisruption(snapshot, { ...base, start: "2024-02", duration: 6, reduction: 0.5 });
    expect(r.used).toEqual(["2024-02", "2024-03", "2024-04", "2024-05", "2024-06"]);
    expect(r.outside).toEqual(["2024-07"]);
    expect(r.partnerAbsent).toEqual(["2024-03", "2024-04"]);
    expect(r.nil).toEqual(["2024-04"]);
    expect(r.provisional).toEqual(["2024-05", "2024-06"]);
    const april = r.months.find((m) => m.month === "2024-04")!;
    expect(april.total).toBe(0);
    expect(april.shareAffected).toBeNull();
    expect(r.months.find((m) => m.month === "2024-07")!.inSnapshot).toBe(false);
    // A: 3 + 1 + 0.5 = 4.5 t baseline, half affected.
    expect(r.partnerBaseline).toBeCloseTo(4.5);
    expect(r.affected).toBeCloseTo(2.25);
    expect(r.suppressedRows).toBe(1);
  });

  it("applies the linear recovery month by month", () => {
    const r = importDisruption(snapshot, { ...base, duration: 1, recovery: 1, reduction: 0.6 });
    expect(r.months.map((m) => m.effective)).toEqual([0.6, 0.3]);
    expect(r.affected).toBeCloseTo(6 * 0.6 + 3 * 0.3);
  });

  it("works on value as well as net mass", () => {
    const r = importDisruption(snapshot, { ...base, measure: "value" });
    expect(r.partnerBaseline).toBe(600);
    expect(r.total).toBe(1400);
    expect(r.affected).toBeCloseTo(180);
  });

  it("is zero for a partner that recorded nothing", () => {
    const r = importDisruption(snapshot, { ...base, partner: "ZZ" });
    expect(r.affected).toBe(0);
    expect(r.partnerName).toBeNull();
    expect(r.partnerShareBefore).toBe(0);
  });

  it("reproduces the recorded tomato figures for Spain (HMRC snapshot 2026-10-26)", () => {
    const tomatoes = readRepoJson<TradeSnapshot>("public/data/snapshots/2026-10-26/trade/tomatoes.json");
    const r = importDisruption(tomatoes, { ...base, partner: "ES", start: "2025-01", duration: 3 });
    const agg = aggregatePeriod(tomatoes, ["2025-01", "2025-02", "2025-03"]);
    const spain = agg.partners.find((p) => p.key === "ES")!.kg / 1000;
    expect(r.partnerBaseline).toBeCloseTo(spain, 6);
    expect(r.total).toBeCloseTo(agg.allocated.kg / 1000, 6);
    expect(r.affected).toBeCloseTo(spain * 0.3, 6);
    expect(r.partnerShareBefore).toBeCloseTo(
      partnerShares(agg.partners, "mass").find((s) => s.key === "ES")!.share,
      12,
    );
  });
});

/** Obviously synthetic closure inputs: stores S0–S3 on a line, areas a0–a4. */
function closureData(): ClosureInput {
  return {
    councils: ["X00000001", "X00000002"],
    stores: {
      id: [10, 11, 12, 13],
      retailer: ["R1", "R1", "R2", "R3"],
      council: [0, 0, 0, 1],
      x: [0, 1500, 4000, 9000],
      y: [0, 0, 0, 0],
    },
    areas: {
      code: ["a0", "a1", "a2", "a3", "a4"],
      council: [0, 0, 0, 1, 1],
      population: [1000, 2000, 1500, 800, 0],
      decile: [1, 3, null, null, 2],
      // Three nearest stores and distances (metres) per area.
      nearest: [
        [0, 1, 2],
        [0, 1, 2],
        [1, 0, 2],
        [0, 2, 3],
        [3, 2, -1],
      ],
      distance: [
        [200, 1300, 3800],
        [600, 900, 3400],
        [300, 1200, 2500],
        [2600, 2900, 6000],
        [100, 4900, 0],
      ],
    },
  };
}

describe("closureImpact (Scenario B)", () => {
  it("moves each area whose nearest is closed to its second nearest", () => {
    const r = closureImpact(closureData(), 0);
    expect(r.affected.map((a) => [a.index, a.before, a.after, a.newStore])).toEqual([
      [0, 200, 1300, 1], // +1,100 m
      [1, 600, 900, 1], // +300 m
      [3, 2600, 2900, 2], // +300 m, smaller population
    ]);
    expect(r.populationAffected).toBe(3800);
    expect(r.maxIncrease).toBe(1100);
    expect(r.unresolved).toBe(0);
  });

  it("population-weights the increase", () => {
    const r = closureImpact(closureData(), 0);
    expect(r.meanIncrease).toBeCloseTo((1100 * 1000 + 300 * 2000 + 300 * 800) / 3800);
    expect(r.medianIncrease).toBe(300);
  });

  it("changes nothing when the closed store is no area's nearest", () => {
    const r = closureImpact(closureData(), 2);
    expect(r.affected).toEqual([]);
    expect(r.populationAffected).toBe(0);
    expect(r.meanIncrease).toBeNull();
    expect(r.councilDistances.meanAfter).toBeCloseTo(r.councilDistances.meanBefore!);
  });

  it("counts supermarkets beyond the council boundary and nearby", () => {
    const r = closureImpact(closureData(), 0);
    // The area in council 2 (a3) is affected by a council-1 store.
    expect(r.byCouncil).toEqual([
      { council: 0, areas: 2, population: 3000 },
      { council: 1, areas: 1, population: 800 },
    ]);
    expect(r.nearby).toEqual([
      { metres: 1000, before: 1, after: 0 },
      { metres: 2000, before: 2, after: 1 },
      { metres: 5000, before: 3, after: 2 },
    ]);
    expect(r.nearestOther).toEqual({ store: 1, metres: 1500 });
    expect(r.takeover).toEqual([
      { store: 1, areas: 2, population: 3000 },
      { store: 2, areas: 1, population: 800 },
    ]);
  });

  it("recomputes the council's distances and thresholds", () => {
    const r = closureImpact(closureData(), 0);
    const c = r.councilDistances;
    expect(c.areas).toBe(3);
    expect(c.population).toBe(4500);
    // Before: 200, 600, 300; after: 1300, 900, 300.
    expect(c.meanBefore).toBeCloseTo((200 * 1000 + 600 * 2000 + 300 * 1500) / 4500);
    expect(c.meanAfter).toBeCloseTo((1300 * 1000 + 900 * 2000 + 300 * 1500) / 4500);
    expect(c.thresholds[0]).toEqual({ metres: 1000, before: 0, after: 1000 });
    expect(c.medianAfter).toBe(900);
  });

  it("measures retailer concentration before and after", () => {
    const r = closureImpact(closureData(), 0);
    expect(r.retailerBefore.retailers).toEqual([
      { retailer: "R1", count: 2 },
      { retailer: "R2", count: 1 },
    ]);
    expect(r.retailerAfter.stores).toBe(2);
    expect(r.retailerAfter.hhi).toBeCloseTo(5000);
    expect(r.retailerBefore.hhi).toBeCloseTo(hhi([2 / 3, 1 / 3])!);
  });

  it("groups affected residents by deprivation decile where one exists (England only)", () => {
    expect(closureImpact(closureData(), 0).deciles).toEqual([
      { decile: 1, areas: 1, population: 1000 },
      { decile: 3, areas: 1, population: 2000 },
    ]);
  });

  it("reports an area left with no supermarket in the data", () => {
    const r = closureImpact(closureData(), 3);
    expect(r.affected.map((a) => [a.index, a.after])).toEqual([[4, 4900]]);
    const data = closureData();
    data.areas.nearest[4] = [3, -1, -1];
    const lone = closureImpact(data, 3);
    expect(lone.unresolved).toBe(1);
    expect(lone.affected[0]!.after).toBeNull();
    expect(lone.meanIncrease).toBeNull();
  });

  it("matches a brute-force recalculation on the published Northern Ireland inputs", () => {
    const ni = readRepoJson<ScenarioClosure>("public/data/snapshots/2026-10-26/scenario/closure-ni.json");
    // The supermarket that is nearest for most residents.
    const pop = new Map<number, number>();
    ni.areas.nearest.forEach((n, i) => pop.set(n[0]!, (pop.get(n[0]!) ?? 0) + ni.areas.population[i]!));
    const store = [...pop.entries()].sort((a, b) => b[1] - a[1])[0]![0];
    const r = closureImpact(ni, store);
    for (const a of r.affected) {
      let best = Infinity;
      for (let j = 0; j < ni.stores.x.length; j++) {
        if (j === store) continue;
        const d = Math.hypot(ni.stores.x[j]! - ni.areas.x[a.index]!, ni.stores.y[j]! - ni.areas.y[a.index]!);
        best = Math.min(best, d);
      }
      // Grid coordinates are published to the metre.
      expect(Math.abs(best - a.after!)).toBeLessThanOrEqual(1.5);
    }
    expect(r.populationAffected).toBe(pop.get(store));
  });
});

describe("weighted statistics", () => {
  it("takes the population-weighted median and mean", () => {
    expect(weightedMedian([1, 2, 3], [1, 1, 10])).toBe(3);
    expect(weightedMedian([5, 1], [1, 1])).toBe(1);
    expect(weightedMedian([], [])).toBeNull();
    expect(weightedMedian([4], [0])).toBeNull();
    expect(weightedMean([1, 3], [1, 3])).toBeCloseTo(2.5);
    expect(weightedMean([], [])).toBeNull();
  });

  it("classes distance increases with fixed breaks", () => {
    expect([0, 249, 250, 999, 1000, 4000].map(increaseClass)).toEqual([0, 0, 1, 2, 3, 4]);
    expect(increaseClass(null)).toBeNull();
  });

  it("measures retailer concentration with no or one store", () => {
    expect(retailerMix([])).toEqual({ stores: 0, retailers: [], hhi: null, topShare: null });
    expect(retailerMix(["R1"]).hhi).toBeCloseTo(10_000);
  });
});

describe("productionShock (Scenario C)", () => {
  const wheat = { production: 11958, imports: 2674, exports: 207, totalSupply: 14425 };

  it("reduces production and total supply by the same amount, imports and exports held", () => {
    const r = productionShock(wheat, 0.15);
    expect(r.removed).toBeCloseTo(1793.7);
    expect(r.productionAfter).toBeCloseTo(10164.3);
    expect(r.supplyAfter).toBeCloseTo(12631.3);
    expect(r.shareBefore).toBeCloseTo(0.829, 3);
    expect(r.shareAfter).toBeCloseTo(10164.3 / 12631.3);
    expect(r.removedShareOfSupply).toBeCloseTo(1793.7 / 14425);
    expect(r.identityGap).toBeCloseTo(0);
  });

  it("is the baseline at 0 % and removes all production at 100 %", () => {
    expect(productionShock(wheat, 0).productionAfter).toBe(11958);
    const all = productionShock(wheat, 1);
    expect(all.productionAfter).toBe(0);
    expect(all.shareAfter).toBe(0);
    expect(
      productionShock({ production: 0, imports: 0, exports: 0, totalSupply: 0 }, 0.5).shareBefore,
    ).toBeNull();
  });
});

describe("portDisruption (Scenario D)", () => {
  const input = {
    reduction: 0.5,
    months: 12,
    international: 1000,
    agricultural: 200,
    roro: 600,
    totalInternational: 10_000,
    totalAgricultural: 1000,
    foodEntryPercent: 10,
  };

  it("affects the port's tonnage for the share of the year disrupted", () => {
    const r = portDisruption(input);
    expect(r.international).toEqual({
      baseline: 1000,
      affected: 500,
      shareOfUk: 0.1,
      shareOfUkAffected: 0.05,
    });
    expect(r.agricultural.affected).toBe(100);
    expect(r.foodEntryAffected).toBe(5);
    expect(portDisruption({ ...input, months: 3 }).international.affected).toBeCloseTo(125);
  });

  it("computes no commodity exposure the data does not record", () => {
    const r = portDisruption({ ...input, agricultural: null, foodEntryPercent: null });
    expect(r.agricultural.affected).toBeNull();
    expect(r.foodEntryAffected).toBeNull();
    expect(portDisruption({ ...input, reduction: 0 }).international.affected).toBe(0);
  });
});
