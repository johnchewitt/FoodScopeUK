import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import UniqueValueInfo from "@arcgis/core/renderers/support/UniqueValueInfo";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import type { AppState } from "@/state/store";
import { BASEMAP_STATUS_ID, REFERENCE_LAYER_ID } from "../layerIds";
import type { LayerController, LayerStatusReporter, ViewLike } from "../types";

/** Palette values mirror src/styles/tokens.css (ArcGIS symbols need concrete colours). */
const TEAL: [number, number, number] = [10, 68, 74];
const CYAN: [number, number, number] = [73, 234, 216];
const GREEN: [number, number, number] = [161, 235, 131];

function buildRenderer(withBasemap: boolean): UniqueValueRenderer {
  const countryFill = new SimpleFillSymbol({
    color: [...TEAL, withBasemap ? 0 : 0.55],
    outline: { color: [...CYAN, withBasemap ? 0.22 : 0.42], width: 0.6 },
  });
  // The UK is the focal geography of every module, so it is outlined in green.
  // This is emphasis for orientation, not a data encoding.
  const ukFill = new SimpleFillSymbol({
    color: [...TEAL, withBasemap ? 0.12 : 0.85],
    outline: { color: [...GREEN, 0.95], width: 1.3 },
  });
  return new UniqueValueRenderer({
    field: "name",
    defaultSymbol: countryFill,
    uniqueValueInfos: [
      new UniqueValueInfo({ value: "United Kingdom", symbol: ukFill, label: "United Kingdom" }),
    ],
  });
}

const OFFLINE_GLOW = "bloom(0.9, 0.4px, 0.2)";

/**
 * Natural Earth 1:110m country outlines (S24) used as the offline base map, and as subtle
 * outlines over the Esri basemap when a key is configured. If the Esri basemap fails to
 * load, the outlines switch to the offline style so the map is still legible.
 * Display-only reference geometry.
 */
export class ReferenceOutlinesController implements LayerController {
  readonly id = REFERENCE_LAYER_ID;
  private view: ViewLike | null = null;
  private report: LayerStatusReporter | null = null;
  private layer: GeoJSONLayer | null = null;
  private url: string | null = null;
  private failure: string | null = null;
  private readonly withBasemap: boolean;
  private basemapFailed = false;

  constructor(withBasemap: boolean) {
    this.withBasemap = withBasemap;
  }

  activate(view: ViewLike, report: LayerStatusReporter): void {
    this.view = view;
    this.report = report;
    if (this.failure) report("error", this.failure);
    else if (this.url) this.addLayer();
    else report("loading");
  }

  /** Called when the data manifest resolves (or fails). */
  setSource(url: string | null, failure?: string): void {
    if (failure) {
      this.failure = failure;
      this.report?.("error", failure);
      return;
    }
    if (url === this.url) return;
    this.url = url;
    this.failure = null;
    if (this.view && url) this.addLayer();
  }

  update(state: AppState): void {
    if (!this.withBasemap || this.basemapFailed) return;
    if (state.layerStatus[BASEMAP_STATUS_ID]?.status !== "error") return;
    this.basemapFailed = true;
    if (this.layer) {
      this.layer.renderer = buildRenderer(false);
      this.layer.effect = OFFLINE_GLOW;
    }
  }

  deactivate(view: ViewLike): void {
    if (this.layer) {
      view.map?.remove(this.layer);
      this.layer.destroy();
    }
    this.layer = null;
    this.view = null;
    this.report = null;
  }

  /** True while the outlines are drawn over a working Esri basemap. */
  private get overBasemap(): boolean {
    return this.withBasemap && !this.basemapFailed;
  }

  private addLayer(): void {
    const view = this.view;
    const report = this.report;
    if (!view || !report || !this.url) return;
    if (this.layer) {
      view.map?.remove(this.layer);
      this.layer.destroy();
    }
    report("loading");
    const layer = new GeoJSONLayer({
      id: REFERENCE_LAYER_ID,
      url: this.url,
      title: "Country outlines (Natural Earth 1:110m)",
      copyright: "Made with Natural Earth",
      definitionExpression: "name <> 'Antarctica'",
      renderer: buildRenderer(this.overBasemap),
      effect: this.overBasemap ? null : OFFLINE_GLOW,
      popupEnabled: false,
      legendEnabled: false,
      listMode: "hide",
    });
    this.layer = layer;
    view.map?.add(layer);
    view
      .whenLayerView(layer)
      .then(() => {
        if (this.layer === layer) report("ready");
      })
      .catch((err: unknown) => {
        if (this.layer !== layer) return;
        report("error", err instanceof Error ? err.message : "Layer failed to load");
      });
  }
}
