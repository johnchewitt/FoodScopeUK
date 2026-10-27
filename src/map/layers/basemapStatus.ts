import { selectRequestedMapStyle, type AppState } from "@/state/store";
import type { MapStyle } from "@/styles/palette";
import { BASEMAP_STATUS_ID } from "../layerIds";
import type { LayerController, LayerStatusReporter, ViewLike } from "../types";

interface Loadable {
  load(): Promise<unknown>;
}

/** The parts of an `@arcgis/core/Basemap` this controller reads (structural, for unit tests). */
export interface LoadableBasemap extends Loadable {
  baseLayers: { toArray(): Loadable[] };
  referenceLayers: { toArray(): Loadable[] };
}

/** Creates the Esri basemap for a style (null without an API key). */
export type BasemapFactory = (style: MapStyle) => LoadableBasemap | null;

export const BASEMAP_FAILED_MESSAGE =
  "The Esri basemap could not be loaded, so the map shows country outlines only.";

/**
 * Owns the Esri basemap (SH-08, ADR-03, ADR-0022):
 * - swaps `map.basemap` when the requested style changes (the visitor's choice; the detailed
 *   styles only where the map draws lines and points), keeping the `apiKeys.basemapStyles`
 *   registration (ADR-0011) untouched;
 * - reports whether the current basemap actually loaded, so the UI never claims a basemap the
 *   visitor cannot see. A view becomes ready even when its basemap's layers fail, so view-ready
 *   alone is not evidence. A failed style falls back to the reference outlines (that controller
 *   follows this status) until another style loads.
 * Without an API key (no factory result) it does nothing and the offline outline map is used.
 */
export class BasemapStatusController implements LayerController {
  readonly id = BASEMAP_STATUS_ID;
  private readonly create: BasemapFactory;
  private style: MapStyle | null;
  private basemap: LoadableBasemap | null;
  private view: ViewLike | null = null;
  private report: LayerStatusReporter | null = null;
  private generation = 0;

  /**
   * @param create builds a basemap for a style.
   * @param initial the basemap the map was created with, and its style (null without a key).
   */
  constructor(create: BasemapFactory, initial: { style: MapStyle; basemap: LoadableBasemap | null }) {
    this.create = create;
    this.style = initial.basemap ? initial.style : null;
    this.basemap = initial.basemap;
  }

  activate(view: ViewLike, report: LayerStatusReporter): void {
    this.view = view;
    this.report = report;
    this.mark();
    if (this.basemap) this.track(this.basemap);
  }

  update(state: AppState): void {
    if (!this.view || !this.basemap || !state.basemapChoice) return;
    const style = selectRequestedMapStyle(state);
    if (style === this.style) return;
    const next = this.create(style);
    if (!next) return;
    this.style = style;
    this.basemap = next;
    if (this.view.map) this.view.map.basemap = next;
    this.mark();
    this.track(next);
  }

  deactivate(): void {
    this.generation++;
    this.view = null;
    this.report = null;
  }

  /** The loaded style on the view container (`data-basemap-style`), for tests and live checks. */
  private mark(): void {
    const container = (this.view as { container?: HTMLElement | null } | null)?.container;
    if (container && this.style) container.dataset.basemapStyle = this.style;
  }

  private track(basemap: LoadableBasemap): void {
    const report = this.report;
    if (!report) return;
    const run = ++this.generation;
    report("loading");
    basemap
      .load()
      .then(() =>
        Promise.all(
          [...basemap.baseLayers.toArray(), ...basemap.referenceLayers.toArray()].map((layer) =>
            layer.load(),
          ),
        ),
      )
      .then(
        () => {
          if (run === this.generation) report("ready");
        },
        () => {
          if (run === this.generation) report("error", BASEMAP_FAILED_MESSAGE);
        },
      );
  }
}
