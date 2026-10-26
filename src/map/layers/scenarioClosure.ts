import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import Polyline from "@arcgis/core/geometry/Polyline";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import {
  selectMapColourStyle,
  selectReducedMotion,
  type AppState,
  type HoverScenario,
  type ScenarioClosureMapModel,
} from "@/state/store";
import type { MapStyle } from "@/styles/palette";
import { HOVER_HIGHLIGHT } from "../highlight";
import { SCENARIO_CLOSURE_LAYER_ID } from "../layerIds";
import type { HitResult, LayerController, LayerStatusReporter, ViewLike, ViewPointerEvent } from "../types";
import { closureGraphicsData } from "./closureSymbols";

/**
 * Scenario Lab supermarket-closure map (Scenario B). Above the councils and supermarkets drawn by
 * the Access layers (in their scenario mode):
 * - each small area whose nearest supermarket is the closed one, as a circle (area ∝ residents),
 *   coloured by the increase in straight-line distance (warm ramp, fixed classes) in the scenario
 *   view, or in one neutral colour in the baseline view;
 * - a dashed straight line from each area to its nearest supermarket: the closed one (baseline) or
 *   the next nearest (scenario). Lines are straight-line links, never routes;
 * - the closed supermarket crossed out (scenario view), and rings on the supermarkets that take over.
 * A change fades in over at most 280 ms (none under reduced motion); classes are never interpolated.
 * Everything comes from `state.scenarioMap` (built by the feature); areas are the only hit-tested graphics.
 */

export const CLOSURE_FADE_MS = 280;

export interface ScenarioClosureActions {
  setHoverScenario(hover: HoverScenario | null): void;
}

interface HighlightableLayerView {
  highlight?(target: unknown, options?: { name?: string }): { remove(): void };
}

export class ScenarioClosureController implements LayerController {
  readonly id = SCENARIO_CLOSURE_LAYER_ID;
  private view: (ViewLike & { container?: HTMLElement | null }) | null = null;
  private report: LayerStatusReporter | null = null;
  private layer: GraphicsLayer | null = null;
  private layerView: HighlightableLayerView | null = null;
  private handles: { remove(): void }[] = [];
  private visible = false;
  private signature = "";
  private fadeFrame = 0;
  private hoverFrame = 0;
  private hoverSeq = 0;
  private lastHover: string | null = null;
  private hoverHighlight: { remove(): void } | null = null;
  private highlighted: string | null = null;
  /** Redraws so far (on the view container for tests). */
  private draws = 0;

  constructor(private readonly actions: ScenarioClosureActions) {}

  activate(view: ViewLike, report: LayerStatusReporter): void {
    this.view = view;
    this.report = report;
    if (view.on && view.hitTest) {
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
    const m = state.scenarioMap;
    const visible = state.module === "scenarios" && state.scenarioKind === "closure" && m !== null;
    if (visible !== this.visible) {
      this.visible = visible;
      if (this.layer) this.layer.visible = visible;
      if (!visible) this.clearHover();
    }
    if (!visible || !m || !this.view) return;
    const style = selectMapColourStyle(state);
    if (!this.layer) this.createLayer();
    const sig = `${style}|${m.key}|${m.view}|${m.areas.length}|${m.takeover.map((t) => t.id).join(",")}`;
    if (sig === this.signature) return;
    this.signature = sig;
    this.draw(m, style, !selectReducedMotion(state));
  }

  deactivate(view: ViewLike): void {
    for (const h of this.handles) h.remove();
    this.handles = [];
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
    this.setHoverHighlight(null);
    if (this.layer) {
      view.map?.remove(this.layer);
      this.layer.destroy();
    }
    this.layer = null;
    this.layerView = null;
    this.view = null;
    this.report = null;
    this.signature = "";
  }

  private createLayer(): void {
    const view = this.view;
    if (!view) return;
    const layer = new GraphicsLayer({
      id: SCENARIO_CLOSURE_LAYER_ID,
      title: "Scenario: small areas whose nearest supermarket changes",
      listMode: "hide",
      visible: this.visible,
    });
    this.layer = layer;
    view.map?.add(layer);
    this.report?.("loading");
    view
      .whenLayerView(layer)
      .then((lv) => {
        if (this.layer !== layer) return;
        this.layerView = lv as HighlightableLayerView;
        this.report?.("ready");
      })
      .catch((err: unknown) => {
        if (this.layer === layer)
          this.report?.("error", err instanceof Error ? err.message : "Layer failed to draw");
      });
  }

  private draw(m: ScenarioClosureMapModel, style: MapStyle, animate: boolean): void {
    const layer = this.layer;
    if (!layer) return;
    this.setHoverHighlight(null);
    const wgs84 = SpatialReference.WGS84;
    const { links, areas, stores } = closureGraphicsData(m, style);
    layer.removeAll();
    layer.addMany([
      ...links.map(
        (l) =>
          new Graphic({
            geometry: new Polyline({ paths: [l.path], spatialReference: wgs84 }),
            attributes: { kind: "link", code: l.code },
            symbol: new SimpleLineSymbol({
              color: l.colour,
              width: l.width,
              style: "short-dash",
              cap: "round",
            }),
          }),
      ),
      ...areas.map(
        (a) =>
          new Graphic({
            geometry: new Point({ longitude: a.point[0], latitude: a.point[1] }),
            attributes: { kind: "area", code: a.code },
            symbol: new SimpleMarkerSymbol({
              style: "circle",
              size: a.size,
              color: a.fill,
              outline: { color: a.outline, width: 1 },
            }),
          }),
      ),
      ...stores.map(
        (s) =>
          new Graphic({
            geometry: new Point({ longitude: s.point[0], latitude: s.point[1] }),
            attributes: { kind: s.kind, id: s.id },
            symbol: new SimpleMarkerSymbol({
              style: s.style,
              size: s.size,
              color: s.fill,
              outline: s.outline,
            }),
          }),
      ),
    ]);
    this.draws += 1;
    const container = this.view?.container;
    if (container) {
      container.dataset.scenarioAreas = String(m.areas.length);
      container.dataset.scenarioView = m.view;
      container.dataset.scenarioClosed = m.closed ? String(m.closed.id) : "";
      container.dataset.scenarioDraws = String(this.draws);
    }
    this.fadeIn(animate && typeof requestAnimationFrame !== "undefined");
  }

  /** Fades the redrawn layer in (≤ CLOSURE_FADE_MS), so the change is seen without implying motion. */
  private fadeIn(animate: boolean): void {
    const layer = this.layer;
    if (!layer) return;
    if (this.fadeFrame) cancelAnimationFrame(this.fadeFrame);
    this.fadeFrame = 0;
    if (!animate) {
      layer.opacity = 1;
      return;
    }
    const start = performance.now();
    layer.opacity = 0.15;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / CLOSURE_FADE_MS);
      layer.opacity = 0.15 + 0.85 * t;
      this.fadeFrame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    this.fadeFrame = requestAnimationFrame(step);
  }

  private areaFromHits(
    results: HitResult[],
  ): { code: string; graphic: NonNullable<HitResult["graphic"]> } | null {
    for (const r of results) {
      const g = r.graphic;
      if (r.type !== "graphic" || !g || g.layer !== this.layer) continue;
      if (g.attributes?.kind === "area" && typeof g.attributes.code === "string")
        return { code: g.attributes.code, graphic: g };
    }
    return null;
  }

  private onPointerMove(e: ViewPointerEvent): void {
    if (!this.visible || !this.view?.hitTest || !this.layer) return;
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
    const view = this.view;
    const layer = this.layer;
    const { x, y } = e;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      const seq = ++this.hoverSeq;
      void view.hitTest!({ x, y }, { include: [layer] }).then(({ results }) => {
        if (seq !== this.hoverSeq || !this.visible) return;
        const hit = this.areaFromHits(results);
        if (!hit) return this.clearHover();
        this.lastHover = hit.code;
        this.setHoverHighlight(hit.graphic, hit.code);
        this.actions.setHoverScenario({ code: hit.code, x, y });
      });
    });
  }

  private clearHover(): void {
    this.setHoverHighlight(null);
    if (this.lastHover === null) return;
    this.lastHover = null;
    this.actions.setHoverScenario(null);
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
