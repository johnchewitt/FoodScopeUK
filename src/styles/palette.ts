/**
 * TypeScript mirror of the colour tokens in tokens.css, for consumers that need concrete colours
 * (ArcGIS symbols). palette.test.ts checks that these values and the class mix percentages match
 * tokens.css, so the map, its legend and the Seasonal heatmap always show the same colours.
 */
import { mixOklab } from "@/analysis/colour";

export const BRAND = {
  navy: "#071923",
  emerald: "#063d3b",
  teal: "#0a444a",
  cyan: "#49ead8",
  green: "#a1eb83",
  amber: "#e8b76b",
  text: "#edf7f5",
  muted: "#8eadae",
} as const;

/**
 * Share classes 0–5 (spec §7.4 fixed breaks): `--fs-seq-<n>` = color-mix(in oklab, cyan p%, teal).
 * Validated with the dataviz ordinal check (monotone lightness, single hue) against the Esri
 * dark grey land (#3d3d3d, lowest class 2.07:1) and the offline outline map (#093138, 2.66:1).
 */
export const SEQ_MIX_PERCENT = [34, 47, 60, 73, 86, 100] as const;

export const SHARE_CLASS_HEX: readonly string[] = SEQ_MIX_PERCENT.map((p) =>
  mixOklab(BRAND.cyan, p, BRAND.teal),
);
