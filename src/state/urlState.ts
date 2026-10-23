import { DEFAULT_MODULE, isModuleId, type ModuleId } from "@/app/modules";

/** Overlays that can be deep-linked (SH-06 Evidence page, Help). */
export const OVERLAYS = ["none", "evidence", "help"] as const;
export type Overlay = (typeof OVERLAYS)[number];

export const PERIOD_MODES = ["rolling12", "month", "year"] as const;
export type PeriodMode = (typeof PERIOD_MODES)[number];
export type Measure = "mass" | "value";
export const DEFAULT_COMMODITY = "tomatoes";

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
};

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

  const monthNum = mo !== null && /^\d{1,2}$/.test(mo) ? Number(mo) : NaN;
  const yearNum = y !== null && /^\d{4}$/.test(y) ? Number(y) : NaN;
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
