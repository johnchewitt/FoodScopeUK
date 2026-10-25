/* Generated from schemas/small-areas.schema.json by scripts/gen-types.mjs — do not edit by hand. */

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

/**
 * Small areas of the deep profiles (LP-06), WGS84 (EPSG:4326): Manchester's LSOAs (2021, ONS BGC V5, S15), Belfast's Data Zones (2021, NISRA, S16) and Belfast's Super Output Areas (2011, NISRA, S19; the geography of NIMDM 2017). Coverage-simplified per kind. Written by `foodscope-pipeline build-areas`.
 */
export interface SmallAreaBoundaries {
  type: "FeatureCollection";
  features: SmallAreaFeature[];
}
export interface SmallAreaFeature {
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
     * LSOA21CD, DZ2021_cd or SOA 2011 code
     */
    code: string;
    kind: "lsoa21" | "dz21" | "soa2011";
    /**
     * May 2025 council code
     */
    lad: string;
  };
}
