import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import type { LayerController, ViewLike } from "../types";

/** The view properties this controller reads (MapView). */
interface WatchableView extends ViewLike {
  stationary?: boolean;
  center?: { longitude?: number | null; latitude?: number | null } | null;
}

export interface ViewRest {
  zoom: number;
  center: [number, number];
}

/**
 * Reports the map's zoom and centre to the store each time the view comes to rest (map events →
 * typed store actions, ADR-03). The Food Access layers and the basemap choice use it for the
 * local-scale rule (SH-08, SM-02) and the proximity tool's "map centre" point (SM-07).
 * Creates no layers.
 */
export class ViewStateController implements LayerController {
  readonly id = "view-state";
  private handle: { remove(): void } | null = null;

  constructor(private readonly onRest: (rest: ViewRest) => void) {}

  activate(view: ViewLike): void {
    const v = view as WatchableView;
    this.handle?.remove();
    this.handle = reactiveUtils.watch(
      () => (v.stationary ? [v.zoom, v.center?.longitude ?? null, v.center?.latitude ?? null] : null),
      (rest) => {
        if (!rest) return;
        const [zoom, lon, lat] = rest;
        if (typeof zoom !== "number" || typeof lon !== "number" || typeof lat !== "number") return;
        this.onRest({ zoom: Math.round(zoom * 100) / 100, center: [lon, lat] });
      },
      { initial: true },
    );
  }

  deactivate(): void {
    this.handle?.remove();
    this.handle = null;
  }
}
