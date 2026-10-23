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
export const ATTRIBUTION_H = 22;

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
}: PaddingInputs): ViewPadding {
  const docked = breakpoint === "desktop" || breakpoint === "laptop";
  const widths = PANEL_WIDTHS[breakpoint];
  const railEdge = breakpoint === "mobile" ? 0 : GAP + RAIL_W + RAIL_TO_PANEL;
  const left = docked && filterPanelOpen ? railEdge + widths.filter + GAP : railEdge;
  const right = docked && insightsOpen ? GAP * 2 + widths.insights : 0;
  const top = GAP + (breakpoint === "mobile" ? KPI_H_MOBILE : KPI_H);
  const bottom = ATTRIBUTION_H + GAP + (timelineVisible ? TIMELINE_H + GAP : 0);
  return { top, right, bottom, left };
}

export function paddingEquals(a: ViewPadding | null | undefined, b: ViewPadding): boolean {
  return !!a && a.top === b.top && a.right === b.right && a.bottom === b.bottom && a.left === b.left;
}
