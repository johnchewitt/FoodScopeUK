import { describe, expect, it } from "vitest";
import { councilProvision, PROVISION, STORE_LAYERS } from "@/analysis/retail";
import { readRepoJson } from "@/test/files";
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import type { StoreCollection } from "@/types/generated/stores";
import {
  areaTotals,
  choroplethFor,
  classLabels,
  councilDetail,
  indexStores,
  layerCounts,
  proximityView,
  reconcile,
  shownStores,
  storesFrame,
  storesGeoJson,
} from "./model";
import { validateLadIndicators, validateStores } from "./validate";

// Real published files (pipeline build-local, snapshot 2026-10-24; GEOLYTIX v46, ONS mid-2025).
const storesDoc = readRepoJson<StoreCollection>("public/data/snapshots/2026-10-24/local/stores.geojson");
const doc = readRepoJson<CouncilIndicators>("public/data/snapshots/2026-10-24/local/lad-indicators.json");
const stores = indexStores(storesDoc);

describe("validation (ADR-06)", () => {
  it("accepts the published files and rejects a damaged store", () => {
    expect(validateStores(storesDoc).ok).toBe(true);
    expect(validateLadIndicators(doc).ok).toBe(true);
    const broken = structuredClone(storesDoc);
    (broken.features[0]!.properties as { storeClass: string }).storeClass = "hypermarket";
    expect(validateStores(broken).ok).toBe(false);
  });
});

describe("map frame", () => {
  it("covers every mapped store, Crown Dependencies and Shetland included", () => {
    const frame = storesFrame(stores)!;
    expect(frame.key).toBe("access:all-stores");
    const [w, s, e, n] = frame.bbox;
    for (const st of stores) {
      expect(st.lon >= w && st.lon <= e && st.lat >= s && st.lat <= n).toBe(true);
    }
    // Northern Ireland to East Anglia, the Channel Islands to Shetland (published store file).
    expect(w).toBeLessThan(-8);
    expect(e).toBeGreaterThan(1.5);
    expect(s).toBeLessThan(49.5);
    expect(n).toBeGreaterThan(60);
    expect(storesFrame([])).toBeNull();
  });
});

describe("store counts match the pipeline (Stage 4 exit criterion)", () => {
  it("counts every store by map layer, separating the Crown Dependencies", () => {
    expect(stores).toHaveLength(19_183);
    const c = layerCounts(stores);
    expect(c.supermarket).toEqual({ total: 7_193, inCouncils: 7_171, crownDependencies: 22 });
    expect(c.convenience.total).toBe(10_722);
    expect(c.other.total).toBe(1_268);
    const crown = STORE_LAYERS.reduce((a, l) => a + c[l].crownDependencies, 0);
    expect(crown).toBe(125); // Guernsey 30, Jersey 51, Isle of Man 44 (local-qa report)
    const inCouncils = STORE_LAYERS.reduce((a, l) => a + c[l].inCouncils, 0);
    expect(inCouncils).toBe(19_058); // "assigned" in the local-qa report
  });

  it("recounts the same council totals from the store file as the indicator file holds", () => {
    for (const r of reconcile(stores, doc)) expect(r.fromStores, r.layer).toBe(r.fromIndicators);
  });

  it("filters by layer and retailer as the map's where clause does", () => {
    const aldi = shownStores(stores, { layers: ["supermarket"], retailers: ["Aldi"] });
    expect(aldi.every((s) => s.retailer === "Aldi" && s.layer === "supermarket")).toBe(true);
    expect(shownStores(stores, { layers: [], retailers: null })).toEqual([]);
    expect(shownStores(stores, { layers: ["supermarket"], retailers: [] })).toEqual([]);
    expect(shownStores(stores, { layers: [...STORE_LAYERS], retailers: null })).toHaveLength(19_183);
  });
});

describe("compact map file", () => {
  it("keeps only id, layer and retailer for every store", () => {
    const fc = JSON.parse(storesGeoJson(stores.slice(0, 3))) as {
      features: { geometry: { coordinates: number[] }; properties: Record<string, unknown> }[];
    };
    expect(fc.features).toHaveLength(3);
    expect(Object.keys(fc.features[0]!.properties).sort()).toEqual(["id", "layer", "retailer"]);
    expect(fc.features[0]!.geometry.coordinates).toEqual([stores[0]!.lon, stores[0]!.lat]);
    expect(JSON.parse(storesGeoJson([])).features).toEqual([]);
  });
});

describe("council choropleth (SM-06)", () => {
  /** Supermarkets per 10,000 computed by hand from the indicator file's columns. */
  function handRate(code: string): number {
    const c = doc.councils.find((x) => x.code === code)!;
    const groups = doc.stores.groups;
    const bands = new Map(doc.stores.sizeBands.map((b) => [b.id, b.storeClass]));
    const n = c.stores.reduce(
      (a, v, i) =>
        a + (bands.get(groups[i]!.sizeBand) === "supermarket" && groups[i]!.format === "standard" ? v : 0),
      0,
    );
    return (n / c.population!) * 10_000;
  }

  it("puts three councils in the class their hand-computed rate falls in", () => {
    const ch = choroplethFor(councilProvision(doc, "supermarkets"), "supermarkets");
    const breaks = PROVISION.supermarkets.breaks;
    for (const code of ["E06000001", "E08000003", "N09000003"]) {
      const rate = handRate(code);
      const expected = breaks.filter((b) => rate >= b).length;
      expect(ch.classes[expected], code).toContain(code);
    }
    // Hartlepool: 12 supermarkets, 99,656 residents → 1.20 per 10,000 → "1.15 to under 1.30".
    expect(handRate("E06000001")).toBeCloseTo((12 / 99_656) * 10_000, 9);
    expect(ch.classes[4]).toContain("E06000001");
  });

  it("assigns every council exactly once; no-data only without a population", () => {
    for (const m of ["supermarkets", "convenience", "all"] as const) {
      const ch = choroplethFor(councilProvision(doc, m), m);
      const all = [...ch.classes.flat(), ...ch.noData];
      expect(all).toHaveLength(361);
      expect(new Set(all).size).toBe(361);
      expect(ch.noData).toEqual([]);
    }
    const one = { ...doc, councils: [{ ...doc.councils[0]!, population: null }] };
    expect(choroplethFor(councilProvision(one, "all"), "all").noData).toEqual([doc.councils[0]!.code]);
    expect(choroplethFor([], "all").classes.every((c) => c.length === 0)).toBe(true);
  });

  it("labels the fixed classes from their breaks", () => {
    expect(classLabels("supermarkets")).toEqual([
      "under 0.70",
      "0.70 to under 0.85",
      "0.85 to under 1.00",
      "1.00 to under 1.15",
      "1.15 to under 1.30",
      "1.30 and over",
    ]);
  });
});

describe("council detail and area totals (SM-08, SM-09)", () => {
  it("gives Belfast its counts by type, summing to the published total", () => {
    const b = councilDetail(doc, "N09000003")!;
    expect(b.name).toBe("Belfast");
    expect(b.byLayer.supermarket + b.byLayer.convenience + b.byLayer.other).toBe(140);
    expect(b.provision.all.stores).toBe(140);
    expect(b.provision.all.per10k).toBeCloseTo((140 / 351_927) * 10_000, 9);
    expect(councilDetail(doc, null)).toBeNull();
    expect(councilDetail(doc, "E99999999")).toBeNull();
  });

  it("sums the nations to the UK", () => {
    const t = areaTotals(doc, "supermarkets");
    expect(t.nations.reduce((a, n) => a + n.stores, 0)).toBe(t.uk.stores);
    expect(t.nations.reduce((a, n) => a + n.population, 0)).toBe(t.uk.population);
    expect(t.uk.stores).toBe(7_171);
    expect(t.nations.map((n) => n.councils)).toEqual([296, 22, 32, 11]);
  });
});

describe("straight-line proximity (SM-07)", () => {
  const supermarkets = shownStores(stores, { layers: ["supermarket"], retailers: null });

  it("matches pyproj distances in Great Britain (BNG) and Northern Ireland (ITM)", () => {
    // Reference: pyproj 3.8 (EPSG:27700 / EPSG:2157), computed 24 Oct 2026 from the same file.
    const m = proximityView(supermarkets, [-2.2426, 53.4808], 3, 2)!;
    expect(m.crs).toBe("EPSG:27700");
    expect(m.nearest.map((n) => n.store.id)).toEqual([1010006430, 1010000277, 1010015313]);
    expect(m.nearest[0]!.metres).toBeCloseTo(187.1, 0);
    expect(m.withinCount).toBe(10);
    const b = proximityView(supermarkets, [-5.9301, 54.5964], 3, 2)!;
    expect(b.crs).toBe("EPSG:2157");
    expect(b.nearest.map((n) => n.store.id)).toEqual([1010001355, 1010016062, 1010011006]);
    expect(b.nearest[2]!.metres).toBeCloseTo(413.0, 0);
    expect(b.withinCount).toBe(10);
  });

  it("draws a closed ring and handles no point, no stores and a single store", () => {
    expect(proximityView(supermarkets, null, 5, 2)).toBeNull();
    const none = proximityView([], [-2.2426, 53.4808], 5, 2)!;
    expect(none.nearest).toEqual([]);
    expect(none.withinCount).toBe(0);
    const one = proximityView(supermarkets.slice(0, 1), [-2.2426, 53.4808], 5, 0.5)!;
    expect(one.nearest).toHaveLength(1);
    expect(one.ring[0]).toEqual(one.ring[one.ring.length - 1]);
    expect(one.radiusM).toBe(500);
  });
});
