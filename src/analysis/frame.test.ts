import { describe, expect, it } from "vitest";
import { symbolicArc } from "./arcs";
import { readRepoJson } from "@/test/files";
import { connectionsBBox, fitBBox, pointsBBox, UK_EXTENT_110M, unionBBox, type FitViewport } from "./frame";

const NO_PAD = { top: 0, right: 0, bottom: 0, left: 0 };
const square: FitViewport = { width: 1024, height: 1024, padding: NO_PAD };

describe("pointsBBox", () => {
  it("is null without points, or with no finite coordinates", () => {
    expect(pointsBBox([])).toBeNull();
    expect(pointsBBox([{ lon: Number.NaN, lat: 1 }])).toBeNull();
  });

  it("is a zero-size box for a single point and skips non-finite coordinates", () => {
    expect(pointsBBox([{ lon: 1, lat: 2 }])).toEqual([1, 2, 1, 2]);
    expect(
      pointsBBox([
        { lon: 1, lat: 2 },
        { lon: -3, lat: Number.POSITIVE_INFINITY },
        { lon: -1, lat: 5 },
      ]),
    ).toEqual([-1, 2, 1, 5]);
  });
});

describe("connectionsBBox", () => {
  it("is null without connections", () => expect(connectionsBBox([], [0, 52])).toBeNull());

  it("covers both ends and the bow of each curve", () => {
    const start: [number, number] = [-10, 30];
    const anchor: [number, number] = [0, 52];
    const box = connectionsBBox([start], anchor)!;
    const arc = symbolicArc(start, anchor, 32);
    expect(box[1]).toBeLessThanOrEqual(30);
    expect(box[2]).toBeGreaterThanOrEqual(0);
    expect(box[3]).toBeGreaterThanOrEqual(52);
    // The curve bows to the left of travel (north-west here), beyond the endpoints' box.
    expect(Math.min(...arc.map((p) => p[0]))).toBe(box[0]);
    expect(box[0]).toBeLessThan(-10);
  });

  it("joins several connections", () => {
    const box = connectionsBBox(
      [
        [-75, 5],
        [30, -25],
      ],
      [0, 52],
    )!;
    expect(box[0]).toBeLessThanOrEqual(-75);
    expect(box[1]).toBeLessThanOrEqual(-25);
    expect(box[2]).toBeGreaterThanOrEqual(30);
  });
});

describe("fitBBox (Web Mercator, 256 px tiles)", () => {
  it("fits a box exactly: 45° of longitude in 1,024 px is zoom 5", () => {
    const f = fitBBox([-22.5, -5, 22.5, 5], square, { marginPx: 0, maxZoom: 8 });
    expect(f.zoom).toBe(5);
    expect(f.center[0]).toBe(0);
    expect(f.center[1]).toBeCloseTo(0, 6);
  });

  it("panels reduce the room: half the width is one zoom level less", () => {
    const f = fitBBox(
      [-22.5, -5, 22.5, 5],
      { ...square, padding: { ...NO_PAD, left: 512 } },
      { marginPx: 0, maxZoom: 8 },
    );
    expect(f.zoom).toBe(4);
  });

  it("the tighter of width and height decides", () => {
    // 0–60° N is 0.2096 of the Mercator world height; 1,024 px / (256 × 0.2096) → zoom 4.25.
    const f = fitBBox([-5, 0, 5, 60], square, { marginPx: 0, maxZoom: 8 });
    expect(f.zoom).toBeCloseTo(4.25, 2);
    // Centred on the Mercator midpoint, not the arithmetic mean of the latitudes.
    expect(f.center[1]).toBeCloseTo(35.26, 2);
  });

  it("clamps to the zoom range and to a minimum span", () => {
    expect(fitBBox([-180, -60, 180, 75], square).zoom).toBe(2);
    // A single point is framed at the minimum span, not at maximum zoom.
    const tiny = fitBBox([4.9, 52.3, 4.9, 52.3], square, { marginPx: 0, maxZoom: 12 });
    expect(tiny.zoom).toBeCloseTo(Math.log2(1024 / (256 * (24 / 360))), 2);
    expect(fitBBox([-1, 50, 1, 52], square, { maxZoom: 3 }).zoom).toBe(3);
  });

  it("centres the box in a framing area smaller than the view's padded area", () => {
    // The view centres in its padded area; framing also keeps clear of a 256 px column on the left.
    const viewport = { ...square, framePadding: { ...NO_PAD, left: 256 } };
    const f = fitBBox([-22.5, -5, 22.5, 5], viewport, { marginPx: 0, maxZoom: 8 });
    expect(f.zoom).toBeCloseTo(Math.log2(768 / (256 * 0.125)), 2);
    // The camera centre moves 128 px west, so the box appears 128 px right of the view centre.
    const pxPerDegree = (256 * 2 ** f.zoom) / 360;
    expect((0 - f.center[0]) * pxPerDegree).toBeCloseTo(128, 1);
    expect(f.center[1]).toBeCloseTo(0, 6);
  });

  it("returns the minimum zoom when panels leave no room", () => {
    const f = fitBBox([-10, 30, 10, 55], {
      width: 300,
      height: 300,
      padding: { top: 200, right: 0, bottom: 200, left: 0 },
    });
    expect(f.zoom).toBe(2);
  });
});

describe("UK extent", () => {
  it("is the extent of the United Kingdom in the committed Natural Earth 1:110m outlines", () => {
    const geo = readRepoJson<{
      features: { properties: { iso_a2: string }; geometry: { coordinates: unknown } }[];
    }>("public/data/reference/world-countries-110m.geojson");
    const gb = geo.features.find((f) => f.properties.iso_a2 === "GB")!;
    const xs: number[] = [];
    const ys: number[] = [];
    const walk = (c: unknown): void => {
      if (Array.isArray(c) && typeof c[0] === "number") {
        xs.push(c[0] as number);
        ys.push(c[1] as number);
      } else if (Array.isArray(c)) c.forEach(walk);
    };
    walk(gb.geometry.coordinates);
    expect(UK_EXTENT_110M).toEqual([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]);
  });

  it("unions boxes", () => {
    expect(unionBBox([-10, 30, 0, 52], UK_EXTENT_110M)).toEqual([-10, 30, 1.682, 58.635]);
  });
});
