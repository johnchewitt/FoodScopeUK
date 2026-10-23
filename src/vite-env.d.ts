/// <reference types="vite/client" />
/// <reference types="@arcgis/map-components/types/react" />
/// <reference types="@esri/calcite-components/types/react" />

interface ImportMetaEnv {
  readonly VITE_ARCGIS_API_KEY?: string;
  readonly VITE_ARCGIS_ASSETS?: "cdn" | "local";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
