/**
 * Scenario Lab formulas (Stage 7, spec §6.5). Pure functions over published baselines; every
 * output is a static exposure calculation under the user's stated assumptions, never a forecast
 * or a shortage (P9). Nothing here substitutes, stockpiles or responds: whatever is not stated as
 * an assumption is held at its baseline value.
 */
import {
  addMonths,
  aggregatePeriod,
  hhi,
  isProvisional,
  measureValue,
  monthDiff,
  partnerShares,
  type Measure,
  type MonthKey,
  type PartnerShare,
} from "./trade";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";

// ---------------------------------------------------------------------------------------------
// A — international supply disruption (SC-A/E)
// ---------------------------------------------------------------------------------------------

/**
 * Effective reduction in month `t` of the scenario (0 = the first disrupted month), spec §6.5:
 * `r` for the `duration` months, then falling linearly over `recovery` months, then 0.
 */
export function effectiveReduction(t: number, r: number, duration: number, recovery: number): number {
  if (t < 0) return 0;
  if (t < duration) return r;
  if (t < duration + recovery) return r * (1 - (t - duration + 1) / (recovery + 1));
  return 0;
}

export interface ImportDisruptionInput {
  partner: string;
  start: MonthKey;
  /** Fractions 0–1. */
  reduction: number;
  substitution: number;
  /** Months at full reduction (≥ 1) and months of linear recovery (≥ 0). */
  duration: number;
  recovery: number;
  measure: Measure;
}

export interface ImportMonth {
  month: MonthKey;
  /** False when the month is not in the snapshot (outside its first–last months): left out. */
  inSnapshot: boolean;
  provisional: boolean;
  /** HMRC recorded no import rows for the basket in the month. */
  nil: boolean;
  /** Effective reduction (0–1). */
  effective: number;
  /** The partner's recorded imports (t or £); 0 when the partner recorded none. */
  partnerBaseline: number;
  partnerRecorded: boolean;
  /** Recorded imports allocated to partner countries (the denominator of shares). */
  total: number;
  affected: number;
  unreplaced: number;
  /** Recorded imports remaining: total − affected. */
  residual: number;
  /** affected ÷ total; null when nothing was recorded in the month. */
  shareAffected: number | null;
  unreplacedShare: number | null;
}

export interface ImportDisruptionResult {
  partner: string;
  partnerName: string | null;
  months: ImportMonth[];
  /** Window months in the snapshot, and those outside it (left out, never estimated). */
  used: MonthKey[];
  outside: MonthKey[];
  provisional: MonthKey[];
  nil: MonthKey[];
  /** Window months in the snapshot in which the partner recorded nothing. */
  partnerAbsent: MonthKey[];
  partnerBaseline: number;
  total: number;
  affected: number;
  unreplaced: number;
  residual: number;
  shareAffected: number | null;
  unreplacedShare: number | null;
  /** Partner shares of recorded imports over the window, before and after (other partners unchanged). */
  sharesBefore: PartnerShare[];
  sharesAfter: PartnerShare[];
  partnerShareBefore: number | null;
  partnerShareAfter: number | null;
  hhiBefore: number | null;
  hhiAfter: number | null;
  /** HMRC rows suppressed in the window (never redistributed, P12). */
  suppressedRows: number;
}

/** Consecutive months from `start`: the disruption (`duration`) and recovery (`recovery`) window. */
export function scenarioWindow(start: MonthKey, duration: number, recovery: number): MonthKey[] {
  const n = Math.max(1, Math.round(duration)) + Math.max(0, Math.round(recovery));
  return Array.from({ length: n }, (_, i) => addMonths(start, i));
}

/**
 * Static exposure of recorded imports to a partner's disruption (spec §6.5):
 * affected(m) = effective_r(m) × M(partner, m); unreplaced = (1 − σ) × affected;
 * residual = total − affected; share affected = affected ÷ total (recorded imports allocated to
 * partner countries). Shares and HHI after: the partner's window total less the affected
 * amount, every other partner unchanged (stated). Months outside the snapshot are left out.
 */
export function importDisruption(
  snapshot: TradeSnapshot,
  input: ImportDisruptionInput,
): ImportDisruptionResult {
  const r = Math.min(1, Math.max(0, input.reduction));
  const sigma = Math.min(1, Math.max(0, input.substitution));
  const window = scenarioWindow(input.start, input.duration, input.recovery);
  const first = snapshot.months.first;
  const last = snapshot.months.last;
  const inSnapshot = (m: MonthKey) => monthDiff(first, m) >= 0 && monthDiff(m, last) >= 0;
  const nilSet = new Set(snapshot.nilMonths.map((i) => addMonths(first, i)));

  const months: ImportMonth[] = window.map((month, t) => {
    const effective = effectiveReduction(t, r, input.duration, input.recovery);
    if (!inSnapshot(month))
      return {
        month,
        inSnapshot: false,
        provisional: false,
        nil: false,
        effective,
        partnerBaseline: 0,
        partnerRecorded: false,
        total: 0,
        affected: 0,
        unreplaced: 0,
        residual: 0,
        shareAffected: null,
        unreplacedShare: null,
      };
    const agg = aggregatePeriod(snapshot, [month]);
    const total = measureValue(agg.allocated, input.measure);
    const p = agg.partners.find((x) => x.key === input.partner);
    const partnerBaseline = p ? measureValue(p, input.measure) : 0;
    const affected = effective * partnerBaseline;
    const unreplaced = (1 - sigma) * affected;
    return {
      month,
      inSnapshot: true,
      provisional: isProvisional(month, snapshot.months.provisionalFrom),
      nil: nilSet.has(month),
      effective,
      partnerBaseline,
      partnerRecorded: partnerBaseline > 0,
      total,
      affected,
      unreplaced,
      residual: total - affected,
      shareAffected: total > 0 ? affected / total : null,
      unreplacedShare: total > 0 ? unreplaced / total : null,
    };
  });

  const used = months.filter((m) => m.inSnapshot);
  const sum = (f: (m: ImportMonth) => number) => used.reduce((s, m) => s + f(m), 0);
  const total = sum((m) => m.total);
  const affected = sum((m) => m.affected);
  const unreplaced = sum((m) => m.unreplaced);
  const partnerBaseline = sum((m) => m.partnerBaseline);

  const agg = aggregatePeriod(
    snapshot,
    used.map((m) => m.month),
  );
  const sharesBefore = partnerShares(agg.partners, input.measure);
  // After: the partner's amounts reduced by the affected share of its window total (mass and value
  // scaled together, so the other measure stays consistent); every other partner unchanged.
  const factor = partnerBaseline > 0 ? Math.max(0, 1 - affected / partnerBaseline) : 1;
  const sharesAfter = partnerShares(
    agg.partners.map((p) => (p.key === input.partner ? { ...p, kg: p.kg * factor, gbp: p.gbp * factor } : p)),
    input.measure,
  );
  const partnerName =
    agg.partners.find((p) => p.key === input.partner)?.name ??
    snapshot.partners.find((p) => p.key === input.partner)?.name ??
    null;
  const shareOf = (shares: PartnerShare[]) =>
    shares.length ? (shares.find((s) => s.key === input.partner)?.share ?? 0) : null;

  return {
    partner: input.partner,
    partnerName,
    months,
    used: used.map((m) => m.month),
    outside: months.filter((m) => !m.inSnapshot).map((m) => m.month),
    provisional: used.filter((m) => m.provisional).map((m) => m.month),
    nil: used.filter((m) => m.nil).map((m) => m.month),
    partnerAbsent: used.filter((m) => !m.partnerRecorded).map((m) => m.month),
    partnerBaseline,
    total,
    affected,
    unreplaced,
    residual: total - affected,
    shareAffected: total > 0 ? affected / total : null,
    unreplacedShare: total > 0 ? unreplaced / total : null,
    sharesBefore,
    sharesAfter,
    partnerShareBefore: shareOf(sharesBefore),
    partnerShareAfter: shareOf(sharesAfter),
    hhiBefore: hhi(sharesBefore.map((s) => s.share)),
    hhiAfter: hhi(sharesAfter.map((s) => s.share)),
    suppressedRows: agg.suppressed.rows,
  };
}

// ---------------------------------------------------------------------------------------------
// B — supermarket closure (SC-D)
// ---------------------------------------------------------------------------------------------

/** The columns of the closure inputs the formulas use (schemas/scenario-closure.schema.json). */
export interface ClosureInput {
  councils: string[];
  stores: { id: number[]; retailer: string[]; council: number[]; x: number[]; y: number[] };
  areas: {
    code: string[];
    council: number[];
    population: number[];
    decile: (number | null)[];
    nearest: number[][];
    distance: number[][];
  };
}

export interface AffectedArea {
  index: number;
  population: number;
  council: number;
  decile: number | null;
  /** Straight-line metres to the nearest supermarket before and after; after null = none left in the data. */
  before: number;
  after: number | null;
  increase: number | null;
  newStore: number | null;
}

export interface ThresholdChange {
  metres: number;
  before: number;
  after: number;
}

export interface DistanceSummary {
  areas: number;
  population: number;
  /** Population-weighted mean and median straight-line distance, metres. */
  meanBefore: number | null;
  meanAfter: number | null;
  medianBefore: number | null;
  medianAfter: number | null;
  /** Residents beyond each threshold, before and after. */
  thresholds: ThresholdChange[];
}

export interface RetailerMix {
  stores: number;
  /** Supermarkets per retailer, most first (ties by name). */
  retailers: { retailer: string; count: number }[];
  /** HHI of retailer shares of the council's supermarkets (0–10,000); null with no supermarket. */
  hhi: number | null;
  topShare: number | null;
}

export interface ClosureResult {
  store: number;
  affected: AffectedArea[];
  populationAffected: number;
  /** Population-weighted mean and median increase, and the largest, metres. */
  meanIncrease: number | null;
  medianIncrease: number | null;
  maxIncrease: number | null;
  /** Areas left with no supermarket in the data (fewer than two listed). */
  unresolved: number;
  /** Supermarkets within each radius of the closed one, before (including it) and after. */
  nearby: { metres: number; before: number; after: number }[];
  /** The nearest other supermarket to the closed one. */
  nearestOther: { store: number; metres: number } | null;
  /** Supermarkets that become the nearest for at least one area. */
  takeover: { store: number; areas: number; population: number }[];
  /** Affected areas by council (a closure can reach beyond its own council). */
  byCouncil: { council: number; areas: number; population: number }[];
  /** The closed store's council: every small area, before and after. */
  council: number;
  councilDistances: DistanceSummary;
  retailerBefore: RetailerMix;
  retailerAfter: RetailerMix;
  /** Affected residents by IoD 2025 decile (England only; empty when no area has a decile). */
  deciles: { decile: number; areas: number; population: number }[];
}

export const DEFAULT_THRESHOLDS_M = [1000, 2000, 5000] as const;
export const NEARBY_RADII_M = [1000, 2000, 5000] as const;

/** Population-weighted median: the smallest value with at least half the weight at or below it. */
export function weightedMedian(values: readonly number[], weights: readonly number[]): number | null {
  const rows = values
    .map((v, i) => ({ v, w: weights[i] ?? 0 }))
    .filter((r) => r.w > 0 && Number.isFinite(r.v))
    .sort((a, b) => a.v - b.v);
  const total = rows.reduce((s, r) => s + r.w, 0);
  if (total <= 0) return null;
  let acc = 0;
  for (const r of rows) {
    acc += r.w;
    if (acc >= total / 2) return r.v;
  }
  return rows[rows.length - 1]!.v;
}

export function weightedMean(values: readonly number[], weights: readonly number[]): number | null {
  let s = 0;
  let w = 0;
  values.forEach((v, i) => {
    const wi = weights[i] ?? 0;
    if (wi > 0 && Number.isFinite(v)) {
      s += v * wi;
      w += wi;
    }
  });
  return w > 0 ? s / w : null;
}

/** Retailer counts and concentration of a set of supermarkets. */
export function retailerMix(retailers: readonly string[]): RetailerMix {
  const counts = new Map<string, number>();
  for (const r of retailers) counts.set(r, (counts.get(r) ?? 0) + 1);
  const rows = [...counts.entries()]
    .map(([retailer, count]) => ({ retailer, count }))
    .sort((a, b) => b.count - a.count || a.retailer.localeCompare(b.retailer));
  const n = retailers.length;
  return {
    stores: n,
    retailers: rows,
    hhi: n > 0 ? hhi(rows.map((r) => r.count / n)) : null,
    topShare: n > 0 ? rows[0]!.count / n : null,
  };
}

function distanceSummary(
  rows: { population: number; before: number; after: number | null }[],
  thresholds: readonly number[],
): DistanceSummary {
  const pops = rows.map((r) => r.population);
  // An area with no supermarket left in the data is beyond every threshold, but has no distance.
  const withAfter = rows.filter((r) => r.after !== null);
  return {
    areas: rows.length,
    population: pops.reduce((s, p) => s + p, 0),
    meanBefore: weightedMean(
      rows.map((r) => r.before),
      pops,
    ),
    meanAfter: weightedMean(
      withAfter.map((r) => r.after!),
      withAfter.map((r) => r.population),
    ),
    medianBefore: weightedMedian(
      rows.map((r) => r.before),
      pops,
    ),
    medianAfter: weightedMedian(
      withAfter.map((r) => r.after!),
      withAfter.map((r) => r.population),
    ),
    thresholds: thresholds.map((t) => ({
      metres: t,
      before: rows.reduce((s, r) => s + (r.before > t ? r.population : 0), 0),
      after: rows.reduce((s, r) => s + (r.after === null || r.after > t ? r.population : 0), 0),
    })),
  };
}

/**
 * Closing one supermarket (spec §6.5, SC-D). Each small area keeps its nearest supermarket unless
 * that is the closed one; then its second nearest (from the published three nearest over every
 * supermarket of its part of the UK, so stores beyond a council boundary count) becomes the
 * nearest. Distances are straight-line metres in the national grid, never travel times.
 */
export function closureImpact(
  data: ClosureInput,
  store: number,
  opts: { thresholds?: readonly number[]; radii?: readonly number[] } = {},
): ClosureResult {
  const thresholds = opts.thresholds ?? DEFAULT_THRESHOLDS_M;
  const radii = opts.radii ?? NEARBY_RADII_M;
  const A = data.areas;
  const S = data.stores;
  const affected: AffectedArea[] = [];
  let unresolved = 0;
  for (let i = 0; i < A.code.length; i++) {
    const near = A.nearest[i]!;
    if (near[0] !== store) continue;
    const dist = A.distance[i]!;
    const next = near[1] ?? -1;
    const after = next >= 0 ? (dist[1] ?? null) : null;
    if (after === null) unresolved += 1;
    affected.push({
      index: i,
      population: A.population[i]!,
      council: A.council[i]!,
      decile: A.decile[i] ?? null,
      before: dist[0]!,
      after,
      increase: after === null ? null : after - dist[0]!,
      newStore: next >= 0 ? next : null,
    });
  }
  affected.sort(
    (a, b) =>
      (b.increase ?? Number.POSITIVE_INFINITY) - (a.increase ?? Number.POSITIVE_INFINITY) ||
      b.population - a.population ||
      a.index - b.index,
  );

  const resolved = affected.filter((a) => a.increase !== null);
  const incs = resolved.map((a) => a.increase!);
  const incPops = resolved.map((a) => a.population);

  // Supermarkets around the closed one (straight line, its own grid).
  const sx = S.x[store]!;
  const sy = S.y[store]!;
  let nearestOther: ClosureResult["nearestOther"] = null;
  const nearby = radii.map((metres) => ({ metres, before: 0, after: 0 }));
  for (let j = 0; j < S.id.length; j++) {
    const d = Math.hypot(S.x[j]! - sx, S.y[j]! - sy);
    for (const n of nearby)
      if (d <= n.metres) {
        n.before += 1;
        if (j !== store) n.after += 1;
      }
    if (
      j !== store &&
      (nearestOther === null ||
        d < nearestOther.metres ||
        (d === nearestOther.metres && j < nearestOther.store))
    )
      nearestOther = { store: j, metres: d };
  }

  const takeoverMap = new Map<number, { areas: number; population: number }>();
  const councilMap = new Map<number, { areas: number; population: number }>();
  const decileMap = new Map<number, { areas: number; population: number }>();
  for (const a of affected) {
    if (a.newStore !== null) {
      const t = takeoverMap.get(a.newStore) ?? { areas: 0, population: 0 };
      t.areas += 1;
      t.population += a.population;
      takeoverMap.set(a.newStore, t);
    }
    const c = councilMap.get(a.council) ?? { areas: 0, population: 0 };
    c.areas += 1;
    c.population += a.population;
    councilMap.set(a.council, c);
    if (a.decile !== null) {
      const d = decileMap.get(a.decile) ?? { areas: 0, population: 0 };
      d.areas += 1;
      d.population += a.population;
      decileMap.set(a.decile, d);
    }
  }
  const byPopulation = <T extends { population: number; areas: number }>(a: [number, T], b: [number, T]) =>
    b[1].population - a[1].population || a[0] - b[0];

  // The closed store's council: every small area, with the affected ones' new distances.
  const council = S.council[store]!;
  const changed = new Map(affected.map((a) => [a.index, a.after]));
  const councilRows: { population: number; before: number; after: number | null }[] = [];
  for (let i = 0; i < A.code.length; i++) {
    if (A.council[i] !== council) continue;
    const before = A.distance[i]![0]!;
    councilRows.push({
      population: A.population[i]!,
      before,
      after: changed.has(i) ? changed.get(i)! : before,
    });
  }
  const councilStores: string[] = [];
  for (let j = 0; j < S.id.length; j++) if (S.council[j] === council) councilStores.push(S.retailer[j]!);
  const after = [...councilStores];
  after.splice(after.indexOf(S.retailer[store]!), 1);

  return {
    store,
    affected,
    populationAffected: affected.reduce((s, a) => s + a.population, 0),
    meanIncrease: weightedMean(incs, incPops),
    medianIncrease: weightedMedian(incs, incPops),
    maxIncrease: incs.length ? Math.max(...incs) : null,
    unresolved,
    nearby,
    nearestOther: nearestOther === null ? null : nearestOther,
    takeover: [...takeoverMap.entries()].sort(byPopulation).map(([s, v]) => ({ store: s, ...v })),
    byCouncil: [...councilMap.entries()].sort(byPopulation).map(([c, v]) => ({ council: c, ...v })),
    council,
    councilDistances: distanceSummary(councilRows, thresholds),
    retailerBefore: retailerMix(councilStores),
    retailerAfter: retailerMix(after),
    deciles: [...decileMap.entries()].sort((a, b) => a[0] - b[0]).map(([decile, v]) => ({ decile, ...v })),
  };
}

/** Distance-increase classes (metres) for the closure map and legend: 5 fixed classes. */
export const INCREASE_BREAKS_M = [250, 500, 1000, 2000] as const;

export function increaseClass(metres: number | null): number | null {
  if (metres === null) return null;
  let c = 0;
  for (const b of INCREASE_BREAKS_M) if (metres >= b) c += 1;
  return c;
}

// ---------------------------------------------------------------------------------------------
// C — domestic production shock (Defra supply balance)
// ---------------------------------------------------------------------------------------------

export interface SupplyBalance {
  /** Thousand tonnes, as Defra publishes them for one basket and year. */
  production: number;
  imports: number;
  exports: number;
  totalSupply: number;
}

export interface ProductionShockResult {
  productionAfter: number;
  removed: number;
  supplyAfter: number;
  /** Production as a share of total supply (0–1), before and after. */
  shareBefore: number | null;
  shareAfter: number | null;
  /** The production removed as a share of baseline total supply. */
  removedShareOfSupply: number | null;
  /** totalSupply − (production + imports − exports): Defra's identity, ~0 (rounding). */
  identityGap: number;
}

/**
 * A reduction in UK production on Defra's published annual balance (SC-C). Static: imports,
 * exports and stocks are held at their published values, so total supply falls by the production
 * removed. All four figures come from the same Defra table and year (never mixed with HMRC).
 */
export function productionShock(b: SupplyBalance, reduction: number): ProductionShockResult {
  const r = Math.min(1, Math.max(0, reduction));
  const removed = b.production * r;
  const productionAfter = b.production - removed;
  const supplyAfter = b.totalSupply - removed;
  return {
    productionAfter,
    removed,
    supplyAfter,
    shareBefore: b.totalSupply > 0 ? b.production / b.totalSupply : null,
    shareAfter: supplyAfter > 0 ? productionAfter / supplyAfter : null,
    removedShareOfSupply: b.totalSupply > 0 ? removed / b.totalSupply : null,
    identityGap: b.totalSupply - (b.production + b.imports - b.exports),
  };
}

// ---------------------------------------------------------------------------------------------
// D — port disruption (DfT port tonnage; UKFSR port of entry)
// ---------------------------------------------------------------------------------------------

export interface PortDisruptionInput {
  /** Fractions and months: reduction 0–1 lasting `months` (1–12) of the year. */
  reduction: number;
  months: number;
  /** The port's latest-year inward tonnage (thousand tonnes) by measure; null when not reported. */
  international: number | null;
  agricultural: number | null;
  roro: number | null;
  /** All major ports' totals for the same year and measures. */
  totalInternational: number | null;
  totalAgricultural: number | null;
  /** UKFSR share (%) of UK food, feed and drink imports entering at the port, when attributable. */
  foodEntryPercent: number | null;
}

/**
 * DfT cargo groups whose contents DfT does not record (S23): roll-on/roll-off units and containers.
 * Most food entering through a Ro-Ro port travels in them, so a port can record no agricultural
 * dry bulk while still carrying food.
 */
export const UNITISED_GROUPS = ["Ro-Ro Self Propelled", "Ro-Ro Non-Self Propelled", "Containers"] as const;

/** A port's unitised inward tonnage in year index `i` (any origin); null when no group reported. */
export function portUnitised(byGroup: Record<string, (number | null)[]>, i: number): number | null {
  let total = 0;
  let any = false;
  for (const g of UNITISED_GROUPS) {
    const v = byGroup[g]?.[i];
    if (v === null || v === undefined) continue;
    any = true;
    total += v;
  }
  return any ? total : null;
}

/**
 * Tonnage over a disruption of `months` months at reduction `r` (0–1), from an annual figure:
 * DfT publishes annual tonnage, so an even spread over the year is assumed (stated).
 */
export function overMonths(annual: number | null, months: number, r = 0): number | null {
  if (annual === null) return null;
  const f = Math.min(12, Math.max(1, Math.round(months))) / 12;
  return annual * f * (1 - Math.min(1, Math.max(0, r)));
}

export interface PortMeasureImpact {
  baseline: number | null;
  /** Thousand tonnes affected over the months: baseline × r × months ÷ 12 (even spread, stated). */
  affected: number | null;
  /** The port's share of all major ports' tonnage (unchanged by duration) and its reduction. */
  shareOfUk: number | null;
  shareOfUkAffected: number | null;
}

export interface PortDisruptionResult {
  international: PortMeasureImpact;
  agricultural: PortMeasureImpact;
  roro: PortMeasureImpact;
  /** Percentage points of UK food, feed and drink import volume affected; null when not attributable. */
  foodEntryAffected: number | null;
}

/**
 * A capacity reduction at one port (Scenario D). DfT publishes annual tonnage, so a reduction for
 * fewer than twelve months assumes an even spread over the year (stated). Commodity exposure is
 * computed only from flows the data records at the port (DfT agricultural products; UKFSR's food,
 * feed and drink share where its port of entry is the port); never from partner countries.
 */
export function portDisruption(input: PortDisruptionInput): PortDisruptionResult {
  const r = Math.min(1, Math.max(0, input.reduction));
  const f = Math.min(12, Math.max(1, Math.round(input.months))) / 12;
  const impact = (baseline: number | null, total: number | null): PortMeasureImpact => ({
    baseline,
    affected: baseline === null ? null : baseline * r * f,
    shareOfUk: baseline !== null && total ? baseline / total : null,
    shareOfUkAffected: baseline !== null && total ? (baseline * r) / total : null,
  });
  return {
    international: impact(input.international, input.totalInternational),
    agricultural: impact(input.agricultural, input.totalAgricultural),
    roro: impact(input.roro, null),
    foodEntryAffected: input.foodEntryPercent === null ? null : input.foodEntryPercent * r,
  };
}
