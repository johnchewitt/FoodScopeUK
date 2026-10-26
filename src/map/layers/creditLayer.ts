import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";

/**
 * A layer that draws nothing and carries a data credit into the map's attribution.
 *
 * GraphicsLayers have no `copyright`, so the SDK's attribution never names the source of data drawn
 * as graphics (the ports of the Risk Explorer and Scenario D: DfT, OGL, and EMODnet, CC BY 4.0,
 * which requires the credit). Its owner shows it exactly when the graphics are shown, so the credit
 * appears with the data and leaves with it (review of Stage 7; "Don't hide data attribution").
 */
export interface CreditLayer {
  layer: GeoJSONLayer;
  setText(text: string): void;
  dispose(): void;
}

const EMPTY = JSON.stringify({ type: "FeatureCollection", features: [] });

export function createCreditLayer(id: string, text: string): CreditLayer {
  const url = URL.createObjectURL(new Blob([EMPTY], { type: "application/geo+json" }));
  const layer = new GeoJSONLayer({
    id,
    url,
    geometryType: "point",
    copyright: text,
    title: text,
    listMode: "hide",
    legendEnabled: false,
    popupEnabled: false,
  });
  return {
    layer,
    setText(next) {
      if (layer.copyright !== next) layer.copyright = next;
    },
    dispose() {
      layer.destroy();
      URL.revokeObjectURL(url);
    },
  };
}
