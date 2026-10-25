/** Layer ids shared by map controllers and UI (kept SDK-free so UI modules stay light). */
export const REFERENCE_LAYER_ID = "reference-outlines";
export const REFERENCE_DATASET_ID = "reference.world_countries_110m";
/** Status entry for the Esri basemap (not a layer the app creates; see BasemapStatusController). */
export const BASEMAP_STATUS_ID = "basemap";
export const REFERENCE_POINTS_DATASET_ID = "reference.world_country_points";
/** Food Origins layers (Stage 2). */
export const ORIGINS_PARTNERS_LAYER_ID = "origins-partners";
export const ORIGINS_FLOWS_LAYER_ID = "origins-flows";
/** UK Food Access layers (Stage 4). */
export const ACCESS_COUNCILS_LAYER_ID = "access-councils";
export const ACCESS_STORES_LAYER_ID = "access-stores";
export const ACCESS_OVERLAY_LAYER_ID = "access-overlay";
export const LOCAL_STORES_DATASET_ID = "local.stores";
export const LOCAL_INDICATORS_DATASET_ID = "local.lad_indicators";
export const LOCAL_BOUNDARIES_DATASET_ID = "local.lad_boundaries_2025";
/** NI grocers from the FSA register that GEOLYTIX does not map (Stage 5, S29): supplementary layer. */
export const ACCESS_GROCERS_LAYER_ID = "access-ni-grocers";
export const REGISTER_GROCERS_DATASET_ID = "register.ni_other_grocers";
/**
 * The NI grocers (285 hollow diamonds, not clustered) are drawn from about zoom 7.5, where
 * Northern Ireland fills much of the map; at UK scale they would cover it as one blot.
 */
export const REGISTER_GROCERS_MIN_ZOOM = 7.5;
/** Local Authority Profiles (Stage 5). */
export const PROFILE_AREAS_LAYER_ID = "profile-small-areas";
export const CONTEXT_COUNCILS_DATASET_ID = "context.council_context";
export const CONTEXT_PRODUCTION_DATASET_ID = "context.uk_production";

/** Dataset ids of a deep-profile council's small areas (one folder per council, ADR-0023). */
export function areaDatasetIds(lad: string): { boundaries: string; indicators: string } {
  const key = lad.toLowerCase();
  return { boundaries: `areas.${key}.boundaries`, indicators: `areas.${key}.indicators` };
}
