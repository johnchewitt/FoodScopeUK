import { describe, expect, it } from "vitest";
import { hexToRgb, mixOklab, rgbToHex } from "@/analysis/colour";
import { readRepoFile } from "@/test/files";
import { BRAND, SEQ_MIX_PERCENT, SHARE_CLASS_HEX } from "./palette";

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

  it("the map legend swatches are the same opaque tokens", () => {
    for (let i = 0; i < 6; i++) {
      const rule = new RegExp(`\\.swatch\\[data-class="${i}"\\][^{]*\\{([^}]*)\\}`).exec(css);
      expect(rule, `swatch ${i}`).not.toBeNull();
      expect(rule![1]).toContain(`var(--fs-seq-${i})`);
      expect(rule![1]).not.toMatch(/opacity/);
    }
  });
});
