import { describe, expect, it } from "vitest";
import { fromGrid, gridCircle, gridDistance, toGrid } from "./projection";

/**
 * Reference values computed with pyproj 3.8 (PROJ 9.8) on 24 Oct 2026, using the transformations
 * PROJ chooses without the OSTN15 grid ("Inverse of OSGB36 to WGS 84 (6)" for EPSG:27700;
 * "Inverse of IRENET95 to WGS 84 (1)" for EPSG:2157). These are the same transformations the
 * pipeline uses. Columns: name, lon, lat, BNG easting, BNG northing, ITM easting, ITM northing.
 */
const FORWARD: [string, number, number, number, number, number, number][] = [
  ["Manchester Piccadilly", -2.2309, 53.4774, 384772.669, 397877.472, 982777.448, 762994.149],
  ["Belfast City Hall", -5.9301, 54.5964, 146235.877, 529459.805, 733754.109, 873983.463],
  ["Lerwick", -1.1449, 60.1546, 447573.546, 1141431.119, 980200.383, 1510661.234],
  ["St Mary's Scilly", -6.3149, 49.9142, 90350.65, 10484.775, 721004.644, 352471.182],
  ["Lowestoft", 1.7529, 52.4811, 654925.162, 293642.124, 1261648.788, 681485.079],
  ["Enniskillen", -7.6372, 54.3438, 33812.301, 508912.304, 623590.131, 843961.708],
];

/**
 * Jersey (St Helier, -2.1058, 49.1856) is left out of the BNG comparison: it is outside the area of
 * use of EPSG:1314, so PROJ falls back to a "ballpark" operation with no datum shift there and its
 * result differs by about 125 m. `toGrid` applies EPSG:1314 everywhere, so the clicked point and the
 * Crown Dependency stores are always projected the same way (see the test below).
 */
const JERSEY: [number, number] = [-2.1058, 49.1856];

/** pyproj inverse: grid easting, northing → lon, lat. */
const INVERSE_BNG: [number, number, number, number][] = [
  [384772.669, 397877.472, -2.230899993, 53.4774],
  [530000, 180000, -0.12835394, 51.503990828],
  [200000, 800000, -5.298777651, 57.047546344],
];
const INVERSE_ITM: [number, number, number, number][] = [
  [733754.109, 873983.463, -5.930099994, 54.596399996],
  [650000, 850000, -7.230049965, 54.396147222],
];

describe("toGrid", () => {
  it.each(FORWARD)("%s matches PROJ in British National Grid to 1 cm", (_n, lon, lat, e, n) => {
    const [x, y] = toGrid(lon, lat, "EPSG:27700");
    expect(Math.abs(x - e)).toBeLessThan(0.01);
    expect(Math.abs(y - n)).toBeLessThan(0.01);
  });

  it.each(FORWARD)(
    "%s matches PROJ in Irish Transverse Mercator to 1 cm",
    (_n, lon, lat, _e, _no, ie, inn) => {
      const [x, y] = toGrid(lon, lat, "EPSG:2157");
      expect(Math.abs(x - ie)).toBeLessThan(0.01);
      expect(Math.abs(y - inn)).toBeLessThan(0.01);
    },
  );
});

describe("fromGrid", () => {
  it.each(INVERSE_BNG)("BNG %d, %d matches PROJ to about 1 cm", (e, n, lon, lat) => {
    const [x, y] = fromGrid(e, n, "EPSG:27700");
    expect(Math.abs(x - lon)).toBeLessThan(2e-7);
    expect(Math.abs(y - lat)).toBeLessThan(1e-7);
  });

  it.each(INVERSE_ITM)("ITM %d, %d matches PROJ to about 1 cm", (e, n, lon, lat) => {
    const [x, y] = fromGrid(e, n, "EPSG:2157");
    expect(Math.abs(x - lon)).toBeLessThan(2e-7);
    expect(Math.abs(y - lat)).toBeLessThan(1e-7);
  });

  it("projects Jersey with the same Helmert shift as Great Britain (no ballpark fallback)", () => {
    // pyproj with "Inverse of OSGB36 to WGS 84 (6)" forced: 392385.800, -79447.074 (ballpark: 392291.052, -79363.766).
    const [x, y] = toGrid(...JERSEY, "EPSG:27700");
    expect(Math.abs(x - 392385.8)).toBeLessThan(0.01);
    expect(Math.abs(y - -79447.074)).toBeLessThan(0.01);
    expect(fromGrid(x, y, "EPSG:27700")[0]).toBeCloseTo(JERSEY[0], 7);
  });

  it("round-trips to within a few millimetres", () => {
    for (const [, lon, lat] of FORWARD) {
      for (const crs of ["EPSG:27700", "EPSG:2157"] as const) {
        const [x, y] = toGrid(lon, lat, crs);
        const [x2, y2] = toGrid(...fromGrid(x, y, crs), crs);
        // The inverse Helmert uses the transposed small-angle rotation, as PROJ does: ~1 mm.
        expect(Math.hypot(x2 - x, y2 - y)).toBeLessThan(0.003);
      }
    }
  });
});

describe("gridDistance and gridCircle", () => {
  it("measures Euclidean grid distance in metres", () => {
    expect(gridDistance([0, 0], [3000, 4000])).toBe(5000);
    expect(gridDistance([5, 5], [5, 5])).toBe(0);
  });

  it("draws a closed ring whose points are the radius away in the grid", () => {
    const ring = gridCircle(-2.2309, 53.4774, 2000, "EPSG:27700", 24);
    expect(ring).toHaveLength(25);
    expect(ring[0]).toEqual(ring[24]);
    const centre = toGrid(-2.2309, 53.4774, "EPSG:27700");
    for (const [lon, lat] of ring) {
      expect(gridDistance(centre, toGrid(lon, lat, "EPSG:27700"))).toBeCloseTo(2000, 2);
    }
  });
});
