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

/**
 * Basemap styles the app offers (SH-08, ADR-0022 and its 27 Oct 2026 amendment); each has its own
 * colour set for the data drawn on it. The ids are also the URL values (`bm`).
 */
export const MAP_STYLES = [
  "dark",
  "light",
  "human",
  "human-dark",
  "imagery",
  "terrain",
  "topographic",
  "natgeo",
  "osm",
] as const;
export type MapStyle = (typeof MAP_STYLES)[number];

/**
 * Detailed reference styles: offered only where the map draws lines and points (roads, ports,
 * stores, outlines), never under shaded areas, which they would compete with (John, 27 Oct 2026).
 */
export const DETAILED_STYLES: readonly MapStyle[] = ["terrain", "topographic", "natgeo", "osm"];

/** Whether a style is a dark or a light map (attribution text, the UK tint, the legend ground). */
export const MAP_STYLE_TONE: Record<MapStyle, "dark" | "light"> = {
  dark: "dark",
  light: "light",
  human: "light",
  "human-dark": "dark",
  imagery: "dark",
  terrain: "light",
  topographic: "light",
  natgeo: "light",
  osm: "light",
};

/**
 * Extra outline width on symbols over busy backgrounds (imagery and the detailed styles), so the
 * white or navy halo separates each symbol from the map beneath it.
 */
export function haloBoost(style: MapStyle): number {
  return style === "imagery" || DETAILED_STYLES.includes(style) ? 0.6 : 0;
}

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
  /**
   * Risk Explorer (Stage 6): six fixed classes of a vulnerability measure (water stress, priority
   * places, concentration), warm hue, in the same reading order as `seq` (more = more salient).
   * Kept apart from the teal `seq`, which shows volumes and shares, so "warm = vulnerability" holds
   * across the module.
   */
  risk: readonly string[];
  /** Road corridors (OS Open Roads): strategic (motorway and trunk) wider than primary; width is the second encoding. */
  roadStrategic: string;
  roadPrimary: string;
  /** Port symbols (proportional circles) and their ring. */
  portFill: string;
  portOutline: string;
  /** Railway lines (dashed). Validated pairwise against roads, port rings, the farm ramp and the selection. */
  rail: string;
}

/**
 * Risk ramp on dark grey and on the dark panels: one warm hue (OKLCH h 48–76°), lightness
 * 0.54 → 0.90. Dataviz validator, ordinal (25 Oct 2026): monotone, adjacent ΔL ≥ 0.06, hue spread
 * 31°; lowest class 2.06:1 on the dark grey land (#3d3d3d), 2.64:1 on the offline map (#093138),
 * 2.57:1 on the panel (#073435).
 */
export const RISK_DARK = ["#9d5b38", "#bb6d3b", "#d68241", "#ed9a4e", "#fbb76e", "#ffd696"] as const;

/**
 * Risk ramp on light grey: the same hue family, light → dark (lightness 0.665 → 0.33). Validator,
 * ordinal: monotone, adjacent ΔL ≥ 0.06, hue spread 26°; lightest class 2.18:1 on #d6d6d6, 2.76:1 on
 * #efefef, 2.88:1 on #f4f4f4, 2.10:1 on the water (#cfd3d4).
 */
export const RISK_LIGHT = ["#d17c28", "#bf6319", "#a94e17", "#8e3d1a", "#72301b", "#572317"] as const;

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
  risk: RISK_DARK,
  // Light, low-chroma lines under the symbols: the near-white text colour and the muted grey-teal.
  roadStrategic: BRAND.text,
  roadPrimary: BRAND.muted,
  portFill: BRAND.text,
  portOutline: BRAND.navy,
  // Violet (as storeOther; stores are never drawn in the logistics view): normal ΔE ≥ 15.8 and
  // CVD ≥ 11.8 against roads, port rings, selection and the teal ramp on #3d3d3d; ≥ 3:1.
  rail: "#9085e9",
};

/**
 * Light grey: dark symbols with white outlines (validated against #d6d6d6 and #f0f0f0: CVD worst
 * ΔE 25.0, all ≥ 3:1).
 */
const LIGHT: MapColours = {
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
  risk: RISK_LIGHT,
  roadStrategic: BRAND.navy,
  roadPrimary: "#5f7175",
  portFill: BRAND.navy,
  portOutline: "#ffffff",
  // Normal ΔE ≥ 19.5, CVD ≥ 17.9 against roads, port and ramp colours on #d6d6d6; ≥ 3:1.
  rail: "#5a3fc0",
};

/**
 * The detailed styles (Terrain, Topographic, National Geographic, OpenStreetMap; lines and points
 * only). Their land is light but busy: greens, tans, yellow towns and blue water. Symbols keep the
 * light set's colours inside a wider white halo (`haloBoost`), which is what separates them from
 * any background. Lines have no halo, so the four coloured lines the light set draws in mid tones
 * are darker here. Checked on 27 Oct 2026 against the styles' published land, water, park, urban
 * and relief colours (docs/03-DATA-SOURCES.md, S25):
 * - navy (councils, strategic roads, ports, UK outline) ≥ 6.0:1 on all of them, and 4.1:1 on
 *   National Geographic's darkest land tint (#72802d, z9);
 * - selection indigo ≥ 5.2:1 (4.5:1 on National Geographic's bright green parks, #28ad1c),
 *   proximity brown ≥ 5.1:1 (4.4:1), primary roads teal ≥ 3.5:1 (3.0:1) and rail blue ≥ 3.1:1
 *   (2.6:1; rail is also dashed);
 * - within each view, normal-vision ΔE ≥ 13.1 and CVD ΔE ≥ 9.8 between the colours drawn
 *   together (access: stores, selection, proximity; logistics: roads, rail, selection, the warm
 *   entry ring; closure: circles, selection).
 */
const DETAILED: MapColours = {
  ...LIGHT,
  selection: "#1a237e",
  ukLine: BRAND.navy,
  proximity: "#4a2a00",
  roadPrimary: "#00525e",
  rail: "#3949ab",
};

/**
 * Colour set per basemap style.
 * - Human Geography (light) is the light set: its land is #f7f7f7 and its sea white, a little
 *   lighter than light grey's (lowest share class 3.0:1 and lowest risk class 3.0:1 on the land,
 *   3.2:1 on the sea).
 * - Human Geography (dark) is the dark set: land #222426, sea #26282a, darker than dark grey's
 *   (lowest share and risk classes 3.0:1 on the land, 2.8:1 on the sea; symbols and lines ≥ 4.9:1).
 * - Imagery is offered at every scale (27 Oct 2026): the dark set with white council and country
 *   outlines. Fills are opaque, so the photograph shows only around and between them.
 */
export const MAP_COLOURS: Record<MapStyle, MapColours> = {
  dark: DARK,
  light: LIGHT,
  human: LIGHT,
  "human-dark": DARK,
  imagery: {
    ...DARK,
    countryLine: "#ffffff",
    countryLineAlpha: 0.35,
    councilLine: "#ffffff",
    councilLineAlpha: 0.85,
  },
  terrain: DETAILED,
  topographic: DETAILED,
  natgeo: DETAILED,
  osm: DETAILED,
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
  "--fs-map-road-strategic": "roadStrategic",
  "--fs-map-road-primary": "roadPrimary",
  "--fs-map-port-fill": "portFill",
  "--fs-map-port-outline": "portOutline",
  "--fs-map-rail": "rail",
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
