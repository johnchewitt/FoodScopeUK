import { beforeEach, describe, expect, it, vi } from "vitest";
import { fitBBox } from "@/analysis/frame";
import { framingPadding } from "./layoutMetrics";
import { resetAppStore, useAppStore, type OriginsMapModel } from "@/state/store";
import { MapController } from "./MapController";
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
