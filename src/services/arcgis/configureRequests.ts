import esriConfig from "@arcgis/core/config";
import { readArcgisEnv } from "./env";
import { applyRequestPolicy } from "./requestPolicy";

/** Applies the request policy to the SDK. Must run before the SDK makes its first request. */
export function configureArcgisRequests(): void {
  applyRequestPolicy(esriConfig, readArcgisEnv().apiKey);
}
