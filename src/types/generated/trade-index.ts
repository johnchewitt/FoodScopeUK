/* Generated from schemas/trade-index.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Commodity baskets available in a trade snapshot (Food Origins explorer).
 */
export interface TradeIndex {
  schemaVersion: 1;
  snapshotId: string;
  /**
   * Commodity groups, in display order (SITC divisions as Defra uses them). Absent in snapshots before 26 Oct 2026.
   */
  groups?: {
    id: string;
    label: string;
  }[];
  /**
   * @minItems 1
   */
  commodities: [
    {
      id: string;
      datasetId: string;
      /**
       * Id of an entry in groups.
       */
      group?: string;
      label: string;
      definition: string;
      hsScope: string;
      path: string;
      months: {
        first: string;
        last: string;
        provisionalFrom: string | null;
      };
    },
    ...{
      id: string;
      datasetId: string;
      /**
       * Id of an entry in groups.
       */
      group?: string;
      label: string;
      definition: string;
      hsScope: string;
      path: string;
      months: {
        first: string;
        last: string;
        provisionalFrom: string | null;
      };
    }[]
  ];
}
