import { describe, expect, it } from "vitest";
import { readRepoJson } from "@/test/files";
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import {
  PROVISION,
  areaTotal,
  classIndex,
  councilProvision,
  countInLayers,
  filterWhereClause,
  groupLayers,
  per10k,
  perKm2,
  retailerCounts,
  searchStores,
  storeLayer,
  storeMatches,
  type FilterableStore,
  type StoreLayer,
} from "./retail";

const real = readRepoJson<CouncilIndicators>("public/data/snapshots/2026-10-24/local/lad-indicators.json");

/** Obviously synthetic indicators: two councils "A" and "B", one size band per class, two formats. */
const synthetic: CouncilIndicators = {
  schemaVersion: 1,
  population: { sourceId: "S18", label: "mid-2025", referenceDate: "2025-06-30", boundaries: "test" },
  landArea: { sourceId: "S18", definition: "test" },
  stores: {
    sourceId: "S11",
    edition: "test",
    sizeBands: [
      { id: "small", label: "small", value: "small", storeClass: "convenience" },
      { id: "big", label: "big", value: "big", storeClass: "supermarket" },
    ],
    storeClasses: [],
    formats: [],
    groups: [
      { sizeBand: "small", format: "standard" },
      { sizeBand: "small", format: "forecourt" },
      { sizeBand: "big", format: "standard" },
      { sizeBand: "big", format: "forecourt" },
    ],
  },
  councils: [
    {
      code: "A",
      name: "A",
      nation: "England",
      population: 20_000,
      landAreaKm2: 10,
      note: null,
      stores: [3, 1, 2, 1],
    },
    {
      code: "B",
      name: "B",
      nation: "Wales",
      population: null,
      landAreaKm2: null,
      note: "no data",
      stores: [1, 0, 0, 0],
    },
  ],
  outsideCouncils: [],
};

describe("store layers (D5)", () => {
  it("maps class and format to a map layer", () => {
    expect(storeLayer("supermarket", "standard")).toBe("supermarket");
    expect(storeLayer("convenience", "standard")).toBe("convenience");
    expect(storeLayer("supermarket", "forecourt")).toBe("other");
    expect(storeLayer("convenience", "hospital")).toBe("other");
  });

  it("labels each indicator column with its layer", () => {
    expect(groupLayers(synthetic)).toEqual(["convenience", "other", "supermarket", "other"]);
    expect(countInLayers([3, 1, 2, 1], groupLayers(synthetic), ["other"])).toBe(2);
    expect(countInLayers([3, 1, 2, 1], groupLayers(synthetic), [])).toBe(0);
  });
});

describe("rates and classes", () => {
  it("computes per 10,000 residents and per km², null without a denominator", () => {
    expect(per10k(2, 20_000)).toBe(1);
    expect(per10k(0, 20_000)).toBe(0);
    expect(per10k(2, null)).toBeNull();
    expect(per10k(2, 0)).toBeNull();
    expect(perKm2(5, 10)).toBe(0.5);
    expect(perKm2(5, null)).toBeNull();
  });

  it("puts values in fixed classes with breaks inclusive at the lower edge", () => {
    const b = [0.7, 0.85, 1, 1.15, 1.3];
    expect(classIndex(0, b)).toBe(0);
    expect(classIndex(0.6999, b)).toBe(0);
    expect(classIndex(0.7, b)).toBe(1);
    expect(classIndex(1.3, b)).toBe(5);
    expect(classIndex(9, b)).toBe(5);
    expect(classIndex(null, b)).toBeNull();
    expect(classIndex(Number.NaN, b)).toBeNull();
  });

  it("builds council provision with a no-data class for a missing population", () => {
    const [a, b] = councilProvision(synthetic, "supermarkets");
    expect(a).toMatchObject({ code: "A", stores: 2, per10k: 1, perKm2: 0.2, classIndex: 3 });
    expect(b).toMatchObject({ code: "B", stores: 0, per10k: null, classIndex: null, note: "no data" });
    const all = councilProvision(synthetic, "all");
    expect(all[0]!.stores).toBe(7);
  });

  it("totals an area and counts councils without population separately", () => {
    const t = areaTotal("Test", councilProvision(synthetic, "convenience"));
    expect(t).toMatchObject({ stores: 3, population: 20_000, councils: 1, withoutPopulation: 1 });
    expect(t.per10k).toBeCloseTo(1.5, 12);
  });

  it("has increasing breaks and six classes for every measure", () => {
    for (const def of Object.values(PROVISION)) {
      expect(def.breaks).toHaveLength(5);
      expect([...def.breaks].sort((x, y) => x - y)).toEqual([...def.breaks]);
    }
  });
});

describe("council provision from the real June 2026 data", () => {
  // Figures from the pipeline (docs/stage-reports/pre-stage-4-data.md): 7,171 supermarkets in UK
  // councils; ONS mid-2025 UK population 69,483,939.
  it("reproduces the UK supermarket total and rate", () => {
    const uk = areaTotal("United Kingdom", councilProvision(real, "supermarkets"));
    expect(uk.stores).toBe(7_171);
    expect(uk.population).toBe(69_483_939);
    expect(uk.withoutPopulation).toBe(0);
    expect(uk.per10k).toBeCloseTo(1.032, 3);
  });

  it("gives Belfast and Manchester their published counts", () => {
    const all = new Map(councilProvision(real, "all").map((p) => [p.code, p]));
    expect(all.get("N09000003")!.stores).toBe(140);
    expect(all.get("E08000003")!.stores).toBe(150);
    expect(all.get("N09000003")!.per10k).toBeCloseTo((140 / 351_927) * 10_000, 9);
  });

  it("spreads councils over every class (no empty class)", () => {
    for (const measure of ["supermarkets", "convenience", "all"] as const) {
      const counts = [0, 0, 0, 0, 0, 0];
      for (const p of councilProvision(real, measure)) counts[p.classIndex!]!++;
      expect(counts.every((n) => n >= 20)).toBe(true);
    }
  });
});

describe("store filters (SM-03)", () => {
  const stores: FilterableStore[] = [
    { layer: "supermarket", retailer: "Retailer A" },
    { layer: "supermarket", retailer: "Retailer B" },
    { layer: "convenience", retailer: "Retailer A" },
    { layer: "other", retailer: "Retailer O'Brien" },
  ];

  it("matches by layer and retailer", () => {
    const f = { layers: ["supermarket"] as StoreLayer[], retailers: ["Retailer A"] };
    expect(stores.filter((s) => storeMatches(s, f))).toHaveLength(1);
    expect(
      stores.filter((s) => storeMatches(s, { layers: ["supermarket", "convenience"], retailers: null })),
    ).toHaveLength(3);
  });

  it("writes an SQL where clause with escaped quotes", () => {
    expect(filterWhereClause({ layers: ["supermarket", "convenience", "other"], retailers: null })).toBe(
      "1=1",
    );
    expect(filterWhereClause({ layers: [], retailers: null })).toBe("1=0");
    expect(filterWhereClause({ layers: ["supermarket"], retailers: [] })).toBe("1=0");
    expect(filterWhereClause({ layers: ["other", "supermarket"], retailers: ["Retailer O'Brien"] })).toBe(
      "layer IN ('other', 'supermarket') AND retailer IN ('Retailer O''Brien')",
    );
  });

  it("counts stores per retailer in the shown layers", () => {
    expect(retailerCounts(stores, ["supermarket", "convenience"])).toEqual([
      { retailer: "Retailer A", stores: 2 },
      { retailer: "Retailer B", stores: 1 },
    ]);
    expect(retailerCounts([], ["supermarket"])).toEqual([]);
  });
});

describe("store search (SM-05)", () => {
  const stores = [
    { id: 1, name: "Shop A Northtown", town: "Northtown", postcode: "ZZ1 2AB" },
    { id: 2, name: "Shop B High Street", town: "Southtown", postcode: "ZZ12 9XY" },
    { id: 3, name: "Northtown Shop C", town: "Easttown", postcode: null },
    { id: 4, name: "Café D", town: null, postcode: "YY3 1AA" },
  ];

  it("ranks postcode, then name prefix, then town, then name matches", () => {
    expect(searchStores(stores, "zz1").map((s) => s.id)).toEqual([1, 2]);
    expect(searchStores(stores, "ZZ1 2").map((s) => s.id)).toEqual([1]);
    expect(searchStores(stores, "northtown").map((s) => s.id)).toEqual([3, 1]);
    expect(searchStores(stores, "southtown").map((s) => s.id)).toEqual([2]);
  });

  it("ignores accents, case and punctuation; needs two characters", () => {
    expect(searchStores(stores, "cafe").map((s) => s.id)).toEqual([4]);
    expect(searchStores(stores, "  SHOP-a ").map((s) => s.id)).toEqual([1]);
    expect(searchStores(stores, "s")).toEqual([]);
    expect(searchStores(stores, "zzz")).toEqual([]);
  });

  it("limits the number of results", () => {
    expect(searchStores(stores, "shop", 2)).toHaveLength(2);
  });
});
