import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import Polyline from "@arcgis/core/geometry/Polyline";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import UniqueValueInfo from "@arcgis/core/renderers/support/UniqueValueInfo";
import CIMSymbol from "@arcgis/core/symbols/CIMSymbol";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { symbolicArc } from "@/analysis/arcs";
import { hexToRgb } from "@/analysis/colour";
import { BRAND, MAP_COLOURS, type MapStyle } from "@/styles/palette";
import { interpolateWidths, widthsDiffer } from "@/analysis/transition";
import {
  selectMapColourStyle,
  selectReducedMotion,
  type AppState,
  type HoverPartner,
  type OriginsMapModel,
  type OriginsMapPartner,
} from "@/state/store";
import { ensureHoverHighlight, HOVER_HIGHLIGHT } from "../highlight";
import { ORIGINS_FLOWS_LAYER_ID, ORIGINS_PARTNERS_LAYER_ID } from "../layerIds";
import { FlowParticles, type ParticleFlow, type ParticleView } from "./flowParticles";
import { FLOW_TWEEN_MS, TWEEN_FRAME_MS } from "./flowTiming";
import type { HitResult, LayerController, LayerStatusReporter, ViewLike, ViewPointerEvent } from "../types";

/**
 * Food Origins map layers (FO-02 – FO-04, P3, P4):
 * - recorded import partners shaded by share (fixed classes, opaque colours shared with the legend
 *   and the Seasonal heatmap), the selected partner outlined; the partner under the pointer is
 *   emphasised with the view's highlight, so hovering never rebuilds the renderer;
 * - partners too small for the 1:110m outlines as points;
 * - symbolic curved connections from each top partner's label point to one UK anchor, width
 *   linear in the measure, with markers moving towards the UK unless motion is reduced (drawn
 *   by FlowParticles on a canvas over the map; ADR-0015).
 * Connections are not routes and never end at a port.
 *
 * All values come from `state.originsMap` (built by the Food Origins or Seasonal Supply feature
 * from the snapshot); this controller only draws them and turns clicks/hovers into store actions
 * (ADR-03). When the month changes, connection widths ease from the old to the new values for at
 * most FLOW_TWEEN_MS (instant under reduced motion) and always end at the exact model widths.
 */

/** Modules whose map is drawn from `state.originsMap`. */
const TRADE_MAP_MODULES: readonly string[] = ["origins", "seasonal"];

type Rgba = [number, number, number, number];

const rgba = (hex: string, alpha = 1): Rgba => [...hexToRgb(hex), alpha];

/**
 * Fill per share class 0–5 (below 1 % … 50 % and over) for a basemap style: opaque, so the map
 * shows exactly the legend colours (src/styles/palette.ts, ADR-0019, ADR-0022).
 */
export function shareClassColours(style: MapStyle): Rgba[] {
  return MAP_COLOURS[style].seq.map((hex) => rgba(hex));
}

interface HighlightableLayerView {
  highlight?(target: unknown, options?: { name?: string }): { remove(): void };
}

export interface OriginsActions {
  selectPartner(key: string | null): void;
  setHoverPartner(hover: HoverPartner | null): void;
}

interface Signature {
  polygons: string;
  flows: string;
}

function partnerFromHits(
  results: HitResult[],
  layers: unknown[],
): { key: string; name: string | null; graphic: NonNullable<HitResult["graphic"]> } | null {
  for (const r of results) {
    if (r.type !== "graphic" || !r.graphic || !layers.includes(r.graphic.layer)) continue;
    const a = r.graphic.attributes ?? {};
    const key = (a.key ?? a.iso_a2) as unknown;
    const name = typeof a.name === "string" ? a.name : null;
    if (typeof key === "string" && key) return { key, name, graphic: r.graphic };
  }
  return null;
}

/**
 * CIM line symbol for one connection (static, always drawn). Layers, top first: the core stroke,
 * a thin casing so the line stays readable over the opaque share fills (navy on dark grey, white
 * on light grey), and a soft glow.
 */
export function flowLineSymbolData(
  width: number,
  emphasis: "normal" | "selected" | "dimmed",
  style: MapStyle = "dark",
) {
  const c = MAP_COLOURS[style];
  const base = hexToRgb(emphasis === "selected" ? c.selection : c.connection);
  const casing = hexToRgb(c.connectionCasing);
  const alpha = emphasis === "dimmed" ? 70 : emphasis === "selected" ? 235 : 190;
  return {
    type: "CIMSymbolReference",
    symbol: {
      type: "CIMLineSymbol",
      symbolLayers: [
        {
          type: "CIMSolidStroke",
          enable: true,
          width,
          color: [...base, alpha],
          capStyle: "Round",
          joinStyle: "Round",
        },
        {
          type: "CIMSolidStroke",
          enable: true,
          width: width + 2,
          color: [...casing, emphasis === "dimmed" ? 60 : 150],
          capStyle: "Round",
          joinStyle: "Round",
        },
        {
          type: "CIMSolidStroke",
          enable: true,
          width: width + (emphasis === "selected" ? 7 : 4),
          color: [...base, emphasis === "dimmed" ? 10 : 36],
          capStyle: "Round",
          joinStyle: "Round",
        },
      ],
    },
  };
}

export class OriginsLayersController implements LayerController {
  readonly id = ORIGINS_PARTNERS_LAYER_ID;
  private view: ViewLike | null = null;
  private report: LayerStatusReporter | null = null;
  private polygons: GeoJSONLayer | null = null;
  private points: GraphicsLayer | null = null;
  private flows: GraphicsLayer | null = null;
  private particles: FlowParticles | null = null;
  private url: string | null = null;
  private handles: { remove(): void }[] = [];
  private signature: Signature = { polygons: "", flows: "" };
  private model: OriginsMapModel | null = null;
  /** Basemap colour set in use (SH-08). */
  private style: MapStyle = "dark";
  private visible = false;
  private hoverFrame = 0;
  private lastHover: string | null = null;
  /** One graphic per connection, reused across months so widths can ease. */
  private flowGraphics = new Map<string, Graphic>();
  private drawnWidths = new Map<string, number>();
  private pathKey = "";
  private tweenFrame = 0;
  /** Transitions started so far (exposed on the view container for tests; no ArcGIS state in React). */
  private transitions = 0;
  /** Layer views, for hover highlights (set when each layer view is created). */
  private layerViews = new Map<unknown, HighlightableLayerView>();
  private hoverHighlight: { remove(): void } | null = null;
  private highlightedKey: string | null = null;
  /** Renderer rebuilds so far (exposed on the view container for tests). */
  private rendererBuilds = 0;

  constructor(private readonly actions: OriginsActions) {}

  /** Outline geometry URL (same Natural Earth file as the reference layer, from the manifest). */
  setSource(url: string | null): void {
    if (url === this.url) return;
    this.url = url;
    if (this.view) this.createLayers();
  }

  activate(view: ViewLike, report: LayerStatusReporter): void {
    this.view = view;
    this.report = report;
    this.particles = new FlowParticles(view as unknown as ParticleView);
    ensureHoverHighlight(view, this.style);
    if (this.url) this.createLayers();
    if (view.on && view.hitTest) {
      this.handles.push(view.on("click", (e) => void this.onClick(e)));
      this.handles.push(view.on("pointer-move", (e) => this.onPointerMove(e)));
      this.handles.push(view.on("pointer-leave", () => this.clearHover()));
    }
  }

  update(state: AppState): void {
    this.model = state.originsMap;
    const visible = TRADE_MAP_MODULES.includes(state.module) && state.originsMap !== null;
    if (visible !== this.visible) {
      this.visible = visible;
      for (const l of this.layers()) l.visible = visible;
      if (!visible) {
        this.clearHover();
        this.particles?.setFlows([], false);
        this.cancelTween();
        this.flows?.removeAll();
        this.flowGraphics.clear();
        this.drawnWidths.clear();
        this.signature = { ...this.signature, flows: "" };
      }
    }
    const style = selectMapColourStyle(state);
    if (style !== this.style) {
      this.style = style;
      this.particles?.setStyle(style);
      if (this.view) ensureHoverHighlight(this.view, style);
    }
    if (!visible || !this.model) return;
    const animate = !selectReducedMotion(state);
    const m = this.model;
    const partnerSig = m.partners
      .map((p) => `${p.key}:${p.shareClass}:${p.flow ? p.flowWidth.toFixed(2) : ""}`)
      .join("|");
    // Hover is drawn with the view's highlight, so it is not part of the renderer's signature.
    const polygons = `${style}|${m.commodityId}|${m.periodLabel}|${m.measure}|${partnerSig}|${state.partner ?? ""}`;
    const flows = `${style}|${m.commodityId}|${m.periodLabel}|${m.measure}|${partnerSig}|${state.partner ?? ""}|${animate}`;
    if (polygons !== this.signature.polygons) this.drawPartners(m, state.partner);
    if (flows !== this.signature.flows) this.drawFlows(m, state.partner, animate);
    this.signature = { polygons, flows };
  }

  deactivate(view: ViewLike): void {
    for (const h of this.handles) h.remove();
    this.handles = [];
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
    this.setHoverHighlight(null);
    this.layerViews.clear();
    this.cancelTween();
    this.flowGraphics.clear();
    this.drawnWidths.clear();
    for (const l of this.layers()) {
      view.map?.remove(l);
      l.destroy();
    }
    this.particles?.destroy();
    this.particles = null;
    this.polygons = this.points = this.flows = null;
    this.view = null;
    this.report = null;
    this.signature = { polygons: "", flows: "" };
  }

  private createLayers(): void {
    const view = this.view;
    if (!view || !this.url) return;
    for (const l of this.layers()) {
      view.map?.remove(l);
      l.destroy();
    }
    this.report?.("loading");
    this.polygons = new GeoJSONLayer({
      id: ORIGINS_PARTNERS_LAYER_ID,
      url: this.url,
      title: "Recorded import partners (share)",
      copyright: "HMRC Overseas Trade Statistics (OGL v3.0)",
      outFields: ["iso_a2", "name"],
      definitionExpression: "iso_a2 IS NOT NULL",
      renderer: new UniqueValueRenderer({ field: "iso_a2", defaultSymbol: this.noFill() }),
      popupEnabled: false,
      legendEnabled: false,
      listMode: "hide",
      visible: this.visible,
    });
    this.points = new GraphicsLayer({
      id: `${ORIGINS_PARTNERS_LAYER_ID}-points`,
      listMode: "hide",
      visible: this.visible,
    });
    this.flows = new GraphicsLayer({ id: ORIGINS_FLOWS_LAYER_ID, listMode: "hide", visible: this.visible });
    view.map?.add(this.polygons);
    view.map?.add(this.flows);
    view.map?.add(this.points);
    this.signature = { polygons: "", flows: "" };
    this.setHoverHighlight(null);
    this.layerViews.clear();
    for (const l of this.layers()) {
      view
        .whenLayerView(l)
        .then((lv) => {
          if (this.layers().includes(l)) this.layerViews.set(l, lv as HighlightableLayerView);
        })
        .catch(() => undefined);
    }
    const layer = this.polygons;
    view
      .whenLayerView(layer)
      .then(() => {
        if (this.polygons === layer) this.report?.("ready");
      })
      .catch((err: unknown) => {
        if (this.polygons === layer)
          this.report?.("error", err instanceof Error ? err.message : "Layer failed to load");
      });
  }

  private layers(): (GeoJSONLayer | GraphicsLayer)[] {
    return [this.polygons, this.points, this.flows].filter(
      (l): l is GeoJSONLayer | GraphicsLayer => l !== null,
    );
  }

  private noFill(): SimpleFillSymbol {
    return new SimpleFillSymbol({ color: [0, 0, 0, 0], outline: { color: [0, 0, 0, 0], width: 0 } });
  }

  private drawPartners(m: OriginsMapModel, selected: string | null): void {
    if (!this.polygons || !this.points) return;
    const colours = MAP_COLOURS[this.style];
    const classes = shareClassColours(this.style);
    const selection = rgba(colours.selection);
    const separator = rgba(colours.separator, colours.separatorAlpha);
    const fill = (p: OriginsMapPartner) => {
      const c = classes[p.shareClass] ?? classes[0]!;
      const isSel = p.key === selected;
      return new SimpleFillSymbol({
        color: c,
        outline: isSel ? { color: selection, width: 2.25 } : { color: separator, width: 0.75 },
      });
    };
    const infos = m.partners
      .filter((p) => p.geometry === "polygon" && p.iso2)
      .map((p) => new UniqueValueInfo({ value: p.iso2!, symbol: fill(p), label: p.name }));
    this.polygons.renderer = new UniqueValueRenderer({
      field: "iso_a2",
      defaultSymbol: this.noFill(),
      uniqueValueInfos: infos,
    });
    this.rendererBuilds += 1;
    const container = (this.view as { container?: HTMLElement | null } | null)?.container;
    if (container) container.dataset.partnerRendererBuilds = String(this.rendererBuilds);

    this.points.removeAll();
    const pointPartners = m.partners.filter((p) => p.geometry === "point" && p.point);
    this.points.addMany(
      pointPartners.map((p) => {
        const c = classes[p.shareClass] ?? classes[0]!;
        const isSel = p.key === selected;
        return new Graphic({
          geometry: new Point({ longitude: p.point![0], latitude: p.point![1] }),
          attributes: { key: p.key },
          symbol: new SimpleMarkerSymbol({
            style: "circle",
            size: isSel ? 11 : 8,
            color: c,
            outline: isSel ? { color: selection, width: 2 } : { color: separator, width: 1 },
          }),
        });
      }),
    );
  }

  private drawFlows(m: OriginsMapModel, selected: string | null, animate: boolean): void {
    if (!this.flows) return;
    this.cancelTween();
    const wgs84 = SpatialReference.WGS84;
    const flows = m.partners.filter((p) => p.flow && p.point);
    const target = new Map(flows.map((p) => [p.key, p.flowWidth]));
    const emphasis = (key: string) => (selected ? (key === selected ? "selected" : "dimmed") : "normal");
    // Paths depend on the partners' points and the UK anchor, which change with the commodity.
    const pathKey = `${m.commodityId}|${m.ukAnchor.join(",")}`;
    const tween = animate && pathKey === this.pathKey && this.drawnWidths.size > 0;
    if (pathKey !== this.pathKey) {
      this.flowGraphics.clear();
      this.drawnWidths.clear();
    }
    this.pathKey = pathKey;

    // Every connection that is drawn now or was drawn before (the latter shrink away).
    const keys = new Set([...flows.map((p) => p.key), ...(tween ? this.flowGraphics.keys() : [])]);
    for (const p of flows) {
      if (this.flowGraphics.has(p.key)) continue;
      this.flowGraphics.set(
        p.key,
        new Graphic({
          geometry: new Polyline({ paths: [symbolicArc(p.point!, m.ukAnchor, 64)], spatialReference: wgs84 }),
          attributes: { key: p.key },
        }),
      );
    }
    for (const key of [...this.flowGraphics.keys()]) if (!keys.has(key)) this.flowGraphics.delete(key);
    const from = new Map(
      [...keys].map((k) => [k, tween ? (this.drawnWidths.get(k) ?? 0) : (target.get(k) ?? 0)]),
    );
    const symbolFor = (key: string, width: number) =>
      new CIMSymbol({ data: flowLineSymbolData(Math.max(0, width), emphasis(key), this.style) as never });

    // Widest (final width) first, so thin connections stay visible on top; the UK point last.
    const ordered = [...keys].sort(
      (a, b) => (target.get(b) ?? 0) - (target.get(a) ?? 0) || a.localeCompare(b),
    );
    for (const key of ordered) {
      const g = this.flowGraphics.get(key)!;
      g.attributes = { key, targetWidth: target.get(key) ?? 0 };
      g.symbol = symbolFor(key, from.get(key) ?? 0);
    }
    this.flows.removeAll();
    this.flows.addMany([
      ...ordered.map((k) => this.flowGraphics.get(k)!),
      new Graphic({
        geometry: new Point({ longitude: m.ukAnchor[0], latitude: m.ukAnchor[1] }),
        attributes: { key: "__uk" },
        symbol: new SimpleMarkerSymbol({
          style: "circle",
          size: 9,
          color: rgba(BRAND.navy, 0.9),
          outline: { color: rgba(MAP_COLOURS[this.style].selection), width: 2 },
        }),
      }),
    ]);

    const particles: ParticleFlow[] = flows.map((p) => ({
      key: p.key,
      path: symbolicArc(p.point!, m.ukAnchor, 64),
      widthPx: p.flowWidth,
      emphasis: emphasis(p.key),
    }));
    this.particles?.setFlows(particles, animate);

    const to = new Map(target);
    const finish = () => {
      for (const key of ordered) {
        const w = to.get(key);
        if (w === undefined) {
          const g = this.flowGraphics.get(key);
          if (g) this.flows?.remove(g);
          this.flowGraphics.delete(key);
          this.drawnWidths.delete(key);
        } else {
          this.flowGraphics.get(key)!.symbol = symbolFor(key, w);
          this.drawnWidths.set(key, w);
        }
      }
      this.tweenFrame = 0;
      this.setTransitionState("idle");
    };
    if (!tween || !widthsDiffer(from, to) || typeof requestAnimationFrame === "undefined") {
      finish();
      return;
    }
    this.transitions += 1;
    this.setTransitionState("running");
    const start = performance.now();
    let last = 0;
    const step = (now: number) => {
      const t = (now - start) / FLOW_TWEEN_MS;
      if (t >= 1) return finish();
      if (now - last >= TWEEN_FRAME_MS) {
        last = now;
        for (const [key, w] of interpolateWidths(from, to, t)) {
          const g = this.flowGraphics.get(key);
          if (!g) continue;
          g.symbol = symbolFor(key, w);
          this.drawnWidths.set(key, w);
        }
      }
      this.tweenFrame = requestAnimationFrame(step);
    };
    this.tweenFrame = requestAnimationFrame(step);
  }

  private setTransitionState(state: "running" | "idle"): void {
    const container = (this.view as { container?: HTMLElement | null } | null)?.container;
    if (!container) return;
    container.dataset.flowTransition = state;
    container.dataset.flowTransitions = String(this.transitions);
  }

  private cancelTween(): void {
    if (this.tweenFrame) cancelAnimationFrame(this.tweenFrame);
    this.tweenFrame = 0;
  }

  private hitLayers(): unknown[] {
    return [this.points, this.flows, this.polygons].filter(Boolean);
  }

  private async onClick(e: ViewPointerEvent): Promise<void> {
    if (!this.visible || !this.view?.hitTest) return;
    const { results } = await this.view.hitTest(e, { include: this.hitLayers() });
    const key = partnerFromHits(results, this.hitLayers())?.key ?? null;
    if (key === "__uk") return;
    const isPartner =
      key !== null && (this.model?.partners.some((p) => p.key === key || p.iso2 === key) ?? false);
    this.actions.selectPartner(isPartner ? key : null);
  }

  private onPointerMove(e: ViewPointerEvent): void {
    if (!this.visible || !this.view?.hitTest) return;
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
    const view = this.view;
    const { x, y } = e;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      void view.hitTest!({ x, y }, { include: this.hitLayers() }).then(({ results }) => {
        const hit = partnerFromHits(results, this.hitLayers());
        if (!hit || hit.key === "__uk") return this.clearHover();
        this.lastHover = hit.key;
        this.setHoverHighlight(hit.graphic, hit.key);
        this.actions.setHoverPartner({ key: hit.key, name: hit.name, x, y });
      });
    });
  }

  private clearHover(): void {
    this.setHoverHighlight(null);
    if (this.lastHover === null) return;
    this.lastHover = null;
    this.actions.setHoverPartner(null);
  }

  /**
   * Emphasises the hovered partner (or country) with the view's highlight instead of rebuilding
   * the partner renderer (which re-symbolised every country on each pointer move).
   */
  private setHoverHighlight(
    graphic: NonNullable<HitResult["graphic"]> | null,
    key: string | null = null,
  ): void {
    if (graphic && key === this.highlightedKey) return;
    this.hoverHighlight?.remove();
    this.hoverHighlight = null;
    this.highlightedKey = graphic ? key : null;
    if (!graphic) return;
    const lv = this.layerViews.get(graphic.layer);
    this.hoverHighlight = lv?.highlight?.(graphic, { name: HOVER_HIGHLIGHT }) ?? null;
  }
}
