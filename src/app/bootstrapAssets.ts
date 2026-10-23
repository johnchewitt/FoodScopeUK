/**
 * Side-effect module imported first by main.tsx. ES module imports are evaluated in order,
 * so asset paths are configured before any component module is evaluated (ADR-14).
 */
import { configureArcgisAssets } from "@/services/arcgis/assets";

configureArcgisAssets();
