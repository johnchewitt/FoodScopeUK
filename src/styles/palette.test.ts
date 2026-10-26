import { describe, expect, it } from "vitest";
import { hexToRgb, mixOklab, rgbToHex, rgbToOklab } from "@/analysis/colour";
import { readRepoFile } from "@/test/files";
import {
  BRAND,
  CATEGORICAL,
  LIGHT_SEQ,
  MAP_COLOURS,
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

/** The declarations inside the first block that starts with `selector {`. */
function block(selector: string): Map<string, string> {
  const start = tokens.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  const body = tokens.slice(start, tokens.indexOf("}", start));
  return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));
}

/** A token value as hex: literal hex, or var(--fs-…) resolved through the :root brand tokens. */
function resolve(value: string, root: Map<string, string>): string {
  const v = /^var\((--[\w-]+)\)$/.exec(value);
  return v ? resolve(root.get(v[1]!) ?? "missing", root) : value.toLowerCase();
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

  it("imagery uses the dark grey symbols (it is offered only at local scale)", () => {
    for (const key of Object.values(MAP_TOKENS)) expect(MAP_COLOURS.imagery[key]).toBe(MAP_COLOURS.dark[key]);
    expect(tokens).not.toContain('[data-map-style="imagery"]');
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
