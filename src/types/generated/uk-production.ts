/* Generated from schemas/uk-production.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Defra's latest annual UK supply balance for each Food Origins basket (LP-05; S09 Horticulture statistics, S10 Agriculture in the UK), as published: production, imports, exports, total supply and production as a percentage of supply, plus the recent share series. National context only; never combined with HMRC monthly trade (SS-07). A basket without a Defra production series has status not_published and a note. Written by `foodscope-pipeline build-context`.
 */
export interface UkProduction {
  schemaVersion: 1;
  scope: "United Kingdom";
  commodities: (
    | {
        basket: string;
        status: "not_published";
        note: string;
      }
    | {
        basket: string;
        status: "published";
        sourceId: string;
        table: string;
        year: number;
        provisional: boolean;
        file: string;
        /**
         * @minItems 5
         * @maxItems 5
         */
        measures: [
          {
            key: "production" | "imports" | "exports" | "totalSupply" | "productionShare";
            label: string;
            value: number;
            unit: "thousand tonnes" | "%";
          },
          {
            key: "production" | "imports" | "exports" | "totalSupply" | "productionShare";
            label: string;
            value: number;
            unit: "thousand tonnes" | "%";
          },
          {
            key: "production" | "imports" | "exports" | "totalSupply" | "productionShare";
            label: string;
            value: number;
            unit: "thousand tonnes" | "%";
          },
          {
            key: "production" | "imports" | "exports" | "totalSupply" | "productionShare";
            label: string;
            value: number;
            unit: "thousand tonnes" | "%";
          },
          {
            key: "production" | "imports" | "exports" | "totalSupply" | "productionShare";
            label: string;
            value: number;
            unit: "thousand tonnes" | "%";
          }
        ];
        shareSeries: {
          year: number;
          value: number;
        }[];
        notes: string[];
        /**
         * What Defra's balance covers, in a few words (e.g. 'Defra: mutton and lamb only (no goat meat), carcase weight'), for display beside the figure.
         */
        scope?: string;
      }
  )[];
}
