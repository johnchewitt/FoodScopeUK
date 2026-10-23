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
        /**
         * First month in the snapshot with recorded imports under this code (null: none).
         */
        firstMonth?: Month | null;
        /**
         * Last month in the snapshot with recorded imports under this code (null: none).
         */
        lastMonth?: Month | null;
        /**
         * Number of snapshot months with recorded imports under this code.
         */
        monthsRecorded?: number;
        /**
         * Calendar months (1–12) in which this code ever has recorded imports in the snapshot.
         */
        calendarMonths?: number[];
        /**
         * Unsuppressed recorded net mass (kg) under this code per calendar month (January first), summed over the snapshot.
         *
         * @minItems 12
         * @maxItems 12
         */
        netMassKgByCalendarMonth?: [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number
        ];
      },
      ...{
        code: string;
        commodityId: number;
        description: string;
        /**
         * First month in the snapshot with recorded imports under this code (null: none).
         */
        firstMonth?: Month | null;
        /**
         * Last month in the snapshot with recorded imports under this code (null: none).
         */
        lastMonth?: Month | null;
        /**
         * Number of snapshot months with recorded imports under this code.
         */
        monthsRecorded?: number;
        /**
         * Calendar months (1–12) in which this code ever has recorded imports in the snapshot.
         */
        calendarMonths?: number[];
        /**
         * Unsuppressed recorded net mass (kg) under this code per calendar month (January first), summed over the snapshot.
         *
         * @minItems 12
         * @maxItems 12
         */
        netMassKgByCalendarMonth?: [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number
        ];
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
  /**
   * Months where the CN8 codes recorded under the basket change: codes last recorded the month before (ended) and codes first recorded in that month (started). Totals include every code, so the series is continuous.
   */
  codeChanges?: {
    month: Month;
    /**
     * @minItems 1
     */
    ended: [string, ...string[]];
    /**
     * @minItems 1
     */
    started: [string, ...string[]];
  }[];
}
