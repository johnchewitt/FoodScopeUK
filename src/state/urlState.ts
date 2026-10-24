import { DEFAULT_MODULE, isModuleId, type ModuleId } from "@/app/modules";
import {
  DEFAULT_STORE_LAYERS,
  STORE_LAYERS,
  type ProvisionMeasure,
  type StoreLayer,
} from "@/analysis/retail";

/** Overlays that can be deep-linked (SH-06 Evidence page, Help). */
export const OVERLAYS = ["none", "evidence", "help"] as const;
export type Overlay = (typeof OVERLAYS)[number];

export const PERIOD_MODES = ["rolling12", "month", "year"] as const;
export type PeriodMode = (typeof PERIOD_MODES)[number];
export type Measure = "mass" | "value";
export const DEFAULT_COMMODITY = "tomatoes";
/** Seasonal heatmap colour (SS-04/SS-05): share of the month, amount, or change vs the comparison year. */
export const HEATMAP_MODES = ["share", "amount", "change"] as const;
export type HeatmapMode = (typeof HEATMAP_MODES)[number];
/** Council layer in UK Food Access (SM-06): a provision measure, or off. */
export type CouncilLayer = ProvisionMeasure | "off";
/** Curated basemaps (SH-08). */
export const BASEMAP_IDS = ["dark", "light", "imagery"] as const;
export type BasemapId = (typeof BASEMAP_IDS)[number];

/** State mirrored in the query string (ADR-13, SH-04). */
export interface UrlState {
  module: ModuleId;
  /** Calendar month 1–12 on the timeline; null = latest published month (Food Origins). */
  month: number | null;
  lad: string | null;
  overlay: Overlay;
  /** Food Origins (FO-01, FO-02, FO-07): commodity basket id, period, year, measure, partner. */
  commodity: string;
  period: PeriodMode;
  year: number | null;
  measure: Measure;
  /** Selected recorded import partner key (ISO alpha-2, or hmrc-<id> for non-country categories). */
  partner: string | null;
  /** Seasonal Supply (SS-01, SS-05): comparison year (null = the year before), comparison month (null = off), heatmap colour. */
  compareYear: number | null;
  compareMonth: number | null;
  heatmap: HeatmapMode;
  /** UK Food Access (SM-03): store layers shown, retailers shown (null = all), council layer, selected store. */
  storeLayers: StoreLayer[];
  retailers: string[] | null;
  councilLayer: CouncilLayer;
  store: number | null;
  /** Basemap style (SH-08). */
  basemap: BasemapId;
}

export const DEFAULT_URL_STATE: UrlState = {
  module: DEFAULT_MODULE,
  month: null,
  lad: null,
  overlay: "none",
  commodity: DEFAULT_COMMODITY,
  period: "rolling12",
  year: null,
  measure: "mass",
  partner: null,
  compareYear: null,
  compareMonth: null,
  heatmap: "share",
  storeLayers: [...DEFAULT_STORE_LAYERS],
  retailers: null,
  councilLayer: "supermarkets",
  store: null,
  basemap: "dark",
};

const LAYER_PARAM: Record<StoreLayer, string> = { supermarket: "s", convenience: "c", other: "o" };
const COUNCIL_PARAM: Record<CouncilLayer, string> = {
  supermarkets: "s",
  convenience: "c",
  all: "a",
  off: "off",
};
const RETAILER_NAME = /^[\p{L}\p{N} &'.()-]{1,60}$/u;
const MAX_RETAILERS = 60;

function parseStoreLayers(v: string | null): StoreLayer[] {
  if (v === null) return [...DEFAULT_STORE_LAYERS];
  if (v === "none") return [];
  const codes = v.split(",");
  return STORE_LAYERS.filter((l) => codes.includes(LAYER_PARAM[l]));
}

function serialiseStoreLayers(layers: readonly StoreLayer[]): string | null {
  const sorted = STORE_LAYERS.filter((l) => layers.includes(l));
  if (sorted.join() === [...DEFAULT_STORE_LAYERS].join()) return null;
  return sorted.length ? sorted.map((l) => LAYER_PARAM[l]).join(",") : "none";
}

function parseRetailers(v: string | null): string[] | null {
  if (v === null) return null;
  if (v === "") return [];
  const names = [...new Set(v.split(",").map((s) => s.trim()))].filter((s) => RETAILER_NAME.test(s));
  return names.slice(0, MAX_RETAILERS).sort();
}

const PERIOD_PARAM: Record<PeriodMode, string> = { rolling12: "r12", month: "m", year: "y" };
const COMMODITY_ID = /^[a-z][a-z0-9-]{0,39}$/;
const PARTNER_KEY = /^([A-Z]{2}|hmrc-\d{1,5})$/;

/** GSS codes for UK local authority districts: E/N/S/W followed by eight digits. */
const GSS_CODE = /^[ENSW]\d{8}$/;

export function isGssCode(value: string): boolean {
  return GSS_CODE.test(value);
}

/** Parse a query string. Invalid values fall back to defaults rather than throwing. */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const m = params.get("m");
  const mo = params.get("mo");
  const lad = params.get("lad");
  const view = params.get("view");
  const c = params.get("c");
  const pm = params.get("pm");
  const y = params.get("y");
  const ms = params.get("ms");
  const p = params.get("p");
  const cy = params.get("cy");
  const cm = params.get("cm");
  const hm = params.get("hm");
  const sl = params.get("sl");
  const rt = params.get("rt");
  const cl = params.get("cl");
  const st = params.get("st");
  const bm = params.get("bm");

  const monthNum = mo !== null && /^\d{1,2}$/.test(mo) ? Number(mo) : NaN;
  const yearNum = y !== null && /^\d{4}$/.test(y) ? Number(y) : NaN;
  const compareYearNum = cy !== null && /^\d{4}$/.test(cy) ? Number(cy) : NaN;
  const compareMonthNum = cm !== null && /^\d{1,2}$/.test(cm) ? Number(cm) : NaN;
  const period = (Object.keys(PERIOD_PARAM) as PeriodMode[]).find((k) => PERIOD_PARAM[k] === pm);

  return {
    module: isModuleId(m) ? m : DEFAULT_URL_STATE.module,
    month: Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null,
    lad: lad && isGssCode(lad.toUpperCase()) ? lad.toUpperCase() : null,
    overlay: view === "evidence" || view === "help" ? view : "none",
    commodity: c && COMMODITY_ID.test(c) ? c : DEFAULT_URL_STATE.commodity,
    period: period ?? DEFAULT_URL_STATE.period,
    year: Number.isInteger(yearNum) && yearNum >= 1990 && yearNum <= 2100 ? yearNum : null,
    measure: ms === "value" ? "value" : "mass",
    partner: p && PARTNER_KEY.test(p) ? p : null,
    compareYear:
      Number.isInteger(compareYearNum) && compareYearNum >= 1990 && compareYearNum <= 2100
        ? compareYearNum
        : null,
    compareMonth:
      Number.isInteger(compareMonthNum) && compareMonthNum >= 1 && compareMonthNum <= 12
        ? compareMonthNum
        : null,
    heatmap: (HEATMAP_MODES as readonly string[]).includes(hm ?? "") ? (hm as HeatmapMode) : "share",
    storeLayers: parseStoreLayers(sl),
    retailers: parseRetailers(rt),
    councilLayer:
      (Object.keys(COUNCIL_PARAM) as CouncilLayer[]).find((k) => COUNCIL_PARAM[k] === cl) ??
      DEFAULT_URL_STATE.councilLayer,
    store: st !== null && /^\d{1,12}$/.test(st) ? Number(st) : null,
    basemap: (BASEMAP_IDS as readonly string[]).includes(bm ?? "") ? (bm as BasemapId) : "dark",
  };
}

/** Serialise state to a query string ("" when everything is default). Order is stable. */
export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.module !== DEFAULT_URL_STATE.module) params.set("m", state.module);
  if (state.commodity !== DEFAULT_URL_STATE.commodity) params.set("c", state.commodity);
  if (state.period !== DEFAULT_URL_STATE.period) params.set("pm", PERIOD_PARAM[state.period]);
  if (state.year !== null) params.set("y", String(state.year));
  if (state.month !== null) params.set("mo", String(state.month));
  if (state.measure !== DEFAULT_URL_STATE.measure) params.set("ms", state.measure);
  if (state.partner !== null) params.set("p", state.partner);
  if (state.compareYear !== null) params.set("cy", String(state.compareYear));
  if (state.compareMonth !== null) params.set("cm", String(state.compareMonth));
  if (state.heatmap !== DEFAULT_URL_STATE.heatmap) params.set("hm", state.heatmap);
  const sl = serialiseStoreLayers(state.storeLayers);
  if (sl !== null) params.set("sl", sl);
  if (state.retailers !== null) params.set("rt", [...state.retailers].sort().join(","));
  if (state.councilLayer !== DEFAULT_URL_STATE.councilLayer)
    params.set("cl", COUNCIL_PARAM[state.councilLayer]);
  if (state.store !== null) params.set("st", String(state.store));
  if (state.basemap !== DEFAULT_URL_STATE.basemap) params.set("bm", state.basemap);
  if (state.lad !== null) params.set("lad", state.lad);
  if (state.overlay !== "none") params.set("view", state.overlay);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Navigation-worthy changes create a history entry; fine adjustments replace it. */
export function historyModeFor(prev: UrlState, next: UrlState): "push" | "replace" {
  return prev.module !== next.module ||
    prev.overlay !== next.overlay ||
    prev.lad !== next.lad ||
    prev.commodity !== next.commodity
    ? "push"
    : "replace";
}
