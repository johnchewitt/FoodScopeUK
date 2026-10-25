/* Generated from schemas/risk-rail.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Railway lines in Northern Ireland from the Translink NIR railway network (S37): one feature per route line (sidings left out), WGS84. Written by `foodscope-pipeline build-risk`.
 */
export interface RiskRail {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: {
      line: string;
      elr: string;
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
