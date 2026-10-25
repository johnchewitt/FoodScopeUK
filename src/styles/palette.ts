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

// ---------------------------------------------------------------------------------------------
// Per-basemap colour sets (SH-08, ADR-0022)

/** Basemap styles the app offers; each has its own colour set for the data drawn on it. */
export const MAP_STYLES = ["dark", "light", "imagery"] as const;
export type MapStyle = (typeof MAP_STYLES)[number];

export interface MapColours {
  /** Six fixed classes, light → dark reading order of the measure (map fills and legend swatches). */
  seq: readonly string[];
  /** Lines between adjacent fills (partners at world scale, councils at national scale). */
  separator: string;
  separatorAlpha: number;
  /** Hatch for areas with no data (P12). */
  noData: string;
  /** Selection: the selected partner, council or store. */
  selection: string;
  /** Pointer highlight (`fs-hover`). */
  hover: string;
  /** Symbolic trade connections: core stroke, casing, and the moving markers. */
  connection: string;
  connectionCasing: string;
  /** Country outlines over the basemap and the UK outline. */
  countryLine: string;
  countryLineAlpha: number;
  ukLine: string;
  /** Council outlines at local scale (fills are drawn only at national and regional scale). */
  councilLine: string;
  councilLineAlpha: number;
  /** Store symbols (SM-04): class by colour and shape; outline separates overlapping symbols. */
  storeSupermarket: string;
  storeConvenience: string;
  storeOther: string;
  storeOutline: string;
  /**
   * NI grocers from the FSA register that GEOLYTIX misses (S29): a hollow diamond, so shape and
   * fill both say "supplementary" next to the filled GEOLYTIX symbols.
   */
  registerGrocer: string;
  /** Store clusters: fill, ring and count text. */
  clusterFill: string;
  clusterRing: string;
  clusterText: string;
  /** Straight-line proximity: radius ring and measuring lines; the chosen point. */
  proximity: string;
  proximityPoint: string;
  proximityPointOutline: string;
}

/**
 * Light grey basemap sequential ramp: one teal hue (OKLCH h ≈ 205°), lightness 0.64 → 0.29.
 * Dataviz validator, ordinal, against #d6d6d6 and #f0f0f0 (bracketing the light grey land):
 * monotone lightness, adjacent ΔL ≥ 0.06, single hue (spread 10°), lightest class 2.22:1 / 2.84:1.
 * Rechecked against the land measured from the live style (24 Oct 2026): #f4f4f4 below zoom 7
 * (2.94:1), #efefef from zoom 7 (2.81:1), water #cfd3d4 (2.14:1).
 */
export const LIGHT_SEQ = ["#3b9ca7", "#1e8691", "#00717c", "#005d68", "#004954", "#003641"] as const;

const DARK: MapColours = {
  seq: SHARE_CLASS_HEX,
  separator: BRAND.navy,
  separatorAlpha: 0.9,
  noData: BRAND.muted,
  selection: BRAND.green,
  hover: BRAND.cyan,
  connection: BRAND.cyan,
  connectionCasing: BRAND.navy,
  countryLine: BRAND.cyan,
  countryLineAlpha: 0.22,
  ukLine: BRAND.green,
  councilLine: BRAND.cyan,
  councilLineAlpha: 0.6,
  // Validated against #3d3d3d (dark grey land): CVD worst ΔE 25.5, all ≥ 3:1.
  storeSupermarket: BRAND.text,
  storeConvenience: "#eb6834",
  storeOther: "#9085e9",
  storeOutline: BRAND.navy,
  registerGrocer: BRAND.text,
  clusterFill: BRAND.navy,
  clusterRing: BRAND.text,
  clusterText: BRAND.text,
  // Pink, not cyan: cyan matched the council outlines and was too close to the green selection
  // (normal-vision ΔE 11.8). Against every overlay colour, the store symbols and the ramp ends:
  // normal ΔE ≥ 16.8, CVD ≥ 8.9, 4.55:1 on #3d3d3d (live check, 24 Oct 2026).
  proximity: "#f184c0",
  proximityPoint: BRAND.text,
  proximityPointOutline: BRAND.navy,
};

/**
 * Colour set per basemap style. Light grey: dark symbols with white outlines (validated against
 * #d6d6d6 and #f0f0f0: CVD worst ΔE 25.0, all ≥ 3:1). Imagery is offered only at local scale,
 * where councils are outlines and stores are individual symbols: the dark set with white council
 * outlines.
 */
export const MAP_COLOURS: Record<MapStyle, MapColours> = {
  dark: DARK,
  light: {
    seq: LIGHT_SEQ,
    separator: "#ffffff",
    separatorAlpha: 0.85,
    noData: "#5f7175",
    selection: "#46821f",
    hover: BRAND.navy,
    connection: BRAND.navy,
    connectionCasing: "#ffffff",
    countryLine: BRAND.navy,
    countryLineAlpha: 0.25,
    ukLine: "#46821f",
    councilLine: BRAND.navy,
    councilLineAlpha: 0.55,
    storeSupermarket: BRAND.navy,
    storeConvenience: "#a3410b",
    storeOther: "#5a3fc0",
    storeOutline: "#ffffff",
    registerGrocer: BRAND.navy,
    clusterFill: BRAND.navy,
    clusterRing: "#ffffff",
    clusterText: "#ffffff",
    // Magenta (was ramp teal #00717c: ΔE 14.8 from the green selection, and the same as class 2).
    // Normal ΔE ≥ 17.5, CVD ≥ 9.2 against overlays, symbols and ramp ends; 6.75:1 on #efefef.
    proximity: "#9c0a73",
    proximityPoint: BRAND.navy,
    proximityPointOutline: "#ffffff",
  },
  imagery: {
    ...DARK,
    countryLine: "#ffffff",
    countryLineAlpha: 0.35,
    councilLine: "#ffffff",
    councilLineAlpha: 0.85,
  },
};

/**
 * CSS custom properties that mirror MAP_COLOURS for legends and map overlays (tokens.css sets
 * them on `[data-map-style]`); palette.test.ts keeps both in sync.
 */
export const MAP_TOKENS: Record<string, keyof MapColours> = {
  "--fs-map-selection": "selection",
  "--fs-map-connection": "connection",
  "--fs-map-no-data": "noData",
  "--fs-map-store-supermarket": "storeSupermarket",
  "--fs-map-store-convenience": "storeConvenience",
  "--fs-map-store-other": "storeOther",
  "--fs-map-store-outline": "storeOutline",
  "--fs-map-register-grocer": "registerGrocer",
  "--fs-map-cluster-fill": "clusterFill",
  "--fs-map-cluster-ring": "clusterRing",
  "--fs-map-proximity": "proximity",
};

/**
 * Categorical chart colours on the dark panels (Local Authority Profiles retailer charts): the
 * dataviz reference palette's eight dark-surface slots, validated on the panel surface #073435
 * (25 Oct 2026): lightness band, chroma floor, adjacent CVD ΔE ≥ 8.4, normal-vision ΔE ≥ 19.3;
 * green is 2.74:1 against the panel, so these charts always have direct labels and a table.
 * "Other" is the muted text colour. tokens.css mirrors them as --fs-cat-*.
 */
export const CATEGORICAL = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
] as const;
export const CATEGORICAL_OTHER = BRAND.muted;
