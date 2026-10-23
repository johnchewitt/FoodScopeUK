import { describe, expect, it } from "vitest";
import { DEFAULT_URL_STATE, historyModeFor, isGssCode, parseUrlState, serializeUrlState } from "./urlState";

describe("parseUrlState", () => {
  it("returns defaults for an empty query", () => {
    expect(parseUrlState("")).toEqual(DEFAULT_URL_STATE);
  });

  it("reads valid values", () => {
    expect(parseUrlState("?m=profiles&mo=7&lad=N09000003&view=evidence")).toEqual({
      ...DEFAULT_URL_STATE,
      module: "profiles",
      month: 7,
      lad: "N09000003",
      overlay: "evidence",
    });
  });

  it("reads Food Origins state", () => {
    expect(parseUrlState("?c=bananas&pm=y&y=2024&ms=value&p=CO")).toEqual({
      ...DEFAULT_URL_STATE,
      commodity: "bananas",
      period: "year",
      year: 2024,
      measure: "value",
      partner: "CO",
    });
    expect(parseUrlState("?pm=m&mo=1&p=hmrc-959")).toMatchObject({
      period: "month",
      month: 1,
      partner: "hmrc-959",
    });
  });

  it("normalises lower-case GSS codes", () => {
    expect(parseUrlState("?lad=e08000003").lad).toBe("E08000003");
  });

  it.each([
    ["?m=unknown", "module", "origins"],
    ["?mo=0", "month", null],
    ["?mo=13", "month", null],
    ["?mo=3.5", "month", null],
    ["?mo=abc", "month", null],
    ["?lad=X12345678", "lad", null],
    ["?lad=N0900000", "lad", null],
    ["?view=admin", "overlay", "none"],
    ["?c=Tomatoes!", "commodity", "tomatoes"],
    ["?c=", "commodity", "tomatoes"],
    ["?pm=weekly", "period", "rolling12"],
    ["?y=26", "year", null],
    ["?y=3000", "year", null],
    ["?ms=litres", "measure", "mass"],
    ["?p=spain", "partner", null],
    ["?p=hmrc-", "partner", null],
  ])("falls back safely for %s", (qs, key, expected) => {
    expect(parseUrlState(qs)[key as keyof typeof DEFAULT_URL_STATE]).toBe(expected);
  });
});

describe("serializeUrlState", () => {
  it("omits defaults", () => {
    expect(serializeUrlState(DEFAULT_URL_STATE)).toBe("");
  });

  it("round-trips through parse", () => {
    const state = {
      ...DEFAULT_URL_STATE,
      module: "seasonal",
      month: 12,
      lad: "S12000036",
      overlay: "help",
    } as const;
    expect(parseUrlState(serializeUrlState(state))).toEqual(state);
    const origins = {
      ...DEFAULT_URL_STATE,
      commodity: "wheat",
      period: "month",
      year: 2025,
      month: 7,
      measure: "value",
      partner: "CA",
    } as const;
    expect(parseUrlState(serializeUrlState(origins))).toEqual(origins);
  });

  it("uses a stable parameter order", () => {
    expect(
      serializeUrlState({
        ...DEFAULT_URL_STATE,
        module: "profiles",
        month: 1,
        lad: "W06000015",
        overlay: "evidence",
      }),
    ).toBe("?m=profiles&mo=1&lad=W06000015&view=evidence");
    expect(
      serializeUrlState({
        ...DEFAULT_URL_STATE,
        commodity: "bananas",
        period: "year",
        year: 2024,
        partner: "CO",
      }),
    ).toBe("?c=bananas&pm=y&y=2024&p=CO");
  });
});

describe("historyModeFor", () => {
  it("pushes for navigation and replaces for fine adjustments", () => {
    const base = DEFAULT_URL_STATE;
    expect(historyModeFor(base, { ...base, module: "risks" })).toBe("push");
    expect(historyModeFor(base, { ...base, overlay: "help" })).toBe("push");
    expect(historyModeFor(base, { ...base, month: 4 })).toBe("replace");
    expect(historyModeFor(base, { ...base, commodity: "wheat" })).toBe("push");
    expect(historyModeFor(base, { ...base, partner: "ES", measure: "value" })).toBe("replace");
  });
});

describe("isGssCode", () => {
  it("accepts the four nations' LAD prefixes", () => {
    for (const code of ["E08000003", "N09000003", "S12000036", "W06000015"])
      expect(isGssCode(code)).toBe(true);
  });
});

describe("Seasonal Supply URL state (SS-01, SS-05, SS-08)", () => {
  it("reads comparison year, comparison month and heatmap colour", () => {
    expect(parseUrlState("?m=seasonal&y=2025&mo=1&cm=7&cy=2023&hm=change")).toEqual({
      ...DEFAULT_URL_STATE,
      module: "seasonal",
      year: 2025,
      month: 1,
      compareMonth: 7,
      compareYear: 2023,
      heatmap: "change",
    });
  });

  it.each([
    ["?cm=13", "compareMonth", null],
    ["?cm=0", "compareMonth", null],
    ["?cy=20x5", "compareYear", null],
    ["?hm=rainbow", "heatmap", "share"],
  ])("%s falls back for %s", (qs, key, expected) => {
    expect(parseUrlState(qs)[key as keyof ReturnType<typeof parseUrlState>]).toBe(expected);
  });

  it("round-trips and omits defaults", () => {
    const state = {
      ...DEFAULT_URL_STATE,
      module: "seasonal" as const,
      year: 2025,
      month: 1,
      compareMonth: 7,
      heatmap: "amount" as const,
    };
    const qs = serializeUrlState(state);
    expect(qs).toBe("?m=seasonal&y=2025&mo=1&cm=7&hm=amount");
    expect(parseUrlState(qs)).toEqual(state);
    expect(historyModeFor(DEFAULT_URL_STATE, { ...DEFAULT_URL_STATE, compareMonth: 7 })).toBe("replace");
  });
});
