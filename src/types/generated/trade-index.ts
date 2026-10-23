/* Generated from schemas/trade-index.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Commodity baskets available in a trade snapshot (Food Origins explorer).
 */
export interface TradeIndex {
  schemaVersion: 1;
  snapshotId: string;
  /**
   * @minItems 1
   */
  commodities: [
    {
      id: string;
      datasetId: string;
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
