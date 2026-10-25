/* Generated from schemas/risk-water-stress.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Level of water stress by country (SDG 6.4.2; FAO AQUASTAT through the World Bank API, S30) with FAO's stress classes. A national figure for the whole country. Countries without any value are listed in `missing`. Written by `foodscope-pipeline build-risk`.
 */
export interface RiskWaterStress {
  schemaVersion: 1;
  indicator: {
    id: "ER.H2O.FWST.ZS";
    label: string;
    unit: "%";
    sdg: "6.4.2";
    sourceId: "S30";
    source: string;
    lastUpdated: string;
    classSource: string;
    classRule: string;
    /**
     * @minItems 5
     * @maxItems 5
     */
    classes: [
      {
        id: "none" | "low" | "medium" | "high" | "critical";
        label: string;
        min: number;
        max: number | null;
      },
      {
        id: "none" | "low" | "medium" | "high" | "critical";
        label: string;
        min: number;
        max: number | null;
      },
      {
        id: "none" | "low" | "medium" | "high" | "critical";
        label: string;
        min: number;
        max: number | null;
      },
      {
        id: "none" | "low" | "medium" | "high" | "critical";
        label: string;
        min: number;
        max: number | null;
      },
      {
        id: "none" | "low" | "medium" | "high" | "critical";
        label: string;
        min: number;
        max: number | null;
      }
    ];
    scope: string;
  };
  countries: {
    iso2: string;
    iso3: string;
    name: string;
    year: number;
    value: number;
    class: "none" | "low" | "medium" | "high" | "critical";
    /**
     * @minItems 1
     */
    series: [[number, number], ...[number, number][]];
  }[];
  missing: {
    iso2: string;
    iso3: string;
    name: string;
  }[];
}
