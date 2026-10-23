/**
 * Layout metrics shared by CSS (src/styles/tokens.css) and the map's view padding.
 * Keep the two in sync — layoutMetrics.test.ts checks the CSS file.
 */
export type Breakpoint = "mobile" | "tablet" | "laptop" | "desktop";

export const GAP = 12;
export const RAIL_W = 76;
export const RAIL_TO_PANEL = 8;
export const KPI_H = 92;
export const KPI_H_MOBILE = 96;
export const TIMELINE_H = 64;
/** Seasonal Supply's timeline also carries month bars and playback controls. */
export const TIMELINE_H_SEASONAL = 88;
export const ATTRIBUTION_H = 22;
/** Map legend card width (app.css `.map-legend`); open by default on desktop only. */
export const LEGEND_W = 236;

export const PANEL_WIDTHS: Record<Breakpoint, { filter: number; insights: number }> = {
  desktop: { filter: 312, insights: 340 },
  laptop: { filter: 288, insights: 320 },
  tablet: { filter: 320, insights: 340 },
  mobile: { filter: 0, insights: 0 },
};

export const BREAKPOINT_MIN_WIDTH: Record<Breakpoint, number> = {
  mobile: 0,
  tablet: 768,
  laptop: 1280,
  desktop: 1440,
};

export function breakpointForWidth(width: number): Breakpoint {
  if (width >= BREAKPOINT_MIN_WIDTH.desktop) return "desktop";
  if (width >= BREAKPOINT_MIN_WIDTH.laptop) return "laptop";
  if (width >= BREAKPOINT_MIN_WIDTH.tablet) return "tablet";
  return "mobile";
}

export interface ViewPadding {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PaddingInputs {
  breakpoint: Breakpoint;
  filterPanelOpen: boolean;
  insightsOpen: boolean;
  timelineVisible: boolean;
  /** Height of the visible timeline (default TIMELINE_H). */
  timelineHeight?: number;
}

/**
 * Map view padding so that map centring (goTo) accounts for the floating UI.
 * On tablet and mobile the panels overlay the map temporarily, so they do not shift the centre.
 */
export function computeViewPadding({
  breakpoint,
  filterPanelOpen,
  insightsOpen,
  timelineVisible,
  timelineHeight = TIMELINE_H,
}: PaddingInputs): ViewPadding {
  const docked = breakpoint === "desktop" || breakpoint === "laptop";
  const widths = PANEL_WIDTHS[breakpoint];
  const railEdge = breakpoint === "mobile" ? 0 : GAP + RAIL_W + RAIL_TO_PANEL;
  const left = docked && filterPanelOpen ? railEdge + widths.filter + GAP : railEdge;
  const right = docked && insightsOpen ? GAP * 2 + widths.insights : 0;
  const top = GAP + (breakpoint === "mobile" ? KPI_H_MOBILE : KPI_H);
  const bottom = ATTRIBUTION_H + GAP + (timelineVisible ? timelineHeight + GAP : 0);
  return { top, right, bottom, left };
}

export function paddingEquals(a: ViewPadding | null | undefined, b: ViewPadding): boolean {
  return !!a && a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}

/**
 * Padding used when framing data (not the view's own padding): on desktop the legend card, open
 * by default, sits at the bottom left of the map, where partners south and west of the UK are
 * drawn, so framing keeps clear of its column as well as of the panels.
 */
export function framingPadding(padding: ViewPadding, breakpoint: Breakpoint): ViewPadding {
  // Read each side explicitly: MapView's padding is an Accessor whose sides are prototype getters,
  // so spreading it would copy nothing.
  const { top, right, bottom, left } = padding;
  return { top, right, bottom, left: breakpoint === "desktop" ? left + LEGEND_W + GAP : left };
}
