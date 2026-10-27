import { describe, expect, it } from "vitest";
import { hexToRgb, mixOklab, rgbToHex, rgbToOklab } from "@/analysis/colour";
import { readRepoFile } from "@/test/files";
import {
  BRAND,
  CATEGORICAL,
  DETAILED_STYLES,
  haloBoost,
  LIGHT_SEQ,
  MAP_COLOURS,
  MAP_STYLE_TONE,
  MAP_STYLES,
  type MapColours,
  type MapStyle,
  RISK_DARK,
  RISK_LIGHT,
  MAP_TOKENS,
  SEQ_MIX_PERCENT,
  SHARE_CLASS_HEX,
} from "./palette";

const tokens = readRepoFile("src/styles/tokens.css");
const css = readRepoFile("src/styles/app.css");

describe("colour maths", () => {
  it("round-trips hex", () => {
    expect(rgbToHex(hexToRgb("#49ead8"))).toBe("#49ead8");
    expect(() => hexToRgb("teal")).toThrow();
  });

  it("matches CSS color-mix(in oklab) at the ends and in between", () => {
    expect(mixOklab("#49ead8", 100, "#0a444a")).toBe("#49ead8");
    expect(mixOklab("#49ead8", 0, "#0a444a")).toBe("#0a444a");
    // Reference values computed independently (stage 3 heatmap check, dataviz validator run).
    expect(mixOklab("#49ead8", 34, "#0a444a")).toBe("#1e7877");
    expect(mixOklab("#49ead8", 60, "#0a444a")).toBe("#2ea39c");
  });
});

describe("palette.ts mirrors tokens.css (map, legend and heatmap share one ramp)", () => {
  it("brand colours", () => {
    for (const [name, hex] of Object.entries(BRAND)) {
      const token = name === "muted" ? "--fs-text-muted" : `--fs-${name}`;
      expect(tokens, token).toMatch(new RegExp(`${token}:\\s*${hex};`, "i"));
    }
  });

  it("share classes use the --fs-seq-* mixes", () => {
    SEQ_MIX_PERCENT.forEach((p, i) => {
      const expected =
        p === 100
          ? `--fs-seq-${i}: var(--fs-cyan);`
          : `--fs-seq-${i}: color-mix(in oklab, var(--fs-cyan) ${p}%, var(--fs-teal));`;
      expect(tokens).toContain(expected);
    });
    expect(SHARE_CLASS_HEX).toEqual(["#1e7877", "#268e8a", "#2ea39c", "#37baaf", "#3fd1c3", "#49ead8"]);
  });

  it("the map legend swatches are the opaque map tokens of the active basemap", () => {
    for (let i = 0; i < 6; i++) {
      const rule = new RegExp(`\\.swatch\\[data-class="${i}"\\][^{]*\\{([^}]*)\\}`).exec(css);
      expect(rule, `swatch ${i}`).not.toBeNull();
      expect(rule![1]).toContain(`var(--fs-map-seq-${i})`);
      expect(rule![1]).not.toMatch(/opacity/);
    }
  });
});

/** Every top-level rule of tokens.css: its selectors and declarations (comments stripped). */
const RULES = [...tokens.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selectors: m[1]!.split(",").map((s) => s.trim()),
  decls: new Map([...m[2]!.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((d) => [d[1]!, d[2]!.trim()])),
}));

/** The declarations of the rules that list `selector`, later rules winning (as in the cascade). */
function block(selector: string): Map<string, string> {
  const rules = RULES.filter((r) => r.selectors.includes(selector));
  expect(rules.length, selector).toBeGreaterThan(0);
  return new Map(rules.flatMap((r) => [...r.decls]));
}

/** The tokens in force for a map style: :root, then the rules for `[data-map-style="<style>"]`. */
function effective(style: MapStyle): Map<string, string> {
  const own = RULES.filter((r) => r.selectors.includes(`[data-map-style="${style}"]`));
  return new Map([...block(":root"), ...own.flatMap((r) => [...r.decls])]);
}

/** A token value as hex: literal hex, or var(--fs-…) resolved through the :root brand tokens. */
function resolve(value: string, root: Map<string, string>): string {
  const v = /^var\((--[\w-]+)\)$/.exec(value);
  if (v) return resolve(root.get(v[1]!) ?? "missing", root);
  // The panel ramp is defined as color-mix(in oklab, var(--a) p%, var(--b)) (SEQ_MIX_PERCENT).
  const mix = /^color-mix\(in oklab, (var\(--[\w-]+\)) (\d+)%, (var\(--[\w-]+\))\)$/.exec(value);
  if (mix) return mixOklab(resolve(mix[1]!, root), Number(mix[2]), resolve(mix[3]!, root));
  return value.toLowerCase();
}

describe("per-basemap colour sets (SH-08, ADR-0022)", () => {
  const root = block(":root");
  const light = block('[data-map-style="light"]');

  it("dark grey: map classes are the panel ramp, map tokens match palette.ts", () => {
    for (let i = 0; i < 6; i++) expect(root.get(`--fs-map-seq-${i}`)).toBe(`var(--fs-seq-${i})`);
    expect(MAP_COLOURS.dark.seq).toEqual(SHARE_CLASS_HEX);
    for (const [token, key] of Object.entries(MAP_TOKENS))
      expect(resolve(root.get(token) ?? "missing", root), token).toBe(MAP_COLOURS.dark[key]);
  });

  it("light grey: its own ramp and symbols, every map token overridden", () => {
    LIGHT_SEQ.forEach((hex, i) => expect(light.get(`--fs-map-seq-${i}`)).toBe(hex));
    expect(MAP_COLOURS.light.seq).toEqual(LIGHT_SEQ);
    for (const [token, key] of Object.entries(MAP_TOKENS))
      expect(resolve(light.get(token) ?? "missing", root), token).toBe(MAP_COLOURS.light[key]);
  });

  it("imagery and Human Geography dark use the dark grey symbols and tokens", () => {
    for (const style of ["imagery", "human-dark"] as const) {
      for (const key of Object.values(MAP_TOKENS))
        expect(MAP_COLOURS[style][key]).toBe(MAP_COLOURS.dark[key]);
      expect(tokens).not.toContain(`[data-map-style="${style}"]`);
    }
  });

  it("every style's tokens are its colour set: map symbols, both ramps (legends match the map)", () => {
    const root = block(":root");
    for (const style of MAP_STYLES) {
      const e = effective(style);
      for (const [token, key] of Object.entries(MAP_TOKENS))
        expect(resolve(e.get(token) ?? "missing", root), `${style} ${token}`).toBe(MAP_COLOURS[style][key]);
      for (let i = 0; i < 6; i++) {
        expect(resolve(e.get(`--fs-map-seq-${i}`) ?? "missing", root), `${style} seq ${i}`).toBe(
          MAP_COLOURS[style].seq[i],
        );
        expect(resolve(e.get(`--fs-map-risk-${i}`) ?? "missing", root), `${style} risk ${i}`).toBe(
          MAP_COLOURS[style].risk[i],
        );
      }
    }
  });

  it("light maps share light grey's colours; the detailed ones darken only four lines", () => {
    for (const style of MAP_STYLES.filter((s) => MAP_STYLE_TONE[s] === "light"))
      expect(MAP_COLOURS[style].seq, style).toEqual(LIGHT_SEQ);
    expect(MAP_COLOURS.human).toEqual(MAP_COLOURS.light);
    for (const style of DETAILED_STYLES) {
      const changed = (Object.keys(MAP_COLOURS.light) as (keyof MapColours)[]).filter(
        (k) => MAP_COLOURS[style][k] !== MAP_COLOURS.light[k],
      );
      expect(changed.sort(), style).toEqual(["proximity", "rail", "roadPrimary", "selection", "ukLine"]);
    }
  });

  it("halos widen only over busy maps", () => {
    expect(MAP_STYLES.filter((s) => haloBoost(s) > 0)).toEqual([
      "imagery",
      "terrain",
      "topographic",
      "natgeo",
      "osm",
    ]);
  });

  it("the light ramp reads light to dark (OKLab lightness strictly decreasing)", () => {
    const lightness = LIGHT_SEQ.map((hex) => rgbToOklab(hexToRgb(hex))[0]);
    for (let i = 1; i < lightness.length; i++) expect(lightness[i]! - lightness[i - 1]!).toBeLessThan(-0.06);
  });
});

describe("risk ramp (Stage 6)", () => {
  const root = block(":root");
  const light = block('[data-map-style="light"]');

  it("tokens.css mirrors the dark and light risk ramps; the panel uses the dark one", () => {
    RISK_DARK.forEach((hex, i) => {
      expect(root.get(`--fs-risk-${i}`)).toBe(hex);
      expect(root.get(`--fs-map-risk-${i}`)).toBe(`var(--fs-risk-${i})`);
    });
    RISK_LIGHT.forEach((hex, i) => expect(light.get(`--fs-map-risk-${i}`)).toBe(hex));
    expect(MAP_COLOURS.dark.risk).toEqual(RISK_DARK);
    expect(MAP_COLOURS.light.risk).toEqual(RISK_LIGHT);
    expect(MAP_COLOURS.imagery.risk).toEqual(RISK_DARK);
  });

  it("reads in the same order as the share ramp: lighter = more on dark, darker = more on light", () => {
    const L = (hex: string) => rgbToOklab(hexToRgb(hex))[0];
    for (let i = 1; i < 6; i++) {
      expect(L(RISK_DARK[i]!) - L(RISK_DARK[i - 1]!)).toBeGreaterThan(0.06);
      expect(L(RISK_LIGHT[i]!) - L(RISK_LIGHT[i - 1]!)).toBeLessThan(-0.06);
    }
  });

  it("legend swatches for risk classes use the map tokens, opaque", () => {
    for (let i = 0; i < 6; i++) {
      const rule = new RegExp(`\\.swatch\\[data-risk="${i}"\\][^{]*\\{([^}]*)\\}`).exec(css);
      expect(rule, `risk swatch ${i}`).not.toBeNull();
      expect(rule![1]).toContain(`var(--fs-map-risk-${i})`);
      expect(rule![1]).not.toMatch(/opacity/);
    }
  });
});

describe("categorical chart colours (Stage 5)", () => {
  it("tokens.css mirrors CATEGORICAL", () => {
    CATEGORICAL.forEach((hex, i) => expect(tokens).toContain(`--fs-cat-${i + 1}: ${hex};`));
    expect(tokens).toContain("--fs-cat-other: var(--fs-text-muted);");
  });
});
