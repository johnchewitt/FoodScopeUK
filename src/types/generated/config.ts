/* Generated from schemas/config.schema.json by scripts/gen-types.mjs — do not edit by hand. */

/**
 * Runtime configuration loaded from public/config.json. Public values only — never secrets (ADR-11).
 */
export interface AppConfig {
  $schema?: string;
  schemaVersion: 1;
  featureFlags: {
    /**
     * 3D globe mode (Release 2).
     */
    globe3d: boolean;
  };
  /**
   * Optional ArcGIS FeatureLayer overrides keyed by dataset id (ADR-08).
   */
  hostedLayers: {
    [k: string]: HostedLayer;
  };
}
export interface HostedLayer {
  url: string;
  /**
   * Maps canonical schema field names to the hosted layer's field names.
   */
  fieldMap?: {
    [k: string]: string;
  };
}
