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
import {
  selectReducedMotion,
  type AppState,
  type HoverPartner,
  type OriginsMapModel,
  type OriginsMapPartner,
} from "@/state/store";
import { ORIGINS_FLOWS_LAYER_ID, ORIGINS_PARTNERS_LAYER_ID } from "../layerIds";
import { FlowParticles, type ParticleFlow, type ParticleView } from "./flowParticles";
import type { HitResult, LayerController, LayerStatusReporter, ViewLike, ViewPointerEvent } from "../types";

/**
 * Food Origins map layers (FO-02 – FO-04, P3, P4):
 * - recorded import partners shaded by share (fixed classes), the selected partner outlined;
 * - partners too small for the 1:110m outlines as points;
 * - symbolic curved connections from each top partner's label point to one UK anchor, width
 *   linear in the measure, with markers moving towards the UK unless motion is reduced (drawn
 *   by FlowParticles on a canvas over the map; ADR-0015).
 * Connections are not routes and never end at a port.
 *
 * All values come from `state.originsMap` (built by the Origins feature from the snapshot);
 * this controller only draws them and turns clicks/hovers into store actions (ADR-03).
 */

/** Palette mirrors src/styles/tokens.css (ArcGIS symbols need concrete colours). */
const NAVY: [number, number, number] = [7, 25, 35];
const TEAL: [number, number, number] = [10, 68, 74];
const CYAN: [number, number, number] = [73, 234, 216];
const GREEN: [number, number, number] = [161, 235, 131];

/** Fill per share class 0–5 (below 1 % … 50 % and over): a ramp from teal to cyan. */
export const SHARE_CLASS_COLOURS: readonly [number, number, number, number][] = [0, 1, 2, 3, 4, 5].map(
  (c) => {
    const t = 0.2 + (0.8 * c) / 5;
    const mix = (i: 0 | 1 | 2) => Math.round(TEAL[i] + (CYAN[i] - TEAL[i]) * t);
    return [mix(0), mix(1), mix(2), Math.round((0.55 + 0.08 * c) * 100) / 100] as [
      number,
      number,
      number,
      number,
    ];
  },
);

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
): { key: string; name: string | null } | null {
  for (const r of results) {
    if (r.type !== "graphic" || !r.graphic || !layers.includes(r.graphic.layer)) continue;
    const a = r.graphic.attributes ?? {};
    const key = (a.key ?? a.iso_a2) as unknown;
    const name = typeof a.name === "string" ? a.name : null;
    if (typeof key === "string" && key) return { key, name };
  }
  return null;
}

/** CIM line symbol for one connection: a core stroke and a soft glow (static, always drawn). */
export function flowLineSymbolData(width: number, emphasis: "normal" | "selected" | "dimmed") {
  const base = emphasis === "selected" ? GREEN : CYAN;
  const alpha = emphasis === "dimmed" ? 70 : emphasis === "selected" ? 235 : 175;
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
  private visible = false;
  private hoverFrame = 0;
  private lastHover: string | null = null;

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
    if (this.url) this.createLayers();
    if (view.on && view.hitTest) {
      this.handles.push(view.on("click", (e) => void this.onClick(e)));
      this.handles.push(view.on("pointer-move", (e) => this.onPointerMove(e)));
      this.handles.push(view.on("pointer-leave", () => this.clearHover()));
    }
  }

  update(state: AppState): void {
    this.model = state.originsMap;
    const visible = state.module === "origins" && state.originsMap !== null;
    if (visible !== this.visible) {
      this.visible = visible;
      for (const l of this.layers()) l.visible = visible;
      if (!visible) {
        this.clearHover();
        this.particles?.setFlows([], false);
        this.signature = { ...this.signature, flows: "" };
      }
    }
    if (!visible || !this.model) return;
    const animate = !selectReducedMotion(state);
    const m = this.model;
    const partnerSig = m.partners
      .map((p) => `${p.key}:${p.shareClass}:${p.flow ? p.flowWidth.toFixed(2) : ""}`)
      .join("|");
    const polygons = `${m.commodityId}|${m.periodLabel}|${m.measure}|${partnerSig}|${state.partner ?? ""}|${state.hoverPartner?.key ?? ""}`;
    const flows = `${m.commodityId}|${m.periodLabel}|${m.measure}|${partnerSig}|${state.partner ?? ""}|${animate}`;
    if (polygons !== this.signature.polygons)
      this.drawPartners(m, state.partner, state.hoverPartner?.key ?? null);
    if (flows !== this.signature.flows) this.drawFlows(m, state.partner, animate);
    this.signature = { polygons, flows };
  }

  deactivate(view: ViewLike): void {
    for (const h of this.handles) h.remove();
    this.handles = [];
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
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

  private drawPartners(m: OriginsMapModel, selected: string | null, hover: string | null): void {
    if (!this.polygons || !this.points) return;
    const fill = (p: OriginsMapPartner) => {
      const c = SHARE_CLASS_COLOURS[p.shareClass] ?? SHARE_CLASS_COLOURS[0]!;
      const isSel = p.key === selected;
      const isHover = p.key === hover;
      return new SimpleFillSymbol({
        color: isSel ? [GREEN[0], GREEN[1], GREEN[2], 0.55] : c,
        outline: {
          color: isSel ? [...GREEN, 1] : isHover ? [...CYAN, 0.95] : [...CYAN, 0.45],
          width: isSel ? 2 : isHover ? 1.6 : 0.6,
        },
      });
    };
    const infos = m.partners
      .filter((p) => p.geometry === "polygon" && p.iso2)
      .map((p) => new UniqueValueInfo({ value: p.iso2!, symbol: fill(p), label: p.name }));
    // A hovered country that is not a partner still gets a faint outline (interactive highlighting).
    if (hover && !m.partners.some((p) => p.iso2 === hover)) {
      infos.push(
        new UniqueValueInfo({
          value: hover,
          symbol: new SimpleFillSymbol({
            color: [...NAVY, 0.2],
            outline: { color: [...CYAN, 0.6], width: 1 },
          }),
        }),
      );
    }
    this.polygons.renderer = new UniqueValueRenderer({
      field: "iso_a2",
      defaultSymbol: this.noFill(),
      uniqueValueInfos: infos,
    });

    this.points.removeAll();
    const pointPartners = m.partners.filter((p) => p.geometry === "point" && p.point);
    this.points.addMany(
      pointPartners.map((p) => {
        const c = SHARE_CLASS_COLOURS[p.shareClass] ?? SHARE_CLASS_COLOURS[0]!;
        const isSel = p.key === selected;
        return new Graphic({
          geometry: new Point({ longitude: p.point![0], latitude: p.point![1] }),
          attributes: { key: p.key },
          symbol: new SimpleMarkerSymbol({
            style: "circle",
            size: isSel ? 11 : p.key === hover ? 9 : 7,
            color: isSel ? [...GREEN, 0.9] : [c[0], c[1], c[2], 0.9],
            outline: { color: isSel ? [...GREEN, 1] : [...CYAN, 0.8], width: isSel ? 2 : 1 },
          }),
        });
      }),
    );
  }

  private drawFlows(m: OriginsMapModel, selected: string | null, animate: boolean): void {
    if (!this.flows) return;
    this.flows.removeAll();
    const wgs84 = SpatialReference.WGS84;
    const flows = m.partners.filter((p) => p.flow && p.point);
    // Draw the widest first so thin connections stay visible on top.
    const ordered = [...flows].sort((a, b) => b.flowWidth - a.flowWidth);
    const graphics: Graphic[] = [];
    const particles: ParticleFlow[] = [];
    for (const p of ordered) {
      const path = symbolicArc(p.point!, m.ukAnchor, 64);
      const emphasis = selected ? (p.key === selected ? "selected" : "dimmed") : "normal";
      graphics.push(
        new Graphic({
          geometry: new Polyline({ paths: [path], spatialReference: wgs84 }),
          attributes: { key: p.key },
          symbol: new CIMSymbol({ data: flowLineSymbolData(p.flowWidth, emphasis) as never }),
        }),
      );
      particles.push({ key: p.key, path, widthPx: p.flowWidth, emphasis });
    }
    graphics.push(
      new Graphic({
        geometry: new Point({ longitude: m.ukAnchor[0], latitude: m.ukAnchor[1] }),
        attributes: { key: "__uk" },
        symbol: new SimpleMarkerSymbol({
          style: "circle",
          size: 9,
          color: [...NAVY, 0.9],
          outline: { color: [...GREEN, 1], width: 2 },
        }),
      }),
    );
    this.flows.addMany(graphics);
    this.particles?.setFlows(particles, animate);
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
        this.actions.setHoverPartner({ key: hit.key, name: hit.name, x, y });
      });
    });
  }

  private clearHover(): void {
    if (this.lastHover === null) return;
    this.lastHover = null;
    this.actions.setHoverPartner(null);
  }
}
