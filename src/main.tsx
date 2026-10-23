// Must stay the first import: sets ArcGIS/Calcite asset paths before components load.
import "./app/bootstrapAssets";

import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@esri/calcite-components/main.css";
import "@arcgis/map-components/main.css";
import "./styles/tokens.css";
import "./styles/calcite-theme.css";
import "./styles/base.css";
import "./styles/app.css";
import "./app/registerComponents";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { AppProviders } from "./app/AppProviders";
import { prefetchStartupData } from "./app/prefetch";
import { loadMapHost } from "./components/maps/loadMapHost";
import { createQueryClient } from "./app/queryClient";
import { parseUrlState } from "./state/urlState";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

// The first view's figures start loading before React renders; the map chunk (ArcGIS SDK) is
// requested straight after, so both download side by side instead of the data waiting for the map.
const queryClient = createQueryClient();
void prefetchStartupData(queryClient, parseUrlState(window.location.search));
void loadMapHost().catch(() => undefined); // errors surface through the lazy component in App

createRoot(root).render(
  <StrictMode>
    <AppProviders client={queryClient}>
      <App />
    </AppProviders>
  </StrictMode>,
);
