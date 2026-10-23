import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppStore, useAppStore } from "@/state/store";
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
});
