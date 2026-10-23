/* Generated from schemas/indicator.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Serialised indicator envelope (ADR-09). Every displayed value travels with its provenance.
 */
export interface IndicatorRecord {
  id: string;
  label: string;
  value: number | string | null;
  missingReason?: "suppressed" | "not_published" | "not_applicable" | "not_covered" | "small_base";
  unit: string;
  provenance: "measured" | "official_estimate" | "derived" | "scenario" | "illustrative";
  /**
   * @minItems 1
   */
  sourceIds: [string, ...string[]];
  referencePeriod: string;
  coverage: string;
  method: string;
  scope: "local" | "national_context";
  comparabilityGroup?: string;
  quality?: string;
}
