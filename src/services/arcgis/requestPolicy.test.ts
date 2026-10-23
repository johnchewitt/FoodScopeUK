import { describe, expect, it } from "vitest";
import { applyRequestPolicy, type ArcgisRequestConfig } from "./requestPolicy";

function sdkDefaults(): ArcgisRequestConfig {
  // Mirrors @arcgis/core 5.1.27 defaults: apiKeys { scopes: [] }, request.useIdentity true.
  return { apiKeys: {}, request: { useIdentity: true } };
}

describe("applyRequestPolicy", () => {
  it("registers the key for the basemap styles service only", () => {
    const config = sdkDefaults();
    applyRequestPolicy(config, "synthetic-test-key");
    expect(config.apiKeys.basemapStyles).toBe("synthetic-test-key");
    // Not set as the global key, which the SDK would send to every *.arcgis.com request.
    expect(config).not.toHaveProperty("apiKey");
  });

  it("never lets the SDK prompt visitors to sign in", () => {
    const withKey = sdkDefaults();
    applyRequestPolicy(withKey, "synthetic-test-key");
    expect(withKey.request.useIdentity).toBe(false);

    const withoutKey = sdkDefaults();
    applyRequestPolicy(withoutKey, null);
    expect(withoutKey.request.useIdentity).toBe(false);
  });

  it("clears a previously registered key when none is configured", () => {
    const config = sdkDefaults();
    applyRequestPolicy(config, "synthetic-test-key");
    applyRequestPolicy(config, null);
    expect(config.apiKeys).not.toHaveProperty("basemapStyles");
  });

  it("is idempotent", () => {
    const once = sdkDefaults();
    const twice = sdkDefaults();
    applyRequestPolicy(once, "synthetic-test-key");
    applyRequestPolicy(twice, "synthetic-test-key");
    applyRequestPolicy(twice, "synthetic-test-key");
    expect(twice).toEqual(once);
  });
});
