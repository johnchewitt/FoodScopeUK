import { describe, expect, it, vi } from "vitest";
import { BASEMAP_STATUS_ID } from "../layerIds";
import type { LayerStatusReporter, ViewLike } from "../types";
import { BASEMAP_FAILED_MESSAGE, BasemapStatusController, type LoadableBasemap } from "./basemapStatus";

const view = {} as ViewLike;

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
    expect(new BasemapStatusController(null).id).toBe(BASEMAP_STATUS_ID);
  });

  it("reports nothing when there is no basemap (offline outline map)", async () => {
    const report = reporter();
    new BasemapStatusController(null).activate(view, report);
    await new Promise((r) => setTimeout(r, 0));
    expect(report).not.toHaveBeenCalled();
  });

  it("reports ready only after the base and reference layers load", async () => {
    const report = reporter();
    new BasemapStatusController(basemap({ base: ["ok"], reference: ["ok"] })).activate(view, report);
    expect(report).toHaveBeenLastCalledWith("loading");
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith("ready"));
  });

  it("reports an error when the basemap itself fails to load", async () => {
    const report = reporter();
    new BasemapStatusController(basemap({ load: "fail" })).activate(view, report);
    await vi.waitFor(() => expect(report).toHaveBeenLastCalledWith("error", BASEMAP_FAILED_MESSAGE));
  });

  it("reports an error when any basemap layer fails (e.g. the key is refused)", async () => {
    const report = reporter();
    new BasemapStatusController(basemap({ base: ["fail"], reference: ["ok"] })).activate(view, report);
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
    const controller = new BasemapStatusController(pending);
    controller.activate(view, report);
    controller.deactivate();
    resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(report.mock.calls).toEqual([["loading"]]);
  });
});
