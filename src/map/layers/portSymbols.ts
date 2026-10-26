import { hexToRgb } from "@/analysis/colour";
import type { RiskMapModel } from "@/state/store";
import { MAP_COLOURS, type MapStyle } from "@/styles/palette";

/** SDK-free symbol specs for the DfT port circles (Risk Explorer logistics, Scenario Lab port disruption). */
type Rgba = [number, number, number, number];
const rgba = (hex: string, alpha = 1): Rgba => [...hexToRgb(hex), alpha];
/** Marker sizes are in points; the model's radii are in px. */
const PX_TO_PT = 0.75;

/** Port symbols, largest first (so small ports are drawn on top and stay clickable). */
export function portGraphicsData(m: RiskMapModel, style: MapStyle) {
  const c = MAP_COLOURS[style];
  const ordered = [...m.ports].sort((a, b) => b.radius - a.radius || a.locode.localeCompare(b.locode));
  return ordered.flatMap((p) => {
    // Scenario D: the baseline size as a dashed ring (no fill) and the scenario size filled inside it.
    if (p.scenarioRadius !== undefined && p.radius > 0)
      return [
        {
          locode: p.locode,
          point: p.point,
          size: 2 * p.radius * PX_TO_PT,
          fill: [0, 0, 0, 0] as Rgba,
          outline: { color: rgba(c.selection), width: 2, style: "dash" as const },
        },
        {
          locode: p.locode,
          point: p.point,
          size: Math.max(4, 2 * p.scenarioRadius) * PX_TO_PT,
          fill: rgba(c.risk[4]!, 0.92),
          outline: { color: rgba(c.portOutline, 0.95), width: 1 },
        },
      ];
    const selected = p.locode === m.selectedPort;
    const empty = p.radius <= 0;
    const size = (empty ? 7 : 2 * p.radius) * PX_TO_PT;
    const ring = selected
      ? { color: rgba(c.selection), width: 2.75 }
      : p.foodEntry
        ? { color: rgba(c.risk[4]!), width: 2 }
        : { color: rgba(c.portOutline, 0.95), width: 1 };
    return {
      locode: p.locode,
      point: p.point,
      size,
      fill: empty ? ([0, 0, 0, 0] as Rgba) : rgba(c.portFill, 0.92),
      outline: (empty && !selected && !p.foodEntry
        ? { color: rgba(c.portFill, 0.9), width: 1.25 }
        : ring) as {
        color: Rgba;
        width: number;
        style?: "dash";
      },
    };
  });
}
