/* Generated from schemas/scenario-closure.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Inputs of the Scenario Lab's supermarket-closure scenario (Stage 7) for one part of the UK: Great Britain (gb) or Northern Ireland (ni). Columnar: every array under stores has one entry per supermarket, every array under areas one entry per small area, in the same order (the app checks the lengths). Supermarkets are GEOLYTIX stores of class supermarket (280 m² and over, D5) in a UK council. Small areas are LSOAs 2021 (England and Wales), Data Zones 2022 (Scotland) and Data Zones 2021 (Northern Ireland), each represented by its population-weighted centroid. nearest holds each area's k nearest supermarkets (indices into stores, nearest first, ties by index) and distance their straight-line distances in metres in the national grid (grid); not travel times. Written by `foodscope-pipeline build-scenario`.
 */
export interface ScenarioClosure {
  schemaVersion: 1;
  part: "gb" | "ni";
  /**
   * Coordinate system of x, y and the distances: British National Grid (gb) or Irish Transverse Mercator (ni).
   */
  grid: "EPSG:27700" | "EPSG:2157";
  k: number;
  /**
   * Census year of the population figures, by nation letter of the area code (E, W, S, N).
   */
  census: {
    /**
     * This interface was referenced by `undefined`'s JSON-Schema definition
     * via the `patternProperty` "^[EWSN]$".
     */
    [k: string]: 2021 | 2022;
  };
  /**
   * Council codes (May 2025) used by stores.council and areas.council.
   *
   * @minItems 1
   */
  councils: [string, ...string[]];
  stores: {
    id: number[];
    name: string[];
    retailer: string[];
    format: string[];
    sizeBand: string[];
    council: number[];
    lon: number[];
    lat: number[];
    x: number[];
    y: number[];
  };
  areas: {
    code: string[];
    name: string[];
    council: number[];
    lon: number[];
    lat: number[];
    x: number[];
    y: number[];
    /**
     * Census usual residents (Census 2021, or 2022 in Scotland: total population) as published.
     */
    population: number[];
    /**
     * IoD 2025 Index of Multiple Deprivation decile within England (1 = most deprived 10 %); null outside England.
     */
    decile: (number | null)[];
    nearest: number[][];
    distance: number[][];
  };
}
