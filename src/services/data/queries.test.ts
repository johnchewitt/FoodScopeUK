import { afterEach, describe, expect, it, vi } from "vitest";
import { readRepoJson } from "@/test/files";
import type { DataManifest } from "@/types/generated/manifest";
import { DataLoadError, describeDataError } from "./errors";
import { familySnapshot, loadConfig, loadManifest, summariseFreshness } from "./queries";

const manifest = readRepoJson<DataManifest>("public/data/manifest.json");

function mockFetch(impl: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(impl));
}

afterEach(() => vi.unstubAllGlobals());

describe("loadManifest", () => {
  it("returns the validated committed manifest", async () => {
    mockFetch(async () => new Response(JSON.stringify(manifest), { status: 200 }));
    await expect(loadManifest()).resolves.toEqual(manifest);
  });

  it("raises a typed http error", async () => {
    mockFetch(async () => new Response("nope", { status: 503 }));
    await expect(loadManifest()).rejects.toMatchObject({ kind: "http" });
  });

  it("raises a typed parse error", async () => {
    mockFetch(async () => new Response("{not json", { status: 200 }));
    await expect(loadManifest()).rejects.toMatchObject({ kind: "parse" });
  });

  it("raises a typed validation error with details", async () => {
    mockFetch(async () => new Response(JSON.stringify({ schemaVersion: 2 }), { status: 200 }));
    const err = await loadManifest().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DataLoadError);
    expect((err as DataLoadError).kind).toBe("validation");
    expect((err as DataLoadError).details.length).toBeGreaterThan(0);
  });

  it("raises a typed network error", async () => {
    mockFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(loadConfig()).rejects.toMatchObject({ kind: "network" });
  });
});

describe("summariseFreshness", () => {
  it("reports loading and errors", () => {
    expect(summariseFreshness(undefined, "pending").state).toBe("loading");
    expect(summariseFreshness(undefined, "error").state).toBe("error");
  });

  it("says no statistics are loaded when only reference data exists (Stage 1)", () => {
    const referenceOnly: DataManifest = {
      ...manifest,
      snapshotId: null,
      datasets: manifest.datasets.filter((d) => d.role === "reference"),
    };
    const f = summariseFreshness(referenceOnly, "success");
    expect(f.state).toBe("none");
    expect(f.label).toBe("No statistics loaded");
  });

  it("reports each data family's snapshot from the committed manifest", () => {
    const f = summariseFreshness(manifest, "success");
    expect(f.state).toBe("current");
    // Five families (Stage 5): the pill shows the date range; the detail names each family.
    expect(f.label).toBe("Data 2026-10-23 to 2026-10-25");
    expect(f.short).toBe("Data 23–25 Oct");
    expect(f.detail).toMatch(
      /its own latest snapshot: trade 2026-10-23, stores and population 2026-10-24, small areas 2026-10-25, council context and uk production 2026-10-25, ni food register 2026-10-24/,
    );
    expect(familySnapshot(manifest, "trade")).toBe("2026-10-23");
    expect(familySnapshot(manifest, "local")).toBe("2026-10-24");
    expect(familySnapshot(manifest, "areas")).toBe("2026-10-25");
    expect(familySnapshot(manifest, "production")).toBeNull();
  });

  it("names both families when there are two", () => {
    const two: DataManifest = { ...manifest, snapshots: { trade: "2026-10-23", local: "2026-10-24" } };
    const f = summariseFreshness(two, "success");
    expect(f.label).toBe("Trade 2026-10-23 · Stores and population 2026-10-24");
    expect(f.short).toBe("Trade 23 Oct · Stores 24 Oct");
  });

  it("reads one snapshot for everything from manifests written before families", () => {
    const withStats: DataManifest = {
      ...manifest,
      snapshots: undefined,
      snapshotId: "2026-11-15",
      datasets: [
        ...manifest.datasets,
        { ...manifest.datasets[0]!, id: "synthetic.stat", role: "statistical" },
      ],
    };
    expect(summariseFreshness(withStats, "success")).toMatchObject({
      state: "current",
      label: "Snapshot 2026-11-15",
      short: "Snapshot 15 Nov",
    });
    expect(familySnapshot(withStats, "trade")).toBe("2026-11-15");
  });
});

describe("describeDataError", () => {
  it("gives plain-English causes", () => {
    expect(describeDataError(new DataLoadError("timeout", "Data index", "t"))).toMatch(/took too long/);
    expect(describeDataError(new DataLoadError("validation", "Data index", "v"))).toMatch(/published schema/);
    expect(describeDataError(new Error("x"))).toBe("x");
  });
});
