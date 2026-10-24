import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against `vite preview` of an existing production build (build first:
 * `VITE_ARCGIS_ASSETS=local npm run build`). The map needs WebGL2, provided in headless
 * Chromium by SwiftShader.
 *
 * PLAYWRIGHT_CHROMIUM_EXECUTABLE lets sandboxes without Playwright's browser download use an
 * installed Chrome; CI uses `npx playwright install chromium`.
 */
const port = 4173;
/**
 * Basemap choice tests (SH-08) need a build made with an API key, served on a second port, with
 * the Esri styles service stubbed in the test (tests/e2e/support/basemapStub.ts). Build it with
 * `npm run build:e2e-basemap`; without it those tests are not run (CI always builds it).
 */
const basemapPort = 4174;
const basemapBuild = existsSync("dist-basemap/index.html");
const basePath = process.env.BASE_PATH ?? "/FoodScopeUK/";
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
/** Set to test a deployed site instead of a local preview (post-deploy smoke test). */
const remoteBaseUrl = process.env.PLAYWRIGHT_BASE_URL || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // On CI the "github" reporter also turns each failure into a check-run annotation, readable through
  // the GitHub API when the job log and report artifact cannot be downloaded.
  reporter: process.env.CI ? [["list"], ["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: remoteBaseUrl ?? `http://localhost:${port}${basePath}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      ...(executablePath ? { executablePath } : {}),
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /basemap\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
    ...(basemapBuild && !remoteBaseUrl
      ? [
          {
            name: "basemap",
            testMatch: /basemap\.spec\.ts/,
            use: {
              ...devices["Desktop Chrome"],
              viewport: { width: 1920, height: 1080 },
              baseURL: `http://localhost:${basemapPort}${basePath}`,
            },
          },
        ]
      : []),
  ],
  webServer: remoteBaseUrl
    ? undefined
    : [
        {
          command: `npx vite preview --port ${port} --strictPort`,
          url: `http://localhost:${port}${basePath}`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        },
        ...(basemapBuild
          ? [
              {
                command: `npx vite preview --outDir dist-basemap --port ${basemapPort} --strictPort`,
                url: `http://localhost:${basemapPort}${basePath}`,
                reuseExistingServer: !process.env.CI,
                timeout: 60_000,
              },
            ]
          : []),
      ],
});
