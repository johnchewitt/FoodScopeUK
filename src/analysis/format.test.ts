import { describe, expect, it } from "vitest";
import {
  formatByUnit,
  formatCount,
  formatGbp,
  formatHhi,
  formatKm,
  formatPer10k,
  formatPerKm2,
  formatPercentagePoints,
  formatPopulation,
  formatShare,
  formatTonnes,
} from "./format";

// Synthetic values — these test formatting rules only (spec §6.4).
describe("formatTonnes", () => {
  it.each([
    [0, "0 t"],
    [999.4, "999 t"],
    [1000, "1.0 kt"],
    [12_345, "12.3 kt"],
    [2_500_000, "2.5 Mt"],
  ])("%d → %s", (v, out) => expect(formatTonnes(v)).toBe(out));
  it("handles missing values", () => {
    expect(formatTonnes(null)).toBe("—");
    expect(formatTonnes(Number.NaN)).toBe("—");
  });
});

describe("formatGbp", () => {
  it.each([
    [0, "£0"],
    [12_499, "£12,000"],
    [12_500, "£13,000"],
    [1_234_567, "£1.2m"],
    [3_450_000_000, "£3.5bn"],
    [-2_000_000, "−£2.0m"],
  ])("%d → %s", (v, out) => expect(formatGbp(v)).toBe(out));
});

describe("formatShare", () => {
  it.each([
    [0, "0.0 %"],
    [0.0004, "< 0.1 %"],
    [0.0005, "0.1 %"],
    [0.4567, "45.7 %"],
    [1, "100.0 %"],
  ])("%d → %s", (v, out) => expect(formatShare(v)).toBe(out));
});

describe("other formats", () => {
  it("percentage points carry a sign", () => {
    expect(formatPercentagePoints(2.34)).toBe("+2.3 pp");
    expect(formatPercentagePoints(-0.06)).toBe("−0.1 pp");
    expect(formatPercentagePoints(0.01)).toBe("±0.0 pp");
  });
  it("HHI rounds to nearest 10", () => expect(formatHhi(2344)).toBe("2,340"));
  it("km to 0.1", () => expect(formatKm(1.26)).toBe("1.3 km"));
  it("population rounds by scale", () => {
    expect(formatPopulation(1234, "small_area")).toBe("1,230");
    expect(formatPopulation(345_678, "authority")).toBe("345,700");
  });
  it("counts", () => expect(formatCount(1234.6)).toBe("1,235"));
  it("formatByUnit dispatches on unit and passes strings through", () => {
    expect(formatByUnit(1500, "t")).toBe("1.5 kt");
    expect(formatByUnit(0.25, "share")).toBe("25.0 %");
    expect(formatByUnit("Belfast", "name")).toBe("Belfast");
    expect(formatByUnit(null, "t")).toBe("—");
    expect(formatByUnit(177, "features")).toBe("177");
  });
});

describe("retail provision formats (spec §6.3, §6.4)", () => {
  it("shows per-10,000 rates to two decimals and land density with a floor", () => {
    expect(formatPer10k(1.0321)).toBe("1.03");
    expect(formatPer10k(0)).toBe("0.00");
    expect(formatPer10k(null)).toBe("—");
    expect(formatPerKm2(0.004)).toBe("< 0.01");
    expect(formatPerKm2(0)).toBe("0.00");
    expect(formatPerKm2(12.114)).toBe("12.11");
  });

  it("formats by the new units, residents to the nearest 100", () => {
    expect(formatByUnit(1.0321, "stores per 10,000 residents")).toBe("1.03");
    expect(formatByUnit(0.4, "stores per km²")).toBe("0.40");
    expect(formatByUnit(351_927, "residents")).toBe("351,900");
  });
});
