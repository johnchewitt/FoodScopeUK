/* Generated from schemas/risk-roads.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Strategic road corridors in Great Britain from OS Open Roads (S35): motorways and trunk roads ('strategic') and other primary-route A roads ('primary'), one feature per road number and category, WGS84. Written by `foodscope-pipeline build-risk`.
 */
export interface RiskRoads {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: {
      road: string;
      category: "strategic" | "primary";
    };
    geometry:
      | {
          type: "LineString";
          /**
           * @minItems 2
           */
          coordinates: [[number, number], [number, number], ...[number, number][]];
        }
      | {
          type: "MultiLineString";
          /**
           * @minItems 1
           */
          coordinates: [
            [[number, number], [number, number], ...[number, number][]],
            ...[[number, number], [number, number], ...[number, number][]][]
          ];
        };
  }[];
}
