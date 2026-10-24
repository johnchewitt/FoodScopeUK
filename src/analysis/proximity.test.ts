import { describe, expect, it } from "vitest";
import { fromGrid, toGrid } from "./projection";
import { distancesFrom, gridFor, projectStore, proximity, type GridStore } from "./proximity";

/** Obviously synthetic stores placed at chosen grid offsets from a GB point and an NI point. */
const GB: [number, number] = [-2.2309, 53.4774];
const NI: [number, number] = [-5.9301, 54.5964];

function storeAt(id: number, origin: [number, number], dx: number, dy: number, lad: string): GridStore {
  const crs = gridFor(lad);
  const [x0, y0] = toGrid(...origin, crs);
  const [lon, lat] = fromGrid(x0 + dx, y0 + dy, crs);
  return projectStore(id, lon, lat, lad);
}

const stores: GridStore[] = [
  storeAt(1, GB, 3000, 4000, "E00000001"), // 5 km
  storeAt(2, GB, 1000, 0, "E00000001"), // 1 km
  storeAt(3, GB, 0, -2500, "E00000001"), // 2.5 km
  storeAt(4, NI, 600, 800, "N00000001"), // 1 km from the NI point, in ITM
];

describe("straight-line proximity (SM-07)", () => {
  it("uses ITM for Northern Ireland councils and BNG elsewhere", () => {
    expect(gridFor("N09000003")).toBe("EPSG:2157");
    expect(gridFor("E08000003")).toBe("EPSG:27700");
    expect(gridFor(null)).toBe("EPSG:27700");
  });

  it("measures each store in its own grid, nearest first", () => {
    const d = distancesFrom(...GB, stores);
    expect(d.map((x) => x.id).slice(0, 3)).toEqual([2, 3, 1]);
    expect(d[0]!.metres).toBeCloseTo(1000, 1);
    expect(d[1]!.metres).toBeCloseTo(2500, 1);
    expect(d[2]!.metres).toBeCloseTo(5000, 1);
    const fromNi = distancesFrom(...NI, stores);
    expect(fromNi[0]).toMatchObject({ id: 4, crs: "EPSG:2157" });
    expect(fromNi[0]!.metres).toBeCloseTo(1000, 1);
  });

  it("returns the nearest n and everything within the radius", () => {
    const r = proximity(...GB, stores, 2, 2600);
    expect(r.nearest.map((x) => x.id)).toEqual([2, 3]);
    expect(r.within.map((x) => x.id)).toEqual([2, 3]);
    expect(r.circleCrs).toBe("EPSG:27700");
    expect(proximity(...NI, stores, 1, 500).within).toEqual([]);
    expect(proximity(...NI, stores, 1, 500).circleCrs).toBe("EPSG:2157");
  });

  it("handles no stores and a zero count", () => {
    expect(proximity(...GB, [], 5, 1000)).toEqual({ nearest: [], within: [], circleCrs: "EPSG:27700" });
    expect(proximity(...GB, stores, 0, 0).nearest).toEqual([]);
  });
});
