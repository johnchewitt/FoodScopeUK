/* Generated from schemas/risk-port-entry.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * UK Food Security Report 2024 (S03), theme 3 chart data as published: food, feed and drink imports by port of entry (3_2_2a), the Short Straits share by food group (3_2_2b) and the average delay on England's Strategic Road Network (3_2_1a). Written by `foodscope-pipeline build-risk`.
 */
export interface RiskPortEntry {
  schemaVersion: 1;
  portOfEntry: {
    sourceId: "S03";
    table: string;
    title: string;
    unit: string;
    years: number[];
    note: string;
    groups: {
      label: string;
      locodes: string[];
      linkNote?: string;
      values: number[];
    }[];
  };
  shortStraits: {
    sourceId: "S03";
    table: string;
    title: string;
    unit: string;
    years: number[];
    foods: {
      food: string;
      values: number[];
    }[];
  };
  srnDelay: {
    sourceId: "S03";
    table: string;
    title: string;
    unit: string;
    coverage: string;
    months: string[];
    monthly: (number | null)[];
    yearEnding: (number | null)[];
  };
}
