/* Generated from schemas/council-context.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * @minItems 1
 */
export type SourceIds = [string, ...string[]];
/**
 * How the value was obtained when it is not on the council's May 2025 boundary as published (a 2023 merger summed, or a pre-2025 boundary); null when it is.
 */
export type Basis = string | null;

/**
 * Per May 2025 council (LP-01, LP-02, LP-04): the box around its boundary (S14, for framing the map), the ONS 2021 Rural Urban Classification (S21; England and Wales only) and Census 2021 households with no car or van (S20; England, Wales and Northern Ireland). A null value means the measure is not published or not yet included for that nation; the reason is in notCovered. Written by `foodscope-pipeline build-context`. Shares are computed in the app.
 */
export interface CouncilContext {
  schemaVersion: 1;
  urbanRural: {
    sourceIds: SourceIds;
    classification: string;
    referencePeriod: string;
    method: string;
    /**
     * @minItems 1
     */
    classes: [
      {
        code: string;
        name: string;
        flag: "Urban" | "Rural";
      },
      ...{
        code: string;
        name: string;
        flag: "Urban" | "Rural";
      }[]
    ];
    coverage: string;
    notCovered: NotCovered;
  };
  carAvailability: {
    sourceIds: SourceIds;
    referenceDate: string;
    measure: string;
    coverage: string;
    notCovered: NotCovered;
    comparability: string;
  };
  councils: {
    code: string;
    name: string;
    nation: "England" | "Wales" | "Scotland" | "Northern Ireland";
    /**
     * [west, south, east, north] of the council's display boundary (WGS84, S14), for framing the map
     *
     * @minItems 4
     * @maxItems 4
     */
    bbox: [number, number, number, number];
    urbanRural: null | {
      code: string;
      name: string;
      flag: "Urban" | "Rural";
      basis: Basis;
    };
    carAvailability: null | {
      households: number;
      noCar: number;
      basis: Basis;
    };
  }[];
}
/**
 * Nation → why the measure is absent there.
 */
export interface NotCovered {
  [k: string]: string;
}
