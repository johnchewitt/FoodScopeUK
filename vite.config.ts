/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { viteStaticCopy } from "vite-plugin-static-copy";

/**
 * ArcGIS SDK asset hosting (ADR-14):
 *  - "cdn"   (default): assets load from js.arcgis.com, pinned to the installed versions.
 *  - "local": assets are copied into the build under `arcgis/` so the app runs without
 *             reaching the Esri CDN (used for offline/sandboxed testing).
 */
function arcgisLocalAssets(): PluginOption {
  return viteStaticCopy({
    // Structure is preserved; stripBase removes the leading package path segments.
    targets: [
      { src: "node_modules/@arcgis/core/assets/**/*", dest: "arcgis/core/assets", rename: { stripBase: 4 } },
      {
        src: "node_modules/@esri/calcite-components/dist/cdn/assets/**/*",
        dest: "arcgis/calcite/assets",
        rename: { stripBase: 6 },
      },
      {
        src: "node_modules/@arcgis/map-components/dist/cdn/assets/**/*",
        dest: "arcgis/map-components/assets",
        rename: { stripBase: 6 },
      },
      {
        src: "node_modules/@arcgis/common-components/dist/cdn/assets/**/*",
        dest: "arcgis/common-components/assets",
        rename: { stripBase: 6 },
      },
    ],
  });
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.BASE_PATH ?? "/FoodScopeUK/";
  const assetsMode = env.VITE_ARCGIS_ASSETS === "local" ? "local" : "cdn";

  return {
    base,
    plugins: [react(), ...(assetsMode === "local" ? [arcgisLocalAssets()] : [])],
    resolve: {
      alias: { "@": new URL("./src", import.meta.url).pathname },
    },
    build: {
      target: "es2023",
      // ArcGIS chunks make source maps very large; enable with SOURCEMAP=true when debugging.
      sourcemap: env.SOURCEMAP === "true",
      chunkSizeWarningLimit: 3000,
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
      css: false,
      restoreMocks: true,
    },
  };
});
