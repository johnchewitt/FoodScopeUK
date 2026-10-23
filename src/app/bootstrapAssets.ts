/**
 * Side-effect module imported first by main.tsx. ES module imports are evaluated in order,
 * so asset paths (ADR-14) and the request policy (ADR-11) are configured before any
 * component module is evaluated or the SDK makes its first request.
 */
import { configureArcgisAssets } from "@/services/arcgis/assets";
import { configureArcgisRequests } from "@/services/arcgis/configureRequests";

configureArcgisAssets();
configureArcgisRequests();
