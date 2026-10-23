import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { splitPolygonAtAntimeridian, unwrapRing } from "./build-reference-layers.mjs";

/** Every segment of every ring must stay within one hemisphere of longitude. */
function maxLongitudeStep(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let max = 0;
  for (const poly of polys)
    for (const ring of poly)
      for (let i = 1; i < ring.length; i++) max = Math.max(max, Math.abs(ring[i][0] - ring[i - 1][0]));
  return max;
}

describe("antimeridian handling (synthetic rings)", () => {
  it("unwraps longitudes into a continuous ring", () => {
    const ring = [
      [179, 0],
      [-179, 0],
      [-179, 1],
      [179, 1],
      [179, 0],
    ];
    expect(unwrapRing(ring).map((p) => p[0])).toEqual([179, 181, 181, 179, 179]);
  });

  it("splits a crossing ring into two valid polygons inside [-180, 180]", () => {
    const parts = splitPolygonAtAntimeridian([
      [
        [179, 0],
        [-179, 0],
        [-179, 1],
        [179, 1],
        [179, 0],
      ],
    ]);
    expect(parts).toHaveLength(2);
    for (const [ring] of parts) {
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      for (const [x] of ring) expect(Math.abs(x)).toBeLessThanOrEqual(180);
    }
  });

  it("leaves non-crossing polygons untouched", () => {
    const poly = [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 0],
      ],
    ];
    expect(splitPolygonAtAntimeridian(poly)).toEqual([poly]);
  });
});

describe("committed reference layer (real data)", () => {
  it("has no ring segment that jumps across the map", async () => {
    const url = resolve(process.cwd(), "public/data/reference/world-countries-110m.geojson");
    const fc = JSON.parse(await readFile(url, "utf8"));
    expect(fc.features.length).toBe(177);
    for (const f of fc.features) expect(maxLongitudeStep(f.geometry), f.properties.name).toBeLessThan(180);
  });
});
