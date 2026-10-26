import { describe, expect, it } from "vitest";
import { readRepoJson } from "@/test/files";
import type { RiskPortEntry } from "@/types/generated/risk-port-entry";
import type { RiskPorts } from "@/types/generated/risk-ports";
import type { ScenarioClosure } from "@/types/generated/scenario-closure";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import type { UkProduction } from "@/types/generated/uk-production";
import { provenanceProblems } from "@/types/indicator";
import {
  areaRadius,
  buildClosureModel,
  buildImportModel,
  buildPortModel,
  buildProductionModel,
  defaultStart,
  findStore,
  foodEntryEvidence,
  mostReliedOn,
  searchStores,
  storeOptions,
  type ClosureParts,
  type CouncilInfo,
  type ResultRow,
} from "./model";
import { portGroupChart, portWindowLabel } from "./charts";
import { closureNarrative, importNarrative, portNarrative, productionNarrative } from "./narrative";
import { closureStructure, validateClosure } from "./validate";

// Real published inputs (stage 7 report: figures recomputed independently from these files).
const tomatoes = readRepoJson<TradeSnapshot>("public/data/snapshots/2026-10-26/trade/tomatoes.json");
const gb = readRepoJson<ScenarioClosure>("public/data/snapshots/2026-10-26/scenario/closure-gb.json");
const ni = readRepoJson<ScenarioClosure>("public/data/snapshots/2026-10-26/scenario/closure-ni.json");
const production = readRepoJson<UkProduction>("public/data/snapshots/2026-10-26/context/uk-production.json");
const ports = readRepoJson<RiskPorts>("public/data/snapshots/2026-10-25/risk/ports.json");
const entry = readRepoJson<RiskPortEntry>("public/data/snapshots/2026-10-25/risk/port-entry.json");
const councilDoc = readRepoJson<{ councils: CouncilInfo[] }>(
  "public/data/snapshots/2026-10-24/local/lad-indicators.json",
);
const councils = new Map(
  councilDoc.councils.map((c) => [c.code, { code: c.code, name: c.name, nation: c.nation }]),
);
const parts: ClosureParts = { gb, ni };
const UK: [number, number] = [-2, 54];

const spain = {
  kind: "import" as const,
  commodity: "tomatoes",
  partner: "ES",
  year: 2025,
  month: 1,
  reduction: 30,
  duration: 3,
  recovery: 0,
  substitution: 0,
  measure: "mass" as const,
};

function everyIndicatorHasProvenance(rows: ResultRow[]) {
  for (const r of rows) {
    expect(provenanceProblems(r.baseline), r.baseline.id).toEqual([]);
    expect(provenanceProblems(r.scenario), r.scenario.id).toEqual([]);
    expect(r.scenario.provenance).toBe("scenario");
  }
}

describe("Scenario A model (tomatoes, Spain)", () => {
  const m = buildImportModel(tomatoes, "Tomatoes", spain, UK, 12, "scenario");

  it("reproduces the recorded figures and the scenario's (independent check, stage 7 report)", () => {
    const r = m.result!;
    expect(r.total).toBeCloseTo(100_929.183, 3);
    expect(r.partnerBaseline).toBeCloseTo(22_617.722, 3);
    expect(r.affected).toBeCloseTo(6_785.317, 3);
    expect(r.residual).toBeCloseTo(94_143.866, 3);
    expect(r.shareAffected).toBeCloseTo(0.067228, 5);
    expect(r.hhiBefore).toBeCloseTo(2571.7, 1);
    expect(r.hhiAfter).toBeCloseTo(2661.4, 1);
    expect(m.windowLabel).toBe("Jan–Mar 2025");
    everyIndicatorHasProvenance(m.rows);
    expect(importNarrative(m)).toMatch(/6\.8 kt would be affected: 6\.7 %/);
  });

  it("defaults to January of the latest complete year and the largest partner", () => {
    expect(defaultStart(tomatoes)).toBe("2025-01");
    const d = buildImportModel(
      tomatoes,
      "Tomatoes",
      { ...spain, partner: null, year: null, month: null },
      UK,
      12,
      "scenario",
    );
    expect(d.startIsDefault).toBe(true);
    expect(d.partnerIsDefault).toBe(true);
    expect(d.partner).toBe(d.partners[0]!.key);
  });

  it("narrows the partner's connection on a fixed scale, with its baseline dashed behind", () => {
    const base = buildImportModel(tomatoes, "Tomatoes", spain, UK, 12, "baseline").map;
    const scen = m.map;
    const b = base.partners.find((p) => p.key === "ES")!;
    const s = scen.partners.find((p) => p.key === "ES")!;
    expect(s.flowWidth).toBeLessThan(b.flowWidth);
    expect(s.ghostWidth).toBeCloseTo(b.flowWidth);
    expect(b.ghostWidth).toBeUndefined();
    // Other partners keep their widths (fixed scale), so only the disrupted connection changes.
    const other = base.partners.find((p) => p.flow && p.key !== "ES")!;
    expect(scen.partners.find((p) => p.key === other.key)!.flowWidth).toBeCloseTo(other.flowWidth);
    // The map changes when the reduction changes (the layer redraws and eases the width).
    expect(
      buildImportModel(tomatoes, "Tomatoes", { ...spain, reduction: 60 }, UK, 12, "scenario").map.periodLabel,
    ).not.toBe(scen.periodLabel);
  });

  it("keeps a fully disrupted partner on the map at 0 %, with no connection", () => {
    const full = buildImportModel(tomatoes, "Tomatoes", { ...spain, reduction: 100 }, UK, 12, "scenario").map;
    const es = full.partners.find((p) => p.key === "ES")!;
    expect(es.share).toBe(0);
    expect(es.flow).toBe(false);
    expect(es.ghostWidth).toBeGreaterThan(0);
  });

  it("rates confidence from the data: provisional months lower it, months beyond the snapshot more", () => {
    expect(m.confidence.level).toBe("moderate");
    expect(m.confidence.reasons.join(" ")).toMatch(/Mar 2025 are provisional/);
    const late = buildImportModel(
      tomatoes,
      "Tomatoes",
      { ...spain, year: 2026, month: 8 },
      UK,
      12,
      "scenario",
    );
    expect(late.confidence.level).toBe("low");
    expect(late.result!.outside).toEqual(["2026-09", "2026-10"]);
    const early = buildImportModel(
      tomatoes,
      "Tomatoes",
      { ...spain, year: 2023, month: 1 },
      UK,
      12,
      "scenario",
    );
    expect(early.confidence.level).toBe("high");
  });
});

describe("Scenario B model (supermarket closure)", () => {
  const ref = findStore(parts, 1010002389)!;
  const m = buildClosureModel(parts, ref, councils, "scenario", "GEOLYTIX v46 (June 2026)");

  it("closes Manchester's most relied-on supermarket (independent check, stage 7 report)", () => {
    expect(mostReliedOn(gb, "E08000003")).toBe(1010002389);
    expect(m.store.name).toBe("Morrisons Whalley Range Manchester");
    expect(m.result.affected).toHaveLength(17);
    expect(m.result.populationAffected).toBe(26_731);
    expect(m.result.meanIncrease).toBeCloseTo(822, 0);
    expect(m.result.maxIncrease).toBeCloseTo(1491, 0);
    expect(m.result.nearby.find((n) => n.metres === 2000)).toEqual({ metres: 2000, before: 3, after: 2 });
    const t2 = m.result.councilDistances.thresholds.find((t) => t.metres === 2000)!;
    expect(t2).toEqual({ metres: 2000, before: 0, after: 4_563 });
    everyIndicatorHasProvenance(m.rows);
    expect(closureNarrative(m)).toMatch(/26,730 residents in 17 small areas/);
  });

  it("draws the affected areas linked to the closed store (baseline) or their new nearest (scenario)", () => {
    expect(m.map.areas).toHaveLength(17);
    expect(m.map.closed?.id).toBe(1010002389);
    expect(m.map.areas.every((a) => a.to !== null && a.cls !== null)).toBe(true);
    expect(m.map.frame?.key).toBe("closure:1010002389");
    expect(areaRadius(3000)).toBeCloseTo(12);
    expect(areaRadius(0)).toBe(3);
  });

  it("works in Northern Ireland, in its own grid, and rates it lower (Republic of Ireland stores missing)", () => {
    const id = mostReliedOn(ni, "N09000003")!;
    const n = buildClosureModel(
      parts,
      findStore(parts, id)!,
      councils,
      "scenario",
      "GEOLYTIX v46 (June 2026)",
    );
    expect(n.part).toBe("ni");
    expect(n.store.council.name).toBe("Belfast");
    expect(n.confidence.level).toBe("low");
    expect(n.confidence.reasons.join(" ")).toMatch(/Republic of Ireland/);
  });

  it("says when a supermarket is no area's nearest", () => {
    const pop = new Set(gb.areas.nearest.map((n) => n[0]));
    const idle = gb.stores.id.findIndex((_, i) => !pop.has(i));
    const n = buildClosureModel(parts, { part: "gb", index: idle }, councils, "scenario", "x");
    expect(n.result.affected).toEqual([]);
    expect(closureNarrative(n)).toMatch(/not the nearest supermarket of any small area/);
  });

  it("finds supermarkets by name, retailer or council", () => {
    const options = storeOptions(parts, councils);
    expect(options).toHaveLength(7_173);
    expect(searchStores(options, "morrisons whalley").map((o) => o.id)).toContain(1010002389);
    expect(searchStores(options, "  ")).toEqual([]);
    expect(searchStores(options, "belfast", 5)).toHaveLength(5);
    expect(findStore(parts, 42)).toBeNull();
  });
});

describe("Scenario C model (Defra production)", () => {
  it("shocks wheat on Defra's published balance and keeps the definitions apart", () => {
    const m = buildProductionModel(production, "wheat", "Wheat", {
      kind: "production",
      commodity: "wheat",
      reduction: 15,
    });
    expect(m.status).toBe("published");
    expect(m.result!.removed).toBeCloseTo(1793.7);
    expect(m.result!.shareAfter).toBeCloseTo(10164.3 / 12631.3, 6);
    expect(m.rows.map((r) => r.id)).toEqual(["production", "imports", "exports", "supply", "share"]);
    expect(m.notInBalance).toEqual(["Consumption (household or total)", "Stocks and stock changes"]);
    expect(m.confidence.level).toBe("moderate"); // provisional 2025
    everyIndicatorHasProvenance(m.rows);
    expect(productionNarrative(m)).toMatch(/15 % lower UK wheat production in 2025/);
  });

  it("is a documented future extension where Defra publishes no balance", () => {
    const m = buildProductionModel(production, "oranges", "Oranges", {
      kind: "production",
      commodity: "oranges",
      reduction: 15,
    });
    expect(m.status).toBe("not_published");
    expect(m.note).toMatch(/Not grown commercially/);
    expect(m.rows).toEqual([]);
    expect(m.available.map((a) => a.basket)).toContain("wheat");
  });
});

describe("Scenario D model (ports)", () => {
  const params = { kind: "port" as const, port: "GBDVR", reduction: 50, months: 1 };

  it("affects Dover's general freight but attributes no food share (UKFSR includes the Channel Tunnel)", () => {
    const m = buildPortModel(ports, entry, params, "scenario", "DfT");
    expect(m.result!.international.baseline).toBeCloseTo(12_512.825, 3);
    expect(m.result!.international.affected).toBeCloseTo(521.368, 3);
    expect(m.result!.international.shareOfUkAffected).toBeCloseTo(0.026344, 5);
    expect(m.food!.percent).toBeNull();
    expect(m.food!.note).toMatch(/Channel Tunnel/);
    expect(m.result!.foodEntryAffected).toBeNull();
    const dover = m.map.ports.find((p) => p.locode === "GBDVR")!;
    expect(dover.scenarioRadius).toBeLessThan(dover.radius);
    expect(
      buildPortModel(ports, entry, params, "baseline", "DfT").map.ports.find((p) => p.locode === "GBDVR")!
        .scenarioRadius,
    ).toBeUndefined();
    everyIndicatorHasProvenance(m.rows);
    expect(portNarrative(m, 50, 1)).toMatch(/No food, feed and drink share is attributable/);
  });

  it("attributes UKFSR's share only where its port of entry is the port", () => {
    expect(foodEntryEvidence(entry, "GBLIV")).toMatchObject({
      groups: ["Liverpool"],
      percent: 10.06,
      note: null,
    });
    const london = foodEntryEvidence(entry, "GBLON");
    expect(london.percent).toBeCloseTo(8.91 + 8.2);
    expect(london.note).toMatch(/Sum of UKFSR's 2 groups/);
    expect(foodEntryEvidence(entry, "GBIMM").note).toMatch(/part of DfT's statistical port/);
    expect(foodEntryEvidence(entry, "GBABD").percent).toBeNull();
  });

  it("says Dover's zero is agricultural dry bulk only, with its Ro-Ro and container freight beside it (review)", () => {
    const m = buildPortModel(ports, entry, params, "scenario", "DfT");
    const agri = m.headlines.find((h) => h.id === "agricultural")!;
    expect(agri.label).toBe("Agricultural dry bulk affected");
    expect(agri.indicator.value).toBe(0);
    // Independent check (python over ports.json): 12,304.196 kt of 12,606.921 kt any origin.
    expect(agri.detail).toBe(
      "None recorded as dry bulk · 97.6 % of inwards here is Ro-Ro or containers, contents not recorded",
    );
    expect(m.selected!.unitisedShare).toBeCloseTo(0.97599, 4);
    const unitised = m.rows.find((r) => r.id === "unitised")!;
    expect(unitised.label).toMatch(/contents not recorded/);
    expect(unitised.baseline.value).toBeCloseTo(1_025_350, -1);
    expect(unitised.scenario.value).toBeCloseTo(512_675, -1);
    everyIndicatorHasProvenance(m.rows);
  });

  it("gives a bulk port's agricultural dry bulk and its UK share", () => {
    const m = buildPortModel(ports, entry, { ...params, port: "GBLIV" }, "scenario", "DfT");
    const agri = m.headlines.find((h) => h.id === "agricultural")!;
    // 1,640.548 kt a year × 50 % × 1 ÷ 12; 17.2 % of 9,534.029 kt.
    expect(agri.indicator.value).toBeCloseTo((1640.548 * 1000 * 0.5) / 12, -1);
    expect(agri.detail).toMatch(/17\.2 % of UK major-port agricultural dry bulk/);
  });

  it("charts the cargo groups over the disruption, not the whole year (review)", () => {
    const m = buildPortModel(ports, entry, params, "scenario", "DfT");
    const one = portGroupChart(m, 50, 1)!;
    const series = (one.option as { series: { data: { value: number }[] }[] }).series;
    const roro = (m.selected!.byGroup.find((g) => g.group === "Ro-Ro Self Propelled")!.value ?? 0) / 12;
    const idx = m
      .selected!.byGroup.filter((g) => (g.value ?? 0) > 0)
      .findIndex((g) => g.group === "Ro-Ro Self Propelled");
    expect(series[0]!.data[idx]!.value).toBeCloseTo(roro, 6); // 11,801.077 ÷ 12 = 983.4 kt
    expect(series[1]!.data[idx]!.value).toBeCloseTo(roro * 0.5, 6);
    expect(one.description).toMatch(
      /over 1 month \(2025 annual tonnage × 1 ÷ 12, an even spread, any origin\)/,
    );
    expect(one.description).toMatch(/Ro-Ro Self Propelled 983\.4 kt to 491\.7 kt/);
    const year = portGroupChart(m, 50, 12)!;
    expect(year.description).toMatch(/Ro-Ro Self Propelled 11\.8 Mt to 5\.9 Mt/);
    expect(portWindowLabel(12)).toBe("the year");
    expect(portWindowLabel(3)).toBe("3 months");
  });

  it("lists every port without a selection", () => {
    const m = buildPortModel(ports, entry, { ...params, port: null }, "scenario", "DfT");
    expect(m.selected).toBeNull();
    expect(m.ports).toHaveLength(51);
    expect(m.headlines).toEqual([]);
  });
});

describe("closure input checks", () => {
  it("accepts the published files", () => {
    expect(validateClosure(ni).ok).toBe(true);
    expect(closureStructure(gb)).toEqual([]);
  });

  it("rejects columns of different lengths and stores out of range", () => {
    const bad = structuredClone(ni);
    bad.areas.population.pop();
    bad.areas.nearest[0] = [9999, 0, 1];
    const problems = closureStructure(bad);
    expect(problems.join(" ")).toMatch(/areas.population has 3779 entries/);
    expect(problems.join(" ")).toMatch(/store out of range/);
    expect(validateClosure({ ...ni, part: "fr" }).ok).toBe(false);
  });
});
