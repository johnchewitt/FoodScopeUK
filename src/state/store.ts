import { create } from "zustand";
import type { ModuleId } from "@/app/modules";
import { type Breakpoint } from "@/map/layoutMetrics";
import {
  DEFAULT_URL_STATE,
  type HeatmapMode,
  type Measure,
  type Overlay,
  type PeriodMode,
  type UrlState,
} from "./urlState";

export type MapStatus = "idle" | "loading" | "ready" | "error";
export type LayerStatus = "loading" | "ready" | "error";

export type MapCommand =
  | { id: number; type: "goTo"; target: "world" | "uk" }
  | { id: number; type: "zoom"; direction: "in" | "out" };

type MapCommandInput = { type: "goTo"; target: "world" | "uk" } | { type: "zoom"; direction: "in" | "out" };

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
}

export const FLOW_COUNT_DEFAULT = 12;

/** Playback speeds (SS-03): 1× = 1.2 s per month. */
export const PLAY_SPEEDS = [0.5, 1, 2] as const;
export type PlaySpeed = (typeof PLAY_SPEEDS)[number];
export const PLAY_MONTH_MS = 1200;

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
  };
}

/** Reset helper for tests. */
export function resetAppStore(): void {
  useAppStore.setState({ ...initialState }, false);
}
