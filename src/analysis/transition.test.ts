import { describe, expect, it } from "vitest";
import { FLOW_TWEEN_MS } from "@/map/layers/flowTiming";
import { easeOutCubic, interpolateWidths, TRANSITION_MAX_MS, widthsDiffer } from "./transition";

describe("month transitions (SS-02)", () => {
  const from = new Map([
    ["A", 4],
    ["B", 2],
  ]);
  const to = new Map([
    ["A", 10],
    ["C", 6],
  ]);

  it("starts at the old widths and ends exactly at the new ones", () => {
    expect(interpolateWidths(from, to, 0)).toEqual(
      new Map([
        ["A", 4],
        ["B", 2],
        ["C", 0],
      ]),
    );
    const end = interpolateWidths(from, to, 1);
    expect(end).toEqual(to); // exact model values; "B" (left the top N) is gone
    expect(end.get("A")).toBe(10);
  });

  it("moves monotonically between them, decelerating", () => {
    const a = [0, 0.25, 0.5, 0.75, 0.99].map((t) => interpolateWidths(from, to, t).get("A")!);
    for (let i = 1; i < a.length; i++) expect(a[i]!).toBeGreaterThan(a[i - 1]!);
    expect(a[1]! - a[0]!).toBeGreaterThan(a[4]! - a[3]!);
    const b = interpolateWidths(from, to, 0.5).get("B")!;
    expect(b).toBeGreaterThan(0);
    expect(b).toBeLessThan(2); // shrinking away
  });

  it("detects when nothing needs to move", () => {
    expect(widthsDiffer(from, new Map(from))).toBe(false);
    expect(widthsDiffer(from, to)).toBe(true);
    expect(widthsDiffer(new Map(), new Map())).toBe(false);
  });

  it("clamps the easing and keeps the map transition within the limit", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
    expect(FLOW_TWEEN_MS).toBeLessThanOrEqual(TRANSITION_MAX_MS);
  });
});
