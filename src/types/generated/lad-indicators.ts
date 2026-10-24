/* Generated from schemas/lad-indicators.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Per May 2025 council: mid-2025 population and land area (S18) and GEOLYTIX store counts by size band and format (S11, assigned on S14 boundaries). Ratios such as stores per 10,000 residents are computed in the app (src/analysis, spec §6.3). Written by `foodscope-pipeline build-local`.
 */
export interface CouncilIndicators {
  schemaVersion: 1;
  population: {
    sourceId: string;
    /**
     * e.g. mid-2025
     */
    label: string;
    referenceDate: string;
    boundaries: string;
  };
  landArea: {
    sourceId: string;
    definition: string;
  };
  stores: {
    sourceId: string;
    edition: string;
    sizeBands: {
      id: string;
      label: string;
      /**
       * GEOLYTIX size_band as delivered
       */
      value: string;
      storeClass: string;
    }[];
    storeClasses: {
      id: string;
      label: string;
    }[];
    formats: {
      id: string;
      label: string;
      inDefaultView: boolean;
      fascias: string[];
    }[];
    /**
     * Columns of each council's `stores` array: every size band × format pair.
     */
    groups: {
      sizeBand: string;
      format: string;
    }[];
  };
  councils: {
    code: string;
    name: string;
    nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
    population: number | null;
    landAreaKm2: number | null;
    /**
     * Comparability note for this council (for example a boundary change after the population estimate)
     */
    note: string | null;
    stores: number[];
  }[];
  /**
   * Stores in the delivered file that no UK council holds, by reason.
   */
  outsideCouncils: {
    reason: string;
    stores: number;
  }[];
}
