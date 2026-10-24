import { afterEach, describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/types/generated/manifest";
import { staticSnapshotAdapter } from "./adapters";
import { adapterFor, featureLayerAdapter, MAX_PAGES } from "./featureLayerAdapter";

/**
 * A mock FeatureLayer (no network): obviously synthetic stores served in pages, with hosted field
 * names that differ from the canonical schema, as `fieldMap` in config.json allows.
 */
const URL_BASE = "https://example.invalid/arcgis/rest/services/Stores/FeatureServer/0";
const DATASET = { id: "local.stores", title: "Grocery stores" } as Dataset;
const FIELDS = ["id", "retailer", "name"] as const;

function page(rows: { OBJECTID: number; STORE_ID: number; RETAILER: string; NAME: string }[], more: boolean) {
  return {
    type: "FeatureCollection",
    features: rows.map((r) => ({
      type: "Feature",
      id: r.OBJECTID,
      geometry: { type: "Point", coordinates: [-1.5, 53.5] },
      properties: r,
    })),
    ...(more ? { properties: { exceededTransferLimit: true } } : {}),
  };
}

function mockPages(pages: unknown[]) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(url);
      const body = pages[calls.length - 1];
      return new Response(JSON.stringify(body), { status: 200 });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("featureLayerAdapter (SM-01)", () => {
  const adapter = featureLayerAdapter(
    { url: `${URL_BASE}/`, fieldMap: { id: "STORE_ID", retailer: "RETAILER", name: "NAME" } },
    FIELDS,
  );

  it("pages through the layer and renames fields to the canonical schema", async () => {
    const calls = mockPages([
      page([{ OBJECTID: 1, STORE_ID: 101, RETAILER: "Retailer A", NAME: "Store A" }], true),
      page([{ OBJECTID: 2, STORE_ID: 102, RETAILER: "Retailer B", NAME: "Store B" }], false),
    ]);
    const out = (await adapter.load(DATASET)) as {
      features: { id: number; properties: Record<string, unknown> }[];
    };
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain(`${URL_BASE}/query?where=1%3D1&outFields=*`);
    expect(calls[0]).toContain("f=geojson&resultOffset=0");
    expect(calls[1]).toContain("resultOffset=1");
    expect(out.features.map((f) => f.id)).toEqual([101, 102]);
    expect(out.features[1]!.properties).toEqual({ id: 102, retailer: "Retailer B", name: "Store B" });
    expect(adapter.kind).toBe("arcgis-feature-layer");
  });

  it("fills unmapped canonical fields with null, so schema validation rejects them", async () => {
    mockPages([
      {
        type: "FeatureCollection",
        features: [{ type: "Feature", geometry: null, properties: { STORE_ID: 7 } }],
      },
    ]);
    const out = (await adapter.load(DATASET)) as { features: { properties: Record<string, unknown> }[] };
    expect(out.features[0]!.properties).toEqual({ id: 7, retailer: null, name: null });
  });

  it("reports a service error and stops after the page limit", async () => {
    mockPages([{ error: { code: 400, message: "Invalid query" } }]);
    await expect(adapter.load(DATASET)).rejects.toMatchObject({ kind: "http", message: "Invalid query" });

    mockPages(
      Array.from({ length: MAX_PAGES + 1 }, (_, i) =>
        page([{ OBJECTID: i, STORE_ID: i, RETAILER: "R", NAME: "N" }], true),
      ),
    );
    await expect(adapter.load(DATASET)).rejects.toThrow(/more than 50 pages/);
  });
});

describe("adapterFor", () => {
  it("uses the static snapshot unless config.json lists a hosted layer for the dataset", () => {
    const config = {
      schemaVersion: 1 as const,
      featureFlags: { globe3d: false },
      hostedLayers: { "test.hosted": { url: "https://example.test/FeatureServer/0" } },
    };
    expect(adapterFor(undefined, "test.hosted", ["id"])).toBe(staticSnapshotAdapter);
    expect(adapterFor(config, "test.other", ["id"])).toBe(staticSnapshotAdapter);
    expect(adapterFor(config, "test.hosted", ["id"]).kind).toBe("arcgis-feature-layer");
  });
});
