/* Generated from schemas/stores.schema.json by scripts/gen-types.mjs — do not edit by hand. */

export type SizeBand = "lt280" | "280to1400" | "1400to2800" | "ge2800";
export type StoreClass = "supermarket" | "convenience";
export type StoreFormat = "standard" | "forecourt" | "motorway" | "travel" | "hospital";

/**
 * GEOLYTIX grocery retail points (S11) with the D5 size band, class and format and the May 2025 council (S14) each store falls in; wholesale and mainly non-food stores are left out, and stores in Guernsey, Jersey and the Isle of Man are included with no council. Written by `foodscope-pipeline build-local`; coordinates WGS84 (EPSG:4326), 6 decimal places.
 */
export interface StoreCollection {
  type: "FeatureCollection";
  features: StoreFeature[];
}
export interface StoreFeature {
  type: "Feature";
  /**
   * GEOLYTIX id
   */
  id: number;
  geometry: {
    type: "Point";
    /**
     * @minItems 2
     * @maxItems 2
     */
    coordinates: [number, number];
  };
  properties: StoreProperties;
}
export interface StoreProperties {
  id: number;
  /**
   * GEOLYTIX retailer, as delivered
   */
  retailer: string;
  /**
   * GEOLYTIX fascia (store brand), as delivered
   */
  fascia: string;
  /**
   * GEOLYTIX store_name, as delivered
   */
  name: string;
  /**
   * GEOLYTIX add_one, as delivered
   */
  address: string | null;
  town: string | null;
  postcode: string | null;
  sizeBand: SizeBand;
  storeClass: StoreClass;
  format: StoreFormat;
  /**
   * May 2025 council code (LAD25CD); null for stores in the Crown Dependencies, which have no UK council
   */
  lad: string | null;
  /**
   * inside = the point is inside the council boundary; nearest = the point is just outside every council (within 50 m, e.g. a harbour-front store) and takes the nearest one; none = a Crown Dependency store, with no UK council
   */
  councilMatch: "inside" | "nearest" | "none";
  /**
   * Crown Dependency for stores with GY, JE or IM postcodes (GY covers the Bailiwick of Guernsey); null for UK stores
   */
  crownDependency: "Guernsey" | "Jersey" | "Isle of Man" | null;
  /**
   * wgs84 = long_wgs/lat_wgs as delivered; bng = derived from bng_e/bng_n because WGS84 was missing
   */
  coordinateSource: "wgs84" | "bng";
}
