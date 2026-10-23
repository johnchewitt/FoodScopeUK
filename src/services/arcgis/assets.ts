import esriConfig from "@arcgis/core/config";
import { setAssetPath as setCommonComponentsAssetPath } from "@arcgis/common-components";
import { setAssetPath as setMapComponentsAssetPath } from "@arcgis/map-components";
import { setAssetPath as setCalciteAssetPath } from "@esri/calcite-components";
import { readArcgisEnv } from "./env";

/**
 * Points the SDK, map components and Calcite at locally hosted assets when built with
 * VITE_ARCGIS_ASSETS=local (ADR-14). In the default "cdn" mode the packages' own defaults
 * (js.arcgis.com, pinned to the installed versions) are used.
 *
 * Must run before any component or SDK module makes its first asset request.
 */
export function configureArcgisAssets(): void {
  const { assets } = readArcgisEnv();
  if (assets !== "local") return;
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  esriConfig.assetsPath = new URL("arcgis/core/assets", base).href;
  setCalciteAssetPath(new URL("arcgis/calcite/", base).href);
  setMapComponentsAssetPath(new URL("arcgis/map-components/", base).href);
  setCommonComponentsAssetPath(new URL("arcgis/common-components/", base).href);
}
