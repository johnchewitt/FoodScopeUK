import { beforeEach, describe, expect, it, vi } from "vitest";
import { fitBBox } from "@/analysis/frame";
import { framingPadding } from "./layoutMetrics";
import {
  LOCAL_ZOOM,
  resetAppStore,
  useAppStore,
  type AccessMapModel,
  type OriginsMapModel,
} from "@/state/store";
import { MapController, PROFILE_MAX_ZOOM } from "./MapController";
import {
  FLIGHT_DURATION_MS,
  GO_TO_TARGETS,
  type LayerController,
  type LayerStatusReporter,
  type ViewLike,
} from "./types";

function fakeView(): ViewLike & { goTo: ReturnType<typeof vi.fn>; paddingSets: number } {
  let padding = { top: 0, right: 0, bottom: 0, left: 0 };
  const view = {
    paddingSets: 0,
    zoom: 3.4,
    width: 1920,
    height: 1024,
    get padding() {
      return padding;
    },
    set padding(p) {
      padding = p;
      view.paddingSets++;
    },
    goTo: vi.fn(() => Promise.resolve()),
    whenLayerView: vi.fn(() => Promise.resolve({})),
    map: { add: vi.fn(), remove: vi.fn() },
  };
  return view;
}

function fakeLayer() {
  return {
    id: "fake",
    activate: vi.fn<(view: ViewLike, report: LayerStatusReporter) => void>(),
    deactivate: vi.fn<(view: ViewLike) => void>(),
    update: vi.fn<() => void>(),
  } satisfies LayerController;
}

beforeEach(() => {
  resetAppStore();
  useAppStore.getState().setBreakpoint("desktop");
});

describe("MapController", () => {
  it("never updates a layer inside another layer's update; nested store changes run afterwards", () => {
    const view = fakeView();
    let report: LayerStatusReporter = () => undefined;
    let depth = 0;
    let maxDepth = 0;
    const order: string[] = [];
    const reporting: LayerController = {
      id: "reporting",
      activate: (_v, r) => (report = r),
      deactivate: () => undefined,
      update: (state) => {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
        order.push(`a:${state.layerStatus.reporting?.status ?? "none"}`);
        // Reports once its module opens, as a layer does when it creates its layer inside update().
        if (state.module === "access" && !state.layerStatus.reporting) report("loading");
        depth--;
      },
    };
    const after: LayerController = {
      id: "after",
      activate: () => undefined,
      deactivate: () => undefined,
      update: (state) => order.push(`b:${state.layerStatus.reporting?.status ?? "none"}`),
    };
    new MapController(useAppStore, [reporting, after]).attach(view);
    order.length = 0;
    useAppStore.getState().setModule("access");
    expect(maxDepth).toBe(1);
    expect(order).toEqual(["a:none", "b:none", "a:loading", "b:loading"]);
  });

  it("activates layers and applies padding on attach", () => {
    const layer = fakeLayer();
    const view = fakeView();
    new MapController(useAppStore, [layer]).attach(view);
    expect(layer.activate).toHaveBeenCalledOnce();
    expect(view.padding.left).toBeGreaterThan(0);
  });

  it("updates padding from React state and is idempotent", () => {
    const view = fakeView();
    new MapController(useAppStore, []).attach(view);
    const sets = view.paddingSets;
    useAppStore.getState().setMonth(3); // unrelated change
    expect(view.paddingSets).toBe(sets);
    useAppStore.getState().toggleInsights(false);
    expect(view.padding.right).toBe(0);
    expect(view.paddingSets).toBe(sets + 1);
  });

  it("runs each camera command once, animated", () => {
    const view = fakeView();
    new MapController(useAppStore, []).attach(view);
    useAppStore.getState().issueMapCommand({ type: "goTo", target: "uk" });
    useAppStore.getState().setMonth(5); // further state changes must not replay the command
    expect(view.goTo).toHaveBeenCalledTimes(1);
    expect(view.goTo).toHaveBeenCalledWith(GO_TO_TARGETS.uk, { animate: true, duration: FLIGHT_DURATION_MS });
  });

  it("disables animation under reduced motion", () => {
    const view = fakeView();
    new MapController(useAppStore, []).attach(view);
    useAppStore.getState().setMotionPreference("reduced");
    useAppStore.getState().issueMapCommand({ type: "goTo", target: "world" });
    expect(view.goTo).toHaveBeenCalledWith(GO_TO_TARGETS.world, { animate: false });
  });

  it("zooms by whole levels from the current zoom", () => {
    const view = fakeView();
    new MapController(useAppStore, []).attach(view);
    useAppStore.getState().issueMapCommand({ type: "zoom", direction: "in" });
    expect(view.goTo).toHaveBeenCalledWith({ zoom: 4 }, expect.objectContaining({ animate: true }));
  });

  it("does not replay commands issued before attach", () => {
    useAppStore.getState().issueMapCommand({ type: "goTo", target: "uk" });
    const view = fakeView();
    new MapController(useAppStore, []).attach(view);
    expect(view.goTo).not.toHaveBeenCalled();
  });

  it("stops syncing and deactivates layers on detach", () => {
    const layer = fakeLayer();
    const view = fakeView();
    const ctl = new MapController(useAppStore, [layer]);
    ctl.attach(view);
    ctl.detach();
    expect(layer.deactivate).toHaveBeenCalledWith(view);
    useAppStore.getState().issueMapCommand({ type: "goTo", target: "uk" });
    expect(view.goTo).not.toHaveBeenCalled();
    expect(ctl.attached).toBe(false);
  });

  it("routes layer status reports into the store", () => {
    const layer: LayerController = {
      id: "reporting",
      activate: (_view, report) => report("error", "synthetic failure"),
      deactivate: () => {},
    };
    new MapController(useAppStore, [layer]).attach(fakeView());
    expect(useAppStore.getState().layerStatus.reporting).toEqual({
      status: "error",
      message: "synthetic failure",
    });
  });

  describe("framing the recorded partners", () => {
    /** Obviously synthetic map model: commodity "A", one box. */
    const model = (key: string, bbox: [number, number, number, number]): OriginsMapModel => ({
      commodityId: key,
      periodLabel: "synthetic",
      measure: "mass",
      partners: [],
      ukAnchor: [0, 52],
      frame: { key, bbox },
    });
    const BOX_A: [number, number, number, number] = [-20, 25, 15, 58];
    const BOX_B: [number, number, number, number] = [-90, -10, 5, 58];
    const expected = (view: ViewLike, bbox: [number, number, number, number]) =>
      fitBBox(bbox, {
        width: view.width!,
        height: view.height!,
        padding: view.padding,
        framePadding: framingPadding(view.padding, useAppStore.getState().breakpoint),
      });

    it("fits the first frame instantly, inside the panels", () => {
      const view = fakeView();
      new MapController(useAppStore, []).attach(view);
      useAppStore.getState().setOriginsMap(model("A", BOX_A));
      expect(view.goTo).toHaveBeenCalledOnce();
      expect(view.goTo).toHaveBeenCalledWith(expected(view, BOX_A), { animate: false });
      const target = view.goTo.mock.calls[0]![0] as { zoom: number };
      expect(target.zoom).toBeGreaterThan(2.4); // closer than the default world view
    });

    it("does not move on month, year or measure changes (same commodity)", () => {
      const view = fakeView();
      new MapController(useAppStore, []).attach(view);
      useAppStore.getState().setOriginsMap(model("A", BOX_A));
      useAppStore.getState().setMonth(4);
      useAppStore.getState().setOriginsMap(model("A", [-30, 20, 20, 60]));
      expect(view.goTo).toHaveBeenCalledOnce();
    });

    it("flies to a new commodity's frame, instantly under reduced motion", () => {
      const view = fakeView();
      new MapController(useAppStore, []).attach(view);
      useAppStore.getState().setOriginsMap(model("A", BOX_A));
      useAppStore.getState().setOriginsMap(model("B", BOX_B));
      expect(view.goTo).toHaveBeenLastCalledWith(expected(view, BOX_B), {
        animate: true,
        duration: FLIGHT_DURATION_MS,
      });
      useAppStore.getState().setMotionPreference("reduced");
      useAppStore.getState().setOriginsMap(model("A", BOX_A));
      expect(view.goTo).toHaveBeenLastCalledWith(expected(view, BOX_A), { animate: false });
    });

    it("re-applies the frame on request, only in the trade views", () => {
      const view = fakeView();
      new MapController(useAppStore, []).attach(view);
      useAppStore.getState().setOriginsMap(model("A", BOX_A));
      useAppStore.getState().issueMapCommand({ type: "goTo", target: "partners" });
      expect(view.goTo).toHaveBeenCalledTimes(2);
      expect(view.goTo).toHaveBeenLastCalledWith(expected(view, BOX_A), {
        animate: true,
        duration: FLIGHT_DURATION_MS,
      });
      useAppStore.getState().setModule("access");
      useAppStore.getState().issueMapCommand({ type: "goTo", target: "partners" });
      expect(view.goTo).toHaveBeenCalledTimes(2);
      // Returning to a trade view frames it again.
      useAppStore.getState().setModule("origins");
      expect(view.goTo).toHaveBeenCalledTimes(3);
    });

    describe("UK Food Access", () => {
      /** Obviously synthetic access model: only the frame matters here. */
      const access = (bbox: [number, number, number, number], storeWhere = "1=1"): AccessMapModel => ({
        mode: "access",
        compareCouncils: [],
        grocers: null,
        storesUrl: "blob:synthetic",
        storeWhere,
        storesCopyright: "synthetic",
        frame: { key: "access:all-stores", bbox },
        councilsUrl: "synthetic.geojson",
        councilsCopyright: "synthetic",
        choropleth: null,
        selectedStore: null,
        selectedCouncil: null,
        proximity: null,
      });
      const STORES: [number, number, number, number] = [-8, 49, 2, 61];
      const tight = (view: ViewLike) =>
        fitBBox(
          STORES,
          {
            width: view.width!,
            height: view.height!,
            padding: view.padding,
            framePadding: framingPadding(view.padding, useAppStore.getState().breakpoint),
          },
          { minSpanLon: 0, minSpanLat: 0 },
        );

      it("fits the mapped stores once when it opens, not on filter changes", () => {
        const view = fakeView();
        new MapController(useAppStore, []).attach(view);
        useAppStore.getState().setModule("access");
        useAppStore.getState().setAccessMap(access(STORES));
        expect(view.goTo).toHaveBeenCalledOnce();
        expect(view.goTo).toHaveBeenCalledWith(tight(view), { animate: false });
        useAppStore.getState().setAccessMap(access(STORES, "layer = 'A'"));
        expect(view.goTo).toHaveBeenCalledOnce();
      });

      it("flies to it from a trade view, and back to the partners on return", () => {
        const view = fakeView();
        new MapController(useAppStore, []).attach(view);
        useAppStore.getState().setOriginsMap(model("A", BOX_A));
        useAppStore.getState().setModule("access");
        useAppStore.getState().setAccessMap(access(STORES));
        expect(view.goTo).toHaveBeenLastCalledWith(tight(view), {
          animate: true,
          duration: FLIGHT_DURATION_MS,
        });
        useAppStore.getState().setModule("origins");
        expect(view.goTo).toHaveBeenLastCalledWith(expected(view, BOX_A), {
          animate: true,
          duration: FLIGHT_DURATION_MS,
        });
      });

      it("leaves the camera alone when the map is already at local scale", () => {
        const view = fakeView();
        view.zoom = LOCAL_ZOOM + 2;
        new MapController(useAppStore, []).attach(view);
        useAppStore.getState().setModule("access");
        useAppStore.getState().setAccessMap(access(STORES));
        expect(view.goTo).not.toHaveBeenCalled();
        view.zoom = 3; // zooming out later does not trigger the opening frame
        useAppStore.getState().setAccessMap(access(STORES, "layer = 'A'"));
        expect(view.goTo).not.toHaveBeenCalled();
      });
    });

    describe("Local Authority Profiles", () => {
      /** Obviously synthetic profile map: a council box "A" or "B", or the UK frame. */
      const profile = (key: string, bbox: [number, number, number, number]): AccessMapModel => ({
        mode: "profile",
        compareCouncils: [],
        grocers: null,
        storesUrl: "blob:synthetic",
        storeWhere: "1=1",
        storesCopyright: "synthetic",
        frame: { key, bbox },
        councilsUrl: "synthetic.geojson",
        councilsCopyright: "synthetic",
        choropleth: null,
        selectedStore: null,
        selectedCouncil: null,
        proximity: null,
      });
      const COUNCIL_A: [number, number, number, number] = [-6.05, 54.53, -5.8, 54.66];
      const COUNCIL_B: [number, number, number, number] = [-2.32, 53.34, -2.15, 53.55];
      const fitCouncil = (view: ViewLike, bbox: [number, number, number, number]) =>
        fitBBox(
          bbox,
          {
            width: view.width!,
            height: view.height!,
            padding: view.padding,
            framePadding: framingPadding(view.padding, useAppStore.getState().breakpoint),
          },
          { minSpanLon: 0, minSpanLat: 0, maxZoom: PROFILE_MAX_ZOOM },
        );

      it("fits the selected council past the national zoom cap", () => {
        const view = fakeView();
        new MapController(useAppStore, []).attach(view);
        useAppStore.getState().setModule("profiles");
        useAppStore.getState().setAccessMap(profile("profile:A", COUNCIL_A));
        expect(view.goTo).toHaveBeenCalledWith(fitCouncil(view, COUNCIL_A), { animate: false });
        const target = view.goTo.mock.calls[0]![0] as { zoom: number };
        expect(target.zoom).toBeGreaterThan(9);
        expect(target.zoom).toBeLessThanOrEqual(PROFILE_MAX_ZOOM);
      });

      it("flies to each newly selected council, at any scale, and not on other changes", () => {
        const view = fakeView();
        view.zoom = LOCAL_ZOOM + 1;
        new MapController(useAppStore, []).attach(view);
        useAppStore.getState().setModule("profiles");
        useAppStore.getState().setAccessMap(profile("profile:A", COUNCIL_A));
        useAppStore.getState().setAccessMap(profile("profile:B", COUNCIL_B));
        expect(view.goTo).toHaveBeenLastCalledWith(fitCouncil(view, COUNCIL_B), {
          animate: true,
          duration: FLIGHT_DURATION_MS,
        });
        useAppStore
          .getState()
          .setAccessMap({ ...profile("profile:B", COUNCIL_B), storeWhere: "layer = 'A'" });
        expect(view.goTo).toHaveBeenCalledTimes(2);
      });

      it("ignores a UK Food Access frame while in profiles", () => {
        const view = fakeView();
        new MapController(useAppStore, []).attach(view);
        useAppStore.getState().setModule("profiles");
        useAppStore.getState().setAccessMap({ ...profile("access:all-stores", COUNCIL_A), mode: "access" });
        expect(view.goTo).not.toHaveBeenCalled();
      });
    });

    it("waits for a view with a size", () => {
      const view = fakeView();
      view.width = 0;
      new MapController(useAppStore, []).attach(view);
      useAppStore.getState().setOriginsMap(model("A", BOX_A));
      expect(view.goTo).not.toHaveBeenCalled();
      view.width = 1920;
      useAppStore.getState().setMonth(2); // any later sync frames it
      expect(view.goTo).toHaveBeenCalledWith(expected(view, BOX_A), { animate: false });
    });
  });
});
