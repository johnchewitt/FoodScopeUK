import { create } from "zustand";
import type { ModuleId } from "@/app/modules";
import { type Breakpoint } from "@/map/layoutMetrics";
import { BASEMAP_STATUS_ID } from "@/map/layerIds";
import { STORE_LAYERS, type StoreLayer } from "@/analysis/retail";
import type { MapStyle } from "@/styles/palette";
import {
  cleanCompare,
  DEFAULT_URL_STATE,
  type AreaMeasure,
  type BasemapId,
  type CouncilLayer,
  type FarmLayer,
  type HeatmapMode,
  type Measure,
  type Nation,
  type Overlay,
  type PeriodMode,
  type PortMeasureId,
  type PpfiMeasure,
  type RiskFill,
  type RiskView,
  type ScenarioKind,
  type ScenarioView,
  type UrlState,
} from "./urlState";
import { baselineFor, defaultsFor, stateFromParams, type ScenarioParams } from "./scenarioParams";

export type MapStatus = "idle" | "loading" | "ready" | "error";
export type LayerStatus = "loading" | "ready" | "error";

export type GoToTarget = "world" | "uk" | "partners";

type MapCommandInput =
  | { type: "goTo"; target: GoToTarget }
  | { type: "zoom"; direction: "in" | "out" }
  /** Centre the map on a point (WGS84) at a zoom level, e.g. a store found by search. */
  | { type: "goToPoint"; center: [number, number]; zoom: number }
  /** Fit a council (handled by the layer that draws councils). */
  | { type: "focusCouncil"; code: string };

export type MapCommand = MapCommandInput & { id: number };

export interface AppState extends UrlState {
  // Layout
  breakpoint: Breakpoint;
  layoutInitialised: boolean;
  filterPanelOpen: boolean;
  insightsOpen: boolean;
  mobileNavOpen: boolean;

  // Motion (AX-04)
  motionPreference: "system" | "reduced";
  systemPrefersReducedMotion: boolean;

  // Map runtime status (serialisable only — ArcGIS objects live in MapController)
  mapStatus: MapStatus;
  mapError: string | null;
  layerStatus: Record<string, { status: LayerStatus; message?: string }>;
  mapCommand: MapCommand | null;

  /** Food Origins map view model (serialisable; written by the Origins feature, read by layer controllers). */
  originsMap: OriginsMapModel | null;
  /** Partner under the pointer on the map, with screen position for the tooltip (not in the URL). */
  hoverPartner: HoverPartner | null;
  /** Number of partners drawn as connections (FO-03, default 12). */
  flowCount: number;

  /** Seasonal Supply playback (SS-03). Not in the URL: a shared link never starts playing. */
  playing: boolean;
  playSpeed: PlaySpeed;

  /** True when an ArcGIS API key is configured, so Esri basemaps (and the basemap choice) exist (SH-08). */
  basemapChoice: boolean;
  /** Zoom and centre (WGS84) of the map when it last came to rest (set by the map; not in the URL). */
  mapView: { zoom: number; center: [number, number] } | null;

  /** UK Food Access map view model (serialisable; written by the feature, read by layer controllers). */
  accessMap: AccessMapModel | null;
  /** Store or council under the pointer on the Food Access map (not in the URL). */
  hoverAccess: HoverAccess | null;
  /** Straight-line proximity tool (SM-07): picking a point, the point, nearest count, radius in km. */
  proximityPicking: boolean;
  proximityPoint: [number, number] | null;
  proximityCount: number;
  proximityRadiusKm: number;

  /** Local Authority Profiles small-area map model (serialisable; written by the feature, read by the map). */
  profileMap: ProfileMapModel | null;
  /** Small area under the pointer in a deep profile (not in the URL). */
  hoverArea: HoverArea | null;
  /** Small areas picked from a chart (LP-06: chart → map), outlined on the map; not in the URL. */
  areaHighlight: AreaHighlight | null;

  /** Risk Explorer logistics map model (serialisable; written by the feature, read by the map). */
  riskMap: RiskMapModel | null;
  /** Port or farming region under the pointer on the logistics map (not in the URL). */
  hoverRisk: HoverRisk | null;

  /** Scenario Lab closure map model (serialisable; written by the feature, read by the map). */
  scenarioMap: ScenarioClosureMapModel | null;
  /** Small area under the pointer on the closure map (not in the URL). */
  hoverScenario: HoverScenario | null;

  // Actions
  setModule: (module: ModuleId) => void;
  setMonth: (month: number | null) => void;
  stepMonth: (delta: 1 | -1) => void;
  setLad: (lad: string | null) => void;
  setCommodity: (commodity: string) => void;
  setPeriod: (period: PeriodMode) => void;
  setYear: (year: number | null) => void;
  /** Sets year and month together (timeline in Food Origins). */
  setYearMonth: (year: number, month: number) => void;
  setMeasure: (measure: Measure) => void;
  selectPartner: (partner: string | null) => void;
  setOriginsMap: (model: OriginsMapModel | null) => void;
  setHoverPartner: (hover: HoverPartner | null) => void;
  setFlowCount: (n: number) => void;
  setCompareYear: (year: number | null) => void;
  setCompareMonth: (month: number | null) => void;
  setHeatmap: (mode: HeatmapMode) => void;
  setPlaying: (playing: boolean) => void;
  setPlaySpeed: (speed: PlaySpeed) => void;
  /** Advances playback to a month without stopping it (every other month setter stops playback). */
  playbackStep: (year: number, month: number) => void;
  openOverlay: (overlay: Exclude<Overlay, "none">) => void;
  closeOverlay: () => void;
  hydrateFromUrl: (state: UrlState) => void;

  toggleStoreLayer: (layer: StoreLayer) => void;
  setStoreLayers: (layers: StoreLayer[]) => void;
  setRetailers: (retailers: string[] | null) => void;
  setCouncilLayer: (layer: CouncilLayer) => void;
  selectStore: (id: number | null) => void;
  /** Selects a council (null clears); selecting the selected council again clears it. */
  selectCouncil: (code: string | null) => void;
  setAccessMap: (model: AccessMapModel | null) => void;
  setHoverAccess: (hover: HoverAccess | null) => void;
  setProximityPicking: (picking: boolean) => void;
  setProximityPoint: (point: [number, number] | null) => void;
  setProximityCount: (n: number) => void;
  setProximityRadiusKm: (km: number) => void;
  setBasemap: (basemap: BasemapId) => void;
  setBasemapChoice: (available: boolean) => void;
  setMapView: (view: { zoom: number; center: [number, number] }) => void;

  /** Adds or removes a comparison council (at most MAX_COMPARE; never the selected council). */
  toggleCompare: (code: string) => void;
  setCompare: (codes: string[]) => void;
  setAreaMeasure: (measure: AreaMeasure) => void;
  /** Selects a small area (null clears); selecting the selected area again clears it. */
  selectArea: (code: string | null) => void;
  setNiGrocers: (on: boolean) => void;
  setProfileMap: (model: ProfileMapModel | null) => void;
  setHoverArea: (hover: HoverArea | null) => void;
  setAreaHighlight: (highlight: AreaHighlight | null) => void;

  setRiskView: (view: RiskView) => void;
  setRiskFill: (fill: RiskFill) => void;
  /** Selects a port (null clears); selecting the selected port again clears it. */
  selectPort: (locode: string | null) => void;
  setPortMeasure: (measure: PortMeasureId) => void;
  setRoads: (on: boolean) => void;
  setRail: (on: boolean) => void;
  setFarmLayer: (layer: FarmLayer) => void;
  setPpfiMeasure: (measure: PpfiMeasure) => void;
  setRankNation: (nation: Nation | null) => void;
  setRiskMap: (model: RiskMapModel | null) => void;
  setHoverRisk: (hover: HoverRisk | null) => void;

  setScenarioKind: (kind: ScenarioKind) => void;
  /** Changes some of the current scenario's settings (only the scenario fields are taken). */
  updateScenario: (patch: Partial<Pick<UrlState, ScenarioField>>) => void;
  /** Applies a whole scenario (a preset or a saved scenario): kind and settings. */
  applyScenario: (params: ScenarioParams) => void;
  /** Removes the disruption of the current kind (SC-03): the scenario equals the baseline. */
  resetScenarioToBaseline: () => void;
  /** Restores the current kind's default settings. */
  restoreScenarioDefaults: () => void;
  setScenarioView: (view: ScenarioView) => void;
  setScenarioMap: (model: ScenarioClosureMapModel | null) => void;
  setHoverScenario: (hover: HoverScenario | null) => void;

  setBreakpoint: (bp: Breakpoint) => void;
  toggleFilterPanel: (open?: boolean) => void;
  toggleInsights: (open?: boolean) => void;
  toggleMobileNav: (open?: boolean) => void;

  setMotionPreference: (pref: "system" | "reduced") => void;
  setSystemPrefersReducedMotion: (value: boolean) => void;

  setMapStatus: (status: MapStatus, error?: string | null) => void;
  setLayerStatus: (layerId: string, status: LayerStatus, message?: string) => void;
  issueMapCommand: (command: MapCommandInput) => void;
}

/** URL fields a scenario may change (SC-05). */
export type ScenarioField =
  | "commodity"
  | "partner"
  | "measure"
  | "store"
  | "port"
  | "scenarioYear"
  | "scenarioMonth"
  | "scenarioReduction"
  | "scenarioDuration"
  | "scenarioRecovery"
  | "scenarioSubstitution"
  | "productionReduction"
  | "portReduction"
  | "portMonths";

const SCENARIO_FIELDS: readonly ScenarioField[] = [
  "commodity",
  "partner",
  "measure",
  "store",
  "port",
  "scenarioYear",
  "scenarioMonth",
  "scenarioReduction",
  "scenarioDuration",
  "scenarioRecovery",
  "scenarioSubstitution",
  "productionReduction",
  "portReduction",
  "portMonths",
];

/** Country under the pointer on the Food Origins map (key = partner key or ISO code). */
export interface HoverPartner {
  key: string;
  name: string | null;
  x: number;
  y: number;
}

/** One partner on the Food Origins map (serialisable). */
export interface OriginsMapPartner {
  key: string;
  name: string;
  iso2: string | null;
  geometry: "polygon" | "point" | "none";
  point: [number, number] | null;
  /** Share of recorded imports (0–1) by the selected measure. */
  share: number;
  shareClass: number;
  /** Formatted value for tooltips, e.g. "12.3 kt". */
  valueText: string;
  /** Drawn as a connection to the UK (top-N). */
  flow: boolean;
  /** Line width in px (FO-03 linear scaling). */
  flowWidth: number;
  /**
   * Risk Explorer, water-stress fill (RK-02): index into the risk ramp of the partner's FAO class
   * (1 = no stress … 5 = critical), or null for a partner without a value (no-data hatch).
   */
  stressClass?: number | null;
  /**
   * Scenario Lab (Scenario A): the connection's baseline width, drawn as a dashed outline behind
   * the scenario's narrower connection, so the reduction is seen against what was recorded.
   */
  ghostWidth?: number;
}

export interface OriginsMapModel {
  commodityId: string;
  periodLabel: string;
  measure: Measure;
  partners: OriginsMapPartner[];
  /** Symbolic UK anchor (Natural Earth label point for the United Kingdom). Not a port. */
  ukAnchor: [number, number];
  /** What the partner fills show: share of recorded imports (default) or water stress (Risk Explorer). */
  fill?: "share" | "stress";
  /**
   * Where the map frames the data: the box around the UK and the connections drawn for the
   * commodity ([west, south, east, north], degrees). The map fits it when `key` changes (a new
   * commodity or the first view), and on request; never on a month or year change.
   */
  frame: { key: string; bbox: [number, number, number, number] } | null;
}

/** Store or council under the pointer on the Food Access map, with screen position for the tooltip. */
export interface HoverAccess {
  kind: "store" | "council" | "cluster" | "grocer";
  id: string;
  x: number;
  y: number;
}

/** Small area under the pointer in a deep profile, with screen position for the tooltip. */
export interface HoverArea {
  code: string;
  x: number;
  y: number;
}

/** Small areas picked from a chart: what was picked (for the chip) and the area codes. */
export interface AreaHighlight {
  label: string;
  codes: string[];
}

/** One small area drawn on the profile map: code, kind and WGS84 polygon rings. */
export interface ProfileMapArea {
  code: string;
  rings: number[][][];
}

/**
 * Local Authority Profiles small-area map (LP-06; serialisable, built by the feature from validated
 * data). The areas of the geography the measure is published on, each with a fixed class (or none:
 * the no-data hatch, P12). Classes index the basemap style's sequential colours from `firstColour`.
 */
export interface ProfileMapModel {
  lad: string;
  /** Changes when the geography or its areas change (the layer redraws its graphics). */
  key: string;
  areas: ProfileMapArea[];
  measure: AreaMeasure;
  classOf: Record<string, number | null>;
  classCount: number;
  /** First index into the sequential colours (5 classes use colours 1–5 of 6). */
  firstColour: number;
  selected: string | null;
  highlighted: string[];
  copyright: string;
}

/** One NI grocer from the FSA register on the supplementary layer (WGS84). */
export interface GrocerPoint {
  id: number;
  lon: number;
  lat: number;
}

/** One store on the proximity overlay (WGS84). */
export interface AccessPoint {
  id: number;
  lon: number;
  lat: number;
}

/** UK Food Access map view model (serialisable; built by the feature from validated data). */
export interface AccessMapModel {
  /**
   * UK Food Access; Local Authority Profiles (councils outlined, the selected council emphasised,
   * comparison councils dashed; no choropleth or proximity tool); or the Risk Explorer's community
   * access view (councils shaded by the Priority Places share on the risk ramp; no stores).
   */
  mode: "access" | "profile" | "risk" | "scenario";
  /** Comparison councils (profile mode). */
  compareCouncils: string[];
  /** NI grocers from the FSA register (S29) when the supplementary layer is on; never in any rate. */
  grocers: { points: GrocerPoint[]; copyright: string } | null;
  /** Store points for the map: a blob: URL of a compact GeoJSON built from the validated data. */
  storesUrl: string;
  /** SQL where clause for the store layer (store layers and retailers shown). */
  storeWhere: string;
  /** Attribution for the store layer (from the manifest; never hidden). */
  storesCopyright: string;
  /**
   * Where the map frames UK Food Access when it opens: the box around every mapped store (all
   * layers, so filters never move the camera). Fitted once per visit to the module.
   */
  frame: { key: string; bbox: [number, number, number, number] } | null;
  /** Council boundaries (display edition) from the manifest. */
  councilsUrl: string;
  councilsCopyright: string;
  /**
   * Council choropleth: class index → council codes; no-data codes; or null when the layer is off.
   * `ramp` "risk" draws the classes with the warm vulnerability ramp (Risk Explorer), else the teal one.
   */
  choropleth: { measure: string; classes: string[][]; noData: string[]; ramp?: "seq" | "risk" } | null;
  selectedStore: AccessPoint | null;
  selectedCouncil: string | null;
  proximity: {
    point: [number, number];
    radiusM: number;
    /** Radius ring in WGS84, drawn in the national grid of the nearest store. */
    ring: [number, number][];
    nearest: AccessPoint[];
  } | null;
}

/** One port on the Risk Explorer logistics map (serialisable). */
export interface RiskMapPort {
  locode: string;
  name: string;
  point: [number, number];
  /** Symbol radius in px (area ∝ the measure); 0 = no tonnage for the measure (drawn as a small ring). */
  radius: number;
  /** Formatted value for the tooltip, e.g. "12.6 Mt from abroad, 2025". */
  valueText: string;
  /** Linked to a UKFSR port-of-entry group (food, feed and drink imports, S03). */
  foodEntry: boolean;
  /**
   * Scenario Lab (Scenario D): the symbol radius after the capacity reduction; the baseline radius
   * is then drawn as a dashed ring around it.
   */
  scenarioRadius?: number;
}

/** Risk Explorer logistics map (RK-03; serialisable, built by the feature from validated data). */
export interface RiskMapModel {
  ports: RiskMapPort[];
  selectedPort: string | null;
  /** Measure and year the symbols show (part of the renderer signature). */
  portKey: string;
  /** Port symbol attribution (DfT; EMODnet locations). */
  portsCopyright: string;
  roads: { url: string; copyright: string } | null;
  /** Road corridors in Northern Ireland (OpenStreetMap, S38; shown with `roads`), or null when off or not published. */
  roadsNi: { url: string; copyright: string } | null;
  /** Railway lines in Northern Ireland (Translink NIR network, S37), or null when off or not published. */
  rail: { url: string; copyright: string } | null;
  /** Farming regions: outlines URL and, when a measure is on, the class (0–4) of each region id. */
  regions: { url: string; copyright: string; measure: string | null; classOf: Record<string, number> } | null;
  /** The UK (fitted once per visit to the view). */
  frame: { key: string; bbox: [number, number, number, number] } | null;
}

/** Port or farming region under the pointer on the logistics map, with screen position. */
export interface HoverRisk {
  kind: "port" | "region";
  id: string;
  x: number;
  y: number;
}

/** One small area on the closure map (Scenario B), WGS84. */
export interface ScenarioMapArea {
  code: string;
  point: [number, number];
  /** Symbol radius in px (area ∝ residents). */
  radius: number;
  /** Class (0–4) of the increase in straight-line distance; null when no supermarket remains in the data. */
  cls: number | null;
  /** The nearest supermarket before (the closed one) and after the closure. */
  from: [number, number];
  to: [number, number] | null;
}

/**
 * Scenario Lab supermarket-closure map (Scenario B; serialisable, built by the feature from the
 * validated closure inputs). The small areas whose nearest supermarket is the closed one, each
 * linked by a straight line (never a route) to its nearest supermarket before or after.
 */
export interface ScenarioClosureMapModel {
  /** Changes when the closed store changes (the camera frames it once). */
  key: string;
  view: ScenarioView;
  closed: { id: number; point: [number, number] } | null;
  areas: ScenarioMapArea[];
  /** Supermarkets that become the nearest for at least one area. */
  takeover: { id: number; point: [number, number] }[];
  frame: { key: string; bbox: [number, number, number, number] } | null;
}

/** Small area under the pointer on the closure map, with screen position. */
export interface HoverScenario {
  code: string;
  x: number;
  y: number;
}

/**
 * True when the trade map (partners and connections) is drawn: Food Origins, Seasonal, Risk
 * Explorer supply, and the Scenario Lab's international supply disruption (Scenario A).
 */
export function selectTradeMapModule(s: Pick<AppState, "module" | "riskView" | "scenarioKind">): boolean {
  return (
    s.module === "origins" ||
    s.module === "seasonal" ||
    (s.module === "risks" && s.riskView === "supply") ||
    (s.module === "scenarios" && s.scenarioKind === "import")
  );
}

/** True when the map can frame the recorded partners (a trade view with drawn connections). */
export function canFramePartners(
  s: Pick<AppState, "module" | "riskView" | "scenarioKind" | "originsMap">,
): boolean {
  return selectTradeMapModule(s) && Boolean(s.originsMap?.frame);
}

export const FLOW_COUNT_DEFAULT = 12;

/** Playback speeds (SS-03): 1× = 1.2 s per month. */
export const PLAY_SPEEDS = [0.5, 1, 2] as const;
export type PlaySpeed = (typeof PLAY_SPEEDS)[number];
export const PLAY_MONTH_MS = 1200;

/** Straight-line proximity defaults (SM-07): nearest 5 stores, 2 km radius (spec D6 proposes 1/2/5 km). */
export const PROXIMITY_COUNT_DEFAULT = 5;
export const PROXIMITY_RADIUS_KM_DEFAULT = 2;
export const PROXIMITY_RADIUS_KM_MAX = 20;

const DOCKED: readonly Breakpoint[] = ["desktop", "laptop"];
let commandSeq = 0;

export const initialState = {
  ...DEFAULT_URL_STATE,
  breakpoint: "desktop" as Breakpoint,
  layoutInitialised: false,
  filterPanelOpen: true,
  insightsOpen: true,
  mobileNavOpen: false,
  motionPreference: "system" as const,
  systemPrefersReducedMotion: false,
  mapStatus: "idle" as MapStatus,
  mapError: null,
  layerStatus: {},
  mapCommand: null,
  originsMap: null,
  hoverPartner: null,
  flowCount: FLOW_COUNT_DEFAULT,
  playing: false,
  playSpeed: 1 as PlaySpeed,
  basemapChoice: false,
  mapView: null,
  accessMap: null,
  hoverAccess: null,
  proximityPicking: false,
  proximityPoint: null,
  proximityCount: PROXIMITY_COUNT_DEFAULT,
  proximityRadiusKm: PROXIMITY_RADIUS_KM_DEFAULT,
  profileMap: null,
  hoverArea: null,
  areaHighlight: null,
  riskMap: null,
  hoverRisk: null,
  scenarioMap: null,
  hoverScenario: null,
};

export const useAppStore = create<AppState>()((set, get) => ({
  ...initialState,

  // Changing what is shown (module, time, commodity, measure, comparison) stops playback (SS-03).
  setModule: (module) => set({ module, mobileNavOpen: false, playing: false }),
  setMonth: (month) =>
    set({ month: month === null ? null : Math.min(12, Math.max(1, Math.round(month))), playing: false }),
  stepMonth: (delta) => {
    const current = get().month ?? (delta === 1 ? 0 : 13);
    const next = ((current - 1 + delta + 12) % 12) + 1;
    set({ month: next, playing: false });
  },
  // A new council clears its small-area selection and chart highlight, and leaves the comparison.
  setLad: (lad) =>
    set((s) =>
      s.lad === lad ? {} : { lad, area: null, areaHighlight: null, compare: cleanCompare(s.compare, lad) },
    ),
  setCommodity: (commodity) =>
    set((s) =>
      s.commodity === commodity ? {} : { commodity, partner: null, hoverPartner: null, playing: false },
    ),
  setPeriod: (period) => set({ period, playing: false }),
  setYear: (year) => set({ year, playing: false }),
  setYearMonth: (year, month) =>
    set({ year, month: Math.min(12, Math.max(1, Math.round(month))), playing: false }),
  setMeasure: (measure) => set({ measure, playing: false }),
  selectPartner: (partner) => set((s) => ({ partner: s.partner === partner ? null : partner })),
  setOriginsMap: (originsMap) => set({ originsMap }),
  setHoverPartner: (hoverPartner) => set({ hoverPartner }),
  setFlowCount: (n) => set({ flowCount: Math.min(25, Math.max(3, Math.round(n))) }),
  setCompareYear: (compareYear) => set({ compareYear, playing: false }),
  setCompareMonth: (compareMonth) =>
    set({
      compareMonth: compareMonth === null ? null : Math.min(12, Math.max(1, Math.round(compareMonth))),
      playing: false,
    }),
  setHeatmap: (heatmap) => set({ heatmap }),
  setPlaying: (playing) => set({ playing }),
  setPlaySpeed: (playSpeed) => set({ playSpeed }),
  playbackStep: (year, month) => set({ year, month: Math.min(12, Math.max(1, Math.round(month))) }),
  openOverlay: (overlay) => set({ overlay, mobileNavOpen: false }),
  closeOverlay: () => set({ overlay: "none" }),
  hydrateFromUrl: (state) =>
    set((s) => ({
      ...state,
      playing: false,
      // A chart outline and hover belong to the council and measure they were made on (back/forward).
      ...(state.lad !== s.lad || state.areaMeasure !== s.areaMeasure
        ? { areaHighlight: null, hoverArea: null }
        : {}),
    })),

  toggleStoreLayer: (layer) =>
    set((s) => ({
      storeLayers: STORE_LAYERS.filter((l) =>
        l === layer ? !s.storeLayers.includes(l) : s.storeLayers.includes(l),
      ),
    })),
  setStoreLayers: (layers) => set({ storeLayers: STORE_LAYERS.filter((l) => layers.includes(l)) }),
  setRetailers: (retailers) => set({ retailers: retailers === null ? null : [...new Set(retailers)].sort() }),
  setCouncilLayer: (councilLayer) => set({ councilLayer }),
  selectStore: (store) => set({ store }),
  selectCouncil: (code) =>
    set((s) => {
      const lad = code === null || s.lad === code ? null : code;
      return { lad, area: null, areaHighlight: null, compare: cleanCompare(s.compare, lad) };
    }),
  setAccessMap: (accessMap) => set({ accessMap }),
  setHoverAccess: (hoverAccess) => set({ hoverAccess }),
  setProximityPicking: (proximityPicking) => set({ proximityPicking }),
  setProximityPoint: (proximityPoint) => set({ proximityPoint, proximityPicking: false }),
  setProximityCount: (n) => set({ proximityCount: Math.min(20, Math.max(1, Math.round(n))) }),
  setProximityRadiusKm: (km) =>
    set({ proximityRadiusKm: Math.min(PROXIMITY_RADIUS_KM_MAX, Math.max(0.5, Math.round(km * 2) / 2)) }),
  setBasemap: (basemap) => set({ basemap }),
  setBasemapChoice: (basemapChoice) => set({ basemapChoice }),
  toggleCompare: (code) =>
    set((s) => ({
      compare: s.compare.includes(code)
        ? s.compare.filter((c) => c !== code)
        : cleanCompare([...s.compare, code], s.lad),
    })),
  setCompare: (codes) => set((s) => ({ compare: cleanCompare(codes, s.lad) })),
  setAreaMeasure: (areaMeasure) => set({ areaMeasure, areaHighlight: null }),
  selectArea: (code) => set((s) => ({ area: code === null || s.area === code ? null : code })),
  setNiGrocers: (niGrocers) => set({ niGrocers }),
  setProfileMap: (profileMap) => set({ profileMap }),
  setHoverArea: (hoverArea) => set({ hoverArea }),
  setAreaHighlight: (areaHighlight) => set({ areaHighlight }),
  // Each view has its own hover; changing view clears them so a tooltip never outlives its map.
  setRiskView: (riskView) =>
    set((s) =>
      s.riskView === riskView ? {} : { riskView, hoverRisk: null, hoverPartner: null, hoverAccess: null },
    ),
  setRiskFill: (riskFill) => set({ riskFill }),
  selectPort: (locode) => set((s) => ({ port: locode === null || s.port === locode ? null : locode })),
  setPortMeasure: (portMeasure) => set({ portMeasure }),
  setRoads: (roads) => set({ roads }),
  setRail: (rail) => set({ rail }),
  setFarmLayer: (farmLayer) => set({ farmLayer }),
  setPpfiMeasure: (ppfiMeasure) => set({ ppfiMeasure }),
  setRankNation: (rankNation) => set({ rankNation }),
  setRiskMap: (riskMap) => set({ riskMap }),
  setHoverRisk: (hoverRisk) => set({ hoverRisk }),
  // A new kind has its own map: hovers from the previous one are cleared.
  setScenarioKind: (scenarioKind) =>
    set((s) =>
      s.scenarioKind === scenarioKind
        ? {}
        : { scenarioKind, hoverScenario: null, hoverPartner: null, hoverAccess: null, hoverRisk: null },
    ),
  updateScenario: (patch) => {
    const next: Partial<AppState> = {};
    for (const key of SCENARIO_FIELDS)
      if (key in patch) (next as Record<string, unknown>)[key] = patch[key as keyof typeof patch];
    set(next);
  },
  applyScenario: (params) =>
    set((s) => ({
      ...stateFromParams(params),
      ...(params.kind !== s.scenarioKind
        ? { hoverScenario: null, hoverPartner: null, hoverAccess: null, hoverRisk: null }
        : {}),
    })),
  resetScenarioToBaseline: () => set((s) => baselineFor(s.scenarioKind)),
  restoreScenarioDefaults: () => set((s) => defaultsFor(s.scenarioKind)),
  setScenarioView: (scenarioView) => set({ scenarioView }),
  setScenarioMap: (scenarioMap) => set({ scenarioMap }),
  setHoverScenario: (hoverScenario) => set({ hoverScenario }),
  setMapView: (mapView) => {
    const prev = get().mapView;
    const same =
      prev &&
      Math.abs(prev.zoom - mapView.zoom) < 0.01 &&
      Math.abs(prev.center[0] - mapView.center[0]) < 1e-6 &&
      Math.abs(prev.center[1] - mapView.center[1]) < 1e-6;
    if (!same) set({ mapView });
  },

  setBreakpoint: (bp) => {
    const { layoutInitialised, breakpoint } = get();
    if (!layoutInitialised) {
      // First measurement decides the default layout (desktop/laptop: panels open).
      const docked = DOCKED.includes(bp);
      set({ breakpoint: bp, layoutInitialised: true, filterPanelOpen: docked, insightsOpen: docked });
      return;
    }
    if (bp === breakpoint) return;
    const docked = DOCKED.includes(bp);
    if (!docked) {
      // Overlay layouts show at most one panel at a time.
      const { filterPanelOpen, insightsOpen } = get();
      set({
        breakpoint: bp,
        filterPanelOpen: filterPanelOpen && !insightsOpen && bp !== "mobile",
        insightsOpen: false,
        mobileNavOpen: false,
      });
    } else {
      set({ breakpoint: bp, mobileNavOpen: false });
    }
  },
  toggleFilterPanel: (open) => {
    const next = open ?? !get().filterPanelOpen;
    const overlayLayout = !DOCKED.includes(get().breakpoint);
    set({
      filterPanelOpen: next,
      ...(next && overlayLayout ? { insightsOpen: false, mobileNavOpen: false } : {}),
    });
  },
  toggleInsights: (open) => {
    const next = open ?? !get().insightsOpen;
    const overlayLayout = !DOCKED.includes(get().breakpoint);
    set({
      insightsOpen: next,
      ...(next && overlayLayout ? { filterPanelOpen: false, mobileNavOpen: false } : {}),
    });
  },
  toggleMobileNav: (open) => set({ mobileNavOpen: open ?? !get().mobileNavOpen }),

  setMotionPreference: (motionPreference) => set({ motionPreference }),
  setSystemPrefersReducedMotion: (systemPrefersReducedMotion) => set({ systemPrefersReducedMotion }),

  setMapStatus: (mapStatus, mapError = null) => set({ mapStatus, mapError }),
  setLayerStatus: (layerId, status, message) =>
    set((s) => ({
      layerStatus: { ...s.layerStatus, [layerId]: { status, ...(message ? { message } : {}) } },
    })),
  issueMapCommand: (command) => set({ mapCommand: { ...command, id: ++commandSeq } as MapCommand }),
}));

/** True when either the OS or the in-app setting asks for reduced motion. */
export function selectReducedMotion(
  s: Pick<AppState, "motionPreference" | "systemPrefersReducedMotion">,
): boolean {
  return s.motionPreference === "reduced" || s.systemPrefersReducedMotion;
}

export function selectUrlState(s: AppState): UrlState {
  return {
    module: s.module,
    month: s.month,
    lad: s.lad,
    overlay: s.overlay,
    commodity: s.commodity,
    period: s.period,
    year: s.year,
    measure: s.measure,
    partner: s.partner,
    compareYear: s.compareYear,
    compareMonth: s.compareMonth,
    heatmap: s.heatmap,
    storeLayers: s.storeLayers,
    retailers: s.retailers,
    councilLayer: s.councilLayer,
    store: s.store,
    basemap: s.basemap,
    areaMeasure: s.areaMeasure,
    area: s.area,
    compare: s.compare,
    niGrocers: s.niGrocers,
    riskView: s.riskView,
    riskFill: s.riskFill,
    port: s.port,
    portMeasure: s.portMeasure,
    roads: s.roads,
    rail: s.rail,
    farmLayer: s.farmLayer,
    ppfiMeasure: s.ppfiMeasure,
    rankNation: s.rankNation,
    scenarioKind: s.scenarioKind,
    scenarioYear: s.scenarioYear,
    scenarioMonth: s.scenarioMonth,
    scenarioReduction: s.scenarioReduction,
    scenarioDuration: s.scenarioDuration,
    scenarioRecovery: s.scenarioRecovery,
    scenarioSubstitution: s.scenarioSubstitution,
    productionReduction: s.productionReduction,
    portReduction: s.portReduction,
    portMonths: s.portMonths,
    scenarioView: s.scenarioView,
  };
}

/**
 * Local scale (SH-08, SM-02): from this zoom level (about 1:144,000) stores are drawn individually,
 * councils as outlines, and imagery is offered. Below it stores are clustered and councils shaded.
 */
export const LOCAL_ZOOM = 12;

/** Modules that work at local scale, where the imagery basemap is offered (SH-08). */
export const IMAGERY_MODULES: readonly ModuleId[] = ["access", "profiles", "scenarios"];

/** True when the map is at local scale (stationary zoom ≥ LOCAL_ZOOM, with a small tolerance). */
export function selectLocalScale(s: Pick<AppState, "mapView">): boolean {
  return (s.mapView?.zoom ?? 0) >= LOCAL_ZOOM - 0.01;
}

/** True when imagery can be shown: a local-scale module, zoomed in to local scale. */
export function selectImageryAvailable(s: Pick<AppState, "module" | "mapView">): boolean {
  return IMAGERY_MODULES.includes(s.module) && selectLocalScale(s);
}

/**
 * The basemap style to load: the visitor's choice, except that imagery falls back to dark grey
 * outside local scale (it stays the choice and returns when they zoom in). Dark grey without a key.
 */
export function selectRequestedMapStyle(
  s: Pick<AppState, "basemap" | "basemapChoice" | "module" | "mapView">,
): MapStyle {
  if (!s.basemapChoice) return "dark";
  if (s.basemap === "imagery") return selectImageryAvailable(s) ? "imagery" : "dark";
  return s.basemap;
}

/**
 * The colour set for the data layers and legends: the requested style while its basemap works;
 * dark grey (the offline outline map's colours) when there is no key or the basemap failed.
 */
export function selectMapColourStyle(
  s: Pick<AppState, "basemap" | "basemapChoice" | "module" | "mapView" | "layerStatus">,
): MapStyle {
  if (s.layerStatus[BASEMAP_STATUS_ID]?.status === "error") return "dark";
  return selectRequestedMapStyle(s);
}

/** Reset helper for tests. */
export function resetAppStore(): void {
  useAppStore.setState({ ...initialState }, false);
}
