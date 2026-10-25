/* Generated from schemas/risk-farming.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Agricultural production regions (Defra June survey, S31): crop area and livestock on 1 June for the 8 Defra regions of England (commercial holdings) and for Wales, Scotland and Northern Ireland, with comparability notes. Regions are drawn on ONS ITL1 boundaries (S33). Written by `foodscope-pipeline build-risk`.
 */
export interface RiskFarming {
  schemaVersion: 1;
  year: number;
  referenceDate: string;
  measures: {
    id: "wheat" | "cattle" | "sheep" | "pigs" | "poultry";
    label: string;
    unit: "hectares" | "head" | "birds";
  }[];
  /**
   * @minItems 11
   * @maxItems 11
   */
  regions: [
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    },
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    },
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    },
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    },
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    },
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    },
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    },
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    },
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    },
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    },
    {
      id: string;
      name: string;
      nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
      itl1: string[];
      basis: string;
      /**
       * @minItems 2
       * @maxItems 2
       */
      point: [number, number];
      /**
       * Area of the region's ITL1 boundaries (BGC, clipped to the coastline; includes inland water), km²
       */
      areaKm2: number;
      values: {
        [k: string]: number;
      };
    }
  ];
  comparability: string[];
  notes: string[];
}
