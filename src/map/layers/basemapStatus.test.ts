import { describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/state/store";
import { BASEMAP_STATUS_ID } from "../layerIds";
import type { LayerStatusReporter, ViewLike } from "../types";
import { BASEMAP_FAILED_MESSAGE, BasemapStatusController, type LoadableBasemap } from "./basemapStatus";

const view = { map: { add: vi.fn(), remove: vi.fn() } } as unknown as ViewLike;

const noBasemap = () => null;
const withInitial = (b: LoadableBasemap | null) =>
  new BasemapStatusController(noBasemap, { style: "dark", basemap: b });

function layer(outcome: "ok" | "fail") {
  return {
    load: vi.fn(() => (outcome === "ok" ? Promise.resolve() : Promise.reject(new Error("401")))),
  };
}

function basemap(opts: {
  load?: "ok" | "fail";
  base?: Array<"ok" | "fail">;
  reference?: Array<"ok" | "fail">;
}): LoadableBasemap {
  const base = (opts.base ?? ["ok"]).map(layer);
  const reference = (opts.reference ?? []).map(layer);
  return {
    load: vi.fn(() => (opts.load === "fail" ? Promise.reject(new Error("401")) : Promise.resolve())),
    baseLayers: { toArray: () => base },
    referenceLayers: { toArray: () => reference },
  };
}

function reporter() {
  return vi.fn<LayerStatusReporter>();
}

describe("BasemapStatusController", () => {
  it("uses the shared basemap status id", () => {
    expect(withInitial(null).id).toBe(BASEMAP_STATUS_ID);
  });

  it("reports nothing when there is no basemap (offline outline map)", async () => {
    const report = reporter();
    withInitial(null).activate(view, report);
    await new Promise((r) => setTimeout(r, 0));
    expect(report).not.toHaveBeenCalled();
  });

  it("reports ready only after the base and reference layers load", async () => {
    const report = reporter();
    withInitial(basemap({ base: ["ok"], reference: ["ok"] })).activate(view, report);
    expect(report).toHaveBeenLastCalledWith("loading");
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith("ready"));
  });

  it("reports an error when the basemap itself fails to load", async () => {
    const report = reporter();
    withInitial(basemap({ load: "fail" })).activate(view, report);
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith("error", BASEMAP_FAILED_MESSAGE));
  });

  it("reports an error when any basemap layer fails (e.g. the key is refused)", async () => {
    const report = reporter();
    withInitial(basemap({ base: ["fail"], reference: ["ok"] })).activate(view, report);
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith("error", BASEMAP_FAILED_MESSAGE));
  });

  it("does not report after deactivation", async () => {
    let resolve!: () => void;
    const pending: LoadableBasemap = {
      load: () => new Promise<void>((r) => (resolve = r)),
      baseLayers: { toArray: () => [] },
      referenceLayers: { toArray: () => [] },
    };
    const report = reporter();
    const controller = withInitial(pending);
    controller.activate(view, report);
    controller.deactivate();
    resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(report.mock.calls).toEqual([["loading"]]);
  });

  it("swaps the basemap when the requested style changes, and reports the new one", async () => {
    const created: string[] = [];
    const map = { add: vi.fn(), remove: vi.fn(), basemap: null as unknown };
    const v = { map } as unknown as ViewLike;
    const failing = basemap({ base: ["fail"] });
    const controller = new BasemapStatusController(
      (style) => {
        created.push(style);
        return style === "light" ? failing : basemap({});
      },
      { style: "dark", basemap: basemap({}) },
    );
    const report = reporter();
    controller.activate(v, report);
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith("ready"));
    const state = { ...useAppStore.getState(), basemapChoice: true };
    controller.update({ ...state, basemap: "dark" });
    expect(created).toEqual([]);
    controller.update({ ...state, basemap: "light" });
    expect(created).toEqual(["light"]);
    expect(map.basemap).toBe(failing);
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith("error", BASEMAP_FAILED_MESSAGE));
    // Imagery is requested only at local scale in a local module; elsewhere it falls back to dark.
    controller.update({ ...state, basemap: "imagery", module: "origins" });
    expect(created).toEqual(["light", "dark"]);
    controller.update({
      ...state,
      basemap: "imagery",
      module: "access",
      mapView: { zoom: 13, center: [0, 52] },
    });
    expect(created).toEqual(["light", "dark", "imagery"]);
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith("ready"));
  });

  it("never swaps without a key", () => {
    const create = vi.fn(() => basemap({}));
    const controller = new BasemapStatusController(create, { style: "dark", basemap: null });
    controller.activate(view, reporter());
    controller.update({ ...useAppStore.getState(), basemapChoice: false, basemap: "light" });
    expect(create).not.toHaveBeenCalled();
  });
});
