import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import Polyline from "@arcgis/core/geometry/Polyline";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer";
import FeatureReductionCluster from "@arcgis/core/layers/support/FeatureReductionCluster";
import LabelClass from "@arcgis/core/layers/support/LabelClass";
import OrderByInfo from "@arcgis/core/layers/support/OrderByInfo";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import UniqueValueInfo from "@arcgis/core/renderers/support/UniqueValueInfo";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import TextSymbol from "@arcgis/core/symbols/TextSymbol";
import { hexToRgb } from "@/analysis/colour";
import type { StoreLayer } from "@/analysis/retail";
import {
  LOCAL_ZOOM,
  selectLocalScale,
  selectMapColourStyle,
  selectReducedMotion,
  type AccessMapModel,
  type AppState,
  type HoverAccess,
  type HoverArea,
  type MapCommand,
  type ProfileMapModel,
} from "@/state/store";
import { MAP_COLOURS, type MapColours, type MapStyle } from "@/styles/palette";
import { ensureHoverHighlight, HOVER_HIGHLIGHT } from "../highlight";
import {
  ACCESS_COUNCILS_LAYER_ID,
  ACCESS_GROCERS_LAYER_ID,
  ACCESS_OVERLAY_LAYER_ID,
  ACCESS_STORES_LAYER_ID,
  PROFILE_AREAS_LAYER_ID,
  REGISTER_GROCERS_MIN_ZOOM,
} from "../layerIds";
import { areaGraphics, areaState, areaSymbol, grocerGraphics } from "./profileAreas";
import {
  FLIGHT_DURATION_MS,
  type HitResult,
  type LayerController,
  type LayerStatusReporter,
  type ViewLike,
  type ViewPointerEvent,
} from "../types";

/**
 * UK Food Access and Local Authority Profiles map layers (SM-02, SM-04, SM-06, SM-07; LP-01, LP-06):
 * - councils shaded by stores per 10,000 residents in fixed classes at national and regional
 *   scale, with a hatched no-data class (P12); outlines only at local scale, where the stores
 *   are drawn individually and a fill would only hide them;
 * - stores clustered below local scale and drawn individually from it, brand-neutral: class by
 *   colour and shape (supermarket circle, convenience square, other formats triangle);
 * - the selected store, and the straight-line proximity overlay (radius ring drawn in the national
 *   grid, straight lines to the nearest stores, the chosen point).
 * - in Local Authority Profiles (`mode: "profile"`): councils outlined, the selected council
 *   emphasised and comparison councils dashed, the stores, and in a deep profile the small areas
 *   shaded by the chosen measure (`state.profileMap`), drawn as graphics so hit tests stay fast;
 * - NI grocers from the FSA register (S29), a supplementary layer of hollow diamonds.
 * Everything comes from `state.accessMap` (built by the feature from validated data); this
 * controller only draws it and turns pointer events into store actions (ADR-03). Colours follow
 * the basemap style (SH-08, ADR-0022).
 */

/** Web Mercator scale at zoom 0 (256 px tiles): zoom z has scale ZOOM0_SCALE / 2^z. */
const ZOOM0_SCALE = 591657527.591555;
/** Clustering stops (stores drawn individually) from local scale, with a little headroom. */
export const LOCAL_SCALE = (ZOOM0_SCALE / 2 ** LOCAL_ZOOM) * 1.02;

const WGS84 = SpatialReference.WGS84;

type Rgba = [number, number, number, number];
const rgba = (hex: string, alpha = 1): Rgba => [...hexToRgb(hex), alpha];

export interface AccessActions {
  selectStore(id: number | null): void;
  /** UK Food Access: toggles the council selection. */
  selectCouncil(code: string | null): void;
  /** Local Authority Profiles: opens the council's profile (never clears it). */
  pickCouncil(code: string): void;
  selectArea(code: string | null): void;
  setHoverAccess(hover: HoverAccess | null): void;
  setHoverArea(hover: HoverArea | null): void;
  setProximityPoint(point: [number, number] | null): void;
}

interface HighlightableLayerView {
  highlight?(target: unknown, options?: { name?: string }): { remove(): void };
}

interface GoToView extends ViewLike {
  container?: HTMLElement | null;
}

/** Store symbols (SM-04): shape is a second encoding next to colour, for colour-blind readers. */
export const STORE_SHAPES: Record<StoreLayer, { style: "circle" | "square" | "triangle"; size: number }> = {
  supermarket: { style: "circle", size: 9 },
  convenience: { style: "square", size: 6.5 },
  other: { style: "triangle", size: 8.5 },
};

function storeColour(c: MapColours, layer: StoreLayer): string {
  return layer === "supermarket"
    ? c.storeSupermarket
    : layer === "convenience"
      ? c.storeConvenience
      : c.storeOther;
}

function storeRenderer(style: MapStyle): UniqueValueRenderer {
  const c = MAP_COLOURS[style];
  const symbol = (layer: StoreLayer) =>
    new SimpleMarkerSymbol({
      style: STORE_SHAPES[layer].style,
      size: STORE_SHAPES[layer].size,
      color: rgba(storeColour(c, layer)),
      // On imagery the ground behind a symbol varies, so the outline is wider (validator: orange and
      // violet fall below 3:1 against mid-grey roofs; the navy outline keeps every symbol's edge).
      outline: {
        color: rgba(c.storeOutline, 0.95),
        width: (layer === "supermarket" ? 1.25 : 1) + (style === "imagery" ? 0.6 : 0),
      },
    });
  return new UniqueValueRenderer({
    field: "layer",
    uniqueValueInfos: (["supermarket", "convenience", "other"] as const).map(
      (layer) => new UniqueValueInfo({ value: layer, symbol: symbol(layer), label: layer }),
    ),
  });
}

function clusterReduction(style: MapStyle): FeatureReductionCluster {
  const c = MAP_COLOURS[style];
  return new FeatureReductionCluster({
    clusterRadius: "56px",
    clusterMinSize: "20px",
    clusterMaxSize: "44px",
    maxScale: LOCAL_SCALE,
    popupEnabled: false,
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: rgba(c.clusterFill, 0.92),
      outline: { color: rgba(c.clusterRing, 0.95), width: 1.5 },
    },
    labelingInfo: [
      new LabelClass({
        deconflictionStrategy: "none",
        labelPlacement: "center-center",
        labelExpressionInfo: { expression: "Text($feature.cluster_count, '#,###')" },
        symbol: new TextSymbol({ color: rgba(c.clusterText), font: { size: 9 } }),
      }),
    ],
  });
}

/** Councils: fixed classes with no-data hatch (national scale) or outlines only (local scale, or layer off). */
function councilRenderer(
  m: AccessMapModel,
  style: MapStyle,
  local: boolean,
): { renderer: UniqueValueRenderer; mode: "fills" | "outlines" } {
  const c = MAP_COLOURS[style];
  const selection = { color: rgba(c.selection), width: 2.5 };
  const line = local
    ? { color: rgba(c.councilLine, c.councilLineAlpha), width: 1.1 }
    : { color: rgba(c.councilLine, c.councilLineAlpha * 0.45), width: 0.5 };
  const outlineOnly = (outline: { color: Rgba; width: number }) =>
    new SimpleFillSymbol({ color: [0, 0, 0, 0], outline });
  const infos: UniqueValueInfo[] = [];
  if (m.mode === "profile") {
    // Profiles: every council outlined; the selected one emphasised (outline and a light tint) and
    // comparison councils dashed in the same colour.
    for (const code of m.compareCouncils)
      infos.push(
        new UniqueValueInfo({
          value: code,
          symbol: outlineOnly({ ...selection, width: 2, style: "dash" } as { color: Rgba; width: number }),
        }),
      );
    if (m.selectedCouncil)
      infos.push(
        new UniqueValueInfo({
          value: m.selectedCouncil,
          symbol: new SimpleFillSymbol({
            color: rgba(c.selection, 0.08),
            outline: { ...selection, width: 3 },
          }),
        }),
      );
    return {
      renderer: new UniqueValueRenderer({
        field: "code",
        defaultSymbol: outlineOnly(line),
        uniqueValueInfos: infos,
      }),
      mode: "outlines",
    };
  }
  const fills = !local && m.choropleth !== null;
  if (fills) {
    const separator = { color: rgba(c.separator, c.separatorAlpha * 0.7), width: 0.4 };
    m.choropleth!.classes.forEach((codes, i) => {
      const colour = rgba(c.seq[i] ?? c.seq[0]!);
      for (const code of codes)
        infos.push(
          new UniqueValueInfo({
            value: code,
            label: `class ${i}`,
            symbol: new SimpleFillSymbol({
              color: colour,
              outline: code === m.selectedCouncil ? selection : separator,
            }),
          }),
        );
    });
    for (const code of m.choropleth!.noData)
      infos.push(
        new UniqueValueInfo({
          value: code,
          label: "no data",
          symbol: new SimpleFillSymbol({
            style: "backward-diagonal",
            color: rgba(c.noData, 0.9),
            outline: code === m.selectedCouncil ? selection : separator,
          }),
        }),
      );
  } else if (m.selectedCouncil) {
    infos.push(new UniqueValueInfo({ value: m.selectedCouncil, symbol: outlineOnly(selection) }));
  }
  return {
    renderer: new UniqueValueRenderer({
      field: "code",
      defaultSymbol: outlineOnly(line),
      uniqueValueInfos: infos,
    }),
    mode: fills ? "fills" : "outlines",
  };
}

function overlayGraphics(m: AccessMapModel, style: MapStyle): Graphic[] {
  const c = MAP_COLOURS[style];
  const graphics: Graphic[] = [];
  const p = m.proximity;
  if (p) {
    graphics.push(
      new Graphic({
        geometry: new Polygon({ rings: [p.ring], spatialReference: WGS84 }),
        attributes: { kind: "proximity-ring" },
        symbol: new SimpleFillSymbol({
          color: rgba(c.proximity, 0.07),
          outline: { color: rgba(c.proximity, 0.95), width: 1.5, style: "dash" },
        }),
      }),
    );
    for (const s of p.nearest)
      graphics.push(
        new Graphic({
          geometry: new Polyline({ paths: [[p.point, [s.lon, s.lat]]], spatialReference: WGS84 }),
          attributes: { kind: "proximity-line", id: s.id },
          symbol: new SimpleLineSymbol({ color: rgba(c.proximity, 0.9), width: 1.25, style: "short-dash" }),
        }),
      );
    graphics.push(
      new Graphic({
        geometry: new Point({ longitude: p.point[0], latitude: p.point[1] }),
        attributes: { kind: "proximity-point" },
        symbol: new SimpleMarkerSymbol({
          style: "circle",
          size: 11,
          color: rgba(c.proximityPoint),
          outline: { color: rgba(c.proximityPointOutline), width: 2.5 },
        }),
      }),
    );
  }
  if (m.selectedStore)
    graphics.push(
      new Graphic({
        geometry: new Point({ longitude: m.selectedStore.lon, latitude: m.selectedStore.lat }),
        attributes: { kind: "selected-store", id: m.selectedStore.id },
        symbol: new SimpleMarkerSymbol({
          style: "circle",
          size: 20,
          color: [0, 0, 0, 0],
          outline: { color: rgba(c.selection), width: 2.5 },
        }),
      }),
    );
  return graphics;
}

type Hit =
  | { kind: "store"; id: number; graphic: NonNullable<HitResult["graphic"]> }
  | { kind: "cluster"; count: number; graphic: NonNullable<HitResult["graphic"]> }
  | { kind: "grocer"; id: number; graphic: NonNullable<HitResult["graphic"]> }
  | { kind: "area"; code: string; graphic: NonNullable<HitResult["graphic"]> }
  | { kind: "council"; code: string; graphic: NonNullable<HitResult["graphic"]> };

export class AccessLayersController implements LayerController {
  readonly id = ACCESS_STORES_LAYER_ID;
  private view: GoToView | null = null;
  private report: LayerStatusReporter | null = null;
  private councils: GeoJSONLayer | null = null;
  private stores: GeoJSONLayer | null = null;
  private overlay: GraphicsLayer | null = null;
  /** Deep-profile small areas (graphics, below the councils) and NI grocers (above the stores). */
  private areas: GraphicsLayer | null = null;
  private grocers: GraphicsLayer | null = null;
  private areaGraphicsByCode = new Map<string, Graphic>();
  private areaModel: ProfileMapModel | null = null;
  private storesUrl: string | null = null;
  private councilsUrl: string | null = null;
  private handles: { remove(): void }[] = [];
  private layerViews = new Map<unknown, HighlightableLayerView>();
  private hoverHighlight: { remove(): void } | null = null;
  private highlightedKey: string | null = null;
  private hoverFrame = 0;
  /** Hit tests can resolve out of order: only the latest one may set the hover (see onPointerMove). */
  private hoverSeq = 0;
  private lastHover: string | null = null;
  private visible = false;
  private profile = false;
  private picking = false;
  private local = false;
  private reducedMotion = false;
  private style: MapStyle = "dark";
  private signature = {
    councils: "",
    storesStyle: "",
    where: "",
    overlay: "",
    areas: "",
    areaStyle: "",
    grocers: "",
  };
  /** Council renderer rebuilds so far (exposed on the view container for tests). */
  private councilBuilds = 0;

  constructor(private readonly actions: AccessActions) {}

  activate(view: ViewLike, report: LayerStatusReporter): void {
    this.view = view as GoToView;
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
    const m = state.accessMap;
    const visible = (state.module === "access" || state.module === "profiles") && m !== null;
    this.profile = visible && m?.mode === "profile";
    this.reducedMotion = selectReducedMotion(state);
    this.picking = visible && state.proximityPicking;
    const container = this.view?.container;
    if (container) container.style.cursor = this.picking ? "crosshair" : "";
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
    this.local = selectLocalScale(state);
    if (m.councilsUrl !== this.councilsUrl || !this.councils) this.createCouncils(m);
    if (m.storesUrl !== this.storesUrl || !this.stores) this.createStores(m);
    if (!this.overlay) {
      this.overlay = new GraphicsLayer({ id: ACCESS_OVERLAY_LAYER_ID, listMode: "hide" });
      this.view.map?.add(this.overlay);
    }

    const choropleth = m.choropleth
      ? `${m.choropleth.measure}:${m.choropleth.classes.map((c) => c.join(",")).join("/")}:${m.choropleth.noData.join(",")}`
      : "off";
    const councils = `${m.mode}|${style}|${this.local}|${choropleth}|${m.selectedCouncil ?? ""}|${m.compareCouncils.join(",")}`;
    if (councils !== this.signature.councils && this.councils) {
      const { renderer, mode } = councilRenderer(m, style, this.local);
      this.councils.renderer = renderer;
      this.councilBuilds += 1;
      if (container) {
        container.dataset.accessCouncils = mode;
        container.dataset.accessCouncilBuilds = String(this.councilBuilds);
      }
      this.signature.councils = councils;
    }
    if (style !== this.signature.storesStyle && this.stores) {
      this.stores.renderer = storeRenderer(style);
      this.stores.featureReduction = clusterReduction(style);
      this.signature.storesStyle = style;
    }
    if (m.storeWhere !== this.signature.where && this.stores) {
      this.stores.definitionExpression = m.storeWhere;
      this.signature.where = m.storeWhere;
      if (container) container.dataset.accessStoreWhere = m.storeWhere;
    }
    const overlay = `${style}|${JSON.stringify(m.selectedStore)}|${JSON.stringify(m.proximity)}`;
    if (overlay !== this.signature.overlay && this.overlay) {
      this.overlay.removeAll();
      this.overlay.addMany(overlayGraphics(m, style));
      this.signature.overlay = overlay;
    }
    this.updateGrocers(m, style);
    this.updateAreas(this.profile ? state.profileMap : null, style);
  }

  /** NI grocers from the FSA register (S29): drawn while the layer is on; never part of a rate. */
  private updateGrocers(m: AccessMapModel, style: MapStyle): void {
    const view = this.view;
    if (!view) return;
    const sig = m.grocers ? `${style}|${m.grocers.points.length}|${m.grocers.points[0]?.id ?? ""}` : "";
    if (sig === this.signature.grocers) return;
    this.signature.grocers = sig;
    if (!m.grocers) {
      if (this.grocers) this.grocers.visible = false;
      return;
    }
    if (!this.grocers) {
      this.grocers = new GraphicsLayer({
        id: ACCESS_GROCERS_LAYER_ID,
        title: "Other NI grocers (FSA register)",
        listMode: "hide",
        minScale: ZOOM0_SCALE / 2 ** REGISTER_GROCERS_MIN_ZOOM,
      });
      view.map?.add(this.grocers, this.overlay ? this.insertIndex(this.overlay) : undefined);
    }
    this.grocers.visible = this.visible;
    this.grocers.removeAll();
    this.grocers.addMany(grocerGraphics(m.grocers.points, style));
    const container = view.container;
    if (container) container.dataset.accessGrocers = String(m.grocers.points.length);
  }

  /**
   * Deep-profile small areas: graphics rebuilt when the areas change (council or geography),
   * re-symbolised in place when classes, selection, chart highlight or basemap style change.
   */
  private updateAreas(pm: ProfileMapModel | null, style: MapStyle): void {
    const view = this.view;
    if (!view) return;
    const container = view.container;
    if (!pm) {
      if (this.areas) this.areas.visible = false;
      this.areaModel = null;
      if (container) delete container.dataset.profileAreas;
      return;
    }
    if (!this.areas) {
      this.areas = new GraphicsLayer({ id: PROFILE_AREAS_LAYER_ID, title: "Small areas", listMode: "hide" });
      // Below the council outlines and the stores.
      view.map?.add(this.areas, this.councils ? this.insertIndex(this.councils) : 0);
      this.watchLayerView(this.areas);
    }
    this.areas.visible = this.visible;
    if (pm.key !== this.signature.areas) {
      this.areas.removeAll();
      const graphics = areaGraphics(pm, style);
      this.areaGraphicsByCode = new Map(graphics.map((g) => [String(g.attributes.code), g]));
      this.areas.addMany(graphics);
      this.signature.areas = pm.key;
      this.signature.areaStyle = this.areaStyleKey(pm, style);
    } else {
      const sig = this.areaStyleKey(pm, style);
      if (sig !== this.signature.areaStyle) {
        for (const [code, g] of this.areaGraphicsByCode)
          g.symbol = areaSymbol(pm, pm.classOf[code] ?? null, areaState(pm, code), style);
        this.signature.areaStyle = sig;
      }
    }
    this.areaModel = pm;
    if (container) {
      container.dataset.profileAreas = `${pm.lad}:${pm.measure}:${pm.areas.length}`;
      container.dataset.profileSelectedArea = pm.selected ?? "";
      container.dataset.profileHighlighted = String(pm.highlighted.length);
    }
  }

  private areaStyleKey(pm: ProfileMapModel, style: MapStyle): string {
    return `${style}|${pm.measure}|${pm.firstColour}|${pm.selected ?? ""}|${pm.highlighted.join(",")}|${JSON.stringify(pm.classOf)}`;
  }

  /** Fits a council (focusCouncil); false when the councils are not drawn. */
  handleCommand(command: MapCommand, context: { reducedMotion: boolean }): boolean {
    if (command.type !== "focusCouncil" || !this.councils || !this.view) return false;
    const view = this.view;
    const code = command.code.replace(/'/g, "''");
    this.councils
      .queryExtent({ where: `code = '${code}'` })
      .then(({ extent }) => {
        if (!extent || this.view !== view) return;
        return view.goTo(
          extent.clone().expand(1.3),
          context.reducedMotion ? { animate: false } : { animate: true, duration: FLIGHT_DURATION_MS },
        );
      })
      .catch(() => undefined);
    return true;
  }

  deactivate(view: ViewLike): void {
    for (const h of this.handles) h.remove();
    this.handles = [];
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
    this.setHoverHighlight(null);
    this.layerViews.clear();
    for (const l of this.layers()) {
      view.map?.remove(l);
      l.destroy();
    }
    this.councils = this.stores = this.overlay = this.areas = this.grocers = null;
    this.areaGraphicsByCode.clear();
    this.areaModel = null;
    this.storesUrl = this.councilsUrl = null;
    this.signature = {
      councils: "",
      storesStyle: "",
      where: "",
      overlay: "",
      areas: "",
      areaStyle: "",
      grocers: "",
    };
    this.view = null;
    this.report = null;
  }

  private layers(): (GeoJSONLayer | GraphicsLayer)[] {
    return [this.areas, this.councils, this.stores, this.grocers, this.overlay].filter(
      (l): l is GeoJSONLayer | GraphicsLayer => l !== null,
    );
  }

  private createCouncils(m: AccessMapModel): void {
    const view = this.view;
    if (!view) return;
    if (this.councils) {
      view.map?.remove(this.councils);
      this.councils.destroy();
    }
    this.councilsUrl = m.councilsUrl;
    this.signature.councils = "";
    const layer = new GeoJSONLayer({
      id: ACCESS_COUNCILS_LAYER_ID,
      url: m.councilsUrl,
      title: "Councils (May 2025)",
      copyright: m.councilsCopyright,
      outFields: ["code", "name"],
      popupEnabled: false,
      legendEnabled: false,
      listMode: "hide",
    });
    this.councils = layer;
    // Below the stores and the overlay, which are added after it.
    view.map?.add(layer, this.insertIndex());
    this.watchLayerView(layer);
  }

  private createStores(m: AccessMapModel): void {
    const view = this.view;
    if (!view) return;
    if (this.stores) {
      view.map?.remove(this.stores);
      this.stores.destroy();
    }
    this.storesUrl = m.storesUrl;
    this.signature.storesStyle = "";
    this.signature.where = "";
    const layer = new GeoJSONLayer({
      id: ACCESS_STORES_LAYER_ID,
      url: m.storesUrl,
      title: "Grocery stores (GEOLYTIX)",
      copyright: m.storesCopyright,
      objectIdField: "id",
      outFields: ["id", "layer", "retailer"],
      definitionExpression: m.storeWhere,
      // Supermarkets on top, then other formats, then convenience stores.
      orderBy: [
        new OrderByInfo({
          valueExpression: "When($feature.layer == 'supermarket', 1, $feature.layer == 'other', 2, 3)",
          order: "ascending",
        }),
      ],
      popupEnabled: false,
      legendEnabled: false,
      listMode: "hide",
    });
    this.stores = layer;
    view.map?.add(layer, this.overlay ? this.insertIndex(this.overlay) : undefined);
    // Reported once the layer is assigned (the report changes the store; MapController then syncs again).
    this.report?.("loading");
    this.watchLayerView(layer, true);
  }

  /** Index just below `before` (or the end of the map's layers). */
  private insertIndex(before?: unknown): number | undefined {
    const layers = (this.view?.map as { layers?: { indexOf(l: unknown): number } } | null | undefined)
      ?.layers;
    const target = before ?? this.stores ?? this.overlay;
    if (!layers || !target) return undefined;
    const i = layers.indexOf(target);
    return i >= 0 ? i : undefined;
  }

  private watchLayerView(layer: GeoJSONLayer | GraphicsLayer, reports = false): void {
    const view = this.view;
    if (!view) return;
    view
      .whenLayerView(layer)
      .then((lv) => {
        if (!this.layers().includes(layer)) return;
        this.layerViews.set(layer, lv as HighlightableLayerView);
        if (reports) this.report?.("ready");
      })
      .catch((err: unknown) => {
        if (reports && this.layers().includes(layer))
          this.report?.("error", err instanceof Error ? err.message : "Layer failed to load");
      });
  }

  private hitLayers(): unknown[] {
    const layers: unknown[] = [];
    if (this.stores) layers.push(this.stores);
    if (this.grocers?.visible) layers.push(this.grocers);
    if (this.areas?.visible && this.areaModel) layers.push(this.areas);
    if (this.councils && !this.local) layers.push(this.councils);
    return layers;
  }

  /** What is under the pointer, by priority: a store or cluster, an NI grocer, a small area, a council. */
  private hitFrom(results: HitResult[]): Hit | null {
    let grocer: Hit | null = null;
    let area: Hit | null = null;
    let council: Hit | null = null;
    for (const r of results) {
      const g = r.graphic;
      if (r.type !== "graphic" || !g) continue;
      const a = g.attributes ?? {};
      if (g.layer === this.stores) {
        if (g.isAggregate) return { kind: "cluster", count: Number(a.cluster_count ?? 0), graphic: g };
        if (typeof a.id === "number") return { kind: "store", id: a.id, graphic: g };
      } else if (g.layer === this.grocers && !grocer && typeof a.id === "number") {
        grocer = { kind: "grocer", id: a.id, graphic: g };
      } else if (g.layer === this.areas && !area && typeof a.code === "string") {
        area = { kind: "area", code: a.code, graphic: g };
      } else if (g.layer === this.councils && !council && typeof a.code === "string") {
        council = { kind: "council", code: a.code, graphic: g };
      }
    }
    return grocer ?? area ?? council;
  }

  private async onClick(e: ViewPointerEvent): Promise<void> {
    if (!this.visible || !this.view?.hitTest) return;
    if (this.picking) {
      const lon = e.mapPoint?.longitude;
      const lat = e.mapPoint?.latitude;
      if (typeof lon === "number" && typeof lat === "number") this.actions.setProximityPoint([lon, lat]);
      return;
    }
    const { results } = await this.view.hitTest(e, { include: this.hitLayers() });
    const hit = this.hitFrom(results);
    if (!hit) return this.actions.selectStore(null);
    if (hit.kind === "store") return this.actions.selectStore(hit.id);
    if (hit.kind === "grocer") return;
    if (hit.kind === "area") return this.actions.selectArea(hit.code);
    if (hit.kind === "council")
      return this.profile ? this.actions.pickCouncil(hit.code) : this.actions.selectCouncil(hit.code);
    // A cluster: zoom in towards it (at most to local scale, where stores are drawn individually).
    const view = this.view;
    const zoom = Math.min(view.zoom + 2, LOCAL_ZOOM + 0.5);
    view
      .goTo(
        { target: hit.graphic.geometry, zoom },
        this.reducedMotion ? { animate: false } : { animate: true, duration: 600 },
      )
      .catch(() => undefined);
  }

  private onPointerMove(e: ViewPointerEvent): void {
    if (!this.visible || !this.view?.hitTest) return;
    if (this.hoverFrame) cancelAnimationFrame(this.hoverFrame);
    const view = this.view;
    const { x, y } = e;
    this.hoverFrame = requestAnimationFrame(() => {
      this.hoverFrame = 0;
      // A slower hit test for an earlier position must not overwrite a newer one (seen on CI: the
      // tooltip stayed on the previous partner after the pointer moved on).
      const seq = ++this.hoverSeq;
      void view.hitTest!({ x, y }, { include: this.hitLayers() }).then(({ results }) => {
        if (seq !== this.hoverSeq || !this.visible) return;
        const hit = this.hitFrom(results);
        if (!hit) return this.clearHover();
        const id =
          hit.kind === "store" || hit.kind === "grocer"
            ? String(hit.id)
            : hit.kind === "council" || hit.kind === "area"
              ? hit.code
              : String(hit.count);
        const key = `${hit.kind}:${id}`;
        this.lastHover = key;
        this.setHoverHighlight(hit.kind === "cluster" ? null : hit.graphic, key);
        if (hit.kind === "area") {
          this.actions.setHoverAccess(null);
          this.actions.setHoverArea({ code: id, x, y });
        } else {
          this.actions.setHoverArea(null);
          this.actions.setHoverAccess({ kind: hit.kind, id, x, y });
        }
      });
    });
  }

  private clearHover(): void {
    this.setHoverHighlight(null);
    if (this.lastHover === null) return;
    this.lastHover = null;
    this.actions.setHoverAccess(null);
    this.actions.setHoverArea(null);
  }

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
