/* Generated from schemas/ni-other-grocers.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Northern Ireland grocers not in the GEOLYTIX data (S11), from the FSA food hygiene register (S29): grocery symbol groups GEOLYTIX does not carry in NI, and independent grocers registered as supermarkets/hypermarkets. Supplementary layer: never part of a store count or rate. Written by `foodscope-pipeline build-ni-grocers`.
 */
export interface NiOtherGrocers {
  type: "FeatureCollection";
  features: Grocer[];
}
export interface Grocer {
  type: "Feature";
  geometry: {
    type: "Point";
    /**
     * @minItems 2
     * @maxItems 2
     */
    coordinates: [number, number];
  };
  properties: {
    /**
     * FSA FHRSID
     */
    id: number;
    /**
     * Business name as registered
     */
    name: string;
    kind: "group" | "independent";
    /**
     * Symbol group (e.g. SuperValu) for kind 'group'; null for independents
     */
    group: string | null;
    fsaType: "Retailers - supermarkets/hypermarkets" | "Retailers - other";
    postcode: string | null;
    town: string | null;
    lad: string;
  };
}
