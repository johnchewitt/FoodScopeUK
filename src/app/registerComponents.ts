/**
 * Registers the Calcite elements the shell renders. Imported only from main.tsx so component
 * tests (jsdom) never load them. <arcgis-map> is registered by the lazily loaded MapHost chunk.
 */
import "@esri/calcite-components/components/calcite-dialog";
import "@esri/calcite-components/components/calcite-loader";
import "@esri/calcite-components/components/calcite-switch";
