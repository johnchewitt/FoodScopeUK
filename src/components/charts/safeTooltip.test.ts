import { describe, expect, it } from "vitest";
import { safeTooltipHtml, withSafeTooltips } from "./safeTooltip";

describe("chart tooltip sanitising (Stage 8 security review)", () => {
  it("keeps line breaks and bold, removes every other tag and its attributes", () => {
    expect(safeTooltipHtml("Tesco: 9<br/>Asda: 4")).toBe("Tesco: 9<br/>Asda: 4");
    expect(safeTooltipHtml("<b>2025</b><br>HHI 2,990")).toBe("<b>2025</b><br>HHI 2,990");
    expect(safeTooltipHtml('Shop<img src=x onerror="alert(1)">')).toBe("Shop");
    expect(safeTooltipHtml("<script>alert(1)</script>Name")).toBe("alert(1)Name");
    expect(safeTooltipHtml('<br onclick="x()">')).toBe("");
    expect(safeTooltipHtml("Marks & Spencer: 5 < 6")).toBe("Marks & Spencer: 5 < 6");
  });

  it("wraps top-level and series tooltip formatters, leaving the rest of the option alone", () => {
    const option = withSafeTooltips({
      tooltip: { trigger: "axis", formatter: () => '<a href="x">A</a><br/>B' },
      series: [{ type: "bar", tooltip: { formatter: () => "<i>C</i>" } }, { type: "line" }],
      grid: { left: 1 },
    });
    expect((option.tooltip as { formatter: () => string }).formatter()).toBe("A<br/>B");
    expect((option.series[0] as { tooltip: { formatter: () => string } }).tooltip.formatter()).toBe("C");
    expect(option.series[1]).toEqual({ type: "line" });
    expect(option.grid).toEqual({ left: 1 });
  });
});
