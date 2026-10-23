import { create } from "zustand";
import type { ModuleId } from "@/app/modules";
import { type Breakpoint } from "@/map/layoutMetrics";
import { DEFAULT_URL_STATE, type Overlay, type UrlState } from "./urlState";

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

  // Actions
  setModule: (module: ModuleId) => void;
  setMonth: (month: number | null) => void;
  stepMonth: (delta: 1 | -1) => void;
  setLad: (lad: string | null) => void;
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
};

export const useAppStore = create<AppState>()((set, get) => ({
  ...initialState,

  setModule: (module) => set({ module, mobileNavOpen: false }),
  setMonth: (month) => set({ month: month === null ? null : Math.min(12, Math.max(1, Math.round(month))) }),
  stepMonth: (delta) => {
    const current = get().month ?? (delta === 1 ? 0 : 13);
    const next = ((current - 1 + delta + 12) % 12) + 1;
    set({ month: next });
  },
  setLad: (lad) => set({ lad }),
  openOverlay: (overlay) => set({ overlay, mobileNavOpen: false }),
  closeOverlay: () => set({ overlay: "none" }),
  hydrateFromUrl: (state) => set({ ...state }),

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
  return { module: s.module, month: s.month, lad: s.lad, overlay: s.overlay };
}

/** Reset helper for tests. */
export function resetAppStore(): void {
  useAppStore.setState({ ...initialState }, false);
}
