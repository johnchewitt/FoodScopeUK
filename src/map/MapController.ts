import type { StoreApi, UseBoundStore } from "zustand";
import { selectReducedMotion, type AppState, type MapCommand } from "@/state/store";
import { getModule } from "@/app/modules";
import { computeViewPadding, paddingEquals } from "./layoutMetrics";
import { FLIGHT_DURATION_MS, GO_TO_TARGETS, type LayerController, type ViewLike } from "./types";

type Store = UseBoundStore<StoreApi<AppState>>;

/**
 * Owns the bridge between React state and the ArcGIS view (ADR-03):
 * store → view (padding, camera commands, layer updates); never the other way round
 * except via typed store actions (status reports).
 */
export class MapController {
  private view: ViewLike | null = null;
  private unsubscribe: (() => void) | null = null;
  private lastCommandId: number | null = null;
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

  private sync(state: AppState): void {
    const view = this.view;
    if (!view) return;

    const padding = computeViewPadding({
      breakpoint: state.breakpoint,
      filterPanelOpen: state.filterPanelOpen,
      insightsOpen: state.insightsOpen,
      timelineVisible: getModule(state.module).usesTimeline,
    });
    if (!paddingEquals(view.padding, padding)) view.padding = padding;

    if (state.mapCommand && state.mapCommand.id !== this.lastCommandId) {
      this.lastCommandId = state.mapCommand.id;
      this.run(state.mapCommand, selectReducedMotion(state));
    }

    for (const layer of this.layers) layer.update?.(state);
  }

  private run(command: MapCommand, reducedMotion: boolean): void {
    const view = this.view;
    if (!view) return;
    const options = reducedMotion ? { animate: false } : { animate: true, duration: FLIGHT_DURATION_MS };
    let target: unknown;
    if (command.type === "goTo") target = GO_TO_TARGETS[command.target];
    else target = { zoom: Math.round(view.zoom) + (command.direction === "in" ? 1 : -1) };
    view
      .goTo(target, command.type === "zoom" && !reducedMotion ? { animate: true, duration: 300 } : options)
      .catch((err: unknown) => {
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
