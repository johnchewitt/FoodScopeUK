import { describe, expect, it } from "vitest";
import { formatDelta } from "./narrative";

describe("signed changes in the results table", () => {
  it("never shows +0.0 km for a real distance change below the display step (P13, review)", () => {
    expect(formatDelta(0.043, "km (straight-line)")).toBe("+< 0.1 km");
    expect(formatDelta(-0.01, "km (straight-line)")).toBe("−< 0.1 km");
    expect(formatDelta(0, "km (straight-line)")).toBe("±0.0 km");
    expect(formatDelta(0.05, "km (straight-line)")).toBe("+0.1 km");
    expect(formatDelta(1.49, "km (straight-line)")).toBe("+1.5 km");
  });

  it("keeps the other units' rules", () => {
    expect(formatDelta(null, "t")).toBe("—");
    expect(formatDelta(-6785.3, "t")).toBe("−6.8 kt");
    expect(formatDelta(0.0561, "share")).toBe("+5.6 pp");
    expect(formatDelta(90, "HHI")).toBe("+90");
    expect(formatDelta(19_720, "residents (small areas)")).toBe("+19,720");
  });
});
