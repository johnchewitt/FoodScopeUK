import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readRepoFile } from "@/test/files";
import { prefetchStartupData } from "./prefetch";

vi.mock("@/features/seasonal/load", () => ({ preloadSeasonal: vi.fn() }));

/** Serves committed files from public/ with a short delay, recording concurrency. */
function stubFetch({ failManifest = false } = {}) {
  const calls: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = url.replace(/^.*?\/(data\/.*|config\.json)$/, "$1");
      calls.push(path);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      if (failManifest && path.endsWith("manifest.json")) return new Response("down", { status: 503 });
      return new Response(readRepoFile(`public/${path}`), { status: 200 });
    }),
  );
  return { calls, maxInFlight: () => maxInFlight };
}

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

afterEach(() => vi.unstubAllGlobals());

describe("prefetchStartupData", () => {
  it("loads the index first, then the trade index, points and commodity together", async () => {
    const f = stubFetch();
    const c = client();
    await prefetchStartupData(c, { module: "origins", commodity: "bananas" });
    expect(f.calls[0]).toBe("data/manifest.json");
    expect(new Set(f.calls.slice(1))).toEqual(
      new Set([
        "data/snapshots/2026-10-23/trade/index.json",
        "data/reference/world-country-points.json",
        "data/snapshots/2026-10-23/trade/bananas.json",
      ]),
    );
    expect(f.maxInFlight()).toBe(3); // in parallel, not one after another
    // Cached under the hooks' keys, already validated.
    const snap = c.getQueryData<{ commodity: { id: string } }>([
      "dataset",
      "trade.bananas",
      "static-snapshot",
      "validated",
    ]);
    expect(snap?.commodity.id).toBe("bananas");
    expect(c.getQueryData(["dataset", "trade.index", "static-snapshot", "validated"])).toBeDefined();
  });

  it("only loads the data index for views without data yet", async () => {
    const f = stubFetch();
    await prefetchStartupData(client(), { module: "risks", commodity: "tomatoes" });
    expect(f.calls).toEqual(["data/manifest.json"]);
  });

  it("UK Food Access: loads the stores and council figures, validated, under the hooks' keys", async () => {
    const f = stubFetch();
    const c = client();
    await prefetchStartupData(c, { module: "access", commodity: "tomatoes" });
    expect(f.calls.slice(0, 2)).toEqual(["data/manifest.json", "config.json"]);
    expect(new Set(f.calls.slice(2))).toEqual(
      new Set([
        "data/snapshots/2026-10-24/local/stores.geojson",
        "data/snapshots/2026-10-24/local/lad-indicators.json",
      ]),
    );
    const stores = c.getQueryData<{ features: unknown[] }>([
      "dataset",
      "local.stores",
      "static-snapshot",
      "validated",
    ]);
    expect(stores?.features).toHaveLength(19_183);
    expect(c.getQueryData(["dataset", "local.lad_indicators", "static-snapshot", "validated"])).toBeDefined();
  });

  it("skips an unknown commodity (the hooks fall back) and never throws", async () => {
    const f = stubFetch();
    await prefetchStartupData(client(), { module: "seasonal", commodity: "durian" });
    expect(f.calls).not.toContain("data/snapshots/2026-10-23/trade/durian.json");
    expect(f.calls).toHaveLength(3);
    const failing = stubFetch({ failManifest: true });
    const c = client();
    await expect(
      prefetchStartupData(c, { module: "origins", commodity: "tomatoes" }),
    ).resolves.toBeUndefined();
    // The data index is retried once (STATIC query options); nothing else is requested.
    expect(failing.calls).toEqual(["data/manifest.json", "data/manifest.json"]);
    expect(c.getQueryState(["manifest"])?.status).toBe("error");
  });
});
