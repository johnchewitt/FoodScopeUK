/* Generated from schemas/farming-regions.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Outlines of the agricultural statistics regions (S33 ONS ITL1, January 2025; London merged with the South East as in Defra's tables), coverage-simplified, WGS84. Written by `foodscope-pipeline build-risk`.
 */
export interface FarmingRegions {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
    };
    geometry:
      | {
          type: "Polygon";
          /**
           * @minItems 1
           */
          coordinates: [
            [[number, number], [number, number], [number, number], [number, number], ...[number, number][]],
            ...[
              [number, number],
              [number, number],
              [number, number],
              [number, number],
              ...[number, number][]
            ][]
          ];
        }
      | {
          type: "MultiPolygon";
          /**
           * @minItems 1
           */
          coordinates: [
            [
              [[number, number], [number, number], [number, number], [number, number], ...[number, number][]],
              ...[
                [number, number],
                [number, number],
                [number, number],
                [number, number],
                ...[number, number][]
              ][]
            ],
            ...[
              [[number, number], [number, number], [number, number], [number, number], ...[number, number][]],
              ...[
                [number, number],
                [number, number],
                [number, number],
                [number, number],
                ...[number, number][]
              ][]
            ][]
          ];
        };
  }[];
}
