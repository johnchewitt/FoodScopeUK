import { describe, expect, it } from "vitest";
import { readRepoJson } from "@/test/files";
import { validateConfig, validateIndicator, validateManifest } from "./validate";

const read = (rel: string) => readRepoJson(rel);

describe("committed files validate against their schemas", () => {
  it("public/config.json", () => {
    const r = validateConfig(read("public/config.json"));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("public/data/manifest.json", () => {
    const r = validateManifest(read("public/data/manifest.json"));
    expect(r.errors).toEqual([]);
    expect(r.value?.datasets.map((d) => d.id)).toContain("reference.world_countries_110m");
  });
});

describe("config schema rejects unsafe or malformed values", () => {
  it("rejects non-HTTPS hosted layer URLs", () => {
    const r = validateConfig({
      schemaVersion: 1,
      featureFlags: { globe3d: false },
      hostedLayers: { stores: { url: "http://example.com/FeatureServer/0" } },
    });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown top-level keys (e.g. an accidental apiKey)", () => {
    const r = validateConfig({
      schemaVersion: 1,
      featureFlags: { globe3d: false },
      hostedLayers: {},
      apiKey: "x",
    });
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/additional properties/);
  });
});

describe("manifest schema", () => {
  it("rejects a wrong schema version and reports paths", () => {
    const r = validateManifest({ schemaVersion: 2 });
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("rejects a malformed snapshot id", () => {
    const m = read("public/data/manifest.json") as Record<string, unknown>;
    expect(validateManifest({ ...m, snapshotId: "23/10/2026" }).ok).toBe(false);
    expect(validateManifest({ ...m, snapshotId: "2026-10-23" }).ok).toBe(true);
  });
});

describe("indicator schema", () => {
  const base = {
    id: "synthetic.test",
    label: "Synthetic",
    value: 1,
    unit: "t",
    provenance: "measured",
    sourceIds: ["S01"],
    referencePeriod: "2025-07",
    coverage: "UK",
    method: "test",
    scope: "local",
  };

  it("accepts a complete record", () => expect(validateIndicator(base).ok).toBe(true));
  it("requires at least one source", () =>
    expect(validateIndicator({ ...base, sourceIds: [] }).ok).toBe(false));
  it("rejects unknown provenance classes", () =>
    expect(validateIndicator({ ...base, provenance: "guess" }).ok).toBe(false));
});
