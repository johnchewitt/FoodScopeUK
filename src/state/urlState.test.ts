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
