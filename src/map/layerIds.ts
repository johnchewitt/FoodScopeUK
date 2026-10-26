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
/** Risk Explorer (Stage 6): logistics layers and the `risk` family datasets. */
export const RISK_PORTS_LAYER_ID = "risk-ports";
/** Draws nothing: carries the ports' data credit into the map attribution (GraphicsLayers cannot). */
export const RISK_PORTS_CREDIT_LAYER_ID = "risk-ports-credit";
export const RISK_ROADS_LAYER_ID = "risk-roads";
export const RISK_RAIL_LAYER_ID = "risk-rail";
export const RISK_ROADS_NI_LAYER_ID = "risk-roads-ni";
export const RISK_REGIONS_LAYER_ID = "risk-regions";
export const RISK_DATASET_IDS = {
  waterStress: "risk.water_stress",
  ports: "risk.ports",
  portEntry: "risk.port_entry",
  roads: "risk.roads",
  roadsNi: "risk.roads_ni",
  rail: "risk.rail",
  farming: "risk.farming",
  farmingRegions: "risk.farming_regions",
  councilPpfi: "risk.council_ppfi",
} as const;

/** Dataset ids of a deep-profile council's small areas (one folder per council, ADR-0023). */
export function areaDatasetIds(lad: string): { boundaries: string; indicators: string } {
  const key = lad.toLowerCase();
  return { boundaries: `areas.${key}.boundaries`, indicators: `areas.${key}.indicators` };
}

/** Scenario Lab (Stage 7): the closure inputs (`scenario` family) and the closure map's layer. */
export const SCENARIO_DATASET_IDS = {
  closureGb: "scenario.closure_gb",
  closureNi: "scenario.closure_ni",
} as const;
export const SCENARIO_CLOSURE_LAYER_ID = "scenario-closure";
