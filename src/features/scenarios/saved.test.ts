import { describe, expect, it } from "vitest";
import { paramsFromState } from "@/state/scenarioParams";
import { parseUrlState } from "@/state/urlState";
import type { Indicator } from "@/types/indicator";
import type { ResultRow } from "./model";
import {
  addSaved,
  csvField,
  defaultName,
  loadSaved,
  MAX_SAVED,
  persistSaved,
  removeSaved,
  SAVED_KEY,
  scenarioLink,
  summaryCsv,
} from "./saved";

/** A minimal in-memory Storage (jsdom's localStorage is per test file; this one is per test). */
function memoryStorage(initial: Record<string, string> = {}, failWrites = false): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => {
      if (failWrites) throw new DOMException("quota", "QuotaExceededError");
      data.set(k, v);
    },
  };
}

const closure = { kind: "closure" as const, store: 1010002389 };
const port = { kind: "port" as const, port: "GBDVR", reduction: 50, months: 1 };
const now = new Date("2026-10-26T12:00:00Z");

describe("saved scenarios (brief §7)", () => {
  it("saves, lists newest first, replaces a name and keeps at most twelve", () => {
    let list = addSaved([], "Closure", closure, now, "a");
    list = addSaved(list, "Dover", port, now, "b");
    expect(list.map((s) => s.name)).toEqual(["Dover", "Closure"]);
    list = addSaved(list, "  Closure  ", { ...closure, store: 1 }, now, "c");
    expect(list.map((s) => [s.id, s.name])).toEqual([
      ["c", "Closure"],
      ["b", "Dover"],
    ]);
    for (let i = 0; i < 20; i++) list = addSaved(list, `S${i}`, port, now, `x${i}`);
    expect(list).toHaveLength(MAX_SAVED);
    expect(removeSaved(list, "x19")).toHaveLength(MAX_SAVED - 1);
    expect(addSaved([], "", port, now, "d")[0]!.name).toBe("Untitled scenario");
  });

  it("round-trips through storage and drops anything invalid", () => {
    const store = memoryStorage();
    const list = addSaved([], "Dover", port, now, "b");
    expect(persistSaved(list, store)).toBe(true);
    expect(loadSaved(store)).toEqual(list);
    const tampered = memoryStorage({
      [SAVED_KEY]: JSON.stringify([
        ...list,
        {
          id: "x",
          name: "bad",
          savedAt: "t",
          params: { kind: "port", port: "javascript:", reduction: 5, months: 1 },
        },
        "nonsense",
      ]),
    });
    expect(loadSaved(tampered)).toEqual(list);
    expect(loadSaved(memoryStorage({ [SAVED_KEY]: "{not json" }))).toEqual([]);
  });

  it("survives a browser that refuses storage", () => {
    expect(persistSaved([], memoryStorage({}, true))).toBe(false);
    expect(persistSaved([], null)).toBe(false);
    expect(loadSaved(null)).toEqual([]);
  });

  it("links reproduce the scenario (SC-05)", () => {
    const link = scenarioLink(port, "https://example.org/FoodScopeUK/");
    expect(link).toBe("https://example.org/FoodScopeUK/?m=scenarios&pt=GBDVR&sk=port");
    expect(paramsFromState(parseUrlState(new URL(link).search))).toEqual(port);
  });

  it("names a scenario from its settings", () => {
    expect(defaultName(port, { port: "Dover" })).toBe("D · Dover −50 % for 1 month");
    expect(defaultName(closure, {})).toBe("B · closure of store 1010002389");
  });
});

describe("export (brief §7)", () => {
  const indicator = (value: number, provenance: Indicator["provenance"]): Indicator<number> => ({
    id: "x",
    label: "Recorded imports",
    value,
    unit: "t",
    provenance,
    sourceIds: ["S01"],
    referencePeriod: "Jan–Mar 2025",
    coverage: "UK",
    method: "m",
    scope: "national_context",
  });
  const rows: ResultRow[] = [
    {
      id: "total",
      label: "Recorded imports, from partner countries",
      baseline: indicator(100_929.183, "measured"),
      scenario: indicator(94_143.8664000001, "scenario"),
      change: -6_785.3166,
      relative: -0.0672,
    },
  ];

  it("writes values, shown values, provenance, sources and the link", () => {
    const csv = summaryCsv(
      [
        {
          scenario: "A · Tomatoes",
          kind: "A",
          link: "https://x/?m=scenarios",
          rows,
          assumptions: [],
          confidence: "Moderate",
        },
      ],
      now,
    );
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toMatch(/^scenario,kind,measure,unit,baseline,scenario_value,change/);
    expect(lines[1]).toBe(
      'A · Tomatoes,A,"Recorded imports, from partner countries",t,100929.183,94143.8664,-6785.3166,-0.0672,100.9 kt,94.1 kt,Measured,Scenario-modelled,S01,Jan–Mar 2025,Moderate,https://x/?m=scenarios',
    );
    expect(lines[2]).toMatch(
      /^Scenario-modelled: static exposure calculations under the stated assumptions; not forecasts or shortages\./,
    );
  });

  it("neutralises spreadsheet formulas and quotes separators", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("@cmd")).toBe("'@cmd");
    expect(csvField('a "b", c')).toBe('"a ""b"", c"');
    expect(csvField(-5)).toBe("-5");
    expect(csvField(null)).toBe("");
  });
});
