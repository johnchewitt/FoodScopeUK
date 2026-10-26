import type { StoreApi, UseBoundStore } from "zustand";
import { fitBBox, type BBox, type FitOptions } from "@/analysis/frame";
import {
  LOCAL_ZOOM,
  selectReducedMotion,
  selectTradeMapModule,
  type AppState,
  type MapCommand,
} from "@/state/store";
import { getModule } from "@/app/modules";
import {
  computeViewPadding,
  framingPadding,
  paddingEquals,
  TIMELINE_H,
  TIMELINE_H_SEASONAL,
} from "./layoutMetrics";
import { FLIGHT_DURATION_MS, GO_TO_TARGETS, type LayerController, type ViewLike } from "./types";

type Store = UseBoundStore<StoreApi<AppState>>;

type FrameFamily =
  | "trade"
  | "access"
  | "profile"
  | "riskLogistics"
  | "riskAccess"
  | "scenarioClosure"
  | "scenarioPort"
  | "scenarioUk"
  | null;

/**
 * Which frame a view uses: the trade views (Food Origins, Seasonal Supply, Risk Explorer supply)
 * share one, so switching between them keeps the camera while the commodity is the same; UK Food
 * Access, Local Authority Profiles and the other two Risk Explorer views have their own; other
 * modules none.
 */
function frameFamily(state: Pick<AppState, "module" | "riskView" | "scenarioKind">): FrameFamily {
  if (selectTradeMapModule(state)) return "trade";
  if (state.module === "access") return "access";
  if (state.module === "profiles") return "profile";
  if (state.module === "risks") return state.riskView === "logistics" ? "riskLogistics" : "riskAccess";
  if (state.module === "scenarios")
    return state.scenarioKind === "closure"
      ? "scenarioClosure"
      : state.scenarioKind === "port"
        ? "scenarioPort"
        : "scenarioUk";
  return null;
}

/** The whole UK (with Shetland), for the national scenarios (Scenario C). */
const UK_FRAME: { key: string; bbox: BBox } = { key: "uk", bbox: [-8.3, 49.8, 1.9, 60.9] };

/** The frame the current view asks for, if any. */
function moduleFrame(state: AppState): { key: string; bbox: BBox } | null {
  const family = frameFamily(state);
  if (family === "trade") return state.originsMap?.frame ?? null;
  if (family === "access") return state.accessMap?.mode === "access" ? state.accessMap.frame : null;
  if (family === "profile") return state.accessMap?.mode === "profile" ? state.accessMap.frame : null;
  if (family === "riskLogistics") return state.riskMap?.frame ?? null;
  if (family === "riskAccess") return state.accessMap?.mode === "risk" ? state.accessMap.frame : null;
  if (family === "scenarioClosure") return state.scenarioMap?.frame ?? null;
  if (family === "scenarioPort") return state.riskMap?.frame ?? null;
  if (family === "scenarioUk") return UK_FRAME;
  return null;
}

/**
 * Trade frames keep fitBBox's minimum span (a single nearby partner still shows context); UK Food
 * Access fits the box around its stores as it is. Local Authority Profiles fits one council, so it
 * may zoom past the national cap (a city council fills the map at about zoom 11); the cap stops a
 * very small council (City of London) being framed at street level.
 */
export const PROFILE_MAX_ZOOM = 13;
const FIT_OPTIONS: Partial<Record<NonNullable<FrameFamily>, FitOptions>> = {
  access: { minSpanLon: 0, minSpanLat: 0 },
  profile: { minSpanLon: 0, minSpanLat: 0, maxZoom: PROFILE_MAX_ZOOM },
  riskLogistics: { minSpanLon: 0, minSpanLat: 0 },
  riskAccess: { minSpanLon: 0, minSpanLat: 0 },
  // A closure frames the areas around one supermarket: at least about 6 km across, never street level.
  scenarioClosure: { minSpanLon: 0.09, minSpanLat: 0.055, maxZoom: PROFILE_MAX_ZOOM },
  scenarioPort: { minSpanLon: 0, minSpanLat: 0 },
  scenarioUk: { minSpanLon: 0, minSpanLat: 0 },
};

/**
 * Owns the bridge between React state and the ArcGIS view (ADR-03):
 * store → view (padding, camera commands, layer updates); never the other way round
 * except via typed store actions (status reports).
 *
 * Framing: when a trade view first draws a commodity (or the commodity changes), the camera fits
 * the UK and its drawn connections into the area left free by the panels. It never moves on a
 * month, year or measure change, so it does not fight a user who has panned or zoomed; "Fit to
 * recorded partners" re-applies the frame on request. UK Food Access fits its mapped stores once
 * when it opens, unless the map is already at local scale (a store or postcode already chosen).
 * Local Authority Profiles fits the selected council (or the UK) on opening and whenever the
 * council changes (LP-01 fly-to), whatever the scale. The Risk Explorer's supply view frames like
 * Food Origins; its logistics and community access views fit the UK once per visit.
 */
export class MapController {
  private view: ViewLike | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastCommandId: number | null = null;
  private lastFrameKey: string | null = null;
  private lastFrameFamily: FrameFamily = null;
  private framedOnce = false;
  private syncing = false;
  private resync = false;
  private readonly store: Store;
  private readonly layers: LayerController[];

  constructor(store: Store, layers: LayerController[]) {
    this.store = store;
    this.layers = layers;
  }

  attach(view: ViewLike): void {
    if (this.view) this.detach();
    this.view = view;
    const report = (id: string) => (status: "loading" | "ready" | "error", message?: string) =>
      this.store.getState().setLayerStatus(id, status, message);
    for (const layer of this.layers) layer.activate(view, report(layer.id));

    // Commands issued before the view was ready are not replayed.
    this.lastCommandId = this.store.getState().mapCommand?.id ?? null;
    this.sync(this.store.getState());
    this.unsubscribe = this.store.subscribe((state) => this.sync(state));
  }

  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.view) for (const layer of this.layers) layer.deactivate(this.view);
    this.view = null;
  }

  get attached(): boolean {
    return this.view !== null;
  }

  /**
   * Store → view. A controller that reports a status inside its update changes the store, which
   * calls sync again: that call is deferred until this one ends and then runs with the latest
   * state, so no controller is updated inside another or with an older state after a newer one.
   */
  private sync(state: AppState): void {
    if (this.syncing) {
      this.resync = true;
      return;
    }
    this.syncing = true;
    try {
      this.syncOnce(state);
    } finally {
      this.syncing = false;
    }
    if (this.resync) {
      this.resync = false;
      this.sync(this.store.getState());
    }
  }

  private syncOnce(state: AppState): void {
    const view = this.view;
    if (!view) return;

    const padding = computeViewPadding({
      breakpoint: state.breakpoint,
      filterPanelOpen: state.filterPanelOpen,
      insightsOpen: state.insightsOpen,
      timelineVisible: getModule(state.module).usesTimeline,
      timelineHeight: state.module === "seasonal" ? TIMELINE_H_SEASONAL : TIMELINE_H,
    });
    if (!paddingEquals(view.padding, padding)) view.padding = padding;

    if (state.mapCommand && state.mapCommand.id !== this.lastCommandId) {
      this.lastCommandId = state.mapCommand.id;
      this.run(state.mapCommand, selectReducedMotion(state), state);
    }

    const frame = moduleFrame(state);
    const family = frameFamily(state);
    // Each visit to a family is framed afresh (e.g. back from UK Food Access to Food Origins).
    if (family !== this.lastFrameFamily) this.lastFrameKey = null;
    this.lastFrameFamily = family;
    if (frame && frame.key !== this.lastFrameKey) {
      if (state.module === "access" && view.zoom >= LOCAL_ZOOM - 0.01) {
        // Already looking at local detail: leave the camera where the visitor put it.
        this.lastFrameKey = frame.key;
      } else if (
        // The first frame replaces the default world view instantly; later ones fly (unless reduced).
        this.fit(
          frame.bbox,
          !this.framedOnce || selectReducedMotion(state),
          state,
          family ? FIT_OPTIONS[family] : undefined,
        )
      ) {
        this.lastFrameKey = frame.key;
        this.framedOnce = true;
      }
    }

    for (const layer of this.layers) layer.update?.(state);
  }

  private run(command: MapCommand, reducedMotion: boolean, state: AppState): void {
    const view = this.view;
    if (!view) return;
    if (command.type === "goTo" && command.target === "partners") {
      const frame = selectTradeMapModule(state) ? state.originsMap?.frame : null;
      if (frame) this.fit(frame.bbox, reducedMotion, state);
      return;
    }
    const options = reducedMotion ? { animate: false } : { animate: true, duration: FLIGHT_DURATION_MS };
    if (command.type === "focusCouncil") {
      // Councils are drawn (and their extents known) by a layer controller.
      for (const layer of this.layers) if (layer.handleCommand?.(command, { reducedMotion })) return;
      return;
    }
    if (command.type === "goToPoint") {
      this.goTo({ center: command.center, zoom: command.zoom }, options);
      return;
    }
    let target: unknown;
    if (command.type === "goTo")
      target = command.target === "partners" ? null : GO_TO_TARGETS[command.target];
    else target = { zoom: Math.round(view.zoom) + (command.direction === "in" ? 1 : -1) };
    if (!target) return;
    this.goTo(target, command.type === "zoom" && !reducedMotion ? { animate: true, duration: 300 } : options);
  }

  /** Fits a [west, south, east, north] box into the unpadded part of the view; false if it cannot yet. */
  private fit(bbox: BBox, instant: boolean, state: AppState, options?: FitOptions): boolean {
    const view = this.view;
    if (!view || !view.width || !view.height) return false;
    const target = fitBBox(
      bbox,
      {
        width: view.width,
        height: view.height,
        padding: view.padding,
        framePadding: framingPadding(view.padding, state.breakpoint),
      },
      options,
    );
    this.goTo(target, instant ? { animate: false } : { animate: true, duration: FLIGHT_DURATION_MS });
    return true;
  }

  private goTo(target: unknown, options: { animate?: boolean; duration?: number }): void {
    this.view?.goTo(target, options).catch((err: unknown) => {
      // Interrupted navigation (a newer goTo) is expected; anything else is reported.
      if (err instanceof Error && err.name === "AbortError") return;
      if (
        typeof err === "object" &&
        err &&
        "name" in err &&
        (err as { name: string }).name === "view:goto-interrupted"
      )
        return;
      console.warn("Map navigation failed", err);
    });
  }
}
