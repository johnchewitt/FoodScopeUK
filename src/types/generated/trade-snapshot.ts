/* Generated from schemas/trade-snapshot.schema.json by scripts/gen-types.mjs — do not edit by hand. */

export type Month = string;

/**
 * Recorded UK imports for one commodity basket by month and recorded import partner (HMRC OTS, S01). Written by the pipeline's build-trade step.
 */
export interface TradeSnapshot {
  schemaVersion: 1;
  id: string;
  commodity: {
    id: string;
    label: string;
    definition: string;
    hsScope: string;
    /**
     * @minItems 1
     */
    cn8: [
      {
        code: string;
        commodityId: number;
        description: string;
      },
      ...{
        code: string;
        commodityId: number;
        description: string;
      }[]
    ];
  };
  /**
   * @minItems 1
   */
  flows: [
    {
      id: number;
      label: string;
    },
    ...{
      id: number;
      label: string;
    }[]
  ];
  months: {
    first: Month;
    last: Month;
    /**
     * First month still inside HMRC's 18-month revision window (estimated), or null.
     */
    provisionalFrom: Month | null;
  };
  units: {
    mass: "kg";
    value: "GBP";
  };
  partners: {
    key: string;
    name: string;
    hmrcNames: string[];
    /**
     * @minItems 1
     */
    hmrcCountryIds: [number, ...number[]];
    /**
     * unallocated = HMRC categories that are not a country (stores and provisions, estimates, confidential, regions not specified).
     */
    kind: "country" | "unallocated";
    iso2: string | null;
    geometry: "polygon" | "point" | "none";
    point: [number, number] | null;
  }[];
  /**
   * [monthIndex, partnerIndex, netMassKg, valueGbp]: unsuppressed trade summed over flows and CN8 codes. monthIndex counts from months.first.
   */
  rows: [number, number, number, number][];
  /**
   * [monthIndex, suppressionIndex, netMassKg | null, valueGbp | null]: trade HMRC suppresses at country level. null = not published at that suppression level.
   */
  suppressed: [number | null, number | null, number | null, number | null][];
  /**
   * Published months (indexes) with no recorded import rows for this basket.
   */
  nilMonths: number[];
}
