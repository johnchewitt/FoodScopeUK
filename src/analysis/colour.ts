/**
 * Colour maths for map symbols that must match CSS design tokens exactly (pure; no DOM).
 *
 * ArcGIS symbols and ECharts need concrete colours, while the legend and heatmap use CSS
 * `color-mix(in oklab, …)` tokens. `mixOklab` reproduces CSS Color 4 `color-mix(in oklab, A p%, B)`
 * for opaque sRGB colours, so the map, the legend swatches and the heatmap cells show the same
 * colour for the same class (spec §7.4).
 */

export type Rgb = [number, number, number];

const HEX = /^#([0-9a-f]{6})$/i;

export function hexToRgb(hex: string): Rgb {
  const m = HEX.exec(hex.trim());
  if (!m) throw new Error(`invalid hex colour: ${hex}`);
  const n = Number.parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const toLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (c: number) => {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, v)) * 255);
};

/** sRGB → OKLab (Björn Ottosson's reference matrices). */
export function rgbToOklab(rgb: Rgb): [number, number, number] {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToRgb([L, a, bb]: [number, number, number]): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3;
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** CSS `color-mix(in oklab, a pct%, b)` for opaque colours, as hex. */
export function mixOklab(a: string, pct: number, b: string): string {
  const t = Math.min(100, Math.max(0, pct)) / 100;
  const A = rgbToOklab(hexToRgb(a));
  const B = rgbToOklab(hexToRgb(b));
  return rgbToHex(oklabToRgb([0, 1, 2].map((i) => A[i]! * t + B[i]! * (1 - t)) as [number, number, number]));
}
