import { describe, expect, it } from "vitest";
import tomatoesJson from "../../public/data/snapshots/2026-10-23/trade/tomatoes.json";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import { toGrid } from "./projection";
import {
  beyondThreshold,
  breakClass,
  breakLabels,
  concentration,
  councilNetwork,
  decileClass,
  decileDistribution,
  density,
  gridForCouncil,
  nationalImports,
  nearestDistances,
  noCarShare,
  OTHER_RETAILERS,
  populationBeyond,
  retailerSlices,
  searchCouncils,
  type NetworkStore,
} from "./profile";

// Obviously synthetic councils "A1"/"B1" and retailers "A", "B", "C" (unit tests of pure functions).
const S = (id: number, lad: string | null, layer: NetworkStore["layer"], retailer: string): NetworkStore => ({
  id,
  lad,
  layer,
  retailer,
});

describe("councilNetwork", () => {
  const stores = [
    S(1, "A1", "supermarket", "A"),
    S(2, "A1", "supermarket", "A"),
    S(3, "A1", "supermarket", "B"),
    S(4, "A1", "convenience", "C"),
    S(5, "A1", "other", "A"),
    S(6, "B1", "supermarket", "B"),
    S(7, null, "supermarket", "A"),
  ];

  it("counts only the council's stores, by type and retailer", () => {
    const n = councilNetwork(stores, "A1");
    expect(n.total).toBe(5);
    expect(n.byLayer).toEqual({ supermarket: 3, convenience: 1, other: 1 });
    expect(n.retailers.map((r) => [r.retailer, r.total])).toEqual([
      ["A", 3],
      ["B", 1],
      ["C", 1],
    ]);
  });

  it("measures concentration on supermarkets and on every store", () => {
    const n = councilNetwork(stores, "A1");
    expect(n.supermarketConcentration).toMatchObject({ stores: 3, topRetailer: "A", retailers: 2 });
    expect(n.supermarketConcentration.topShare).toBeCloseTo(2 / 3);
    // HHI = (100·2/3)² + (100·1/3)²
    expect(n.supermarketConcentration.hhi).toBeCloseTo((200 / 3) ** 2 + (100 / 3) ** 2);
    expect(n.allConcentration.top3Share).toBeCloseTo(1);
  });

  it("is empty, not zero-filled, for a council without stores", () => {
    const n = councilNetwork(stores, "Z9");
    expect(n.total).toBe(0);
    expect(n.retailers).toEqual([]);
    expect(n.supermarketConcentration).toMatchObject({
      stores: 0,
      hhi: null,
      topShare: null,
      topRetailer: null,
    });
  });

  it("single retailer: HHI 10,000 and share 1", () => {
    const c = concentration(
      [{ retailer: "A", total: 2, byLayer: { supermarket: 2, convenience: 0, other: 0 } }],
      ["supermarket"],
    );
    expect(c.hhi).toBe(10_000);
    expect(c.topShare).toBe(1);
  });
});

describe("retailerSlices", () => {
  it("keeps slotted retailers in slot order and folds the rest into Other", () => {
    const rows = [
      { retailer: "Zed", total: 9, byLayer: { supermarket: 9, convenience: 0, other: 0 } },
      { retailer: "Lidl", total: 2, byLayer: { supermarket: 2, convenience: 0, other: 0 } },
      { retailer: "Tesco", total: 3, byLayer: { supermarket: 3, convenience: 0, other: 0 } },
      { retailer: "Yak", total: 1, byLayer: { supermarket: 0, convenience: 1, other: 0 } },
    ];
    expect(retailerSlices(rows)).toEqual([
      { retailer: "Tesco", slot: 0, stores: 3, members: ["Tesco"] },
      { retailer: "Lidl", slot: 7, stores: 2, members: ["Lidl"] },
      { retailer: OTHER_RETAILERS, slot: null, stores: 10, members: ["Zed", "Yak"] },
    ]);
    expect(retailerSlices([])).toEqual([]);
  });
});

describe("straight-line distances", () => {
  const at = (lon: number, lat: number, crs: "EPSG:27700" | "EPSG:2157") => {
    const [x, y] = toGrid(lon, lat, crs);
    return { x, y, crs };
  };

  it("measures in the council's grid among stores in that grid", () => {
    expect(gridForCouncil("N09000003")).toBe("EPSG:2157");
    expect(gridForCouncil("E08000003")).toBe("EPSG:27700");
    const areas = [
      { code: "a", centroid: [-2.24, 53.48] as [number, number] },
      { code: "b", centroid: [-2.24, 53.5] as [number, number] },
    ];
    const near = at(-2.24, 53.481, "EPSG:27700");
    const ni = at(-5.93, 54.6, "EPSG:2157");
    const d = nearestDistances(areas, [near, ni], "EPSG:27700");
    expect(d.get("a")!).toBeGreaterThan(100);
    expect(d.get("a")!).toBeLessThan(120);
    expect(d.get("b")!).toBeGreaterThan(2000);
    // No store in the grid: null, never zero.
    expect(nearestDistances(areas, [ni], "EPSG:27700").get("a")).toBeNull();
  });

  it("sums population beyond a threshold and counts unknown areas", () => {
    const areas = [
      { code: "a", population: 100 },
      { code: "b", population: 300 },
      { code: "c", population: 50 },
    ];
    const d = new Map<string, number | null>([
      ["a", 500],
      ["b", 1500],
      ["c", null],
    ]);
    expect(populationBeyond(areas, d, 1)).toEqual({
      thresholdKm: 1,
      population: 300,
      areas: 1,
      share: 0.75,
      unknown: 1,
    });
    expect(populationBeyond(areas, d, 2).population).toBe(0);
    expect(populationBeyond([], d, 1).share).toBeNull();
    expect(beyondThreshold(areas, d, 0.4).map((a) => a.code)).toEqual(["b", "a"]);
  });
});

describe("classes and distributions", () => {
  it("decile classes put the highest priority last", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(decileClass)).toEqual([4, 4, 3, 3, 2, 2, 1, 1, 0, 0]);
    expect(decileClass(null)).toBeNull();
    expect(decileClass(0)).toBeNull();
    expect(decileClass(11)).toBeNull();
  });

  it("break classes: a value at a break goes to the class above", () => {
    const b = [0.15, 0.3, 0.45, 0.6];
    expect([0, 0.1499, 0.15, 0.3, 0.6, 1].map((v) => breakClass(v, b))).toEqual([0, 0, 1, 2, 4, 4]);
    expect(breakClass(null, b)).toBeNull();
    expect(breakClass(Number.NaN, b)).toBeNull();
    expect(breakLabels([1, 2], (v) => `${v} km`)).toEqual([
      "under 1 km",
      "1 km to under 2 km",
      "2 km and over",
    ]);
  });

  it("decile distribution: population only when every area has one", () => {
    const withPop = decileDistribution([
      { decile: 1, population: 10 },
      { decile: 1, population: 5 },
      { decile: 10, population: 1 },
      { decile: null, population: 3 },
    ]);
    expect(withPop.rows[0]).toEqual({ decile: 1, areas: 2, population: 15 });
    expect(withPop.rows[9]).toEqual({ decile: 10, areas: 1, population: 1 });
    expect(withPop.missing).toBe(1);
    const noPop = decileDistribution([{ decile: 2 }, { decile: 2 }]);
    expect(noPop.rows[1]).toEqual({ decile: 2, areas: 2, population: null });
  });

  it("no-car share and density are null without a denominator", () => {
    expect(noCarShare(200, 50)).toBe(0.25);
    expect(noCarShare(0, 0)).toBeNull();
    expect(noCarShare(null, 3)).toBeNull();
    expect(density(1000, 10)).toBe(100);
    expect(density(1000, 0)).toBeNull();
    expect(density(null, 10)).toBeNull();
  });
});

describe("searchCouncils", () => {
  const councils = [
    { code: "E08000003", name: "Manchester" },
    { code: "N09000003", name: "Belfast" },
    { code: "N09000001", name: "Antrim and Newtownabbey" },
    { code: "W06000015", name: "Cardiff" },
  ];
  it("finds by name start, word start, code; ignores case", () => {
    expect(searchCouncils(councils, "bel").map((c) => c.name)).toEqual(["Belfast"]);
    expect(searchCouncils(councils, "NEWTOWN").map((c) => c.name)).toEqual(["Antrim and Newtownabbey"]);
    expect(searchCouncils(councils, "e08000003").map((c) => c.name)).toEqual(["Manchester"]);
    expect(searchCouncils(councils, "  ")).toEqual([]);
    expect(searchCouncils(councils, "zzz")).toEqual([]);
  });
});

describe("nationalImports (real HMRC tomatoes snapshot, 2026-10-23)", () => {
  const tomatoes = tomatoesJson as unknown as TradeSnapshot;

  it("covers the latest 12 months by net mass, with the Food Origins concentration measures", () => {
    const n = nationalImports(tomatoes, tomatoes.months.provisionalFrom)!;
    expect(n.periodLabel).toMatch(/^12 months to /);
    expect(n.partners).toBeGreaterThan(5);
    expect(n.topShare!).toBeGreaterThan(0);
    expect(n.topShare!).toBeLessThanOrEqual(1);
    // HHI is at least the top partner's squared share and at most 10,000.
    expect(n.hhi!).toBeGreaterThanOrEqual((100 * n.topShare!) ** 2 - 1e-6);
    expect(n.hhi!).toBeLessThanOrEqual(10_000);
    expect(n.tonnes).toBeGreaterThan(0);
  });

  it("is null when the period has no recorded imports", () => {
    expect(nationalImports({ ...tomatoes, rows: [] }, null)).toBeNull();
  });
});
