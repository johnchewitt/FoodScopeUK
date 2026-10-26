import { describe, expect, it } from "vitest";
import { DEFAULT_URL_STATE, historyModeFor, isGssCode, parseUrlState, serializeUrlState } from "./urlState";

describe("Risk Explorer state (RK-01 – RK-04)", () => {
  it("reads and writes the view, fills, port, layers and measures", () => {
    const qs =
      "?m=risks&rv=logistics&rf=stress&pt=gbdvr&pms=roro&rd=0&rl=0&fm=wheat&pf=socio_demographic&rn=S";
    const state = parseUrlState(qs);
    expect(state).toMatchObject({
      module: "risks",
      riskView: "logistics",
      riskFill: "stress",
      port: "GBDVR",
      portMeasure: "roro",
      roads: false,
      rail: false,
      farmLayer: "wheat",
      ppfiMeasure: "socio_demographic",
      rankNation: "Scotland",
    });
    expect(parseUrlState(serializeUrlState(state))).toEqual(state);
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, module: "risks" })).toBe("?m=risks");
  });

  it.each([
    ["?rv=global", "riskView", "supply"],
    ["?rf=heat", "riskFill", "share"],
    ["?pt=DOVER", "port", null],
    ["?pt=FRCQF", "port", null],
    ["?pms=food", "portMeasure", "international"],
    ["?rd=no", "roads", true],
    ["?rl=off", "rail", true],
    ["?fm=barley", "farmLayer", "off"],
    ["?pf=total", "ppfiMeasure", "combined"],
    ["?rn=X", "rankNation", null],
  ])("falls back safely for %s", (qs, key, expected) => {
    expect(parseUrlState(qs)[key as keyof typeof DEFAULT_URL_STATE]).toBe(expected);
  });

  it("makes a view change a history entry", () => {
    expect(historyModeFor(DEFAULT_URL_STATE, { ...DEFAULT_URL_STATE, riskView: "access" })).toBe("push");
    expect(historyModeFor(DEFAULT_URL_STATE, { ...DEFAULT_URL_STATE, ppfiMeasure: "fuel_poverty" })).toBe(
      "replace",
    );
  });
});

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

describe("UK Food Access and basemap URL state (SM-03, SM-05, SM-06, SH-08)", () => {
  it("reads store layers, retailers, council layer, store and basemap", () => {
    expect(
      parseUrlState("?m=access&sl=c,s&rt=Retailer%20B,Retailer%20A&cl=a&st=1010000001&bm=light"),
    ).toMatchObject({
      module: "access",
      storeLayers: ["supermarket", "convenience"],
      retailers: ["Retailer A", "Retailer B"],
      councilLayer: "all",
      store: 1010000001,
      basemap: "light",
    });
    expect(parseUrlState("?sl=none&rt=&cl=off")).toMatchObject({
      storeLayers: [],
      retailers: [],
      councilLayer: "off",
    });
  });

  it("falls back on invalid values", () => {
    expect(parseUrlState("?sl=x&rt=<script>,Retailer%20A&cl=zzz&st=abc&bm=neon")).toMatchObject({
      storeLayers: [],
      retailers: ["Retailer A"],
      councilLayer: "supermarkets",
      store: null,
      basemap: "dark",
    });
  });

  it("round-trips and omits defaults", () => {
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, module: "access" })).toBe("?m=access");
    const state = {
      ...DEFAULT_URL_STATE,
      module: "access" as const,
      storeLayers: ["supermarket" as const, "other" as const],
      retailers: ["Retailer O'Brien", "Retailer A"],
      councilLayer: "convenience" as const,
      store: 42,
      basemap: "imagery" as const,
    };
    const qs = serializeUrlState(state);
    expect(qs).toBe("?m=access&sl=s%2Co&rt=Retailer+A%2CRetailer+O%27Brien&cl=c&st=42&bm=imagery");
    expect(parseUrlState(qs)).toEqual({ ...state, retailers: ["Retailer A", "Retailer O'Brien"] });
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, storeLayers: [] })).toBe("?sl=none");
  });
});

describe("Local Authority Profiles URL state (LP-01, LP-06, LP-07)", () => {
  it("reads the small-area measure, small area, comparison councils and NI grocers layer", () => {
    expect(
      parseUrlState("?m=profiles&lad=N09000003&am=distance&sa=95GG35S1&cmp=E08000003,w06000015&ng=1"),
    ).toMatchObject({
      module: "profiles",
      lad: "N09000003",
      areaMeasure: "distance",
      area: "95GG35S1",
      compare: ["E08000003", "W06000015"],
      niGrocers: true,
    });
    expect(parseUrlState("?sa=E01005063").area).toBe("E01005063");
    expect(parseUrlState("?sa=N20000001").area).toBe("N20000001");
    // Whole-ward SOAs end in W (10 of Belfast's 174 SOAs).
    expect(parseUrlState("?sa=95II07W1").area).toBe("95II07W1");
  });

  it("falls back on invalid values; comparison drops the selected council, repeats and extras", () => {
    expect(parseUrlState("?am=composite&sa=<x>&ng=yes")).toMatchObject({
      areaMeasure: "ppfi",
      area: null,
      niGrocers: false,
    });
    expect(
      parseUrlState("?lad=E08000003&cmp=E08000003,N09000003,n09000003,X1,S12000036,W06000015,E06000001")
        .compare,
    ).toEqual(["N09000003", "S12000036", "W06000015"]);
  });

  it("round-trips and omits defaults", () => {
    const state = {
      ...DEFAULT_URL_STATE,
      module: "profiles" as const,
      lad: "E08000003",
      areaMeasure: "ppfi-family-food" as const,
      area: "E01005063",
      compare: ["N09000003"],
      niGrocers: true,
      overlay: "compare" as const,
    };
    const qs = serializeUrlState(state);
    expect(qs).toBe(
      "?m=profiles&am=ppfi-family-food&ng=1&lad=E08000003&sa=E01005063&cmp=N09000003&view=compare",
    );
    expect(parseUrlState(qs)).toEqual(state);
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, module: "profiles" })).toBe("?m=profiles");
  });
});

describe("Scenario Lab state (SC-05)", () => {
  it("reads and writes every scenario setting", () => {
    const qs = "?m=scenarios&sk=import&c=tomatoes&p=ES&sy=2025&smo=1&sr=30&sd=3&srk=2&ss=10&sv=baseline";
    const state = parseUrlState(qs);
    expect(state).toMatchObject({
      module: "scenarios",
      scenarioKind: "import",
      partner: "ES",
      scenarioYear: 2025,
      scenarioMonth: 1,
      scenarioReduction: 30,
      scenarioDuration: 3,
      scenarioRecovery: 2,
      scenarioSubstitution: 10,
      scenarioView: "baseline",
    });
    expect(parseUrlState(serializeUrlState(state))).toEqual(state);
    const port = parseUrlState("?m=scenarios&sk=port&pt=GBDVR&sdr=40&sdm=3");
    expect(port).toMatchObject({ scenarioKind: "port", port: "GBDVR", portReduction: 40, portMonths: 3 });
    expect(parseUrlState(serializeUrlState(port))).toEqual(port);
    const closure = parseUrlState("?m=scenarios&sk=closure&st=1010000001");
    expect(closure).toMatchObject({ scenarioKind: "closure", store: 1010000001 });
    expect(parseUrlState("?sk=production&spr=15").productionReduction).toBe(15);
  });

  it("leaves the defaults out of the URL (the default reduction is 30 %)", () => {
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, module: "scenarios" })).toBe("?m=scenarios");
    expect(serializeUrlState({ ...DEFAULT_URL_STATE, scenarioReduction: 0 })).toBe("?sr=0");
  });

  it.each([
    ["?sk=flood", "scenarioKind", "import"],
    ["?sr=101", "scenarioReduction", 30],
    ["?sr=-5", "scenarioReduction", 30],
    ["?sr=2.5", "scenarioReduction", 30],
    ["?sd=0", "scenarioDuration", 1],
    ["?sd=13", "scenarioDuration", 1],
    ["?srk=7", "scenarioRecovery", 0],
    ["?ss=abc", "scenarioSubstitution", 0],
    ["?smo=13", "scenarioMonth", null],
    ["?sy=25", "scenarioYear", null],
    ["?sdm=0", "portMonths", 1],
    ["?sv=both", "scenarioView", "scenario"],
  ])("falls back safely for %s", (qs, key, expected) => {
    expect(parseUrlState(qs)[key as keyof typeof DEFAULT_URL_STATE]).toBe(expected);
  });

  it("makes a change of scenario a history entry; a slider replaces it", () => {
    expect(historyModeFor(DEFAULT_URL_STATE, { ...DEFAULT_URL_STATE, scenarioKind: "closure" })).toBe("push");
    expect(historyModeFor(DEFAULT_URL_STATE, { ...DEFAULT_URL_STATE, scenarioReduction: 55 })).toBe(
      "replace",
    );
  });
});
