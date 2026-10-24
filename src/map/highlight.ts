import { hexToRgb } from "@/analysis/colour";
import HighlightOptions from "@arcgis/core/views/support/HighlightOptions";
import { MAP_COLOURS, type MapStyle } from "@/styles/palette";
import type { ViewLike } from "./types";

/** Named view highlight for the feature under the pointer (shared by the trade and access layers). */
export const HOVER_HIGHLIGHT = "fs-hover";

interface HighlightsCollection {
  find(f: (h: { name?: string }) => boolean): unknown;
  add(h: unknown): void;
}

/**
 * Adds the hover highlight to the view once, and recolours it for the basemap style (a cyan halo
 * on dark grey and imagery, navy on light grey). Hover never rebuilds a renderer.
 */
export function ensureHoverHighlight(view: ViewLike, style: MapStyle): void {
  const highlights = (view as { highlights?: HighlightsCollection }).highlights;
  if (!highlights) return;
  const colour = hexToRgb(MAP_COLOURS[style].hover);
  const existing = highlights.find((h) => h.name === HOVER_HIGHLIGHT) as
    { color: unknown; haloColor: unknown } | undefined;
  if (existing) {
    existing.color = [...colour];
    existing.haloColor = [...colour];
    return;
  }
  highlights.add(
    new HighlightOptions({
      name: HOVER_HIGHLIGHT,
      color: [...colour],
      haloColor: [...colour],
      haloOpacity: 0.95,
      fillOpacity: 0.14,
    }),
  );
}
