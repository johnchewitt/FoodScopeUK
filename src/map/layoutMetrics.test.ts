import { describe, expect, it } from "vitest";
import { readRepoFile } from "@/test/files";
import {
  ATTRIBUTION_H,
  GAP,
  KPI_H,
  PANEL_WIDTHS,
  RAIL_W,
  TIMELINE_H,
  TIMELINE_H_SEASONAL,
  breakpointForWidth,
  computeViewPadding,
  framingPadding,
  LEGEND_W,
  paddingEquals,
} from "./layoutMetrics";

describe("breakpointForWidth", () => {
  it.each([
    [390, "mobile"],
    [767, "mobile"],
    [768, "tablet"],
    [1023, "tablet"],
    [1024, "tablet"],
    [1279, "tablet"],
    [1280, "laptop"],
    [1366, "laptop"],
    [1439, "laptop"],
    [1440, "desktop"],
    [1920, "desktop"],
  ])("%i px → %s", (w, bp) => expect(breakpointForWidth(w)).toBe(bp));
});

describe("computeViewPadding", () => {
  it("reserves space for docked panels on desktop", () => {
    const p = computeViewPadding({
      breakpoint: "desktop",
      filterPanelOpen: true,
      insightsOpen: true,
      timelineVisible: true,
    });
    expect(p).toEqual({
      top: 104,
      left: 12 + 76 + 8 + 312 + 12,
      right: 12 * 2 + 340,
      bottom: 22 + 12 + 64 + 12,
    });
  });

  it("ignores overlay panels on tablet so the map centre does not jump", () => {
    const p = computeViewPadding({
      breakpoint: "tablet",
      filterPanelOpen: true,
      insightsOpen: true,
      timelineVisible: false,
    });
    expect(p.left).toBe(GAP + RAIL_W + 8);
    expect(p.right).toBe(0);
    expect(p.bottom).toBe(ATTRIBUTION_H + GAP);
  });

  it("has no rail offset on mobile", () => {
    const p = computeViewPadding({
      breakpoint: "mobile",
      filterPanelOpen: false,
      insightsOpen: false,
      timelineVisible: true,
    });
    expect(p.left).toBe(0);
  });

  it("reserves the taller Seasonal Supply timeline", () => {
    const p = computeViewPadding({
      breakpoint: "desktop",
      filterPanelOpen: true,
      insightsOpen: true,
      timelineVisible: true,
      timelineHeight: TIMELINE_H_SEASONAL,
    });
    expect(p.bottom).toBe(22 + 12 + 88 + 12);
  });

  it("compares paddings by value", () => {
    const a = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(paddingEquals(a, { ...a })).toBe(true);
    expect(paddingEquals(a, { ...a, left: 5 })).toBe(false);
    expect(paddingEquals(null, a)).toBe(false);
  });
});

describe("CSS tokens stay in sync with layout metrics", () => {
  const css = readRepoFile("src/styles/tokens.css");
  const root = css.slice(0, css.indexOf("@media"));
  const px = (name: string) => Number(new RegExp(`--${name}:\\s*(\\d+)px`).exec(root)?.[1]);

  it("matches the shared constants", () => {
    expect(px("fs-gap")).toBe(GAP);
    expect(px("fs-rail-w")).toBe(RAIL_W);
    expect(px("fs-kpi-h")).toBe(KPI_H);
    expect(px("fs-timeline-h")).toBe(TIMELINE_H);
    expect(px("fs-timeline-h-seasonal")).toBe(TIMELINE_H_SEASONAL);
    expect(px("fs-attribution-h")).toBe(ATTRIBUTION_H);
    expect(px("fs-filter-w")).toBe(PANEL_WIDTHS.desktop.filter);
    expect(px("fs-insights-w")).toBe(PANEL_WIDTHS.desktop.insights);
  });
});

describe("framingPadding", () => {
  const p = { top: 104, right: 364, bottom: 110, left: 420 };
  it("keeps clear of the desktop legend column", () => {
    expect(framingPadding(p, "desktop")).toEqual({ ...p, left: 420 + LEGEND_W + GAP });
  });
  it("is the view padding elsewhere (legend collapsed or hidden)", () => {
    expect(framingPadding(p, "laptop")).toEqual(p);
    expect(framingPadding(p, "mobile")).toEqual(p);
  });
  it("reads padding exposed through getters (MapView's Accessor padding)", () => {
    class AccessorPadding {
      get top() {
        return 104;
      }
      get right() {
        return 364;
      }
      get bottom() {
        return 110;
      }
      get left() {
        return 420;
      }
    }
    expect(framingPadding(new AccessorPadding(), "laptop")).toEqual(p);
    expect(framingPadding(new AccessorPadding(), "desktop").left).toBe(420 + LEGEND_W + GAP);
  });
  it("matches the legend width in app.css", () => {
    const css = readRepoFile("src/styles/app.css");
    const rule = /\.map-legend \{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toContain(`width: ${LEGEND_W}px;`);
  });
});
