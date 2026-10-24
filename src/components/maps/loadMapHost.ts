/**
 * The map chunk (MapHost and the ArcGIS SDK). Shared by the lazy component in App and main.tsx,
 * which starts the download before React's first render so the SDK and the first view's data
 * load side by side.
 */
export const loadMapHost = () => import("./MapHost");
