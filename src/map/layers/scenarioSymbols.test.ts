import { describe, expect, it } from "vitest";
import type { RiskMapModel, ScenarioClosureMapModel } from "@/state/store";
import { MAP_COLOURS } from "@/styles/palette";
import { closureGraphicsData } from "./closureSymbols";
import { ghostBodySymbolData, ghostEdgesSymbolData, ghostExtent, GHOST_DASH } from "./ghostSymbols";
import { portGraphicsData } from "./portSymbols";

/** Obviously synthetic closure map: areas "a" and "b", stores 1 (closed), 2 and 3. */
const closure = (view: "baseline" | "scenario"): ScenarioClosureMapModel => ({
  key: "closure:1",
  view,
  closed: { id: 1, point: [0, 0] },
  areas: [
    { code: "a", point: [0.01, 0], radius: 4, cls: 0, from: [0, 0], to: [0.02, 0] },
    { code: "b", point: [0, 0.01], radius: 10, cls: null, from: [0, 0], to: null },
  ],
  takeover: [{ id: 2, point: [0.02, 0] }],
  frame: null,
});

describe("closure map symbols (Scenario B)", () => {
  it("links areas to the closed store in the baseline, to the new nearest in the scenario", () => {
    const base = closureGraphicsData(closure("baseline"), "dark");
    expect(base.links.map((l) => l.path[1])).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(base.stores).toEqual([]);
    const scen = closureGraphicsData(closure("scenario"), "dark");
    // An area with no supermarket left in the data has no link, and the no-data colour.
    expect(scen.links.map((l) => [l.code, l.path[1]])).toEqual([["a", [0.02, 0]]]);
    expect(scen.stores.map((s) => s.kind)).toEqual(["takeover", "closed"]);
  });

  it("draws larger areas first and colours by class only in the scenario", () => {
    const c = MAP_COLOURS.dark;
    const scen = closureGraphicsData(closure("scenario"), "dark");
    expect(scen.areas.map((a) => a.code)).toEqual(["b", "a"]);
    expect(scen.areas[1]!.size).toBeCloseTo(6);
    const hex = (rgb: number[]) =>
      `#${rgb
        .slice(0, 3)
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")}`;
    expect(hex(scen.areas[1]!.fill)).toBe(c.risk[0]!.toLowerCase());
    expect(hex(scen.areas[0]!.fill)).toBe(c.noData.toLowerCase());
    const base = closureGraphicsData(closure("baseline"), "light");
    expect(new Set(base.areas.map((a) => hex(a.fill)))).toEqual(
      new Set([MAP_COLOURS.light.seq[3]!.toLowerCase()]),
    );
  });
});

describe("port symbols with a scenario (Scenario D)", () => {
  const model: RiskMapModel = {
    ports: [
      {
        locode: "GBAAA",
        name: "A",
        point: [0, 0],
        radius: 10,
        valueText: "",
        foodEntry: false,
        scenarioRadius: 5,
      },
      { locode: "GBBBB", name: "B", point: [1, 1], radius: 6, valueText: "", foodEntry: false },
    ],
    selectedPort: "GBAAA",
    portKey: "k",
    portsCopyright: "",
    roads: null,
    roadsNi: null,
    rail: null,
    regions: null,
    frame: null,
  };

  it("draws the baseline as a dashed ring and the scenario filled inside it", () => {
    const g = portGraphicsData(model, "dark");
    const a = g.filter((x) => x.locode === "GBAAA");
    expect(a).toHaveLength(2);
    expect(a[0]!.outline.style).toBe("dash");
    expect(a[0]!.fill[3]).toBe(0);
    expect(a[1]!.size).toBeLessThan(a[0]!.size);
    expect(g.filter((x) => x.locode === "GBBBB")).toHaveLength(1);
  });
});

describe("baseline ghost of the disrupted partner (Scenario A, review)", () => {
  type Layer = { width: number; color: number[]; effects?: { type: string; offset?: number }[] };
  const layers = (d: { symbol: { symbolLayers: unknown[] } }) => d.symbol.symbolLayers as Layer[];

  it("is as wide as the baseline line with its casing, in the flow line's units", () => {
    // A flow line of width w draws a core w and a casing w + 2 (flowLineSymbolData).
    expect(ghostExtent(12)).toBe(14);
    expect(ghostExtent(-1)).toBe(2);
    expect(layers(ghostBodySymbolData(12, "dark"))[0]!.width).toBe(14);
  });

  it("draws dashed edges at ± half the baseline extent, in the selection colour", () => {
    const edges = layers(ghostEdgesSymbolData(12, "light"));
    expect(edges.map((l) => l.effects![0]!.offset)).toEqual([7, -7]);
    expect(edges.every((l) => l.effects![1]!.type === "CIMGeometricEffectDashes")).toBe(true);
    expect(GHOST_DASH).toEqual([4, 3]);
    const sel = MAP_COLOURS.light.selection;
    const rgb = [1, 3, 5].map((i) => parseInt(sel.slice(i, i + 2), 16));
    expect(edges[0]!.color.slice(0, 3)).toEqual(rgb);
    // The body is faint (it sits under the scenario line); the edges are near-opaque.
    expect(layers(ghostBodySymbolData(12, "light"))[0]!.color[3]).toBeLessThan(64);
    expect(edges[0]!.color[3]).toBeGreaterThan(200);
  });
});
