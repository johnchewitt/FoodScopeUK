/* Generated from schemas/country-points.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Natural Earth label point per ISO alpha-2 code (public/data/reference/world-country-points.json, S24).
 */
export interface CountryPoints {
  source: string;
  points: {
    iso_a2: string;
    name: string;
    name_long: string;
    lon: number;
    lat: number;
    in110m: boolean;
  }[];
}
