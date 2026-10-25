/* Generated from schemas/risk-ports.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * UK major ports (DfT PORT0499, S23): freight tonnage (thousand tonnes) by year, inwards by region of loading and by cargo group, agricultural products inwards by region, and outwards. A year in which a port reported nothing is null. Locations from DfT's port list or EMODnet (S36). Written by `foodscope-pipeline build-risk`.
 */
export interface RiskPorts {
  schemaVersion: 1;
  unit: "thousand tonnes";
  /**
   * @minItems 1
   */
  years: [number, ...number[]];
  latestYear: number;
  cargoGroups: string[];
  regions: string[];
  domesticRegion: string;
  unspecifiedRegion: string;
  agricultural: {
    category: number;
    label: string;
    group: string;
  };
  notes: string[];
  method: string;
  ports: {
    locode: string;
    name: string;
    nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
    point: [number, number] | null;
    location: {
      source: "dft" | "emodnet" | "none";
      detail: string;
    };
    years: number[];
    inwardsByRegion: {
      [k: string]: (number | null)[];
    };
    inwardsByGroup: {
      [k: string]: (number | null)[];
    };
    agriculturalInwardsByRegion: {
      [k: string]: (number | null)[];
    };
    outwards: (number | null)[];
  }[];
}
