import { create } from "zustand";
import type { ModuleId } from "@/app/modules";
import { type Breakpoint } from "@/map/layoutMetrics";
import { BASEMAP_STATUS_ID } from "@/map/layerIds";
import { STORE_LAYERS, type StoreLayer } from "@/analysis/retail";
import type { MapStyle } from "@/styles/palette";
import {
  DEFAULT_URL_STATE,
  type BasemapId,
  type CouncilLayer,
  type HeatmapMode,
  type Measure,
  type Overlay,
  type PeriodMode,
  type UrlState,
} from "./urlState";

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
}

export interface OriginsMapModel {
  commodityId: string;
  periodLabel: string;
  measure: Measure;
  partners: OriginsMapPartner[];
  /** Symbolic UK anchor (Natural Earth label point for the United Kingdom). Not a port. */
  ukAnchor: [number, number];
  /**
   * Where the map frames the data: the box around the UK and the connections drawn for the
   * commodity ([west, south, east, north], degrees). The map fits it when `key` changes (a new
   * commodity or the first view), and on request; never on a month or year change.
   */
  frame: { key: string; bbox: [number, number, number, number] } | null;
}

/** Store or council under the pointer on the Food Access map, with screen position for the tooltip. */
export interface HoverAccess {
  kind: "store" | "council" | "cluster";
  id: string;
  x: number;
  y: number;
}

/** One store on the proximity overlay (WGS84). */
export interface AccessPoint {
  id: number;
  lon: number;
  lat: number;
}

/** UK Food Access map view model (serialisable; built by the feature from validated data). */
export interface AccessMapModel {
  /** Store points for the map: a blob: URL of a compact GeoJSON built from the validated data. */
  storesUrl: string;
  /** SQL where clause for the store layer (store layers and retailers shown). */
  storeWhere: string;
  /** Attribution for the store layer (from the manifest; never hidden). */
  storesCopyright: string;
  /** Council boundaries (display edition) from the manifest. */
  councilsUrl: string;
  councilsCopyright: string;
  /** Council choropleth: class index → council codes; no-data codes; or null when the layer is off. */
  choropleth: { measure: string; classes: string[][]; noData: string[] } | null;
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

/** True when the map can frame the recorded partners (a trade view with drawn connections). */
export function canFramePartners(s: Pick<AppState, "module" | "originsMap">): boolean {
  return (s.module === "origins" || s.module === "seasonal") && Boolean(s.originsMap?.frame);
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
  setLad: (lad) => set({ lad }),
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
  hydrateFromUrl: (state) => set({ ...state, playing: false }),

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
  selectCouncil: (code) => set((s) => ({ lad: code === null || s.lad === code ? null : code })),
  setAccessMap: (accessMap) => set({ accessMap }),
  setHoverAccess: (hoverAccess) => set({ hoverAccess }),
  setProximityPicking: (proximityPicking) => set({ proximityPicking }),
  setProximityPoint: (proximityPoint) => set({ proximityPoint, proximityPicking: false }),
  setProximityCount: (n) => set({ proximityCount: Math.min(20, Math.max(1, Math.round(n))) }),
  setProximityRadiusKm: (km) =>
    set({ proximityRadiusKm: Math.min(PROXIMITY_RADIUS_KM_MAX, Math.max(0.5, Math.round(km * 2) / 2)) }),
  setBasemap: (basemap) => set({ basemap }),
  setBasemapChoice: (basemapChoice) => set({ basemapChoice }),
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
  };
}

/**
 * Local scale (SH-08, SM-02): from this zoom level (about 1:144,000) stores are drawn individually,
 * councils as outlines, and imagery is offered. Below it stores are clustered and councils shaded.
 */
export const LOCAL_ZOOM = 12;

/** Modules that work at local scale, where the imagery basemap is offered (SH-08). */
export const IMAGERY_MODULES: readonly ModuleId[] = ["access", "profiles"];

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
