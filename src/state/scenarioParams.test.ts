import { beforeEach, describe, expect, it } from "vitest";
import {
  baselineFor,
  isBaseline,
  paramsFromState,
  parseScenarioParams,
  stateFromParams,
  type ScenarioParams,
} from "./scenarioParams";
import { resetAppStore, selectUrlState, useAppStore } from "./store";
import { DEFAULT_URL_STATE, parseUrlState, serializeUrlState } from "./urlState";

const spain: ScenarioParams = {
  kind: "import",
  commodity: "tomatoes",
  partner: "ES",
  year: 2025,
  month: 1,
  reduction: 30,
  duration: 3,
  recovery: 0,
  substitution: 0,
  measure: "mass",
};

beforeEach(() => resetAppStore());

describe("typed scenario model (SC-05)", () => {
  it("round-trips every kind through the shared state and the URL", () => {
    const all: ScenarioParams[] = [
      spain,
      { kind: "closure", store: 1010000001 },
      { kind: "production", commodity: "wheat", reduction: 15 },
      { kind: "port", port: "GBDVR", reduction: 50, months: 3 },
    ];
    for (const p of all) {
      const state = { ...DEFAULT_URL_STATE, module: "scenarios" as const, ...stateFromParams(p) };
      expect(paramsFromState(state)).toEqual(p);
      expect(paramsFromState(parseUrlState(serializeUrlState(state)))).toEqual(p);
    }
  });

  it("clamps values that come from outside the controls", () => {
    expect(stateFromParams({ ...spain, reduction: 140, duration: 0, substitution: -3 })).toMatchObject({
      scenarioReduction: 100,
      scenarioDuration: 1,
      scenarioSubstitution: 0,
    });
  });

  it("reads back only valid stored scenarios", () => {
    expect(parseScenarioParams(JSON.parse(JSON.stringify(spain)))).toEqual(spain);
    expect(parseScenarioParams({ ...spain, extra: "x" })).toEqual(spain);
    expect(parseScenarioParams({ ...spain, reduction: 30.5 })).toBeNull();
    expect(parseScenarioParams({ ...spain, partner: "<script>" })).toBeNull();
    expect(parseScenarioParams({ kind: "closure", store: "1" })).toBeNull();
    expect(parseScenarioParams({ kind: "port", port: "FRCQF", reduction: 10, months: 1 })).toBeNull();
    expect(parseScenarioParams({ kind: "weather" })).toBeNull();
    expect(parseScenarioParams(null)).toBeNull();
  });

  it("knows the baseline of each kind", () => {
    expect(isBaseline({ ...spain, reduction: 0 })).toBe(true);
    expect(isBaseline(spain)).toBe(false);
    expect(isBaseline({ kind: "closure", store: null })).toBe(true);
    expect(baselineFor("port")).toEqual({ portReduction: 0 });
  });
});

describe("scenario store actions (SC-03, SC-05)", () => {
  it("applies a saved scenario and resets to the baseline without losing the selection", () => {
    const s = useAppStore.getState();
    s.setModule("scenarios");
    s.applyScenario(spain);
    expect(paramsFromState(selectUrlState(useAppStore.getState()))).toEqual(spain);
    useAppStore.getState().resetScenarioToBaseline();
    const after = paramsFromState(selectUrlState(useAppStore.getState()));
    expect(after).toEqual({ ...spain, reduction: 0 });
    useAppStore.getState().restoreScenarioDefaults();
    expect(useAppStore.getState().scenarioReduction).toBe(DEFAULT_URL_STATE.scenarioReduction);
    expect(useAppStore.getState().partner).toBe("ES");
  });

  it("changes only scenario fields through updateScenario", () => {
    useAppStore.getState().updateScenario({ scenarioReduction: 70, ...({ module: "origins" } as object) });
    expect(useAppStore.getState().scenarioReduction).toBe(70);
    expect(useAppStore.getState().module).toBe(DEFAULT_URL_STATE.module);
  });

  it("clears the previous map's hovers when the kind changes", () => {
    useAppStore.setState({ hoverPartner: { key: "ES", name: "Spain", x: 1, y: 1 } });
    useAppStore.getState().setScenarioKind("closure");
    expect(useAppStore.getState().hoverPartner).toBeNull();
    expect(useAppStore.getState().scenarioKind).toBe("closure");
  });
});
