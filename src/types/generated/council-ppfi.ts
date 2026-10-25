/* Generated from schemas/council-ppfi.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Priority Places for Food Index v2.1 (S13) by council: for each May 2025 council, the number of its small areas and how many fall in their nation's highest-priority deciles (1-2), for the combined index and each domain (null where the domain has no data in that nation), plus the combined decile counts. Small areas assigned with S15 (England, Wales), S32 (Scotland, 2011 Data Zones) and S19 NIMDM 2017 (Northern Ireland). Shares and within-nation ranks are computed in the app. Written by `foodscope-pipeline build-risk`.
 */
export interface CouncilPpfi {
  schemaVersion: 1;
  index: {
    name: string;
    version: string;
    sourceId: "S13";
    orientation: string;
    priorityDeciles: number[];
    measure: string;
    comparability: string;
    domainsWithoutDataNote: string | null;
  };
  measures: {
    id: string;
    label: string;
  }[];
  /**
   * @minItems 4
   * @maxItems 4
   */
  nations: [
    {
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      councils: number;
      areas: number;
      areaType: string;
      assignment: string;
      priorityAreas: number;
      domainsWithoutData: string[];
    },
    {
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      councils: number;
      areas: number;
      areaType: string;
      assignment: string;
      priorityAreas: number;
      domainsWithoutData: string[];
    },
    {
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      councils: number;
      areas: number;
      areaType: string;
      assignment: string;
      priorityAreas: number;
      domainsWithoutData: string[];
    },
    {
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      councils: number;
      areas: number;
      areaType: string;
      assignment: string;
      priorityAreas: number;
      domainsWithoutData: string[];
    }
  ];
  councils: {
    code: string;
    name: string;
    nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
    areas: number;
    /**
     * @minItems 10
     * @maxItems 10
     */
    combinedDeciles: [number, number, number, number, number, number, number, number, number, number];
    values: {
      [k: string]: {
        priority: number;
        areas: number;
      } | null;
    };
  }[];
}
