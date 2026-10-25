import { describe, expect, it } from "vitest";
import { indexStores } from "@/features/access/model";
import { validateStores } from "@/features/access/validate";
import { readRepoJson } from "@/test/files";
import type { CouncilContext } from "@/types/generated/council-context";
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import type { SmallAreaBoundaries } from "@/types/generated/small-areas";
import type { SmallAreaIndicators } from "@/types/generated/small-area-indicators";
import type { StoreCollection } from "@/types/generated/stores";
import type { UkProduction } from "@/types/generated/uk-production";
import {
  areaClasses,
  codesInDecileClass,
  councilRows,
  deepProfile,
  deprivationDistribution,
  measureGeography,
  ppfiDistribution,
  profileAreaMap,
  profileCouncilMap,
  underserved,
} from "./model";
import {
  validateAreaBoundaries,
  validateAreaIndicators,
  validateCouncilContext,
  validateUkProduction,
} from "./validate";

/*
 * Real published files: local 2026-10-24 (GEOLYTIX v46, ONS mid-2025, May 2025 councils), areas and
 * context 2026-10-25. The expected values were checked independently against the raw source files
 * with pyproj, openpyxl and xlrd, without the pipeline's code (docs/stage-reports/stage-5.md,
 * "Hand checks").
 */
const AREAS = "public/data/snapshots/2026-10-25/areas";
const storesDoc = readRepoJson<StoreCollection>("public/data/snapshots/2026-10-24/local/stores.geojson");
const ladDoc = readRepoJson<CouncilIndicators>("public/data/snapshots/2026-10-24/local/lad-indicators.json");
const contextDoc = readRepoJson<CouncilContext>(
  "public/data/snapshots/2026-10-25/context/council-context.json",
);
const productionDoc = readRepoJson<UkProduction>(
  "public/data/snapshots/2026-10-25/context/uk-production.json",
);
const stores = indexStores(storesDoc);
const load = (lad: string) => ({
  indicators: readRepoJson<SmallAreaIndicators>(`${AREAS}/${lad}/small-area-indicators.json`),
  boundaries: readRepoJson<SmallAreaBoundaries>(`${AREAS}/${lad}/small-areas.geojson`),
});
const manchester = load("E08000003");
const belfast = load("N09000003");
const deepM = deepProfile(manchester.indicators, manchester.boundaries, stores);
const deepB = deepProfile(belfast.indicators, belfast.boundaries, stores);

describe("validation (ADR-06)", () => {
  it("accepts every published profile file", () => {
    expect(validateStores(storesDoc).ok).toBe(true);
    expect(validateCouncilContext(contextDoc).ok).toBe(true);
    expect(validateUkProduction(productionDoc).ok).toBe(true);
    for (const d of [manchester, belfast]) {
      expect(validateAreaIndicators(d.indicators).ok).toBe(true);
      expect(validateAreaBoundaries(d.boundaries).ok).toBe(true);
    }
  });

  it("rejects a small area with an unknown geography", () => {
    const broken = structuredClone(manchester.indicators);
    (broken.profiles[0]!.geography as { kind: string }).kind = "msoa21";
    expect(validateAreaIndicators(broken).ok).toBe(false);
  });
});

describe("council rows (LP-01, LP-02)", () => {
  const rows = councilRows(ladDoc, contextDoc, new Set(["E08000003", "N09000003"]));
  const row = (code: string) => rows.find((r) => r.code === code)!;

  it("lists all 361 councils by name, with the two deep profiles marked", () => {
    expect(rows).toHaveLength(361);
    expect(rows.map((r) => r.name)).toEqual([...rows.map((r) => r.name)].sort((a, b) => a.localeCompare(b)));
    expect(rows.filter((r) => r.deep).map((r) => r.name)).toEqual(["Belfast", "Manchester"]);
  });

  it("carries mid-2025 population (= ONS MYE2), land area, frame and car availability", () => {
    expect(row("N09000003")).toMatchObject({ population: 351_927, nation: "Northern Ireland" });
    expect(row("E08000003")).toMatchObject({ population: 588_256, nation: "England" });
    expect(row("W06000015").population).toBe(381_516);
    expect(row("S12000036").population).toBe(531_370);
    // Census 2021 households with no car or van (NISRA LGD file; ONS TS045 LTLA).
    expect(row("N09000003").context?.carAvailability).toMatchObject({ households: 149_207, noCar: 50_594 });
    expect(row("E08000003").context?.carAvailability).toMatchObject({ households: 214_732, noCar: 83_770 });
    expect(row("E08000003").context?.urbanRural).toMatchObject({ code: "UUN" });
    expect(row("N09000003").context?.urbanRural).toBeNull(); // no council-level class for NI
    expect(row("S12000036").context?.carAvailability).toBeNull(); // Scotland's census is 2022
    const [w, s, e, n] = row("N09000003").bbox!;
    expect(w).toBeLessThan(-5.93);
    expect(e).toBeGreaterThan(-5.93);
    expect(s).toBeLessThan(54.6);
    expect(n).toBeGreaterThan(54.6);
  });
});

describe("deep profiles (LP-04, LP-05)", () => {
  it("joins every small area: 295 LSOAs; 735 Data Zones and 174 SOAs", () => {
    expect(deepM.areas).toHaveLength(295);
    expect(deepM.ppfi).toHaveLength(295);
    expect(deepM.deprivation).toHaveLength(295);
    expect(deepB.areas).toHaveLength(735);
    expect(deepB.ppfi).toHaveLength(174);
    expect(deepB.deprivation).toHaveLength(174);
    expect(deepB.ppfiGeography).toBe("soa2011");
    expect(deepM.ppfiGeography).toBe("lsoa21");
  });

  it("straight-line distances match an independent pyproj calculation (within 5 m)", () => {
    // Nearest GEOLYTIX supermarket from the raw population-weighted centroids (BNG; Irish Grid → ITM).
    const expected: Record<string, number> = {
      E01005061: 1358,
      E01005151: 950,
      E01005230: 634,
      E01005310: 448,
      E01034138: 159,
      N20000711: 1071,
      N20000894: 499,
      N20001078: 403,
      N20001262: 1829,
      N20001445: 408,
    };
    const all = [...deepM.areas, ...deepB.areas];
    for (const [code, metres] of Object.entries(expected)) {
      const area = all.find((a) => a.code === code)!;
      expect(Math.abs(area.toSupermarket! - metres), code).toBeLessThanOrEqual(5);
    }
  });

  it("population beyond 1, 2 and 5 km straight-line uses the census population of the same areas", () => {
    for (const d of [deepM, deepB]) {
      for (const b of d.beyondSupermarket) {
        const beyond = d.areas.filter((a) => a.toSupermarket! > b.thresholdKm * 1000);
        expect(b.population).toBe(beyond.reduce((s, a) => s + a.population, 0));
        expect(b.areas).toBe(beyond.length);
        expect(b.share).toBeCloseTo(b.population / d.population, 10);
      }
    }
    expect(deepB.beyondSupermarket[0]!.share).toBeCloseTo(0.322, 3);
    expect(deepM.beyondSupermarket[0]!.share).toBeCloseTo(0.141, 3);
    // Underserved list: farthest first, each beyond the threshold.
    const list = underserved(deepB, 2);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => a.metres > 2000)).toBe(true);
    expect(list.map((a) => a.metres)).toEqual([...list.map((a) => a.metres)].sort((a, b) => b - a));
  });

  it("decile counts match the raw PPFI v2.1, IoD 2025 and NIMDM 2017 files", () => {
    const top = (rows: { decile: number; areas: number }[], max: number) =>
      rows.filter((r) => r.decile <= max).reduce((s, r) => s + r.areas, 0);
    expect(top(ppfiDistribution(deepM, "combined").rows, 2)).toBe(119);
    expect(top(ppfiDistribution(deepB, "combined").rows, 2)).toBe(6);
    expect(top(deprivationDistribution(deepM).rows, 1)).toBe(120);
    expect(top(deprivationDistribution(deepB).rows, 1)).toBe(47);
    // Three PPFI domains have no NI data: missing, never zero.
    const online = ppfiDistribution(deepB, "ecommerce_access");
    expect(online.missing).toBe(174);
    expect(online.rows.every((r) => r.areas === 0)).toBe(true);
  });
});

describe("map models (LP-06)", () => {
  it("draws PPFI and deprivation on their own geography, distance and car access on the census areas", () => {
    expect(measureGeography(deepB, "ppfi")).toBe("soa2011");
    expect(measureGeography(deepB, "deprivation")).toBe("soa2011");
    expect(measureGeography(deepB, "distance")).toBe("dz21");
    expect(profileAreaMap(deepB, "ppfi", null, [], "c").areas).toHaveLength(174);
    expect(profileAreaMap(deepB, "no-car", null, [], "c").areas).toHaveLength(735);
    expect(profileAreaMap(deepM, "distance", null, [], "c").areas).toHaveLength(295);
  });

  it("a chart class outlines the same areas the map shades in that class", () => {
    const items = deepB.ppfi.map((p) => ({ code: p.code, decile: p.ppfi.decile }));
    const codes = codesInDecileClass(items, 4); // deciles 1–2
    expect(codes).toHaveLength(6);
    const classes = areaClasses(deepB, "ppfi");
    expect(codes.every((c) => classes[c] === 4)).toBe(true);
    const model = profileAreaMap(deepB, "ppfi", "95GG01S1", [...codes, "E01005061"], "c");
    expect(model.highlighted).toEqual(codes); // codes not on this map are dropped
    expect(model.selected).toBe("95GG01S1");
    // A Data Zone is not on the SOA map, so it is not selected there.
    expect(profileAreaMap(deepB, "ppfi", "N20000711", [], "c").selected).toBeNull();
  });

  it("frames the selected council, or the UK without one", () => {
    const base = {
      mode: "access" as const,
      compareCouncils: [],
      grocers: null,
      storesUrl: "blob:x",
      storeWhere: "1=1",
      storesCopyright: "x",
      frame: { key: "access:all-stores", bbox: [-8, 49, 2, 61] as [number, number, number, number] },
      councilsUrl: "x",
      councilsCopyright: "x",
      choropleth: null,
      selectedStore: null,
      selectedCouncil: null,
      proximity: null,
    };
    const bbox: [number, number, number, number] = [-6.05, 54.53, -5.8, 54.66];
    expect(profileCouncilMap(base, "N09000003", bbox, ["E08000003"])).toMatchObject({
      mode: "profile",
      selectedCouncil: "N09000003",
      compareCouncils: ["E08000003"],
      frame: { key: "profile:N09000003", bbox },
      choropleth: null,
    });
    expect(profileCouncilMap(base, null, null, []).frame).toEqual({
      key: "profile:uk",
      bbox: base.frame.bbox,
    });
  });
});
