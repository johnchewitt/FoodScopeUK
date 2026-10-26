import { describe, expect, it } from "vitest";
import { formatShare } from "@/analysis/format";
import { breakClass, FARM_BREAKS, STRESS_CLASSES } from "@/analysis/risk";
import { validateTradeIndex, validateTradeSnapshot } from "@/services/data/validate";
import { readRepoJson } from "@/test/files";
import type { CouncilContext } from "@/types/generated/council-context";
import type { CouncilPpfi } from "@/types/generated/council-ppfi";
import type { RiskFarming } from "@/types/generated/risk-farming";
import type { RiskPortEntry } from "@/types/generated/risk-port-entry";
import type { RiskPorts } from "@/types/generated/risk-ports";
import type { RiskWaterStress } from "@/types/generated/risk-water-stress";
import type { TradeIndex } from "@/types/generated/trade-index";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import type { Indicator } from "@/types/indicator";
import {
  explainCommodity,
  explainCouncil,
  explainPort,
  explainPorts,
  explainRegion,
  explainRoads,
  type Explanation,
} from "./explain";
import {
  basketList,
  buildAccessRiskModel,
  buildLogisticsModel,
  buildSupplyModel,
  changeText,
  type LogisticsSources,
  type SupplyBasket,
} from "./model";
import {
  validateCouncilContext,
  validateCouncilPpfi,
  validateFarming,
  validatePortEntry,
  validatePorts,
  validateWaterStress,
} from "./validate";

/*
 * Real published files: trade 2026-10-23 (HMRC), risk and context 2026-10-25. The expected values
 * were computed independently from the raw source files (HMRC OTS responses, World Bank API, DfT
 * PORT0499 read with pandas, the PPFI CSV with the Scottish Government lookup), without the
 * pipeline's or the app's code (docs/stage-reports/stage-6.md, "Hand checks").
 */
const TRADE = "public/data/snapshots/2026-10-23/trade";
const RISK = "public/data/snapshots/2026-10-25/risk";
const BASKETS = ["tomatoes", "strawberries", "bananas", "potatoes", "wheat"] as const;
const LABELS: Record<string, string> = {
  tomatoes: "Tomatoes",
  strawberries: "Strawberries",
  bananas: "Bananas",
  potatoes: "Potatoes",
  wheat: "Wheat",
};
const snapshots = Object.fromEntries(
  BASKETS.map((b) => [b, readRepoJson<TradeSnapshot>(`${TRADE}/${b}.json`)]),
) as Record<(typeof BASKETS)[number], TradeSnapshot>;
const baskets: SupplyBasket[] = BASKETS.map((b) => ({ id: b, label: LABELS[b]!, snapshot: snapshots[b] }));
const water = readRepoJson<RiskWaterStress>(`${RISK}/water-stress.json`);
const ports = readRepoJson<RiskPorts>(`${RISK}/ports.json`);
const entry = readRepoJson<RiskPortEntry>(`${RISK}/port-entry.json`);
const farming = readRepoJson<RiskFarming>(`${RISK}/farming.json`);
const ppfi = readRepoJson<CouncilPpfi>(`${RISK}/council-ppfi.json`);
const context = readRepoJson<CouncilContext>("public/data/snapshots/2026-10-25/context/council-context.json");
/** Natural Earth label point of the UK (world-country-points.json). */
const UK: [number, number] = [-2.1163, 54.4027];
const LAST_12 = { period: "rolling12" as const, year: null, month: null, measure: "mass" as const };

const supply = (
  basket: (typeof BASKETS)[number],
  partner: string | null = null,
  fill: "share" | "stress" = "share",
) => buildSupplyModel(snapshots[basket], baskets, water, { ...LAST_12, partner, flowCount: 12 }, fill, UK);

const SOURCES: LogisticsSources = {
  roads: { url: "roads.geojson", copyright: "OS" },
  roadsNi: { url: "roads-ni.geojson", copyright: "© OpenStreetMap contributors (ODbL)" },
  rail: { url: "rail.geojson", copyright: "Translink" },
  regions: { url: "regions.geojson", copyright: "ONS" },
  portsCopyright: "DfT",
};
const logistics = (
  sel: Partial<Parameters<typeof buildLogisticsModel>[3]> = {},
  sources: LogisticsSources = SOURCES,
) =>
  buildLogisticsModel(
    ports,
    entry,
    farming,
    { measure: "international", port: null, roads: true, rail: true, farm: null, ...sel },
    sources,
  );

const access = (sel: Partial<Parameters<typeof buildAccessRiskModel>[2]> = {}) =>
  buildAccessRiskModel(ppfi, context, { measure: "combined", lad: null, rankNation: null, ...sel });

describe("validation (ADR-06)", () => {
  it("accepts every published risk file", () => {
    expect(validateWaterStress(water).ok).toBe(true);
    expect(validatePorts(ports).ok).toBe(true);
    expect(validatePortEntry(entry).ok).toBe(true);
    expect(validateFarming(farming).ok).toBe(true);
    expect(validateCouncilPpfi(ppfi).ok).toBe(true);
    expect(validateCouncilContext(context).ok).toBe(true);
  });
});

describe("international supply exposure (RK-02)", () => {
  it("covers the latest 12 months, Sep 2025 – Aug 2026", () => {
    const m = supply("tomatoes");
    expect(m.origins.period.available[0]).toBe("2025-09");
    expect(m.origins.period.available.at(-1)).toBe("2026-08");
    // Provisional from 2025-03: every month of the period.
    expect(m.provisionalMonths).toBe(12);
  });

  it("ranks the five baskets by HHI, matching the raw HMRC responses", () => {
    const m = supply("tomatoes");
    expect(m.ranking.map((r) => r.id)).toEqual(["tomatoes", "strawberries", "potatoes", "bananas", "wheat"]);
    const hhi = Object.fromEntries(m.ranking.map((r) => [r.id, r.hhi]));
    expect(hhi.tomatoes).toBeCloseTo(2991.676, 2);
    expect(hhi.strawberries).toBeCloseTo(2636.594, 2);
    expect(hhi.potatoes).toBeCloseTo(1949.755, 2);
    expect(hhi.bananas).toBeCloseTo(1649.64, 2);
    expect(hhi.wheat).toBeCloseTo(1433.959, 2);
    expect(m.ranking.map((r) => r.partners)).toEqual([25, 22, 16, 43, 35]);
    // The matrix lists every basket against the union of their top partners.
    expect(m.matrix.commodities).toHaveLength(5);
  });

  it("estimates exposure to one partner's disruption, never a shortage", () => {
    const m = supply("tomatoes", "ES");
    expect(m.disruption?.periodShare).toBeCloseTo(0.110358, 5);
    expect(m.disruption?.peak?.month).toBe("2026-02");
    expect(m.disruption?.peak?.share).toBeCloseTo(0.23816, 4);
    expect(supply("tomatoes").disruption).toBeNull();
    const e = explainCommodity(m);
    expect(e.observed.map((i) => i.id)).toContain("risk.supply.exposure");
    const text = allText(e);
    expect(text).toMatch(/Whether that becomes a shortage depends on substitution/);
    expect(text).not.toMatch(/will run out|shortage of/i);
    // "Will fail" appears only in the negation.
    expect(text.match(/will fail/g)).toEqual(["will fail"]);
    expect(text).toMatch(/not a prediction that supply will fail/);
  });

  it("shares recorded imports by the partners' national water stress (S30)", () => {
    const t = supply("tomatoes", null, "stress");
    expect(t.stress.highOrCritical).toBeCloseTo(0.000831, 5);
    expect(supply("strawberries").stress.highOrCritical).toBeCloseTo(0.235215, 5);
    expect(supply("potatoes").stress.highOrCritical).toBeCloseTo(0.233025, 5);
    // Classes on the map: 1 = no stress … 5 = critical; Spain 43.3 % (2022) is low.
    expect(t.map.fill).toBe("stress");
    const es = t.map.partners.find((p) => p.key === "ES");
    expect(es?.stressClass).toBe(STRESS_CLASSES.indexOf("low") + 1);
    expect(t.stressOf.get("ES")).toEqual({
      class: "low",
      value: expect.closeTo(43.254, 3) as number,
      year: 2022,
    });
    const nl = t.stressOf.get("NL");
    expect(nl?.class).toBe("none");
  });

  it("treats a partner without a water-stress value as no data, never as low stress", () => {
    const doc: RiskWaterStress = { ...water, countries: water.countries.filter((c) => c.iso2 !== "ES") };
    const m = buildSupplyModel(
      snapshots.tomatoes,
      baskets,
      doc,
      { ...LAST_12, partner: null, flowCount: 12 },
      "stress",
      UK,
    );
    expect(m.stressOf.get("ES")).toBeNull();
    expect(m.map.partners.find((p) => p.key === "ES")?.stressClass).toBeNull();
    expect(m.stress.byClass.noData).toBeCloseTo(0.110358, 5);
    expect(m.stress.partners.noData).toContain("ES");
    expect(m.stress.partners.low).not.toContain("ES");
  });

  it("reports the tomato code change and keeps the series continuous", () => {
    const m = supply("tomatoes");
    expect(m.codeChanges).toEqual([
      { month: "2025-01", ended: ["07020000"], started: ["07020010", "07020091", "07020099"] },
    ]);
    // January 2025 (the first month of the new codes) has recorded imports and an HHI.
    expect(m.monthly.find((x) => x.month === "2025-01")?.hhi).toBeCloseTo(2736, 0);
  });

  it("keeps unallocated trade apart: shares use the allocated part only", () => {
    const m = supply("bananas");
    expect(m.allocatedShare).not.toBeNull();
    expect(m.allocatedShare!).toBeGreaterThan(0.99);
    expect(m.allocatedShare!).toBeLessThanOrEqual(1);
    const sum = m.origins.shares.reduce((s, r) => s + r.share, 0);
    expect(sum).toBeCloseTo(1, 9);
  });
});

describe("logistics and infrastructure (RK-03)", () => {
  it("describes a change from a published zero in words, never as a missing figure", () => {
    expect(changeText(12.2, 0, 2024)).toBe("up from 0 t in 2024");
    expect(changeText(0, 0, 2024)).toBe("also 0 t in 2024");
    expect(changeText(null, 5, 2024)).toBe("no 2024 figure");
    expect(changeText(5, null, 2024)).toBe("no 2024 figure");
    expect(changeText(97.762, 100, 2024)).toBe("−2.2 % on 2024");
    // Dover had no agricultural products inwards in 2024 or 2025.
    const dover = logistics({ measure: "agricultural", port: "GBDVR" }).selected!;
    expect([dover.previous, dover.latest]).toEqual([0, 0]);
  });

  it("totals and ranks the major ports as in DfT PORT0499 (2025, inward from abroad)", () => {
    const l = logistics();
    expect(l.latestYear).toBe(2025);
    expect(l.totals.at(-1)).toBeCloseTo(237484.733, 0);
    expect(l.ports.slice(0, 5).map((p) => p.name)).toEqual([
      "London",
      "Grimsby & Immingham",
      "Milford Haven",
      "Southampton",
      "Liverpool",
    ]);
    expect(l.ports[0]!.shareOfTotal).toBeCloseTo(0.16145, 4);
    expect(l.map.ports).toHaveLength(51);
    expect(l.map.ports.find((p) => p.locode === l.ports[0]!.locode)?.radius).toBe(26);
  });

  it("selects a port with its change on the previous year and its UKFSR entry group", () => {
    const l = logistics({ port: "GBDVR" });
    expect(l.selected?.name).toBe("Dover");
    expect(l.selected?.latest).toBeCloseTo(12512.825, 2);
    expect(l.selected?.change).toBeCloseTo(-0.02238, 4);
    expect(l.selected?.foodEntry).toEqual(["Dover/Folkestone/Eurotunnel"]);
    expect(l.map.selectedPort).toBe("GBDVR");
    expect(l.selected?.regionsLatest.international[0]?.region).toBe("European Union (excl. United Kingdom)");
  });

  it("switches the port measure: agricultural products inwards", () => {
    const l = logistics({ measure: "agricultural" });
    expect(l.totals.at(-1)).toBeCloseTo(9534.031, 0);
    expect(l.ports[0]!.name).toBe("Belfast");
    expect(l.ports[0]!.latest).toBeCloseTo(2590.651, 2);
    expect(l.map.portKey).toBe("agricultural|2025");
  });

  it("draws a port with no tonnage for the measure (an absolute zero in PORT0499) as an empty symbol", () => {
    const l = logistics({ measure: "roro" });
    const zero = l.ports.filter((p) => p.latest === 0);
    expect(zero.length).toBe(23);
    expect(l.ports.filter((p) => p.latest === null)).toEqual([]);
    for (const p of zero) {
      expect(p.shareOfTotal).toBe(0);
      const symbol = l.map.ports.find((x) => x.locode === p.locode);
      expect(symbol?.radius).toBe(0);
      expect(symbol?.valueText).toBe("0 t roll-on/roll-off inwards, 2025");
    }
  });

  it("shows roads only when switched on, and farming classes only for a chosen measure", () => {
    expect(logistics({ roads: false }).map.roads).toBeNull();
    // Northern Ireland's corridors (OpenStreetMap, S38) follow the same switch, with their own credit.
    expect(logistics({ roads: false }).map.roadsNi).toBeNull();
    expect(logistics().map.roadsNi?.copyright).toBe("© OpenStreetMap contributors (ODbL)");
    expect(logistics({ rail: false }).map.rail).toBeNull();
    expect(logistics().map.rail?.url).toBe("rail.geojson");
    expect(logistics().map.roads?.url).toBe("roads.geojson");
    expect(logistics().map.regions?.classOf).toEqual({});
    const l = logistics({ farm: "sheep" });
    expect(l.farmingYear).toBe(2025);
    const wales = l.regions.find((r) => r.name === "Wales")!;
    expect(wales.values.sheep).toBe(8_813_021);
    expect(wales.density).toBeCloseTo(8_813_021 / wales.areaKm2, 6);
    expect(wales.cls).toBe(breakClass(wales.density!, FARM_BREAKS.sheep));
    expect(wales.cls).toBe(4);
    expect(l.map.regions?.classOf[wales.id]).toBe(4);
    expect(Object.keys(l.map.regions!.classOf)).toHaveLength(l.regions.length);
  });

  it("works without the farming file or the roads file", () => {
    const l = buildLogisticsModel(
      ports,
      entry,
      null,
      { measure: "international", port: null, roads: true, rail: true, farm: "wheat" },
      { ...SOURCES, roads: null, roadsNi: null, rail: null },
    );
    expect(l.regions).toEqual([]);
    expect(l.farmingYear).toBeNull();
    expect(l.map.roads).toBeNull();
    expect(l.map.rail).toBeNull();
  });
});

describe("community food access (RK-04)", () => {
  it("shares and ranks a council within its own nation (Glasgow, Scotland)", () => {
    const a = access({ lad: "S12000049" });
    expect(a.nation).toBe("Scotland");
    expect(a.selected?.priority).toBe(103);
    expect(a.selected?.areas).toBe(746);
    expect(a.selected?.rank).toEqual({ rank: 18, of: 32, tied: false });
    expect(a.ranking.slice(0, 3).map((r) => [r.name, r.priority, r.areas])).toEqual([
      ["North Ayrshire", 119, 186],
      ["East Ayrshire", 98, 163],
      ["West Dunbartonshire", 60, 121],
    ]);
    expect(a.nationShare).toBeCloseTo(1396 / 6976, 12);
    const families = a.selectedDomains.find((d) => d.measure === "food_for_families");
    expect(families?.share).toBe(1);
    expect(a.deciles.get("S12000049")).toEqual([32, 71, 63, 75, 88, 98, 79, 78, 62, 100]);
  });

  it("never ranks across nations; the ranking nation can be chosen", () => {
    const a = access({ lad: "S12000049", rankNation: "England" });
    expect(a.nation).toBe("England");
    expect(a.ranking.every((r) => r.nation === "England")).toBe(true);
    expect(a.ranking).toHaveLength(296);
    expect(a.nationShare).toBeCloseTo(6751 / 33755, 12);
    // The selected council keeps its own nation's rank.
    expect(a.selected?.rank?.of).toBe(32);
  });

  it("shows Northern Ireland's missing domains as no data", () => {
    const a = access({ measure: "supermarket_accessibility", rankNation: "Northern Ireland" });
    expect(a.measureMissing).toBe(true);
    expect(a.nationShare).toBeNull();
    expect(a.ranking).toEqual([]);
    const ni = a.rows.filter((r) => r.nation === "Northern Ireland");
    expect(ni).toHaveLength(11);
    expect(ni.every((r) => r.share === null && r.rank === null && r.cls === null)).toBe(true);
    expect(a.choropleth.noData.sort()).toEqual(ni.map((r) => r.code).sort());
  });

  it("explains a council against its own nation, whatever nation is ranked", () => {
    const a = access({ lad: "E06000001", rankNation: "Scotland" }); // Hartlepool
    expect(a.nation).toBe("Scotland");
    expect(a.nationShares.get("England")).toBeCloseTo(6751 / 33755, 12);
    const e = explainCouncil(a.selected!, a);
    const base = e.observed.find((i) => i.id === "risk.access.nation_share");
    expect(base?.label).toBe("England: small areas in deciles 1–2");
    expect(base?.value).toBeCloseTo(6751 / 33755, 12);
    expect(e.interpretation[0]).toMatch(/times the nation's share/);
  });

  it("puts every council in exactly one class or no data", () => {
    const a = access();
    const all = [...a.choropleth.classes.flat(), ...a.choropleth.noData];
    expect(all).toHaveLength(a.rows.length);
    expect(new Set(all).size).toBe(a.rows.length);
    expect(a.rows).toHaveLength(361);
    expect(a.choropleth.ramp).toBe("risk");
    // Urban/rural groups only where the ONS classification applies.
    expect(a.urbanRural.map((u) => u.nation)).toEqual(["England", "Wales"]);
  });
});

// ---------------------------------------------------------------------------------------------
// "Explain this risk": observed evidence with provenance, kept apart from interpretation.

function allText(e: Explanation): string {
  return [
    e.subject,
    e.measured,
    e.why,
    e.calculation,
    ...e.limitations,
    ...e.moreEvidence,
    ...e.options,
    ...e.interpretation,
  ].join("\n");
}

function checkExplanation(e: Explanation) {
  const ids = new Set(e.sources.map((s) => s.id));
  expect(e.observed.length).toBeGreaterThan(0);
  for (const ind of e.observed as Indicator<number | string>[]) {
    expect(ind.sourceIds.length).toBeGreaterThan(0);
    // Every observed value's sources are listed with the explanation.
    for (const s of ind.sourceIds) expect(ids, `${ind.id} cites ${s}`).toContain(s);
    expect(ind.referencePeriod).toBeTruthy();
    expect(ind.method).toBeTruthy();
    expect(["measured", "official_estimate", "derived"]).toContain(ind.provenance);
    if (ind.value === null) expect(ind.missingReason).toBeTruthy();
  }
  expect(e.interpretation.length).toBeGreaterThan(0);
  const text = allText(e);
  // No forecasts, probabilities or scores.
  expect(text).not.toMatch(/probabilit|chance of|risk score|composite/i);
  expect(text).not.toMatch(/where (the )?food is grown(?! )/i);
}

describe("explanations", () => {
  it("explain a commodity with its evidence and a labelled interpretation", () => {
    const m = supply("tomatoes", "ES");
    const e = explainCommodity(m);
    checkExplanation(e);
    expect(e.kind).toBe("commodity");
    expect(e.interpretation.at(-1)).toMatch(/not a prediction that supply will fail/);
    // The interpretation restates the observed values, formatted the same way.
    expect(e.interpretation[0]).toContain(formatShare(m.origins.rows[0]!.share));
    expect(e.interpretation[0]).toContain("Netherlands");
    expect(e.observed.find((i) => i.id === "risk.supply.water_stress")?.referencePeriod).toBe("2022");
  });

  it("date each port figure by its own source period", () => {
    const l = logistics({ port: "GBDVR" });
    const port = explainPort(l.selected!, l);
    checkExplanation(port);
    expect(port.observed.map((i) => i.referencePeriod)).toEqual(["2025", "2025", "2023"]);
    expect(port.sources.map((s) => s.id)).toEqual(["S23", "S03", "S36"]); // Dover located by EMODnet
    const network = explainPorts(l);
    checkExplanation(network);
    expect(network.kind).toBe("ports");
    expect(network.observed.find((i) => i.id === "risk.ports.short_straits")?.value).toBeCloseTo(0.179, 3);
    const roads = explainRoads(l);
    checkExplanation(roads);
    expect(roads.observed[0]?.referencePeriod).toBe("Year to Dec 2023");
    expect(roads.observed[0]?.value).toBe(10.5);
  });

  it("explain a farming region and a council", () => {
    const l = logistics({ farm: "wheat" });
    const region = explainRegion(l.regions[0]!, "wheat", l.farmingYear!);
    checkExplanation(region);
    expect(region.observed[0]?.referencePeriod).toBe("June 2025");
    expect(region.observed[0]?.unit).toBe("share");

    const g = access({ lad: "S12000049" });
    const glasgow = explainCouncil(g.selected!, g);
    checkExplanation(glasgow);
    expect(glasgow.limitations.join(" ")).toMatch(/2011 Data Zones/);
    expect(glasgow.limitations.join(" ")).not.toMatch(/Northern Ireland three domains/);
    expect(glasgow.interpretation[0]).toMatch(
      /^13\.8 % of Glasgow City's small areas .* 0\.7 times the nation's share/,
    );

    const b = access({ lad: "N09000003", measure: "fuel_poverty" });
    const belfast = explainCouncil(b.selected!, b);
    checkExplanation(belfast);
    expect(belfast.observed[0]?.value).toBeNull();
    expect(belfast.observed[0]?.missingReason).toBe("not_covered");
    expect(belfast.interpretation[0]).toMatch(/no data for fuel poverty in Northern Ireland/);
    expect(belfast.limitations.join(" ")).toMatch(/three domains have no data/);
  });
});

describe("sixteen baskets (trade snapshot 2026-10-26)", () => {
  /*
   * Expected values computed independently from the raw HMRC responses in
   * pipeline/raw/hmrc/2026-10-26 (every page of single or split queries, CountryCodeAlpha with
   * XS → RS, non-geographic ids and suppressed rows excluded), without the pipeline's or the app's
   * code. Sep 2025 – Aug 2026, net mass.
   */
  const TRADE16 = "public/data/snapshots/2026-10-26/trade";
  const index16 = readRepoJson<TradeIndex>(`${TRADE16}/index.json`);
  const baskets16: SupplyBasket[] = basketList(index16).map((b) => ({
    id: b.id,
    label: b.label,
    group: b.group,
    snapshot: readRepoJson<TradeSnapshot>(`${TRADE16}/${b.id}.json`),
  }));
  const supply16 = (id: string) =>
    buildSupplyModel(
      baskets16.find((b) => b.id === id)!.snapshot!,
      baskets16,
      water,
      { ...LAST_12, partner: null, flowCount: 12 },
      "share",
      UK,
    );
  const EXPECTED: Record<string, { hhi: number; partners: number; top: string; topShare: number }> = {
    tomatoes: { hhi: 2991.676, partners: 25, top: "NL", topShare: 0.43828 },
    potatoes: { hhi: 1949.755, partners: 16, top: "IE", topShare: 0.3512 },
    strawberries: { hhi: 2636.594, partners: 22, top: "ES", topShare: 0.41452 },
    apples: { hhi: 1869.452, partners: 35, top: "FR", topShare: 0.31314 },
    oranges: { hhi: 2625.722, partners: 33, top: "EG", topShare: 0.34857 },
    bananas: { hhi: 1649.64, partners: 43, top: "CO", topShare: 0.3013 },
    wheat: { hhi: 1433.959, partners: 35, top: "CA", topShare: 0.22226 },
    rice: { hhi: 1782.84, partners: 67, top: "IN", topShare: 0.37914 },
    beef: { hhi: 4271.292, partners: 31, top: "IE", topShare: 0.63406 },
    "sheep-goat": { hhi: 3883.491, partners: 18, top: "NZ", topShare: 0.49081 },
    poultry: { hhi: 1785.886, partners: 29, top: "PL", topShare: 0.29838 },
    "milk-products": { hhi: 2131.511, partners: 46, top: "IE", topShare: 0.39813 },
    cheese: { hhi: 1153.849, partners: 41, top: "IE", topShare: 0.20235 },
    sugar: { hhi: 2472.633, partners: 69, top: "BR", topShare: 0.46604 },
    coffee: { hhi: 1168.606, partners: 100, top: "BR", topShare: 0.26741 },
    cocoa: { hhi: 2535.367, partners: 61, top: "CI", topShare: 0.42009 },
  };

  it("validates every basket file and groups them as the index says", () => {
    expect(validateTradeIndex(index16).ok).toBe(true);
    for (const b of baskets16) expect(validateTradeSnapshot(b.snapshot).ok, b.id).toBe(true);
    expect(index16.groups?.map((g) => g.label)).toEqual([
      "Fruit and vegetables",
      "Cereals",
      "Meat",
      "Dairy",
      "Sugar, coffee and cocoa",
    ]);
  });

  it("ranks all sixteen baskets with the HHI, partners and top supplier of the raw responses", () => {
    const m = supply16("beef");
    expect(m.ranking).toHaveLength(16);
    expect(m.ranking[0]?.id).toBe("beef"); // most concentrated: Ireland 63.4 %
    expect(m.ranking.at(-1)?.id).toBe("cheese"); // least: Ireland 20.2 %
    for (const r of m.ranking) {
      const e = EXPECTED[r.id]!;
      expect(r.hhi, r.id).toBeCloseTo(e.hhi, 2);
      expect(r.partners, r.id).toBe(e.partners);
      expect(r.top?.key, r.id).toBe(e.top);
      expect(r.cr1, r.id).toBeCloseTo(e.topShare, 4);
    }
  });

  it("compares a basket with its own group in the matrix", () => {
    const beef = supply16("beef");
    expect(beef.matrixGroup).toEqual({ id: "meat", label: "Meat" });
    expect(beef.matrix.commodities.map((c) => c.id)).toEqual(["beef", "sheep-goat", "poultry"]);
    const ie = beef.matrix.partners.findIndex((p) => p.key === "IE");
    expect(beef.matrix.cells[ie]![0]).toBeCloseTo(0.63406, 4);
    const cocoa = supply16("cocoa");
    expect(cocoa.matrix.commodities.map((c) => c.id)).toEqual(["sugar", "coffee", "cocoa"]);
    // Five Stage 2 baskets (no groups in the 2026-10-23 index): every basket, as before.
    expect(supply("tomatoes").matrixGroup).toBeNull();
  });
});
