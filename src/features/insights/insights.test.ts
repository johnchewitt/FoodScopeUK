import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { nationalImports } from "@/analysis/profile";
import { indexStores } from "@/features/access/model";
import { councilRows, deepProfile } from "@/features/profiles/model";
import type { NationalRow } from "@/features/profiles/useProfile";
import {
  closureMethodology,
  importMethodology,
  productionMethodology,
  portMethodology,
} from "@/features/scenarios/methodology";
import {
  buildClosureModel,
  buildImportModel,
  buildPortModel,
  buildProductionModel,
  findStore,
  type ClosureParts,
  type CouncilInfo,
} from "@/features/scenarios/model";
import type { ScenarioParams } from "@/state/scenarioParams";
import { readRepoJson } from "@/test/files";
import type { CouncilContext } from "@/types/generated/council-context";
import type { CouncilPpfi } from "@/types/generated/council-ppfi";
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import type { DataManifest } from "@/types/generated/manifest";
import type { RiskPortEntry } from "@/types/generated/risk-port-entry";
import type { RiskPorts } from "@/types/generated/risk-ports";
import type { RiskWaterStress } from "@/types/generated/risk-water-stress";
import type { ScenarioClosure } from "@/types/generated/scenario-closure";
import type { SmallAreaBoundaries } from "@/types/generated/small-areas";
import type { SmallAreaIndicators } from "@/types/generated/small-area-indicators";
import type { StoreCollection } from "@/types/generated/stores";
import type { TradeIndex } from "@/types/generated/trade-index";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import type { UkProduction } from "@/types/generated/uk-production";
import { provenanceProblems } from "@/types/indicator";
import schema from "../../../schemas/consulting-content.schema.json";
import { authorityInputs, commodityInputs, nationBeyond } from "./assemble";
import { AUTHORITY_RULES, buildAuthorityReport } from "./authority";
import { buildCommodityReport, COMMODITY_RULES, seasonalSourcing } from "./commodity";
import { claimProblems, CONSULTING, SERVICES, serviceById } from "./content";
import type { AssessmentReport } from "./report";
import { buildScenarioReport, type ScenarioModel } from "./scenario";
import { councilSmallAreas, closurePreview, furthestAreas } from "./smallAreas";

/*
 * Real published files (the manifest's current snapshots). Expected values are recomputed here
 * from the raw arrays, without the assessment code, and checked against the deep profiles'
 * figures that the Stage 5 report verified by hand (Manchester 14.08 %, Belfast 32.17 % beyond 1 km).
 */
const D = "public/data/snapshots";
const manifest = readRepoJson<DataManifest>("public/data/manifest.json");
const ladDoc = readRepoJson<CouncilIndicators>(`${D}/2026-10-24/local/lad-indicators.json`);
const storesDoc = readRepoJson<StoreCollection>(`${D}/2026-10-24/local/stores.geojson`);
const contextDoc = readRepoJson<CouncilContext>(`${D}/2026-10-26/context/council-context.json`);
const productionDoc = readRepoJson<UkProduction>(`${D}/2026-10-26/context/uk-production.json`);
const ppfiDoc = readRepoJson<CouncilPpfi>(`${D}/2026-10-25/risk/council-ppfi.json`);
const water = readRepoJson<RiskWaterStress>(`${D}/2026-10-25/risk/water-stress.json`);
const portEntry = readRepoJson<RiskPortEntry>(`${D}/2026-10-25/risk/port-entry.json`);
const ports = readRepoJson<RiskPorts>(`${D}/2026-10-25/risk/ports.json`);
const gb = readRepoJson<ScenarioClosure>(`${D}/2026-10-26/scenario/closure-gb.json`);
const ni = readRepoJson<ScenarioClosure>(`${D}/2026-10-26/scenario/closure-ni.json`);
const index = readRepoJson<TradeIndex>(`${D}/2026-10-26/trade/index.json`);
const snapshots = new Map(
  index.commodities.map((c) => [c.id, readRepoJson<TradeSnapshot>(`public/data/${c.path}`)]),
);
const stores = indexStores(storesDoc);
const deepCodes = new Set(["E08000003", "N09000003"]);
const councils = councilRows(ladDoc, contextDoc, deepCodes);
const national: NationalRow[] = index.commodities.map((c) => ({
  basket: c.id,
  label: c.label,
  imports: nationalImports(snapshots.get(c.id)!, c.months.provisionalFrom),
  production: productionDoc.commodities.find((p) => p.basket === c.id) ?? null,
}));
const deep = (lad: string) =>
  deepProfile(
    readRepoJson<SmallAreaIndicators>(`${D}/2026-10-25/areas/${lad}/small-area-indicators.json`),
    readRepoJson<SmallAreaBoundaries>(`${D}/2026-10-25/areas/${lad}/small-areas.geojson`),
    stores,
  );
const UK: [number, number] = [-2, 54];

function authority(lad: string): AssessmentReport {
  const inputs = authorityInputs(
    {
      lad: ladDoc,
      councils,
      context: contextDoc,
      stores,
      ppfi: ppfiDoc,
      closure: { gb, ni },
      deep: deepCodes.has(lad) ? deep(lad) : null,
      national,
    },
    lad,
    manifest,
    `https://example.test/?m=insights&lad=${lad}`,
  );
  return buildAuthorityReport(inputs!);
}

/** Every string of a report (findings, tables, packages, notes), for wording and claim audits. */
function allText(r: AssessmentReport): string {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk({ ...r, sources: [], datasets: [], link: "" });
  return out.join("\n");
}

/** Shared checks of every report: provenance (P1), references, wording (P9), claims (P14), JSON. */
function checkReport(r: AssessmentReport) {
  const ids = new Set(r.indicators.map((i) => i.id));
  expect(ids.size).toBe(r.indicators.length);
  for (const i of r.indicators) expect(provenanceProblems(i), i.id).toEqual([]);
  for (const k of r.kpis) expect(ids.has(k.indicator.id), k.id).toBe(true);
  const findings = [...r.executiveSummary, ...r.sections.flatMap((s) => s.findings)];
  for (const f of findings)
    for (const id of f.indicatorIds) expect(ids.has(id), `${id} in "${f.text}"`).toBe(true);
  for (const s of r.sections) {
    for (const t of s.tables) {
      expect(t.numeric.length, t.id).toBe(t.columns.length);
      for (const row of t.rows) expect(row.length, t.id).toBe(t.columns.length);
    }
    for (const c of s.chartIds)
      expect(
        r.charts.some((x) => x.id === c),
        c,
      ).toBe(true);
  }
  for (const c of r.charts)
    for (const s of c.series) expect(s.values.length, `${c.id} ${s.name}`).toBe(c.categories.length);
  for (const w of r.workPackages) {
    expect(() => serviceById(w.serviceId)).not.toThrow();
    expect(w.evidence.length, w.id).toBeGreaterThan(0);
    expect(w.additionalData.length, w.id).toBeGreaterThan(0);
  }
  // Indicated packages come first, and each rule names a real service.
  const firstSupporting = r.workPackages.findIndex((w) => !w.indicated);
  if (firstSupporting >= 0)
    expect(r.workPackages.slice(firstSupporting).every((w) => !w.indicated)).toBe(true);
  for (const rule of r.rules) expect(() => serviceById(rule.serviceId)).not.toThrow();

  const text = allText(r);
  expect(claimProblems(text)).toEqual([]);
  // P9: "shortage" and "confirmed impact" appear only negated; hypothetical results are never confirmed.
  const hits = [...text.matchAll(/[^.\n]*\b(?:shortages?|confirmed)\b[^.\n]*/gi)].map((m) => m[0]);
  for (const sentence of hits) expect(sentence, sentence).toMatch(/\bnot\b|\bnothing\b|\bnever\b|\bno\b/i);
  expect(text).not.toMatch(/forecast(ed)? shortages?/i);
  expect(text).not.toMatch(/\bNaN\b|undefined|\[object Object\]/);
  expect(r.disclaimer).toMatch(/not a commissioned food security audit/);
  expect(JSON.parse(JSON.stringify(r))).toEqual(r);
}

describe("consulting content (CI-04, P14)", () => {
  it("matches its schema and lists John's nine services", () => {
    const ajv = new Ajv({ allErrors: true, strict: true });
    const validate = ajv.compile(schema);
    expect(validate(CONSULTING), JSON.stringify(validate.errors)).toBe(true);
    expect(SERVICES.map((s) => s.title)).toEqual([
      "Food Security Geospatial Strategy",
      "National and Regional Resilience Assessment",
      "Food Retail Accessibility Mapping",
      "Supply Chain Geographic Risk Analysis",
      "Climate and Agricultural Resilience",
      "Critical Food Infrastructure Mapping",
      "Digital Twins and Operational Dashboards",
      "Geospatial Data Integration and Automation",
      "Scenario Modelling and Spatial Decision Support",
    ]);
    expect(CONSULTING.status.approval).toBe("draft-for-approval");
  });

  it("makes no claims: no clients, credentials, track record, budgets or procurement", () => {
    const text = JSON.stringify(CONSULTING);
    expect(claimProblems(text)).toEqual([]);
    // Services are described, never priced.
    expect(text).not.toMatch(/£|\bprice\b|\bcost(s)? from\b/i);
  });

  it("detects claim-like wording", () => {
    expect(claimProblems("Our clients include several councils.")).not.toEqual([]);
    expect(claimProblems("An award-winning team.")).not.toEqual([]);
    expect(claimProblems("The council has a budget for this work.")).not.toEqual([]);
    expect(claimProblems("Our fees start at a modest day rate.")).not.toEqual([]);
    expect(claimProblems("A geospatial assessment of food access.")).toEqual([]);
  });
});

describe("small areas from the Scenario Lab inputs (every council)", () => {
  /** Independent: loop over the raw arrays. */
  function rawBeyond(d: ScenarioClosure, lad: string, km: number) {
    const ci = d.councils.indexOf(lad);
    let pop = 0;
    let far = 0;
    d.areas.code.forEach((_, i) => {
      if (d.areas.council[i] !== ci) return;
      pop += d.areas.population[i]!;
      if (d.areas.distance[i]![0]! > km * 1000) far += d.areas.population[i]!;
    });
    return far / pop;
  }

  it("agrees with the deep profiles' shares beyond 1 km (Manchester, Belfast)", () => {
    const m = councilSmallAreas(gb, "E08000003")!;
    const b = councilSmallAreas(ni, "N09000003")!;
    expect(m.beyond[0]!.share).toBeCloseTo(rawBeyond(gb, "E08000003", 1), 10);
    expect(b.beyond[0]!.share).toBeCloseTo(rawBeyond(ni, "N09000003", 1), 10);
    expect(m.beyond[0]!.share).toBeCloseTo(0.1408, 4);
    expect(b.beyond[0]!.share).toBeCloseTo(0.3217, 4);
    expect(m.censusYear).toBe(2021);
    expect(m.deprived).not.toBeNull();
    expect(b.deprived).toBeNull();
    expect(b.deprivedAndFar).toEqual([]);
  });

  it("covers a Scottish and a Welsh council (Census 2022 for Scotland)", () => {
    const glasgow = councilSmallAreas(gb, "S12000049")!;
    expect(glasgow.censusYear).toBe(2022);
    expect(glasgow.deprived).toBeNull();
    const cardiff = councilSmallAreas(gb, "W06000015")!;
    expect(cardiff.areas.length).toBeGreaterThan(100);
    expect(cardiff.beyond[0]!.share).toBeCloseTo(rawBeyond(gb, "W06000015", 1), 10);
  });

  it("returns null for an unknown council and lists the furthest areas first", () => {
    expect(councilSmallAreas(gb, "E99999999")).toBeNull();
    const far = furthestAreas(councilSmallAreas(gb, "E08000003")!, 3);
    expect(far[0]!.nearestM).toBeGreaterThanOrEqual(far[1]!.nearestM);
    expect(far[1]!.nearestM).toBeGreaterThanOrEqual(far[2]!.nearestM);
  });

  it("previews closing the most relied-on supermarket (independent recount)", () => {
    const p = closurePreview(gb, "E08000003")!;
    const ci = gb.councils.indexOf("E08000003");
    const relied = new Map<number, number>();
    gb.areas.nearest.forEach((n, i) => {
      if (gb.areas.council[i] !== ci) return;
      relied.set(n[0]!, (relied.get(n[0]!) ?? 0) + gb.areas.population[i]!);
    });
    const max = Math.max(...relied.values());
    expect(p.reliedOn).toBe(max);
    expect(relied.get(p.storeIndex)).toBe(max);
    let affected = 0;
    gb.areas.nearest.forEach((n, i) => {
      if (n[0] === p.storeIndex) affected += gb.areas.population[i]!;
    });
    expect(p.result.populationAffected).toBe(affected);
  });

  it("computes a nation's share beyond 1 km over its own small areas", () => {
    const wales = nationBeyond(gb, "W", 1)!;
    let pop = 0;
    let far = 0;
    gb.areas.code.forEach((_, i) => {
      if (!gb.councils[gb.areas.council[i]!]!.startsWith("W")) return;
      pop += gb.areas.population[i]!;
      if (gb.areas.distance[i]![0]! > 1000) far += gb.areas.population[i]!;
    });
    expect(wales).toBeCloseTo(far / pop, 12);
  });
});

describe("Local Authority Food Security Assessment (CI-02, CI-03)", () => {
  const manchester = authority("E08000003");
  const belfast = authority("N09000003");

  it("passes the shared report checks", () => {
    checkReport(manchester);
    checkReport(belfast);
  });

  it("reproduces the council's figures from the raw files", () => {
    const raw = ladDoc.councils.find((c) => c.code === "E08000003")!;
    const sup = storesDoc.features.filter(
      (f) => f.properties.lad === "E08000003" && f.properties.storeClass === "supermarket",
    ).length;
    const kpi = (id: string) => manchester.kpis.find((k) => k.id === id)!.indicator.value as number;
    expect(kpi("population")).toBe(raw.population);
    expect(kpi("rate")).toBeCloseTo((sup / raw.population!) * 10_000, 10);
    expect(kpi("beyond")).toBeCloseTo(0.1408, 4);
    const ppfi = ppfiDoc.councils.find((c) => c.code === "E08000003")!;
    expect(kpi("ppfi")).toBeCloseTo(ppfi.values.combined!.priority / ppfi.values.combined!.areas, 12);
  });

  it("compares PPFI only with the council's own nation (pooled share)", () => {
    const rows = ppfiDoc.councils.filter((c) => c.nation === "Northern Ireland");
    const pooled =
      rows.reduce((s, c) => s + c.values.combined!.priority, 0) /
      rows.reduce((s, c) => s + c.values.combined!.areas, 0);
    const rule = belfast.rules.find((r) => r.id === "vulnerability")!;
    const b = ppfiDoc.councils.find((c) => c.code === "N09000003")!;
    const share = b.values.combined!.priority / b.values.combined!.areas;
    expect(rule.fired).toBe(share >= pooled);
    const nationInd = belfast.indicators.find((i) => i.id.startsWith("risk.access.nation"))!;
    expect(nationInd.value as number).toBeCloseTo(pooled, 12);
  });

  it("labels national context as such and keeps it out of local findings (P6)", () => {
    const n = manchester.sections.find((s) => s.id === "national")!;
    expect(n.scopeNote).toMatch(/National context/);
    expect(n.findings.every((f) => f.scope === "national_context")).toBe(true);
    for (const s of manchester.sections.filter((x) => x.id !== "national"))
      expect(
        s.findings.some((f) => f.scope === "national_context"),
        s.id,
      ).toBe(false);
  });

  it("states every rule with its threshold and observed value, and offers all seven opportunities", () => {
    expect(manchester.workPackages.map((w) => w.title).sort()).toEqual(
      [
        "Data integration and monitoring",
        "Geographic accessibility assessment",
        "Geospatial data governance and digital twin services",
        "Policy intervention evaluation",
        "Regional food resilience strategy",
        "Retail network analysis",
        "Scenario modelling",
      ].sort(),
    );
    for (const r of manchester.rules) expect(r.observed.length, r.id).toBeGreaterThan(0);
    const network = manchester.rules.find((r) => r.id === "network")!;
    expect(network.rule).toContain(`${Math.round(AUTHORITY_RULES.topRetailerShare * 100)}`);
  });

  it("flags Northern Ireland's store coverage and missing deprivation deciles", () => {
    const data = belfast.rules.find((r) => r.id === "data")!;
    expect(data.fired).toBe(true);
    expect(data.observed).toMatch(/partial store coverage/);
    expect(belfast.limitations.join(" ")).toMatch(/Republic of Ireland/);
    const deprived = belfast.indicators.find((i) => i.id === "insights.deprivation.deciles_1_2")!;
    expect(deprived.value).toBeNull();
    expect(deprived.missingReason).toBe("not_covered");
  });

  it("works for a council without a deep profile (Cardiff)", () => {
    const r = authority("W06000015");
    checkReport(r);
    expect(r.sections.find((s) => s.id === "vulnerability")!.tables.some((t) => t.id === "ppfi-areas")).toBe(
      false,
    );
    expect(r.kpis.some((k) => k.id === "beyond")).toBe(true);
  });

  it("lists every data source and the snapshot of each family it used (EX-01)", () => {
    expect(manchester.sources.map((s) => s.id)).toEqual(expect.arrayContaining(["S01", "S11", "S13", "S18"]));
    const families = manchester.snapshots.map((s) => s.family);
    expect(families).toEqual(
      expect.arrayContaining(["context", "local", "risk", "scenario", "trade", "areas"]),
    );
  });
});

describe("Commodity Supply Resilience Assessment (CI-02, CI-03)", () => {
  function commodity(id: string, measure: "mass" | "value" = "mass") {
    const entry = index.commodities.find((c) => c.id === id)!;
    const group = index.groups?.find((g) => g.id === entry.group) ?? null;
    return buildCommodityReport(
      commodityInputs(
        { entry, group, snapshot: snapshots.get(id)!, water, production: productionDoc, portEntry },
        { period: "rolling12", year: null, month: null, measure },
        UK,
        manifest,
        `https://example.test/?m=insights&ia=commodity&c=${id}`,
      ),
    );
  }

  it("passes the shared report checks for every basket", () => {
    for (const c of index.commodities) checkReport(commodity(c.id));
    checkReport(commodity("coffee", "value"));
  });

  it("reproduces the largest partner's share over the latest 12 months (independent)", () => {
    const snap = snapshots.get("tomatoes")!;
    const r = commodity("tomatoes");
    const last = snap.months.last;
    const [ly, lm] = last.split("-").map(Number) as [number, number];
    const lastIndex =
      (ly - Number(snap.months.first.slice(0, 4))) * 12 + lm - Number(snap.months.first.slice(5));
    const byPartner = new Map<number, number>();
    for (const [m, p, kg] of snap.rows) {
      if (m < lastIndex - 11 || m > lastIndex) continue;
      if (snap.partners[p]!.kind !== "country") continue;
      byPartner.set(p, (byPartner.get(p) ?? 0) + kg);
    }
    const total = [...byPartner.values()].reduce((s, v) => s + v, 0);
    const top = Math.max(...byPartner.values()) / total;
    expect(r.kpis.find((k) => k.id === "top")!.indicator.value as number).toBeCloseTo(top, 10);
  });

  it("finds seasonal dominance month by month and fires the seasonal rule only at the threshold", () => {
    const snap = snapshots.get("strawberries")!;
    const s = seasonalSourcing(snap, 2025, "mass");
    const months = s.dominant.reduce((n, d) => n + d.months.length, 0);
    for (const d of s.dominant)
      for (const m of d.months) expect(s.top[m - 1]!.share).toBeGreaterThanOrEqual(0.5);
    const r = commodity("strawberries");
    expect(r.rules.find((x) => x.id === "seasonal")!.fired).toBe(months >= COMMODITY_RULES.dominantMonths);
  });

  it("uses Defra's published balance or says it is not published (never estimated)", () => {
    const published = productionDoc.commodities.find((c) => c.status === "published")!;
    const missing = productionDoc.commodities.find((c) => c.status === "not_published")!;
    const a = commodity(published.basket);
    const b = commodity(missing.basket);
    expect(a.indicators.some((i) => i.id.startsWith("profile.national.production"))).toBe(true);
    expect(b.indicators.some((i) => i.id.startsWith("profile.national.production"))).toBe(false);
    expect(b.sections.find((s) => s.id === "production")!.findings[0]!.text).toMatch(/does not publish/);
  });

  it("labels the port of entry as all foods, never this commodity", () => {
    const r = commodity("bananas");
    const port = r.indicators.find((i) => i.id === "insights.port_entry.top")!;
    expect(port.coverage).toMatch(/not this commodity alone/);
    expect(r.workPackages.find((w) => w.id === "infrastructure")!.indicated).toBe(false);
  });
});

describe("Food Supply Disruption Scenario Assessment (CI-02, brief §4)", () => {
  const parts: ClosureParts = { gb, ni };
  const info = new Map<string, CouncilInfo>(
    ladDoc.councils.map((c) => [c.code, { code: c.code, name: c.name, nation: c.nation }]),
  );
  const tomatoes = snapshots.get("tomatoes")!;
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
  const rebuild = (p: ScenarioParams): ScenarioModel | null => {
    switch (p.kind) {
      case "import":
        return buildImportModel(tomatoes, "Tomatoes", p, UK, 12, "scenario");
      case "production":
        return buildProductionModel(productionDoc, p.commodity, "Wheat", p);
      case "port":
        return buildPortModel(ports, portEntry, p, "scenario", "DfT");
      case "closure": {
        const ref = findStore(parts, p.store);
        return ref ? buildClosureModel(parts, ref, info, "scenario", "June 2026") : null;
      }
    }
  };
  const report = (params: ScenarioParams) => {
    const model = rebuild(params)!;
    const methodology =
      model.kind === "import"
        ? importMethodology(model)
        : model.kind === "closure"
          ? closureMethodology(model)
          : model.kind === "production"
            ? productionMethodology(model)
            : portMethodology(model);
    return buildScenarioReport({
      params,
      model,
      methodology,
      rebuild,
      savedName: null,
      manifest,
      datasetIds: [],
      link: "",
    });
  };

  it("reports Scenario A with its baseline, assumptions and sensitivity", () => {
    const r = report(spain);
    checkReport(r);
    const sens = r.sections.find((s) => s.id === "sensitivity")!.tables[0]!;
    expect(sens.rows.map((x) => x[0])).toEqual([
      "Reduction 15 %",
      "Reduction 30 % (as set)",
      "Reduction 45 %",
      "Substitution 50 % (alternative assumption)",
    ]);
    // Affected tonnes are linear in the reduction: 15 % is half of 30 % (6,785.317 t, Stage 7 check).
    const half = buildImportModel(tomatoes, "Tomatoes", { ...spain, reduction: 15 }, UK, 12, "scenario");
    expect(half.result!.affected).toBeCloseTo(6_785.317 / 2, 3);
    expect(sens.rows[1]![1]).toBe(r.kpis[0]!.indicator.value === null ? "—" : sens.rows[1]![1]);
    const params = r.sections.find((s) => s.id === "scenario")!.tables[0]!;
    expect(params.rows.find((x) => x[0] === "Substitution by other partners")![2]).toMatch(/User assumption/);
    expect(r.rules.find((x) => x.id === "substitution")!.fired).toBe(true);
  });

  it("reports Scenario B for Manchester's most relied-on supermarket, with its geography", () => {
    const id = closurePreview(gb, "E08000003")!.storeId;
    const r = report({ kind: "closure", store: id });
    checkReport(r);
    const geo = r.sections.find((s) => s.id === "geography")!;
    expect(geo.tables.find((t) => t.id === "councils")!.rows.length).toBeGreaterThan(0);
    expect(r.charts.find((c) => c.id === "thresholds")!.series.map((s) => s.role)).toEqual([
      "baseline",
      "scenario",
    ]);
  });

  it("reports Scenarios C and D without inventing a geography", () => {
    const c = report({ kind: "production", commodity: "wheat", reduction: 20 });
    checkReport(c);
    expect(c.sections.find((s) => s.id === "geography")!.findings[0]!.text).toMatch(/never apportioned/);
    const d = report({ kind: "port", port: "GBFXT", reduction: 50, months: 3 });
    checkReport(d);
    expect(d.sections.find((s) => s.id === "sensitivity")!.tables[0]!.rows).toHaveLength(4);
  });
});
