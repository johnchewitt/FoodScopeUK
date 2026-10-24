/* Generated from schemas/lad-boundaries.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * @minItems 1
 */
export type PolygonCoordinates = [Ring, ...Ring[]];
/**
 * @minItems 4
 */
export type Ring = [Position, Position, Position, Position, ...Position[]];
/**
 * @minItems 2
 * @maxItems 2
 */
export type Position = [number, number];
export type Nation = "England" | "Wales" | "Scotland" | "Northern Ireland";

/**
 * May 2025 council boundaries for display (S14, BGC edition clipped to the coastline), simplified as a coverage and published in WGS84 (EPSG:4326). Written by `foodscope-pipeline build-local`.
 */
export interface CouncilBoundaries {
  type: "FeatureCollection";
  features: CouncilFeature[];
}
export interface CouncilFeature {
  type: "Feature";
  geometry:
    | {
        type: "Polygon";
        coordinates: PolygonCoordinates;
      }
    | {
        type: "MultiPolygon";
        /**
         * @minItems 1
         */
        coordinates: [PolygonCoordinates, ...PolygonCoordinates[]];
      };
  properties: {
    /**
     * LAD25CD
     */
    code: string;
    /**
     * LAD25NM
     */
    name: string;
    /**
     * LAD25NMW (Welsh councils only)
     */
    nameWelsh: string | null;
    nation: Nation;
  };
}
