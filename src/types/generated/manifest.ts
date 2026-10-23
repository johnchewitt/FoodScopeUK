/* Generated from schemas/manifest.schema.json by scripts/gen-types.mjs — do not edit by hand. */

export type ProvenanceClass = "measured" | "official_estimate" | "derived" | "scenario" | "illustrative";

/**
 * Index of published data (public/data/manifest.json), written by the pipeline's publish step (ADR-06).
 */
export interface DataManifest {
  schemaVersion: 1;
  generatedAt: string;
  generator: string;
  /**
   * Dated statistical snapshot (YYYY-MM-DD) or null when none has been published yet.
   */
  snapshotId: string | null;
  datasets: Dataset[];
  catalogue: CatalogueEntry[];
}
export interface Dataset {
  id: string;
  title: string;
  /**
   * reference = geometry/context used for display; statistical = values shown as indicators.
   */
  role: "reference" | "statistical";
  /**
   * Relative to public/data/.
   */
  path: string;
  format: "geojson" | "json";
  schemaId?: string | null;
  sha256: string;
  bytes: number;
  featureCount?: number;
  /**
   * @minItems 1
   */
  sourceIds: [string, ...string[]];
  referencePeriod: string;
  coverage: string;
  provenance: ProvenanceClass;
  licence: string;
  attribution: string;
  expectedCadence?: "monthly" | "quarterly" | "annual" | "irregular" | "static";
  retrieval: {
    method: string;
    source: string;
    retrievedAt: string;
    notes?: string;
  };
}
export interface CatalogueEntry {
  id: string;
  title: string;
  publisher: string;
  url: string;
  licence: string;
  status: "verified" | "partly_verified" | "to_verify" | "gap";
  notes?: string;
}
