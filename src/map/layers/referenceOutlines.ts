import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import UniqueValueInfo from "@arcgis/core/renderers/support/UniqueValueInfo";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import { hexToRgb } from "@/analysis/colour";
import { selectMapColourStyle, type AppState } from "@/state/store";
import { MAP_COLOURS, type MapStyle } from "@/styles/palette";
import { BASEMAP_STATUS_ID, REFERENCE_LAYER_ID } from "../layerIds";
import type { LayerController, LayerStatusReporter, ViewLike } from "../types";

/** Palette values mirror src/styles/tokens.css (ArcGIS symbols need concrete colours). */
const TEAL: [number, number, number] = [10, 68, 74];
const CYAN: [number, number, number] = [73, 234, 216];
const GREEN: [number, number, number] = [161, 235, 131];

/** "offline" = no Esri basemap (no key, or the basemap failed): the outlines are the map. */
type OutlineMode = MapStyle | "offline";

function buildRenderer(mode: OutlineMode): UniqueValueRenderer {
  const offline = mode === "offline";
  const colours = MAP_COLOURS[offline ? "dark" : mode];
  const line = offline ? CYAN : hexToRgb(colours.countryLine);
  const uk = offline ? GREEN : hexToRgb(colours.ukLine);
  const countryFill = new SimpleFillSymbol({
    color: [...TEAL, offline ? 0.55 : 0],
    outline: { color: [...line, offline ? 0.42 : colours.countryLineAlpha], width: 0.6 },
  });
  // The UK is the focal geography of every module, so it is outlined (green on dark styles).
  // This is emphasis for orientation, not a data encoding.
  const ukFill = new SimpleFillSymbol({
    color: [...TEAL, offline ? 0.85 : mode === "light" ? 0.06 : 0.12],
    outline: { color: [...uk, 0.95], width: 1.3 },
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
 * outlines over the Esri basemap when a key is configured, coloured for the basemap style
 * (SH-08). If the Esri basemap fails to load, the outlines switch to the offline style so the
 * map is still legible, and back when another style loads. Display-only reference geometry.
 */
export class ReferenceOutlinesController implements LayerController {
  readonly id = REFERENCE_LAYER_ID;
  private view: ViewLike | null = null;
  private report: LayerStatusReporter | null = null;
  private layer: GeoJSONLayer | null = null;
  private url: string | null = null;
  private failure: string | null = null;
  private readonly withBasemap: boolean;
  private mode: OutlineMode;

  constructor(withBasemap: boolean) {
    this.withBasemap = withBasemap;
    this.mode = withBasemap ? "dark" : "offline";
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
    if (!this.withBasemap) return;
    const failed = state.layerStatus[BASEMAP_STATUS_ID]?.status === "error";
    const mode: OutlineMode = failed ? "offline" : selectMapColourStyle(state);
    if (mode === this.mode) return;
    this.mode = mode;
    if (this.layer) {
      this.layer.renderer = buildRenderer(mode);
      this.layer.effect = mode === "offline" ? OFFLINE_GLOW : null;
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
      renderer: buildRenderer(this.mode),
      effect: this.mode === "offline" ? OFFLINE_GLOW : null,
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
