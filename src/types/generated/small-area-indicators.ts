/* Generated from schemas/small-area-indicators.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Per small area of the deep profiles (LP-04, FA-02, FA-03): Census 2021 usual residents, households and households without a car or van (S18, S20), the population-weighted centroid (S15, S16), and deprivation within its own nation (S19: IoD 2025 for England on LSOAs; NIMDM 2017 for Northern Ireland on SOAs 2011). Shares and distances are computed in the app (src/analysis). Written by `foodscope-pipeline build-areas`.
 */
export interface SmallAreaIndicators {
  schemaVersion: 1;
  census: {
    sourceIds: string[];
    referenceDate: string;
    population: string;
    households: string;
    noCarHouseholds: string;
    note: string;
  };
  centroids: {
    sourceIds: string[];
    definition: string;
  };
  profiles: Profile[];
}
export interface Profile {
  lad: string;
  name: string;
  nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
  geography: {
    kind: "lsoa21" | "dz21";
    label: string;
    count: number;
  };
  deprivation: {
    index: string;
    sourceId: string;
    measure: string;
    geography: "lsoa21" | "soa2011";
    ranked: number;
    within: string;
    /**
     * 'published' or how it was derived
     */
    decile: string;
    referencePeriod: string;
  };
  areas: Area[];
  deprivationAreas: null | DeprivationArea[];
  missing: {
    field: string;
    reason: string;
  }[];
}
export interface Area {
  code: string;
  name: string;
  /**
   * Electoral ward (2025), best-fit (England and Wales only)
   */
  ward?: string;
  wardName?: string;
  /**
   * Census 2021 usual residents
   */
  population: number;
  /**
   * Census 2021 households; null when not published for this geography (see the profile's `missing`)
   */
  households: number | null;
  noCarHouseholds: number | null;
  /**
   * Population-weighted centroid, [lon, lat] WGS84
   *
   * @minItems 2
   * @maxItems 2
   */
  centroid: [number, number];
  /**
   * Deprivation within the nation on this geography; null when the nation's index uses another geography (`deprivationAreas`)
   */
  deprivation: null | Rank;
}
export interface Rank {
  rank: number;
  decile: number;
}
export interface DeprivationArea {
  code: string;
  name: string;
  /**
   * NISRA 2015 default urban/rural classification, as in the NIMDM 2017 file
   */
  urbanRural2015: string;
  rank: number;
  decile: number;
  domainRanks: {
    income: number;
    employment: number;
    health: number;
    education: number;
    access: number;
    livingEnvironment: number;
    crime: number;
  };
}
