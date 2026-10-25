/**
 * Risk Explorer view models (Stage 6; RK-01 – RK-04). Pure: no React, ArcGIS or DOM. Each view's
 * map, KPI cards, charts, tables and "Explain this risk" panel read one model, so they always agree.
 *
 * The three views are kept apart (RK-06, P10): nothing here combines supply, logistics and local
 * access into a score, and within a view no indicator is weighted into another.
 */
import type { BBox } from "@/analysis/frame";
import { formatChange, formatShare, formatTonnes } from "@/analysis/format";
import {
  annualSummary,
  breakClass,
  councilPriority,
  disruptionExposure,
  exposureMatrix,
  FARM_BREAKS,
  farmDensity,
  groupSummary,
  monthlyConcentration,
  portSeries,
  priorityClass,
  proportionalRadius,
  rankByConcentration,
  rankWithinNation,
  waterStressExposure,
  STRESS_CLASSES,
  type CommodityConcentration,
  type CouncilPriority,
  type DisruptionExposure,
  type ExposureMatrix,
  type FarmMeasure,
  type GroupSummary,
  type MonthConcentration,
  type NationRank,
  type PortMeasure,
  type StressExposure,
  type StressInfo,
  type YearSummary,
} from "@/analysis/risk";
import {
  aggregatePeriod,
  concentrationRatio,
  hhi,
  partnerShares,
  relativeChange,
  resolvePeriod,
  type Measure,
  type PartnerShare,
} from "@/analysis/trade";
import { buildOriginsModel, type OriginsModel, type OriginsSelection } from "@/features/origins/model";
import type { OriginsMapModel, RiskMapModel } from "@/state/store";
import type { Nation, PpfiMeasure } from "@/state/urlState";
import type { CouncilContext } from "@/types/generated/council-context";
import type { CouncilPpfi } from "@/types/generated/council-ppfi";
import type { RiskFarming } from "@/types/generated/risk-farming";
import type { RiskPortEntry } from "@/types/generated/risk-port-entry";
import type { RiskPorts } from "@/types/generated/risk-ports";
import type { RiskWaterStress } from "@/types/generated/risk-water-stress";
import type { TradeIndex } from "@/types/generated/trade-index";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";

/**
 * The whole UK with Shetland and the west of Northern Ireland (the 1:110m extent stops short of
 * both), for framing the logistics and community access views.
 */
export const UK_FULL_EXTENT: BBox = [-8.3, 49.8, 1.9, 60.9];

// ---------------------------------------------------------------------------------------------
// International supply exposure (RK-02)
// ---------------------------------------------------------------------------------------------

/** Water stress by ISO alpha-2 code (the join key of the trade partners, S24 crosswalk). */
export function stressIndex(doc: RiskWaterStress): Map<string, StressInfo> {
  return new Map(doc.countries.map((c) => [c.iso2, { class: c.class, value: c.value, year: c.year }]));
}

export interface SupplyBasket {
  id: string;
  label: string;
  snapshot: TradeSnapshot | undefined;
}

export interface SupplyModel {
  origins: OriginsModel;
  /** The trade map with the chosen fill (share or water stress). */
  map: OriginsMapModel;
  fill: "share" | "stress";
  stress: StressExposure;
  /** Each partner's water stress (null: no value in the World Bank series). */
  stressOf: Map<string, StressInfo | null>;
  /** Share of all recorded imports (incl. unallocated and suppressed) allocated to a partner country. */
  allocatedShare: number | null;
  provisionalMonths: number;
  monthly: MonthConcentration[];
  annual: YearSummary[];
  /** The five baskets over the same period, most concentrated first. */
  ranking: CommodityConcentration[];
  matrix: ExposureMatrix;
  /** Estimated exposure to the selected partner's disruption, month by month over the period. */
  disruption: DisruptionExposure | null;
  /** Commodity code changes in the snapshot (classification changes, kept continuous by the basket). */
  codeChanges: TradeSnapshot["codeChanges"];
}

const STRESS_INDEX = Object.fromEntries(STRESS_CLASSES.map((c, i) => [c, i + 1])) as Record<string, number>;

/** One basket's concentration over a period selection (for the ranking and the matrix). */
export function basketConcentration(
  snapshot: TradeSnapshot,
  label: string,
  sel: Pick<OriginsSelection, "period" | "year" | "month" | "measure">,
): { row: CommodityConcentration; shares: PartnerShare[] } {
  const period = resolvePeriod(
    { mode: sel.period, year: sel.year, month: sel.month },
    { first: snapshot.months.first, last: snapshot.months.last },
  );
  const shares = partnerShares(aggregatePeriod(snapshot, period.available).partners, sel.measure);
  const top = shares[0];
  return {
    row: {
      id: snapshot.commodity.id,
      label,
      hhi: hhi(shares.map((s) => s.share)),
      cr1: concentrationRatio(shares, 1),
      cr3: concentrationRatio(shares, 3),
      partners: shares.length,
      top: top ? { key: top.key, name: top.name } : null,
    },
    shares,
  };
}

export function buildSupplyModel(
  snapshot: TradeSnapshot,
  baskets: readonly SupplyBasket[],
  water: RiskWaterStress,
  sel: OriginsSelection,
  fill: "share" | "stress",
  ukAnchor: [number, number],
): SupplyModel {
  const origins = buildOriginsModel(snapshot, sel, ukAnchor);
  const stress = stressIndex(water);
  const iso2Of = new Map(snapshot.partners.map((p) => [p.key, p.iso2]));
  const stressOf = new Map<string, StressInfo | null>(
    origins.shares.map((s) => {
      const iso2 = iso2Of.get(s.key);
      return [s.key, (iso2 && stress.get(iso2)) || null];
    }),
  );
  const exposure = waterStressExposure(origins.shares, (k) => iso2Of.get(k) ?? null, stress);

  const map: OriginsMapModel = {
    ...origins.map,
    fill,
    partners: origins.map.partners.map((p) => {
      const info = stressOf.get(p.key);
      return { ...p, stressClass: info ? (STRESS_INDEX[info.class] ?? null) : null };
    }),
  };

  const agg = aggregatePeriod(snapshot, origins.period.available);
  const grand = sel.measure === "mass" ? agg.grandTotal.kg : agg.grandTotal.gbp;
  const allocated = sel.measure === "mass" ? agg.allocated.kg : agg.allocated.gbp;
  const provisionalFrom = snapshot.months.provisionalFrom;

  const concentration = baskets
    .filter((b) => b.snapshot)
    .map((b) => ({ id: b.id, label: b.label, ...basketConcentration(b.snapshot!, b.label, sel) }));

  return {
    origins,
    map,
    fill,
    stress: exposure,
    stressOf,
    allocatedShare: grand > 0 ? allocated / grand : null,
    provisionalMonths: provisionalFrom
      ? origins.period.available.filter((m) => m >= provisionalFrom).length
      : 0,
    monthly: monthlyConcentration(snapshot, sel.measure),
    annual: annualSummary(snapshot, sel.measure),
    ranking: rankByConcentration(concentration.map((c) => c.row)),
    matrix: exposureMatrix(
      concentration.map((c) => ({ id: c.id, label: c.label, shares: c.shares })),
      5,
    ),
    disruption: sel.partner
      ? disruptionExposure(snapshot, sel.measure, sel.partner, origins.period.available)
      : null,
    codeChanges: snapshot.codeChanges,
  };
}

/** Basket labels from the trade index, in its order. */
export function basketList(index: TradeIndex): { id: string; label: string; datasetId: string }[] {
  return index.commodities.map((c) => ({ id: c.id, label: c.label, datasetId: c.datasetId }));
}

// ---------------------------------------------------------------------------------------------
// Logistics and infrastructure (RK-03)
// ---------------------------------------------------------------------------------------------

export const PORT_MEASURE_LABELS: Record<PortMeasure, { short: string; long: string }> = {
  international: {
    short: "Inward freight from abroad",
    long: "Inward freight loaded at ports outside the UK (all cargo)",
  },
  agricultural: {
    short: "Agricultural products inwards",
    long: "Inward agricultural products (grain, soya, tapioca…) loaded abroad: dry bulk only",
  },
  roro: {
    short: "Roll-on/roll-off inwards",
    long: "Inward roll-on/roll-off freight, any origin (lorries, trailers): no commodity recorded",
  },
};

export interface PortRow {
  locode: string;
  name: string;
  nation: string;
  point: [number, number] | null;
  location: RiskPorts["ports"][number]["location"];
  /** Series per measure (thousand tonnes), aligned with `years`; null = not reported that year. */
  series: Record<PortMeasure, (number | null)[]>;
  latest: number | null;
  previous: number | null;
  change: number | null;
  /** Share of the latest total across all major ports for the measure. */
  shareOfTotal: number | null;
  /** UKFSR port-of-entry groups linked to this port (food, feed and drink imports, S03). */
  foodEntry: string[];
  /** Latest year's inwards by region of loading abroad: all cargo, and agricultural products (thousand tonnes). */
  regionsLatest: {
    international: { region: string; value: number }[];
    agricultural: { region: string; value: number }[];
  };
}

export interface LogisticsModel {
  years: number[];
  latestYear: number;
  measure: PortMeasure;
  ports: PortRow[];
  /** Sum over the major ports, per year (null when no port reported). */
  totals: (number | null)[];
  selected: PortRow | null;
  map: RiskMapModel;
  entry: RiskPortEntry;
  farmingMeasure: FarmMeasure | null;
  /** Year of the June survey (null when the farming file is missing). */
  farmingYear: number | null;
  regions: FarmingRegionRow[];
}

export interface FarmingRegionRow {
  id: string;
  name: string;
  nation: string;
  areaKm2: number;
  values: Record<string, number>;
  /** Density of the chosen measure and its class (null when the layer is off). */
  density: number | null;
  cls: number | null;
}

export function farmingRows(doc: RiskFarming, measure: FarmMeasure | null): FarmingRegionRow[] {
  return doc.regions.map((r) => {
    const density = measure ? farmDensity(r.values[measure] ?? NaN, r.areaKm2) : null;
    return {
      id: r.id,
      name: r.name,
      nation: r.nation,
      areaKm2: r.areaKm2,
      values: r.values as Record<string, number>,
      density,
      cls: measure && density !== null ? breakClass(density, FARM_BREAKS[measure]) : null,
    };
  });
}

export interface LogisticsSources {
  roads: { url: string; copyright: string } | null;
  regions: { url: string; copyright: string } | null;
  portsCopyright: string;
}

export function buildLogisticsModel(
  ports: RiskPorts,
  entry: RiskPortEntry,
  farming: RiskFarming | null,
  sel: { measure: PortMeasure; port: string | null; roads: boolean; farm: FarmMeasure | null },
  sources: LogisticsSources,
): LogisticsModel {
  const regions = { domestic: ports.domesticRegion, unspecified: ports.unspecifiedRegion };
  const last = ports.years.length - 1;
  const linked = new Map<string, string[]>();
  for (const g of entry.portOfEntry.groups)
    for (const code of g.locodes) linked.set(code, [...(linked.get(code) ?? []), g.label]);

  const rows: PortRow[] = ports.ports.map((p) => {
    const series = {
      international: portSeries(p, "international", regions),
      agricultural: portSeries(p, "agricultural", regions),
      roro: portSeries(p, "roro", regions),
    };
    const s = series[sel.measure];
    const latest = s[last] ?? null;
    const previous = last > 0 ? (s[last - 1] ?? null) : null;
    const abroad = (record: Record<string, (number | null)[]>) =>
      Object.entries(record)
        .filter(([region]) => region !== regions.domestic && region !== regions.unspecified)
        // A year the port did not report is left out, never counted as 0 t.
        .flatMap(([region, values]) => {
          const value = values[last];
          return value === null || value === undefined ? [] : [{ region, value }];
        })
        .sort((a, b) => b.value - a.value || a.region.localeCompare(b.region));
    return {
      locode: p.locode,
      name: p.name,
      nation: p.nation,
      point: p.point as [number, number] | null,
      location: p.location,
      series,
      latest,
      previous,
      change: relativeChange(latest, previous),
      shareOfTotal: null,
      foodEntry: linked.get(p.locode) ?? [],
      regionsLatest: {
        international: abroad(p.inwardsByRegion),
        agricultural: abroad(p.agriculturalInwardsByRegion),
      },
    };
  });
  const totals = ports.years.map((_, i) => {
    const values = rows.map((r) => r.series[sel.measure][i]).filter((v): v is number => v !== null);
    return values.length ? values.reduce((a, b) => a + b, 0) : null;
  });
  const total = totals[last] ?? null;
  for (const r of rows) r.shareOfTotal = total && r.latest !== null ? r.latest / total : null;
  rows.sort((a, b) => (b.latest ?? -1) - (a.latest ?? -1) || a.name.localeCompare(b.name));

  const max = Math.max(0, ...rows.map((r) => r.latest ?? 0));
  const label = PORT_MEASURE_LABELS[sel.measure].short.toLowerCase();
  const year = ports.years[last]!;
  const farmRows = farming ? farmingRows(farming, sel.farm) : [];
  const map: RiskMapModel = {
    ports: rows
      .filter((r) => r.point)
      .map((r) => ({
        locode: r.locode,
        name: r.name,
        point: r.point!,
        radius: proportionalRadius(r.latest, max),
        valueText: `${formatTonnes(r.latest === null ? null : r.latest * 1000)} ${label}, ${year}`,
        foodEntry: r.foodEntry.length > 0,
      })),
    selectedPort: sel.port,
    portKey: `${sel.measure}|${year}`,
    portsCopyright: sources.portsCopyright,
    roads: sel.roads ? sources.roads : null,
    regions: sources.regions
      ? {
          ...sources.regions,
          measure: sel.farm,
          classOf: sel.farm
            ? Object.fromEntries(farmRows.filter((r) => r.cls !== null).map((r) => [r.id, r.cls!]))
            : {},
        }
      : null,
    frame: { key: "uk", bbox: UK_FULL_EXTENT },
  };
  return {
    years: ports.years,
    latestYear: year,
    measure: sel.measure,
    ports: rows,
    totals,
    selected: sel.port ? (rows.find((r) => r.locode === sel.port) ?? null) : null,
    map,
    entry,
    farmingMeasure: sel.farm,
    farmingYear: farming?.year ?? null,
    regions: farmRows,
  };
}

/**
 * "+4.2 % on 2024" style detail for a port value (thousand tonnes). A published zero is a value,
 * not a gap: a change from 0 t has no percentage, so it is described in words.
 */
export function changeText(latest: number | null, previous: number | null, previousYear: number): string {
  if (latest === null || previous === null) return `no ${previousYear} figure`;
  if (previous === 0) return latest === 0 ? `also 0 t in ${previousYear}` : `up from 0 t in ${previousYear}`;
  return `${formatChange((latest - previous) / previous)} on ${previousYear}`;
}

// ---------------------------------------------------------------------------------------------
// Community food access (RK-04)
// ---------------------------------------------------------------------------------------------

export interface CouncilRiskRow extends CouncilPriority {
  rank: NationRank | null;
  cls: number | null;
  fewAreas: boolean;
}

export interface AccessRiskModel {
  measure: PpfiMeasure;
  rows: CouncilRiskRow[];
  byCode: Map<string, CouncilRiskRow>;
  /** The nation whose ranking is shown. */
  nation: Nation;
  /** That nation's councils with data, highest share first. */
  ranking: CouncilRiskRow[];
  /** Pooled share of the ranking nation's small areas in deciles 1–2 for the measure (about 20 %). */
  nationShare: number | null;
  /** The same for every nation (the baseline for each council's own nation). */
  nationShares: Map<string, number | null>;
  /** Councils of the nation without data for the measure (Northern Ireland: three domains). */
  measureMissing: boolean;
  selected: CouncilRiskRow | null;
  /** Each measure for the selected council (null: no data in its nation). */
  selectedDomains: {
    measure: string;
    label: string;
    share: number | null;
    priority: number | null;
    areas: number;
  }[];
  choropleth: { measure: string; classes: string[][]; noData: string[]; ramp: "risk" };
  /** England and Wales councils grouped by the ONS 2021 urban/rural flag (no class elsewhere). */
  urbanRural: { nation: string; groups: GroupSummary[] }[];
  /** Each council's small areas by decile of the combined index (1 = highest priority). */
  deciles: Map<string, number[]>;
  index: CouncilPpfi["index"];
  nations: CouncilPpfi["nations"];
  measures: CouncilPpfi["measures"];
}

export const FEW_AREAS = 10;

export function buildAccessRiskModel(
  doc: CouncilPpfi,
  context: CouncilContext | null,
  sel: { measure: PpfiMeasure; lad: string | null; rankNation: Nation | null },
): AccessRiskModel {
  const base = councilPriority(doc.councils, sel.measure);
  const ranks = rankWithinNation(base);
  const rows: CouncilRiskRow[] = base.map((r) => ({
    ...r,
    rank: ranks.get(r.code) ?? null,
    cls: priorityClass(r.share),
    fewAreas: r.areas < FEW_AREAS,
  }));
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const selected = sel.lad ? (byCode.get(sel.lad) ?? null) : null;
  const nation = (sel.rankNation ?? (selected?.nation as Nation | undefined) ?? "England") as Nation;
  const inNation = rows.filter((r) => r.nation === nation);
  const ranking = inNation
    .filter((r) => r.share !== null)
    .sort((a, b) => b.share! - a.share! || a.name.localeCompare(b.name));
  const pooled = (list: readonly CouncilRiskRow[]) => {
    const areas = list.reduce((s, r) => s + (r.share === null ? 0 : r.areas), 0);
    const prio = list.reduce((s, r) => s + (r.share === null ? 0 : (r.priority ?? 0)), 0);
    return areas > 0 ? prio / areas : null;
  };
  const nationShares = new Map(
    [...new Set(rows.map((r) => r.nation))].map((n) => [n, pooled(rows.filter((r) => r.nation === n))]),
  );

  const classes: string[][] = Array.from({ length: 6 }, () => []);
  const noData: string[] = [];
  for (const r of rows) (r.cls === null ? noData : classes[r.cls]!).push(r.code);

  const raw = selected ? doc.councils.find((c) => c.code === selected.code) : undefined;
  const selectedDomains = raw
    ? doc.measures.map((m) => {
        const v = raw.values[m.id] ?? null;
        return {
          measure: m.id,
          label: m.label,
          share: v ? v.priority / v.areas : null,
          priority: v ? v.priority : null,
          areas: raw.areas,
        };
      })
    : [];

  const flag = new Map<string, string>();
  for (const c of context?.councils ?? []) if (c.urbanRural) flag.set(c.code, c.urbanRural.flag);
  const urbanRural = (["England", "Wales"] as const).map((n) => ({
    nation: n,
    groups: groupSummary(
      rows.filter((r) => r.nation === n),
      (code) => flag.get(code) ?? null,
    ),
  }));

  return {
    measure: sel.measure,
    rows,
    byCode,
    nation,
    ranking,
    nationShare: nationShares.get(nation) ?? null,
    nationShares,
    measureMissing: inNation.length > 0 && inNation.every((r) => r.share === null),
    selected,
    selectedDomains,
    choropleth: { measure: sel.measure, classes, noData, ramp: "risk" },
    urbanRural,
    deciles: new Map(doc.councils.map((c) => [c.code, [...c.combinedDeciles]])),
    index: doc.index,
    nations: doc.nations,
    measures: doc.measures,
  };
}

/** Plain-language label of a priority class (legend and tooltips). */
export const PRIORITY_CLASS_LABELS = [
  "None of its areas",
  "Under 10 %",
  "10 – 20 %",
  "20 – 30 %",
  "30 – 50 %",
  "50 % and over",
] as const;

export function shareLine(r: Pick<CouncilPriority, "priority" | "areas" | "share">): string {
  return r.share === null
    ? "No data for this measure"
    : `${formatShare(r.share)} (${r.priority} of ${r.areas} small areas)`;
}

export type { Measure };
