/* Generated from schemas/small-area-indicators.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Per small area of the deep profiles (LP-04, FA-02, FA-03): Census 2021 usual residents, households and households without a car or van (S18, S20), the population-weighted centroid (S15, S16), deprivation within its own nation (S19: IoD 2025 for England on LSOAs; NIMDM 2017 for Northern Ireland on SOAs 2011) and the Priority Places for Food Index v2.1 within its nation (S13, on the same geographies) and the urban/rural class (S21: ONS 2021 on LSOAs; NISRA 2015 on Northern Ireland SOAs). Shares and distances are computed in the app (src/analysis). One file per deep-profile council (Stage 5, ADR-0023). Written by `foodscope-pipeline build-areas`.
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
  /**
   * @minItems 1
   */
  profiles: [Profile, ...Profile[]];
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
  urbanRural: {
    sourceId: string;
    geography: "lsoa21" | "soa2011";
    classification: string;
    referencePeriod: string;
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
  ppfi: {
    index: string;
    sourceId: string;
    decile: string;
    orientation: string;
    referencePeriod: string;
    geography: "lsoa21" | "soa2011";
    ranked: number;
    within: string;
    domainsWithoutData: (
      | "supermarket_proximity"
      | "supermarket_accessibility"
      | "ecommerce_access"
      | "socio_demographic"
      | "nonsupermarket_proximity"
      | "food_for_families"
      | "fuel_poverty"
    )[];
  };
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
   * Urban/rural class of this small area (ONS 2021, England and Wales); null when the nation's class uses another geography (Northern Ireland: `deprivationAreas[].urbanRural2015`)
   */
  urbanRural: null | UrbanRural;
  /**
   * Deprivation within the nation on this geography; null when the nation's index uses another geography (`deprivationAreas`)
   */
  deprivation: null | Rank;
  /**
   * PPFI v2.1 on this geography; null when the nation's PPFI uses another geography (`deprivationAreas`)
   */
  ppfi: null | Ppfi;
}
export interface UrbanRural {
  code: string;
  name: string;
  flag: "Urban" | "Rural";
}
export interface Rank {
  rank: number;
  decile: number;
}
/**
 * Priority Places for Food Index v2.1 for one area: combined rank and decile within its nation, and each domain's rank and decile (null where the domain has no data for that nation)
 */
export interface Ppfi {
  rank: number;
  decile: number;
  domains: {
    supermarket_proximity: null | Rank;
    supermarket_accessibility: null | Rank;
    ecommerce_access: null | Rank;
    socio_demographic: null | Rank;
    nonsupermarket_proximity: null | Rank;
    food_for_families: null | Rank;
    fuel_poverty: null | Rank;
  };
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
  ppfi: Ppfi;
}
