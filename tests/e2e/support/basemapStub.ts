import type { Page } from "@playwright/test";

/**
 * Stands in for the Esri Basemap styles service (S25) in E2E tests, which cannot use the real
 * key or reach Esri from CI's sandbox. SDK 5.1 loads a style from two requests (read from
 * `Basemap._loadFromStylesService`): `styles/<id>/self` (metadata) and `webmaps/<id>` (a web map
 * whose `baseMap` holds the layers). The stub web map has one tiled layer of a single flat colour
 * per style, with its own attribution, so tests can tell which style is drawn without Esri data.
 */

/** 8 × 8 px PNG tiles in each style's land tone (test fixtures, obviously synthetic). */
const TILES: Record<string, string> = {
  "dark-gray":
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVR4nGOwxQEYhpYEAODHLcHb92FIAAAAAElFTkSuQmCC",
  "light-gray":
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAD0lEQVR4nGN4gAMwDC0JAKSXqAHu0VR/AAAAAElFTkSuQmCC",
  imagery:
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEUlEQVR4nGPwjrXCihiGlgQAGFI4gYjkwEwAAAAASUVORK5CYII=",
};

export const STUB_ATTRIBUTION = (style: string) => `Stub ${style} basemap (test)`;

export interface StubOptions {
  /** Styles whose web map request fails (HTTP 500), to test the fallback. */
  fail?: string[];
}

/** Routes the styles service and the stub tiles; returns the style ids requested, in order. */
export async function stubBasemapStyles(page: Page, opts: StubOptions = {}): Promise<string[]> {
  const requested: string[] = [];
  await page.route("https://basemapstyles-api.arcgis.com/**", async (route) => {
    const url = new URL(route.request().url());
    const m = /\/styles\/v2\/(styles|webmaps)\/arcgis\/([a-z-]+)(\/self)?$/.exec(url.pathname);
    if (!m) return route.fulfill({ status: 404, body: "not stubbed" });
    const [, kind, style] = m;
    if (kind === "styles") return route.fulfill({ json: { name: style, thumbnailUrl: null } });
    requested.push(style!);
    if (opts.fail?.includes(style!)) return route.fulfill({ status: 500, body: "stubbed failure" });
    return route.fulfill({
      json: {
        spatialReference: { wkid: 102100, latestWkid: 3857 },
        baseMap: {
          title: `Stub ${style}`,
          baseMapLayers: [
            {
              id: `stub-${style}`,
              title: `Stub ${style}`,
              layerType: "WebTiledLayer",
              templateUrl: `https://tiles.stub.test/${style}/{level}/{col}/{row}.png`,
              copyright: STUB_ATTRIBUTION(style!),
              visibility: true,
              opacity: 1,
            },
          ],
        },
      },
    });
  });
  await page.route("https://tiles.stub.test/**", (route) => {
    const style = new URL(route.request().url()).pathname.split("/")[1] ?? "dark-gray";
    return route.fulfill({
      contentType: "image/png",
      body: Buffer.from(TILES[style] ?? TILES["dark-gray"]!, "base64"),
    });
  });
  return requested;
}
