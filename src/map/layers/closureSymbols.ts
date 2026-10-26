import { hexToRgb } from "@/analysis/colour";
import type { ScenarioClosureMapModel } from "@/state/store";
import { MAP_COLOURS, type MapStyle } from "@/styles/palette";

/** SDK-free symbol specs for the Scenario Lab closure map (drawn by ScenarioClosureController). */
type Rgba = [number, number, number, number];
const rgba = (hex: string, alpha = 1): Rgba => [...hexToRgb(hex), alpha];
/** Marker sizes are in points; the model's radii are in px. */
const PX_TO_PT = 0.75;

/** Graphic specs, testable without the SDK: links first, then areas, then stores. */
export function closureGraphicsData(m: ScenarioClosureMapModel, style: MapStyle) {
  const c = MAP_COLOURS[style];
  const scenario = m.view === "scenario";
  const neutral = rgba(c.seq[3]!, 0.9);
  const colourOf = (cls: number | null): Rgba =>
    cls === null ? rgba(c.noData, 0.95) : rgba(c.risk[cls] ?? c.risk[0]!, 0.95);
  const links = m.areas.flatMap((a) => {
    const target = scenario ? a.to : a.from;
    if (!target) return [];
    return [
      {
        kind: "link" as const,
        code: a.code,
        path: [a.point, target] as [number, number][],
        colour: scenario ? colourOf(a.cls) : rgba(c.selection, 0.55),
        width: scenario ? 1.4 : 1,
      },
    ];
  });
  // Largest first, so small areas stay on top and hoverable.
  const areas = [...m.areas]
    .sort((a, b) => b.radius - a.radius || a.code.localeCompare(b.code))
    .map((a) => ({
      kind: "area" as const,
      code: a.code,
      point: a.point,
      size: 2 * a.radius * PX_TO_PT,
      fill: scenario ? colourOf(a.cls) : neutral,
      outline: rgba(c.storeOutline, 0.9),
    }));
  const stores = [
    ...(scenario
      ? m.takeover.map((t) => ({
          kind: "takeover" as const,
          id: t.id,
          point: t.point,
          size: 18,
          style: "circle" as const,
          fill: [0, 0, 0, 0] as Rgba,
          outline: { color: rgba(c.selection), width: 2, style: "dash" as const },
        }))
      : []),
    ...(m.closed && scenario
      ? [
          {
            kind: "closed" as const,
            id: m.closed.id,
            point: m.closed.point,
            size: 15,
            style: "x" as const,
            fill: rgba(c.risk[5]!),
            outline: { color: rgba(c.risk[5]!), width: 3.5, style: "solid" as const },
          },
        ]
      : []),
  ];
  return { links, areas, stores };
}
