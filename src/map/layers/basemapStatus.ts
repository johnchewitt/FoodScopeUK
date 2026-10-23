import { BASEMAP_STATUS_ID } from "../layerIds";
import type { LayerController, LayerStatusReporter } from "../types";

interface Loadable {
  load(): Promise<unknown>;
}

/** The parts of an `@arcgis/core/Basemap` this controller reads (structural, for unit tests). */
export interface LoadableBasemap extends Loadable {
  baseLayers: { toArray(): Loadable[] };
  referenceLayers: { toArray(): Loadable[] };
}

export const BASEMAP_FAILED_MESSAGE =
  "The Esri basemap could not be loaded, so the map shows country outlines only.";

/**
 * Reports whether the Esri basemap actually loaded, so the UI never claims a basemap the
 * visitor cannot see. A view becomes ready even when its basemap's layers fail, so
 * view-ready alone is not evidence. Creates and changes no layers.
 */
export class BasemapStatusController implements LayerController {
  readonly id = BASEMAP_STATUS_ID;
  private readonly basemap: LoadableBasemap | null;
  private generation = 0;

  constructor(basemap: LoadableBasemap | null) {
    this.basemap = basemap;
  }

  activate(_view: unknown, report: LayerStatusReporter): void {
    const basemap = this.basemap;
    if (!basemap) return;
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

  deactivate(): void {
    this.generation++;
  }
}
