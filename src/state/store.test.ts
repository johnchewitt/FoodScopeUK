import { beforeEach, describe, expect, it } from "vitest";
import {
  LOCAL_ZOOM,
  resetAppStore,
  selectImageryAvailable,
  selectLocalScale,
  selectMapColourStyle,
  selectReducedMotion,
  selectRequestedMapStyle,
  selectUrlState,
  useAppStore,
} from "./store";

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

describe("Seasonal playback (SS-03)", () => {
  it("stops when the user changes month, year, commodity, measure, comparison or module", () => {
    const stops: [string, () => void][] = [
      ["setMonth", () => s().setMonth(3)],
      ["setYearMonth", () => s().setYearMonth(2025, 4)],
      ["setYear", () => s().setYear(2024)],
      ["setCommodity", () => s().setCommodity("bananas")],
      ["setMeasure", () => s().setMeasure("value")],
      ["setCompareYear", () => s().setCompareYear(2022)],
      ["setCompareMonth", () => s().setCompareMonth(7)],
      ["setModule", () => s().setModule("origins")],
      ["hydrateFromUrl", () => s().hydrateFromUrl({ ...selectUrlState(s()) })],
    ];
    for (const [name, act] of stops) {
      s().setPlaying(true);
      act();
      expect(s().playing, name).toBe(false);
    }
  });

  it("keeps playing while it advances, and when a partner is followed or the heatmap changes", () => {
    s().setPlaying(true);
    s().playbackStep(2025, 2);
    expect(s()).toMatchObject({ playing: true, year: 2025, month: 2 });
    s().selectPartner("MA");
    s().setHeatmap("amount");
    expect(s().playing).toBe(true);
  });

  it("defaults to 1× (1.2 s per month) and clamps comparison months", () => {
    expect(s().playSpeed).toBe(1);
    s().setPlaySpeed(2);
    expect(s().playSpeed).toBe(2);
    s().setCompareMonth(14);
    expect(s().compareMonth).toBe(12);
    s().setCompareMonth(null);
    expect(s().compareMonth).toBeNull();
  });
});

describe("UK Food Access selection (SM-03, SM-05, SM-07)", () => {
  it("toggles store layers in a fixed order and normalises retailers", () => {
    const s = useAppStore.getState();
    expect(s.storeLayers).toEqual(["supermarket"]);
    s.toggleStoreLayer("other");
    s.toggleStoreLayer("convenience");
    expect(useAppStore.getState().storeLayers).toEqual(["supermarket", "convenience", "other"]);
    s.toggleStoreLayer("supermarket");
    expect(useAppStore.getState().storeLayers).toEqual(["convenience", "other"]);
    s.setRetailers(["Lidl", "Aldi", "Lidl"]);
    expect(useAppStore.getState().retailers).toEqual(["Aldi", "Lidl"]);
    s.setRetailers(null);
    expect(useAppStore.getState().retailers).toBeNull();
  });

  it("selecting the selected council again clears it", () => {
    const s = useAppStore.getState();
    s.selectCouncil("N09000003");
    expect(useAppStore.getState().lad).toBe("N09000003");
    s.selectCouncil("N09000003");
    expect(useAppStore.getState().lad).toBeNull();
  });

  it("clamps the proximity count and radius; choosing a point ends picking", () => {
    const s = useAppStore.getState();
    s.setProximityCount(0);
    expect(useAppStore.getState().proximityCount).toBe(1);
    s.setProximityCount(99);
    expect(useAppStore.getState().proximityCount).toBe(20);
    s.setProximityRadiusKm(0.1);
    expect(useAppStore.getState().proximityRadiusKm).toBe(0.5);
    s.setProximityRadiusKm(3.3);
    expect(useAppStore.getState().proximityRadiusKm).toBe(3.5);
    s.setProximityRadiusKm(50);
    expect(useAppStore.getState().proximityRadiusKm).toBe(20);
    s.setProximityPicking(true);
    s.setProximityPoint([-2.24, 53.48]);
    expect(useAppStore.getState()).toMatchObject({ proximityPicking: false, proximityPoint: [-2.24, 53.48] });
  });
});

describe("basemap choice (SH-08)", () => {
  const at = (zoom: number) => ({ zoom, center: [-2.24, 53.48] as [number, number] });

  it("is dark grey without a key, whatever the URL asks", () => {
    useAppStore.setState({ basemap: "light", basemapChoice: false });
    expect(selectRequestedMapStyle(useAppStore.getState())).toBe("dark");
    expect(selectMapColourStyle(useAppStore.getState())).toBe("dark");
  });

  it("offers imagery only at local scale in the local modules, keeping the choice", () => {
    useAppStore.setState({ basemapChoice: true, basemap: "imagery", module: "access", mapView: at(9) });
    expect(selectImageryAvailable(useAppStore.getState())).toBe(false);
    expect(selectRequestedMapStyle(useAppStore.getState())).toBe("dark");
    useAppStore.getState().setMapView(at(LOCAL_ZOOM));
    expect(selectLocalScale(useAppStore.getState())).toBe(true);
    expect(selectRequestedMapStyle(useAppStore.getState())).toBe("imagery");
    useAppStore.getState().setModule("origins");
    expect(selectRequestedMapStyle(useAppStore.getState())).toBe("dark");
    expect(useAppStore.getState().basemap).toBe("imagery");
  });

  it("uses the dark colour set while a basemap has failed", () => {
    useAppStore.setState({ basemapChoice: true, basemap: "light", mapView: at(6) });
    expect(selectMapColourStyle(useAppStore.getState())).toBe("light");
    useAppStore.getState().setLayerStatus("basemap", "error", "failed");
    expect(selectRequestedMapStyle(useAppStore.getState())).toBe("light");
    expect(selectMapColourStyle(useAppStore.getState())).toBe("dark");
  });

  it("records the view only when it moved", () => {
    const s = useAppStore.getState();
    s.setMapView(at(6));
    const first = useAppStore.getState().mapView;
    s.setMapView({ zoom: 6.001, center: [-2.24, 53.48] });
    expect(useAppStore.getState().mapView).toBe(first);
    s.setMapView(at(7));
    expect(useAppStore.getState().mapView?.zoom).toBe(7);
  });
});

describe("Local Authority Profiles selection (LP-01, LP-06, LP-07)", () => {
  it("changing council clears the small area and chart outline and cleans the comparison", () => {
    s().setLad("E08000003");
    s().setCompare(["N09000003", "E08000003", "W06000015"]);
    expect(s().compare).toEqual(["N09000003", "W06000015"]);
    s().selectArea("E01005063");
    s().setAreaHighlight({ label: "Synthetic class", codes: ["E01005063"] });
    s().setLad("N09000003");
    expect(s().area).toBeNull();
    expect(s().areaHighlight).toBeNull();
    expect(s().compare).toEqual(["W06000015"]);
  });

  it("toggles comparison councils up to three; selecting an area twice clears it", () => {
    s().setLad("E08000003");
    for (const c of ["N09000003", "W06000015", "S12000036", "E06000001"]) s().toggleCompare(c);
    expect(s().compare).toEqual(["N09000003", "W06000015", "S12000036"]);
    s().toggleCompare("W06000015");
    expect(s().compare).toEqual(["N09000003", "S12000036"]);
    s().selectArea("E01005063");
    s().selectArea("E01005063");
    expect(s().area).toBeNull();
  });

  it("a new map measure clears the chart outline; the URL carries the profile state", () => {
    s().setModule("profiles");
    s().setLad("N09000003");
    s().setAreaHighlight({ label: "Synthetic class", codes: ["95GG35S1"] });
    s().setAreaMeasure("deprivation");
    expect(s().areaHighlight).toBeNull();
    s().setNiGrocers(true);
    expect(selectUrlState(s())).toMatchObject({
      module: "profiles",
      lad: "N09000003",
      areaMeasure: "deprivation",
      niGrocers: true,
    });
  });

  it("back/forward to another council or measure drops the chart outline", () => {
    s().setLad("N09000003");
    s().setAreaHighlight({ label: "Synthetic class", codes: ["95GG35S1"] });
    s().hydrateFromUrl({ ...selectUrlState(s()) });
    expect(s().areaHighlight).not.toBeNull(); // same council and measure: kept
    s().hydrateFromUrl({ ...selectUrlState(s()), lad: "E08000003" });
    expect(s().areaHighlight).toBeNull();
  });
});
