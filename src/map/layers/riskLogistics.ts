import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import UniqueValueInfo from "@arcgis/core/renderers/support/UniqueValueInfo";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { hexToRgb } from "@/analysis/colour";
import { selectMapColourStyle, type AppState, type HoverRisk, type RiskMapModel } from "@/state/store";
import { MAP_COLOURS, type MapStyle } from "@/styles/palette";
import { ensureHoverHighlight, HOVER_HIGHLIGHT } from "../highlight";
import { RISK_PORTS_LAYER_ID, RISK_REGIONS_LAYER_ID, RISK_ROADS_LAYER_ID } from "../layerIds";
import type { HitResult, LayerController, LayerStatusReporter, ViewLike, ViewPointerEvent } from "../types";

/**
 * Risk Explorer logistics map (RK-03), bottom to top:
 * - agricultural statistics regions (Defra regions of England, the devolved countries), outlined,
 *   and shaded by a farming density in five fixed classes when a measure is chosen (teal ramp:
 *   a magnitude, not a vulnerability);
 * - road corridors from OS Open Roads (Great Britain): strategic (motorway and trunk) wider than
 *   primary A roads; corridors, not freight flows;
 * - DfT major ports as proportional circles (area ∝ tonnage), largest first so small ports stay on
 *   top; a warm ring marks the ports UKFSR names as entry points for food, feed and drink imports;
 *   the selected port is ringed in the selection colour.
 * Ports are graphics, so hit tests stay fast (B29); regions and roads are never hit-tested.
 * Everything comes from `state.riskMap` (built by the feature from validated data); this controller
 * only draws it and turns pointer events into store actions (ADR-03).
 */

type Rgba = [number, number, number, number];
const rgba = (hex: string, alpha = 1): Rgba => [...hexToRgb(hex), alpha];
/** Marker sizes are in points; the model's radii are in px. */
const PX_TO_PT = 0.75;

export interface RiskLogisticsActions {
  selectPort(locode: string | null): void;
  setHoverRisk(hover: HoverRisk | null): void;
}

interface HighlightableLayerView {
  highlight?(target: unknown, options?: { name?: string }): { remove(): void };
}

/** Port symbols, largest first (so small ports are drawn on top and stay clickable). */
export function portGraphicsData(m: RiskMapModel, style: MapStyle) {
  const c = MAP_COLOURS[style];
  const ordered = [...m.ports].sort((a, b) => b.radius - a.radius || a.locode.localeCompare(b.locode));
  return ordered.map((p) => {
    const selected = p.locode === m.selectedPort;
    const empty = p.radius <= 0;
    const size = (empty ? 7 : 2 * p.radius) * PX_TO_PT;
    const ring = selected
      ? { color: rgba(c.selection), width: 2.75 }
      : p.foodEntry
        ? { color: rgba(c.risk[4]!), width: 2 }
        : { color: rgba(c.portOutline, 0.95), width: 1 };
    return {
      locode: p.locode,
      point: p.point,
      size,
      fill: empty ? ([0, 0, 0, 0] as Rgba) : rgba(c.portFill, 0.92),
      outline: empty && !selected && !p.foodEntry ? { color: rgba(c.portFill, 0.9), width: 1.25 } : ring,
    };
  });
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

export class RiskLogisticsController implements LayerController {
  readonly id = RISK_PORTS_LAYER_ID;
  private view: (ViewLike & { container?: HTMLElement | null }) | null = null;
  private report: LayerStatusReporter | null = null;
  private regions: GeoJSONLayer | null = null;
  private roads: GeoJSONLayer | null = null;
  private ports: GraphicsLayer | null = null;
  private regionsUrl: string | null = null;
  private roadsUrl: string | null = null;
  private handles: { remove(): void }[] = [];
  private visible = false;
  private style: MapStyle = "dark";
  private signature = { regions: "", roads: "", ports: "" };
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
    const visible = state.module === "risks" && state.riskView === "logistics" && m !== null;
    if (visible !== this.visible) {
      this.visible = visible;
      for (const l of this.layers()) l.visible = visible;
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
    this.regions = this.roads = this.ports = null;
    this.regionsUrl = this.roadsUrl = null;
    this.layerView = null;
    this.signature = { regions: "", roads: "", ports: "" };
    this.view = null;
    this.report = null;
  }

  private layers(): (GeoJSONLayer | GraphicsLayer)[] {
    return [this.regions, this.roads, this.ports].filter(
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
      view.map?.add(this.regions, this.below(this.roads, this.ports));
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
      view.map?.add(this.roads, this.below(this.ports));
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
    const sig = `${style}|${m.portKey}|${m.selectedPort ?? ""}|${m.ports.map((p) => `${p.locode}:${p.radius.toFixed(2)}:${p.foodEntry ? 1 : 0}`).join(",")}`;
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
