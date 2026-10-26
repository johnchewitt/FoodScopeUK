import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import UniqueValueInfo from "@arcgis/core/renderers/support/UniqueValueInfo";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { hexToRgb } from "@/analysis/colour";
import {
  selectMapColourStyle,
  selectMapModule,
  type AppState,
  type HoverRisk,
  type RiskMapModel,
} from "@/state/store";
import { MAP_COLOURS, type MapStyle } from "@/styles/palette";
import { ensureHoverHighlight, HOVER_HIGHLIGHT } from "../highlight";
import { createCreditLayer, type CreditLayer } from "./creditLayer";
import { portGraphicsData } from "./portSymbols";
import {
  RISK_PORTS_CREDIT_LAYER_ID,
  RISK_PORTS_LAYER_ID,
  RISK_RAIL_LAYER_ID,
  RISK_REGIONS_LAYER_ID,
  RISK_ROADS_LAYER_ID,
  RISK_ROADS_NI_LAYER_ID,
} from "../layerIds";
import type { HitResult, LayerController, LayerStatusReporter, ViewLike, ViewPointerEvent } from "../types";

/**
 * Risk Explorer logistics map (RK-03), bottom to top:
 * - agricultural statistics regions (Defra regions of England, the devolved countries), outlined,
 *   and shaded by a farming density in five fixed classes when a measure is chosen (teal ramp:
 *   a magnitude, not a vulnerability);
 * - road corridors from OS Open Roads (Great Britain) and OpenStreetMap (Northern Ireland, S38):
 *   strategic (motorways, and trunk roads in GB) wider than primary roads; corridors, not freight;
 * - railway lines in Northern Ireland (Translink NIR network, 2015), dashed in their own colour;
 *   where the railway runs, not services or freight;
 * - DfT major ports as proportional circles (area ∝ tonnage), largest first so small ports stay on
 *   top; a warm ring marks the ports UKFSR names as entry points for food, feed and drink imports;
 *   the selected port is ringed in the selection colour.
 * Ports are graphics, so hit tests stay fast (B29); regions, roads and rail are never hit-tested.
 * Everything comes from `state.riskMap` (built by the feature from validated data); this controller
 * only draws it and turns pointer events into store actions (ADR-03).
 */

type Rgba = [number, number, number, number];
const rgba = (hex: string, alpha = 1): Rgba => [...hexToRgb(hex), alpha];

export interface RiskLogisticsActions {
  selectPort(locode: string | null): void;
  setHoverRisk(hover: HoverRisk | null): void;
}

interface HighlightableLayerView {
  highlight?(target: unknown, options?: { name?: string }): { remove(): void };
}

function regionRenderer(m: RiskMapModel, style: MapStyle): UniqueValueRenderer {
  const c = MAP_COLOURS[style];
  const line = { color: rgba(c.councilLine, c.councilLineAlpha * 0.6), width: 0.7 };
  const outlineOnly = new SimpleFillSymbol({ color: [0, 0, 0, 0], outline: line });
  const regions = m.regions;
  const infos =
    regions && regions.measure
      ? Object.entries(regions.classOf).map(
          ([id, cls]) =>
            new UniqueValueInfo({
              value: id,
              // Five classes use sequential colours 1–5 of 6 (as the small-area maps).
              symbol: new SimpleFillSymbol({
                color: rgba(c.seq[1 + cls] ?? c.seq[1]!),
                outline: { color: rgba(c.separator, c.separatorAlpha * 0.8), width: 0.6 },
              }),
            }),
        )
      : [];
  // With a measure chosen, a region without a value is hatched as no data, never left blank (P12).
  const noData = new SimpleFillSymbol({
    style: "backward-diagonal",
    color: rgba(c.noData, 0.9),
    outline: { color: rgba(c.separator, c.separatorAlpha * 0.8), width: 0.6 },
  });
  return new UniqueValueRenderer({
    field: "id",
    defaultSymbol: regions?.measure ? noData : outlineOnly,
    uniqueValueInfos: infos,
  });
}

function roadRenderer(style: MapStyle): UniqueValueRenderer {
  const c = MAP_COLOURS[style];
  return new UniqueValueRenderer({
    field: "category",
    uniqueValueInfos: [
      new UniqueValueInfo({
        value: "strategic",
        symbol: new SimpleLineSymbol({ color: rgba(c.roadStrategic, 0.72), width: 1.15, cap: "round" }),
      }),
      new UniqueValueInfo({
        value: "primary",
        symbol: new SimpleLineSymbol({ color: rgba(c.roadPrimary, 0.55), width: 0.55, cap: "round" }),
      }),
    ],
  });
}

function railRenderer(style: MapStyle): SimpleRenderer {
  const c = MAP_COLOURS[style];
  return new SimpleRenderer({
    symbol: new SimpleLineSymbol({ color: rgba(c.rail), width: 1.6, style: "dash", cap: "butt" }),
  });
}

export class RiskLogisticsController implements LayerController {
  readonly id = RISK_PORTS_LAYER_ID;
  private view: (ViewLike & { container?: HTMLElement | null }) | null = null;
  private report: LayerStatusReporter | null = null;
  private regions: GeoJSONLayer | null = null;
  private roads: GeoJSONLayer | null = null;
  private roadsNi: GeoJSONLayer | null = null;
  private rail: GeoJSONLayer | null = null;
  private ports: GraphicsLayer | null = null;
  /** The ports' data credit (DfT, EMODnet): GraphicsLayers carry no attribution of their own. */
  private portsCredit: CreditLayer | null = null;
  private regionsUrl: string | null = null;
  private roadsUrl: string | null = null;
  private roadsNiUrl: string | null = null;
  private railUrl: string | null = null;
  private handles: { remove(): void }[] = [];
  private visible = false;
  private style: MapStyle = "dark";
  private signature = { regions: "", roads: "", roadsNi: "", rail: "", ports: "" };
  private layerView: HighlightableLayerView | null = null;
  private hoverHighlight: { remove(): void } | null = null;
  private highlighted: string | null = null;
  private hoverFrame = 0;
  private hoverSeq = 0;
  private lastHover: string | null = null;

  constructor(private readonly actions: RiskLogisticsActions) {}

  activate(view: ViewLike, report: LayerStatusReporter): void {
    this.view = view;
    this.report = report;
    if (view.on && view.hitTest) {
      this.handles.push(view.on("click", (e) => void this.onClick(e)));
      this.handles.push(view.on("pointer-move", (e) => this.onPointerMove(e)));
      this.handles.push(
        view.on("pointer-leave", () => {
          this.hoverSeq++;
          this.clearHover();
        }),
      );
    }
  }

  update(state: AppState): void {
    const m = state.riskMap;
    // Also the Scenario Lab's port disruption (Scenario D), which publishes its own model.
    const visible =
      m !== null &&
      ((selectMapModule(state) === "risks" && state.riskView === "logistics") ||
        (selectMapModule(state) === "scenarios" && state.scenarioKind === "port"));
    if (visible !== this.visible) {
      this.visible = visible;
      for (const l of this.layers()) l.visible = visible;
      if (this.portsCredit) this.portsCredit.layer.visible = visible;
      if (!visible) this.clearHover();
    }
    if (!visible || !m || !this.view) return;
    const style = selectMapColourStyle(state);
    if (style !== this.style) {
      this.style = style;
      ensureHoverHighlight(this.view, style);
    }
    this.updateRegions(m, style);
    this.updateRoads(m, style);
    this.updateRoadsNi(m, style);
    this.updateRail(m, style);
    this.updatePorts(m, style);
  }

  deactivate(view: ViewLike): void {
    for (const h of this.handles) h.remove();
    this.handles = [];
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
    this.setHoverHighlight(null);
    for (const l of this.layers()) {
      view.map?.remove(l);
      l.destroy();
    }
    if (this.portsCredit) {
      view.map?.remove(this.portsCredit.layer);
      this.portsCredit.dispose();
      this.portsCredit = null;
    }
    this.regions = this.roads = this.roadsNi = this.rail = this.ports = null;
    this.regionsUrl = this.roadsUrl = this.roadsNiUrl = this.railUrl = null;
    this.layerView = null;
    this.signature = { regions: "", roads: "", roadsNi: "", rail: "", ports: "" };
    this.view = null;
    this.report = null;
  }

  private layers(): (GeoJSONLayer | GraphicsLayer)[] {
    return [this.regions, this.roads, this.roadsNi, this.rail, this.ports].filter(
      (l): l is GeoJSONLayer | GraphicsLayer => l !== null,
    );
  }

  /** Index of the first of `above` already on the map (or the end), so layers stay in order. */
  private below(...above: (GeoJSONLayer | GraphicsLayer | null)[]): number | undefined {
    const layers = (this.view?.map as { layers?: { indexOf(l: unknown): number } } | null | undefined)
      ?.layers;
    if (!layers) return undefined;
    for (const l of above) {
      if (!l) continue;
      const i = layers.indexOf(l);
      if (i >= 0) return i;
    }
    return undefined;
  }

  private updateRegions(m: RiskMapModel, style: MapStyle): void {
    const view = this.view!;
    const r = m.regions;
    if (r && r.url !== this.regionsUrl) {
      if (this.regions) {
        view.map?.remove(this.regions);
        this.regions.destroy();
      }
      this.regionsUrl = r.url;
      this.regions = new GeoJSONLayer({
        id: RISK_REGIONS_LAYER_ID,
        url: r.url,
        title: "Agricultural statistics regions",
        copyright: r.copyright,
        outFields: ["id", "name"],
        popupEnabled: false,
        legendEnabled: false,
        listMode: "hide",
        visible: this.visible,
      });
      view.map?.add(this.regions, this.below(this.roads, this.roadsNi, this.rail, this.ports));
      this.signature.regions = "";
    }
    if (this.regions) this.regions.visible = this.visible && r !== null;
    const sig = r ? `${style}|${r.measure ?? ""}|${JSON.stringify(r.classOf)}` : "off";
    if (sig !== this.signature.regions && this.regions && r) {
      this.regions.renderer = regionRenderer(m, style);
      const container = this.view?.container;
      if (container) container.dataset.riskRegions = r.measure ?? "outlines";
    }
    this.signature.regions = sig;
  }

  private updateRoads(m: RiskMapModel, style: MapStyle): void {
    const view = this.view!;
    const r = m.roads;
    if (r && r.url !== this.roadsUrl) {
      if (this.roads) {
        view.map?.remove(this.roads);
        this.roads.destroy();
      }
      this.roadsUrl = r.url;
      this.roads = new GeoJSONLayer({
        id: RISK_ROADS_LAYER_ID,
        url: r.url,
        title: "Strategic road corridors (OS Open Roads)",
        copyright: r.copyright,
        outFields: ["road", "category"],
        popupEnabled: false,
        legendEnabled: false,
        listMode: "hide",
        visible: this.visible,
      });
      view.map?.add(this.roads, this.below(this.roadsNi, this.rail, this.ports));
      this.signature.roads = "";
      const layer = this.roads;
      view.whenLayerView(layer).catch((err: unknown) => {
        if (this.roads === layer)
          this.report?.("error", err instanceof Error ? err.message : "Road corridors failed to load");
      });
    }
    if (this.roads) this.roads.visible = this.visible && r !== null;
    const sig = r ? style : "off";
    if (sig !== this.signature.roads && this.roads && r) this.roads.renderer = roadRenderer(style);
    this.signature.roads = sig;
    const container = this.view?.container;
    if (container) container.dataset.riskRoads = r ? "on" : "off";
  }

  /** Northern Ireland's corridors (OpenStreetMap, S38): the same symbols as GB's, its own credit. */
  private updateRoadsNi(m: RiskMapModel, style: MapStyle): void {
    const view = this.view!;
    const r = m.roadsNi;
    if (r && r.url !== this.roadsNiUrl) {
      if (this.roadsNi) {
        view.map?.remove(this.roadsNi);
        this.roadsNi.destroy();
      }
      this.roadsNiUrl = r.url;
      this.roadsNi = new GeoJSONLayer({
        id: RISK_ROADS_NI_LAYER_ID,
        url: r.url,
        title: "Road corridors, Northern Ireland (OpenStreetMap)",
        copyright: r.copyright,
        outFields: ["road", "category"],
        popupEnabled: false,
        legendEnabled: false,
        listMode: "hide",
        visible: this.visible,
      });
      view.map?.add(this.roadsNi, this.below(this.rail, this.ports));
      this.signature.roadsNi = "";
      const layer = this.roadsNi;
      view.whenLayerView(layer).catch((err: unknown) => {
        if (this.roadsNi === layer)
          this.report?.("error", err instanceof Error ? err.message : "Road corridors failed to load");
      });
    }
    if (this.roadsNi) this.roadsNi.visible = this.visible && r !== null;
    const sig = r ? style : "off";
    if (sig !== this.signature.roadsNi && this.roadsNi && r) this.roadsNi.renderer = roadRenderer(style);
    this.signature.roadsNi = sig;
    const container = this.view?.container;
    if (container) container.dataset.riskRoadsNi = r ? "on" : "off";
  }

  private updateRail(m: RiskMapModel, style: MapStyle): void {
    const view = this.view!;
    const r = m.rail;
    if (r && r.url !== this.railUrl) {
      if (this.rail) {
        view.map?.remove(this.rail);
        this.rail.destroy();
      }
      this.railUrl = r.url;
      this.rail = new GeoJSONLayer({
        id: RISK_RAIL_LAYER_ID,
        url: r.url,
        title: "Railway lines, Northern Ireland (Translink NIR network)",
        copyright: r.copyright,
        outFields: ["line"],
        popupEnabled: false,
        legendEnabled: false,
        listMode: "hide",
        visible: this.visible,
      });
      view.map?.add(this.rail, this.below(this.ports));
      this.signature.rail = "";
      const layer = this.rail;
      view.whenLayerView(layer).catch((err: unknown) => {
        if (this.rail === layer)
          this.report?.("error", err instanceof Error ? err.message : "Railway lines failed to load");
      });
    }
    if (this.rail) this.rail.visible = this.visible && r !== null;
    const sig = r ? style : "off";
    if (sig !== this.signature.rail && this.rail && r) this.rail.renderer = railRenderer(style);
    this.signature.rail = sig;
    const container = this.view?.container;
    if (container) container.dataset.riskRail = r ? "on" : "off";
  }

  private updatePorts(m: RiskMapModel, style: MapStyle): void {
    const view = this.view!;
    if (!this.ports) {
      this.ports = new GraphicsLayer({
        id: RISK_PORTS_LAYER_ID,
        title: "Major ports (DfT)",
        listMode: "hide",
      });
      this.ports.visible = this.visible;
      view.map?.add(this.ports);
      this.report?.("loading");
      const layer = this.ports;
      view
        .whenLayerView(layer)
        .then((lv) => {
          if (this.ports !== layer) return;
          this.layerView = lv as HighlightableLayerView;
          this.report?.("ready");
        })
        .catch((err: unknown) => {
          if (this.ports === layer)
            this.report?.("error", err instanceof Error ? err.message : "Ports failed to draw");
        });
    }
    if (m.portsCopyright) {
      if (!this.portsCredit) {
        this.portsCredit = createCreditLayer(RISK_PORTS_CREDIT_LAYER_ID, m.portsCopyright);
        this.portsCredit.layer.visible = this.visible;
        view.map?.add(this.portsCredit.layer);
      } else this.portsCredit.setText(m.portsCopyright);
    }
    const sig = `${style}|${m.portKey}|${m.selectedPort ?? ""}|${m.ports.map((p) => `${p.locode}:${p.radius.toFixed(2)}:${p.foodEntry ? 1 : 0}:${p.scenarioRadius?.toFixed(2) ?? ""}`).join(",")}`;
    if (sig === this.signature.ports) return;
    this.signature.ports = sig;
    this.setHoverHighlight(null);
    this.ports.removeAll();
    this.ports.addMany(
      portGraphicsData(m, style).map(
        (p) =>
          new Graphic({
            geometry: new Point({ longitude: p.point[0], latitude: p.point[1] }),
            attributes: { locode: p.locode },
            symbol: new SimpleMarkerSymbol({
              style: "circle",
              size: p.size,
              color: p.fill,
              outline: p.outline,
            }),
          }),
      ),
    );
    const container = this.view?.container;
    if (container) {
      container.dataset.riskPorts = String(m.ports.length);
      container.dataset.riskSelectedPort = m.selectedPort ?? "";
    }
  }

  private portFromHits(
    results: HitResult[],
  ): { locode: string; graphic: NonNullable<HitResult["graphic"]> } | null {
    for (const r of results) {
      const g = r.graphic;
      if (r.type !== "graphic" || !g || g.layer !== this.ports) continue;
      const code = g.attributes?.locode;
      if (typeof code === "string") return { locode: code, graphic: g };
    }
    return null;
  }

  private async onClick(e: ViewPointerEvent): Promise<void> {
    if (!this.visible || !this.view?.hitTest || !this.ports) return;
    const { results } = await this.view.hitTest(e, { include: [this.ports] });
    const hit = this.portFromHits(results);
    if (hit) this.actions.selectPort(hit.locode);
  }

  private onPointerMove(e: ViewPointerEvent): void {
    if (!this.visible || !this.view?.hitTest || !this.ports) return;
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
    const view = this.view;
    const ports = this.ports;
    const { x, y } = e;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      const seq = ++this.hoverSeq;
      void view.hitTest!({ x, y }, { include: [ports] }).then(({ results }) => {
        if (seq !== this.hoverSeq || !this.visible) return;
        const hit = this.portFromHits(results);
        if (!hit) return this.clearHover();
        this.lastHover = hit.locode;
        this.setHoverHighlight(hit.graphic, hit.locode);
        this.actions.setHoverRisk({ kind: "port", id: hit.locode, x, y });
      });
    });
  }

  private clearHover(): void {
    this.setHoverHighlight(null);
    if (this.lastHover === null) return;
    this.lastHover = null;
    this.actions.setHoverRisk(null);
  }

  private setHoverHighlight(
    graphic: NonNullable<HitResult["graphic"]> | null,
    key: string | null = null,
  ): void {
    if (graphic && key === this.highlighted) return;
    this.hoverHighlight?.remove();
    this.hoverHighlight = null;
    this.highlighted = graphic ? key : null;
    if (!graphic) return;
    this.hoverHighlight = this.layerView?.highlight?.(graphic, { name: HOVER_HIGHLIGHT }) ?? null;
  }
}

export { portGraphicsData };
