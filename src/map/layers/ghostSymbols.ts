import { hexToRgb } from "@/analysis/colour";
import { MAP_COLOURS, type MapStyle } from "@/styles/palette";

/**
 * Scenario A's "ghost": the disrupted partner's baseline connection drawn behind and around its
 * narrower scenario line (ADR-0026, review of Stage 7). SDK-free CIM JSON, so it is unit-tested.
 *
 * Widths are in the same unit as `flowLineSymbolData` (CIM points), so the ghost is exactly as
 * wide as the baseline line would be, casing included (`width + 2`). Two parts:
 * - a faint body under the scenario line (the area the baseline covered);
 * - two dashed edges at ± half that width, drawn above the scenario line, so the baseline extent
 *   stays visible however small the reduction (the legend's dashed outline sample).
 */
export const GHOST_EDGE_WIDTH = 1.25;
export const GHOST_DASH: [number, number] = [4, 3];

/** The baseline line's full width (core plus its 2 pt casing), in CIM points. */
export function ghostExtent(baselineWidth: number): number {
  return Math.max(0, baselineWidth) + 2;
}

export function ghostBodySymbolData(baselineWidth: number, style: MapStyle = "dark") {
  const sel = hexToRgb(MAP_COLOURS[style].selection);
  return {
    type: "CIMSymbolReference",
    symbol: {
      type: "CIMLineSymbol",
      symbolLayers: [
        {
          type: "CIMSolidStroke",
          enable: true,
          width: ghostExtent(baselineWidth),
          color: [...sel, 40],
          capStyle: "Round",
          joinStyle: "Round",
        },
      ],
    },
  };
}

export function ghostEdgesSymbolData(baselineWidth: number, style: MapStyle = "dark") {
  const sel = hexToRgb(MAP_COLOURS[style].selection);
  const half = ghostExtent(baselineWidth) / 2;
  const edge = (offset: number) => ({
    type: "CIMSolidStroke",
    enable: true,
    width: GHOST_EDGE_WIDTH,
    color: [...sel, 235],
    capStyle: "Butt",
    joinStyle: "Round",
    effects: [
      { type: "CIMGeometricEffectOffset", method: "Rounded", offset, option: "Fast" },
      { type: "CIMGeometricEffectDashes", dashTemplate: GHOST_DASH, lineDashEnding: "NoConstraint" },
    ],
  });
  return {
    type: "CIMSymbolReference",
    symbol: { type: "CIMLineSymbol", symbolLayers: [edge(half), edge(-half)] },
  };
}
