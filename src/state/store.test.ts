import { beforeEach, describe, expect, it } from "vitest";
import { resetAppStore, selectReducedMotion, useAppStore } from "./store";

const s = () => useAppStore.getState();

beforeEach(() => resetAppStore());

describe("layout initialisation", () => {
  it("opens both panels on first desktop measurement", () => {
    s().setBreakpoint("desktop");
    expect(s()).toMatchObject({ filterPanelOpen: true, insightsOpen: true, layoutInitialised: true });
  });

  it("starts with panels closed on mobile and tablet", () => {
    s().setBreakpoint("mobile");
    expect(s()).toMatchObject({ filterPanelOpen: false, insightsOpen: false });
    resetAppStore();
    s().setBreakpoint("tablet");
    expect(s()).toMatchObject({ filterPanelOpen: false, insightsOpen: false });
  });

  it("closes the insights panel when shrinking to an overlay layout", () => {
    s().setBreakpoint("desktop");
    s().setBreakpoint("tablet");
    expect(s().insightsOpen).toBe(false);
  });
});

describe("panels", () => {
  it("allows both panels docked on desktop", () => {
    s().setBreakpoint("desktop");
    s().toggleFilterPanel(true);
    s().toggleInsights(true);
    expect(s()).toMatchObject({ filterPanelOpen: true, insightsOpen: true });
  });

  it("shows only one overlay panel at a time on tablet", () => {
    s().setBreakpoint("tablet");
    s().toggleFilterPanel(true);
    s().toggleInsights(true);
    expect(s()).toMatchObject({ filterPanelOpen: false, insightsOpen: true });
  });

  it("toggles without an argument", () => {
    s().setBreakpoint("desktop");
    s().toggleFilterPanel();
    expect(s().filterPanelOpen).toBe(false);
  });
});

describe("navigation", () => {
  it("setModule closes the mobile drawer", () => {
    s().toggleMobileNav(true);
    s().setModule("risks");
    expect(s()).toMatchObject({ module: "risks", mobileNavOpen: false });
  });

  it("stepMonth wraps in both directions and starts from the ends", () => {
    s().stepMonth(1);
    expect(s().month).toBe(1);
    s().setMonth(12);
    s().stepMonth(1);
    expect(s().month).toBe(1);
    s().stepMonth(-1);
    expect(s().month).toBe(12);
    s().setMonth(null);
    s().stepMonth(-1);
    expect(s().month).toBe(12);
  });

  it("setMonth clamps out-of-range values", () => {
    s().setMonth(15);
    expect(s().month).toBe(12);
    s().setMonth(0);
    expect(s().month).toBe(1);
  });
});

describe("map commands", () => {
  it("issues commands with increasing ids", () => {
    s().issueMapCommand({ type: "goTo", target: "uk" });
    const first = s().mapCommand;
    s().issueMapCommand({ type: "goTo", target: "uk" });
    expect(s().mapCommand?.id).toBeGreaterThan(first?.id ?? 0);
  });

  it("records layer status with optional message", () => {
    s().setLayerStatus("x", "error", "boom");
    expect(s().layerStatus.x).toEqual({ status: "error", message: "boom" });
  });
});

describe("reduced motion", () => {
  it("follows either the OS or the in-app preference", () => {
    expect(selectReducedMotion(s())).toBe(false);
    s().setSystemPrefersReducedMotion(true);
    expect(selectReducedMotion(s())).toBe(true);
    s().setSystemPrefersReducedMotion(false);
    s().setMotionPreference("reduced");
    expect(selectReducedMotion(s())).toBe(true);
  });
});
