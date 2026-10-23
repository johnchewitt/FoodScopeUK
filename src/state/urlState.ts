import { DEFAULT_MODULE, isModuleId, type ModuleId } from "@/app/modules";

/** Overlays that can be deep-linked (SH-06 Evidence page, Help). */
export const OVERLAYS = ["none", "evidence", "help"] as const;
export type Overlay = (typeof OVERLAYS)[number];

/** State mirrored in the query string (ADR-13, SH-04). */
export interface UrlState {
  module: ModuleId;
  month: number | null;
  lad: string | null;
  overlay: Overlay;
}

export const DEFAULT_URL_STATE: UrlState = {
  module: DEFAULT_MODULE,
  month: null,
  lad: null,
  overlay: "none",
};

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

  const monthNum = mo !== null && /^\d{1,2}$/.test(mo) ? Number(mo) : NaN;

  return {
    module: isModuleId(m) ? m : DEFAULT_URL_STATE.module,
    month: Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null,
    lad: lad && isGssCode(lad.toUpperCase()) ? lad.toUpperCase() : null,
    overlay: view === "evidence" || view === "help" ? view : "none",
  };
}

/** Serialise state to a query string ("" when everything is default). Order is stable. */
export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.module !== DEFAULT_URL_STATE.module) params.set("m", state.module);
  if (state.month !== null) params.set("mo", String(state.month));
  if (state.lad !== null) params.set("lad", state.lad);
  if (state.overlay !== "none") params.set("view", state.overlay);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Navigation-worthy changes create a history entry; fine adjustments replace it. */
export function historyModeFor(prev: UrlState, next: UrlState): "push" | "replace" {
  return prev.module !== next.module || prev.overlay !== next.overlay || prev.lad !== next.lad
    ? "push"
    : "replace";
}
