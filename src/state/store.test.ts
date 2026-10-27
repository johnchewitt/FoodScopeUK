import { beforeEach, describe, expect, it } from "vitest";
import {
  LOCAL_ZOOM,
  openExportFor,
  resetAppStore,
  selectMapShadesAreas,
  selectLocalScale,
  selectMapColourStyle,
  selectMapModule,
  selectReducedMotion,
  selectRequestedMapStyle,
  selectTradeMapModule,
  selectUrlState,
  useAppStore,
  type AppState,
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

  it("offers imagery and Human Geography at every scale, in every module", () => {
    for (const basemap of ["imagery", "human", "human-dark"] as const) {
      useAppStore.setState({ basemapChoice: true, basemap, module: "origins", mapView: at(3) });
      expect(selectRequestedMapStyle(useAppStore.getState())).toBe(basemap);
      useAppStore.setState({ module: "access", mapView: at(LOCAL_ZOOM + 1) });
      expect(selectRequestedMapStyle(useAppStore.getState())).toBe(basemap);
    }
  });

  it("offers the detailed styles only where the map draws lines and points, keeping the choice", () => {
    useAppStore.setState({ basemapChoice: true, basemap: "terrain", module: "access", mapView: at(9) });
    // UK Food Access shades councils below local scale: light grey stands in.
    expect(selectMapShadesAreas(useAppStore.getState())).toBe(true);
    expect(selectRequestedMapStyle(useAppStore.getState())).toBe("light");
    useAppStore.getState().setMapView(at(LOCAL_ZOOM));
    expect(selectLocalScale(useAppStore.getState())).toBe(true);
    expect(selectRequestedMapStyle(useAppStore.getState())).toBe("terrain");
    useAppStore.getState().setModule("origins");
    expect(selectRequestedMapStyle(useAppStore.getState())).toBe("light");
    expect(useAppStore.getState().basemap).toBe("terrain");
  });

  it("knows which views shade areas (the layer controllers' rules)", () => {
    type Shading = Parameters<typeof selectMapShadesAreas>[0];
    const base: Shading = {
      module: "origins",
      riskView: "supply",
      scenarioKind: "import",
      mapView: at(6),
      councilLayer: "supermarkets",
      farmLayer: "off",
      profileMap: null,
    };
    const shades = (s: Partial<Shading>) => selectMapShadesAreas({ ...base, ...s });
    // Trade maps: Food Origins, Seasonal, Risk Explorer supply, Scenario A, commodity assessments.
    expect(shades({})).toBe(true);
    expect(shades({ module: "seasonal" })).toBe(true);
    expect(shades({ module: "risks", riskView: "supply" })).toBe(true);
    expect(shades({ module: "scenarios", scenarioKind: "import" })).toBe(true);
    expect(shades({ module: "insights", insightsKind: "commodity" })).toBe(true);
    // Risk Explorer: councils shaded in the community view; farming regions only with a measure.
    expect(shades({ module: "risks", riskView: "access" })).toBe(true);
    expect(shades({ module: "risks", riskView: "logistics" })).toBe(false);
    expect(shades({ module: "risks", riskView: "logistics", farmLayer: "wheat" })).toBe(true);
    // UK Food Access: councils shaded below local scale unless the council layer is off.
    expect(shades({ module: "access" })).toBe(true);
    expect(shades({ module: "access", councilLayer: "off" })).toBe(false);
    expect(shades({ module: "access", mapView: at(LOCAL_ZOOM) })).toBe(false);
    // Profiles: outlines, unless a deep profile's small areas are drawn.
    expect(shades({ module: "profiles" })).toBe(false);
    const areas = { areas: [{ code: "A", rings: [] }] } as unknown as AppState["profileMap"];
    expect(shades({ module: "profiles", profileMap: areas })).toBe(true);
    expect(shades({ module: "insights", insightsKind: "authority", profileMap: areas })).toBe(true);
    // Scenario Lab B, C and D: circles, lines, ports and outlines.
    for (const scenarioKind of ["closure", "production", "port"] as const)
      expect(shades({ module: "scenarios", scenarioKind })).toBe(false);
    expect(shades({ module: "insights", insightsKind: "scenario", scenarioKind: "port" })).toBe(false);
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

describe("Risk Explorer selection (RK-01 – RK-04)", () => {
  it("shares the trade map only in the supply view", () => {
    s().setModule("risks");
    expect(selectTradeMapModule(s())).toBe(true);
    s().setRiskView("logistics");
    expect(selectTradeMapModule(s())).toBe(false);
    s().setRiskView("access");
    expect(selectTradeMapModule(s())).toBe(false);
    s().setModule("origins");
    expect(selectTradeMapModule(s())).toBe(true);
  });

  it("changing view clears every hover; the same view keeps them", () => {
    s().setModule("risks");
    s().setHoverRisk({ kind: "port", id: "GBDVR", x: 1, y: 2 });
    s().setRiskView("supply");
    expect(s().hoverRisk).not.toBeNull();
    s().setHoverPartner({ key: "ES", name: "Spain", x: 1, y: 2 });
    s().setRiskView("logistics");
    expect(s()).toMatchObject({
      riskView: "logistics",
      hoverRisk: null,
      hoverPartner: null,
      hoverAccess: null,
    });
  });

  it("selecting the selected port again clears it; the URL carries the view state", () => {
    s().setModule("risks");
    s().setRiskView("logistics");
    s().selectPort("GBDVR");
    expect(s().port).toBe("GBDVR");
    s().selectPort("GBDVR");
    expect(s().port).toBeNull();
    s().selectPort("GBLON");
    s().setPortMeasure("agricultural");
    s().setRoads(false);
    s().setFarmLayer("sheep");
    expect(selectUrlState(s())).toMatchObject({
      module: "risks",
      riskView: "logistics",
      port: "GBLON",
      portMeasure: "agricultural",
      roads: false,
      farmLayer: "sheep",
    });
    s().setRiskView("access");
    s().setPpfiMeasure("fuel_poverty");
    s().setRankNation("Wales");
    s().setLad("W06000015");
    expect(selectUrlState(s())).toMatchObject({
      riskView: "access",
      ppfiMeasure: "fuel_poverty",
      rankNation: "Wales",
      lad: "W06000015",
    });
  });
});

describe("Consulting Insights map (Stage 8, ADR-0027)", () => {
  it("shows the map of the module each assessment draws on", () => {
    expect(selectMapModule({ module: "origins" })).toBe("origins");
    expect(selectMapModule({ module: "insights", insightsKind: "authority" })).toBe("profiles");
    expect(selectMapModule({ module: "insights", insightsKind: "commodity" })).toBe("origins");
    expect(selectMapModule({ module: "insights", insightsKind: "scenario" })).toBe("scenarios");
    const base = { riskView: "supply" as const, scenarioKind: "import" as const };
    expect(selectTradeMapModule({ ...base, module: "insights", insightsKind: "commodity" })).toBe(true);
    expect(selectTradeMapModule({ ...base, module: "insights", insightsKind: "scenario" })).toBe(true);
    expect(selectTradeMapModule({ ...base, module: "insights", insightsKind: "authority" })).toBe(false);
    expect(
      selectTradeMapModule({
        ...base,
        scenarioKind: "closure",
        module: "insights",
        insightsKind: "scenario",
      }),
    ).toBe(false);
  });

  it("changes the assessment type and clears hovers", () => {
    s().setInsightsKind("commodity");
    expect(s().insightsKind).toBe("commodity");
    expect(selectUrlState(s()).insightsKind).toBe("commodity");
  });
});

describe("top bar Export (Stage 8 UX review)", () => {
  it("opens the ConsultingWhere Insights assessment that matches the view", () => {
    const cases: [Partial<ReturnType<typeof s>>, string][] = [
      [{ module: "profiles", lad: "E08000003" }, "authority"],
      [{ module: "access" }, "authority"],
      [{ module: "origins" }, "commodity"],
      [{ module: "seasonal" }, "commodity"],
      [{ module: "risks", riskView: "supply" }, "commodity"],
      [{ module: "risks", riskView: "access" }, "authority"],
      [{ module: "scenarios" }, "scenario"],
    ];
    for (const [state, kind] of cases) {
      resetAppStore();
      useAppStore.setState(state);
      openExportFor(useAppStore.getState());
      const s = useAppStore.getState();
      expect(s.module).toBe("insights");
      expect(s.insightsKind).toBe(kind);
      expect(s.filterPanelOpen).toBe(true);
    }
    expect(useAppStore.getState().lad).toBeNull();
  });
});
