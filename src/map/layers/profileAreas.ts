import Graphic from "@arcgis/core/Graphic";
import Point from "@arcgis/core/geometry/Point";
import Polygon from "@arcgis/core/geometry/Polygon";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import { hexToRgb } from "@/analysis/colour";
import type { GrocerPoint, ProfileMapModel } from "@/state/store";
import { haloBoost, MAP_COLOURS, type MapStyle } from "@/styles/palette";

/**
 * Symbols for the Local Authority Profiles small-area layer (LP-06) and the NI grocers layer
 * (S29). Small areas are graphics (not a GeoJSON layer) so pointer hit tests stay fast (B29):
 * one graphic per area, its fill the area's fixed class from `ProfileMapModel` (computed in the
 * feature, never here), a hatch for no data (P12), outlines for the selected area and for areas
 * picked from a chart.
 */

const WGS84 = SpatialReference.WGS84;
type Rgba = [number, number, number, number];
const rgba = (hex: string, alpha = 1): Rgba => [...hexToRgb(hex), alpha];

export type AreaState = "normal" | "selected" | "highlighted";

export function areaSymbol(
  model: Pick<ProfileMapModel, "firstColour">,
  classIndex: number | null,
  state: AreaState,
  style: MapStyle,
): SimpleFillSymbol {
  const c = MAP_COLOURS[style];
  const outline =
    state === "selected"
      ? { color: rgba(c.selection), width: 3 }
      : state === "highlighted"
        ? { color: rgba(c.proximity), width: 2.25 }
        : { color: rgba(c.separator, c.separatorAlpha * 0.75), width: 0.5 };
  if (classIndex === null)
    return new SimpleFillSymbol({ style: "backward-diagonal", color: rgba(c.noData, 0.9), outline });
  const colour = c.seq[model.firstColour + classIndex] ?? c.seq[c.seq.length - 1]!;
  return new SimpleFillSymbol({ color: rgba(colour), outline });
}

export function areaState(model: ProfileMapModel, code: string): AreaState {
  if (code === model.selected) return "selected";
  return model.highlighted.includes(code) ? "highlighted" : "normal";
}

/** One graphic per small area (attributes: kind "area", code). */
export function areaGraphics(model: ProfileMapModel, style: MapStyle): Graphic[] {
  return model.areas.map(
    (a) =>
      new Graphic({
        geometry: new Polygon({ rings: a.rings, spatialReference: WGS84 }),
        attributes: { kind: "area", code: a.code },
        symbol: areaSymbol(model, model.classOf[a.code] ?? null, areaState(model, a.code), style),
      }),
  );
}

export function grocerSymbol(style: MapStyle): SimpleMarkerSymbol {
  const c = MAP_COLOURS[style];
  return new SimpleMarkerSymbol({
    style: "diamond",
    size: 9,
    color: [0, 0, 0, 0],
    outline: { color: rgba(c.registerGrocer, 0.95), width: 1.6 + haloBoost(style) * (2 / 3) },
  });
}

export function grocerGraphics(points: readonly GrocerPoint[], style: MapStyle): Graphic[] {
  const symbol = grocerSymbol(style);
  return points.map(
    (p) =>
      new Graphic({
        geometry: new Point({ longitude: p.lon, latitude: p.lat }),
        attributes: { kind: "grocer", id: p.id },
        symbol,
      }),
  );
}
