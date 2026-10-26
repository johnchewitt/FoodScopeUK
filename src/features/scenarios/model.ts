/**
 * Scenario Lab view models (Stage 7, SC-01 – SC-05). Pure: built from validated published data and
 * the typed scenario parameters, so the map, cards, charts, results table, methodology and export
 * all read one computation. Baseline figures keep their published provenance; every scenario
 * figure is "Scenario-modelled" (P2, P9) and carries its formula and assumptions.
 */
import { UK_EXTENT_110M } from "@/analysis/frame";
import { formatGbp, formatHhi, formatKm, formatShare, formatTonnes } from "@/analysis/format";
import { portSeries, proportionalRadius } from "@/analysis/risk";
import {
  closureImpact,
  importDisruption,
  increaseClass,
  portDisruption,
  productionShock,
  scenarioWindow,
  type ClosureResult,
  type ImportDisruptionResult,
  type PortDisruptionResult,
  type ProductionShockResult,
} from "@/analysis/scenario";
import {
  aggregatePeriod,
  flowWidths,
  formatMonth,
  formatMonthRange,
  monthDiff,
  monthKey,
  parseMonthKey,
  partnerShares,
  shareClass,
  type MonthKey,
  type PartnerShare,
} from "@/analysis/trade";
import { frameFor } from "@/features/origins/model";
import type {
  OriginsMapModel,
  OriginsMapPartner,
  RiskMapModel,
  ScenarioClosureMapModel,
  ScenarioMapArea,
} from "@/state/store";
import type { ImportScenario, PortScenario, ProductionScenario } from "@/state/scenarioParams";
import type { Measure, ScenarioView } from "@/state/urlState";
import type { Indicator, ProvenanceClass } from "@/types/indicator";
import type { RiskPortEntry } from "@/types/generated/risk-port-entry";
import type { RiskPorts } from "@/types/generated/risk-ports";
import type { ScenarioClosure } from "@/types/generated/scenario-closure";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import type { UkProduction } from "@/types/generated/uk-production";

type BBox = [number, number, number, number];

// ---------------------------------------------------------------------------------------------
// Shared shapes
// ---------------------------------------------------------------------------------------------

/** One row of the results dashboard: baseline, scenario, absolute and relative change (SC-03). */
export interface ResultRow {
  id: string;
  label: string;
  baseline: Indicator<number>;
  scenario: Indicator<number>;
  /** Scenario − baseline in the row's unit; null when either is missing. */
  change: number | null;
  /** (Scenario − baseline) ÷ baseline; null when the baseline is 0 or missing. */
  relative: number | null;
}

export type ConfidenceLevel = "high" | "moderate" | "low";

/** How far the inputs support the result: a stated rule, never a statistical interval. */
export interface Confidence {
  level: ConfidenceLevel;
  reasons: string[];
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "Higher",
  moderate: "Moderate",
  low: "Lower",
};

export interface Headline {
  id: string;
  label: string;
  indicator: Indicator<number>;
  detail: string;
}

interface IndicatorSpec {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  provenance: ProvenanceClass;
  sourceIds: [string, ...string[]];
  referencePeriod: string;
  coverage: string;
  method: string;
  scope?: Indicator["scope"];
  missingReason?: Indicator["missingReason"];
}

function ind(spec: IndicatorSpec): Indicator<number> {
  return {
    id: spec.id,
    label: spec.label,
    value: spec.value,
    unit: spec.unit,
    provenance: spec.provenance,
    sourceIds: spec.sourceIds,
    referencePeriod: spec.referencePeriod,
    coverage: spec.coverage,
    method: spec.method,
    scope: spec.scope ?? "national_context",
    ...(spec.value === null ? { missingReason: spec.missingReason ?? "not_published" } : {}),
  };
}

function row(id: string, label: string, baseline: Indicator<number>, scenario: Indicator<number>): ResultRow {
  const b = baseline.value;
  const s = scenario.value;
  return {
    id,
    label,
    baseline,
    scenario,
    change: b === null || s === null ? null : s - b,
    relative: b === null || s === null || b === 0 ? null : (s - b) / b,
  };
}

/** "−1.8 kt (−30.0 %)" style change text for a card detail (units as the measure). */
export function signed(value: number | null, format: (v: number) => string): string {
  if (value === null) return "—";
  if (Math.abs(value) < 1e-9) return `±${format(0)}`;
  return `${value < 0 ? "−" : "+"}${format(Math.abs(value))}`;
}

const SCENARIO_NOTE =
  "Scenario-modelled: a static exposure calculation under the stated assumptions, not a forecast.";

// ---------------------------------------------------------------------------------------------
// A — international supply disruption
// ---------------------------------------------------------------------------------------------

export interface PartnerOption {
  key: string;
  name: string;
  share: number;
}

export interface ImportModel {
  kind: "import";
  commodity: { id: string; label: string };
  measure: Measure;
  /** Resolved settings (defaults applied). */
  start: MonthKey;
  startIsDefault: boolean;
  windowLabel: string;
  partner: string | null;
  partnerName: string;
  partnerIsDefault: boolean;
  partners: PartnerOption[];
  years: number[];
  result: ImportDisruptionResult | null;
  headlines: Headline[];
  rows: ResultRow[];
  confidence: Confidence;
  assumptions: string[];
  map: OriginsMapModel;
  /** The latest complete calendar year in the snapshot (the default baseline year). */
  defaultYear: number;
  range: { first: MonthKey; last: MonthKey; provisionalFrom: MonthKey | null };
}

/** January of the latest complete calendar year in the snapshot (spec §6.5 default baseline). */
export function defaultStart(snapshot: TradeSnapshot): MonthKey {
  const last = parseMonthKey(snapshot.months.last);
  const year = last.month === 12 ? last.year : last.year - 1;
  const first = parseMonthKey(snapshot.months.first);
  return monthKey(Math.max(year, first.year), 1);
}

function measureText(v: number | null, measure: Measure): string {
  return measure === "mass" ? formatTonnes(v) : formatGbp(v);
}

function measureUnit(measure: Measure): string {
  return measure === "mass" ? "t" : "GBP";
}

export function buildImportModel(
  snapshot: TradeSnapshot,
  label: string,
  params: ImportScenario,
  ukAnchor: [number, number],
  flowCount: number,
  view: ScenarioView,
): ImportModel {
  const measure = params.measure;
  const start =
    params.year !== null && params.month !== null
      ? monthKey(params.year, params.month)
      : defaultStart(snapshot);
  const startIsDefault = params.year === null || params.month === null;
  const window = scenarioWindow(start, params.duration, params.recovery);
  const first = snapshot.months.first;
  const last = snapshot.months.last;
  const inSnapshot = window.filter((m) => monthDiff(first, m) >= 0 && monthDiff(m, last) >= 0);
  const baseAgg = aggregatePeriod(snapshot, inSnapshot);
  const baseShares = partnerShares(baseAgg.partners, measure);
  const partners: PartnerOption[] = baseShares.map((s) => ({ key: s.key, name: s.name, share: s.share }));
  const partner = params.partner ?? baseShares[0]?.key ?? null;
  const partnerName =
    (partner && snapshot.partners.find((p) => p.key === partner)?.name) ?? partner ?? "no recorded partner";
  if (partner && !partners.some((p) => p.key === partner))
    partners.push({ key: partner, name: partnerName, share: 0 });

  const result = partner
    ? importDisruption(snapshot, {
        partner,
        start,
        reduction: params.reduction / 100,
        substitution: params.substitution / 100,
        duration: params.duration,
        recovery: params.recovery,
        measure,
      })
    : null;
  const used = result?.used ?? [];
  const windowLabel =
    used.length > 0
      ? formatMonthRange(used[0]!, used[used.length - 1]!)
      : formatMonthRange(window[0]!, window[window.length - 1]!);
  const unit = measureUnit(measure);
  const word = measure === "mass" ? "net mass" : "value (current prices)";
  const coverage = `UK recorded imports of ${label.toLowerCase()} allocated to partner countries (HMRC; partner = country of dispatch)`;
  const formula = `affected = reduction (${params.reduction} %${params.recovery ? `, then linear recovery over ${params.recovery} months` : ""}) × ${partnerName}'s recorded ${word} in each month; residual = recorded imports − affected; affected share = affected ÷ recorded imports from partner countries.`;
  const noData = !result || used.length === 0;
  const missing = noData ? "not_published" : undefined;

  const total = ind({
    id: "scenario.import.total",
    label: "Recorded imports from partner countries",
    value: noData ? null : result!.total,
    unit,
    provenance: "measured",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method: `Sum of HMRC recorded ${word} allocated to partner countries over the months of the scenario (non-country and suppressed amounts excluded and listed separately, P12).`,
    missingReason: missing,
  });
  const residual = ind({
    id: "scenario.import.residual",
    label: "Recorded imports remaining",
    value: noData ? null : result!.residual,
    unit,
    provenance: "scenario",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method: `${formula} No alternative sourcing, stocks or demand response assumed.`,
    missingReason: missing,
  });
  const affected = ind({
    id: "scenario.import.affected",
    label: "Recorded imports affected",
    value: noData ? null : result!.affected,
    unit,
    provenance: "scenario",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method: formula,
    missingReason: missing,
  });
  const share = ind({
    id: "scenario.import.share_affected",
    label: "Share of recorded imports affected",
    value: noData ? null : result!.shareAffected,
    unit: "share",
    provenance: "scenario",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method: formula,
    missingReason: missing,
  });
  const partnerBefore = ind({
    id: "scenario.import.partner_baseline",
    label: `Recorded imports from ${partnerName}`,
    value: noData ? null : result!.partnerBaseline,
    unit,
    provenance: "measured",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method: `HMRC recorded ${word} from ${partnerName} (country of dispatch, not where the food was grown) over the scenario's months.`,
    missingReason: missing,
  });
  const partnerAfter = ind({
    id: "scenario.import.partner_scenario",
    label: `Recorded imports from ${partnerName} in the scenario`,
    value: noData ? null : result!.partnerBaseline - result!.affected,
    unit,
    provenance: "scenario",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method: formula,
    missingReason: missing,
  });
  const shareBefore = ind({
    id: "scenario.import.partner_share_baseline",
    label: `${partnerName}'s share of recorded imports`,
    value: noData ? null : result!.partnerShareBefore,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method: "Partner's recorded imports ÷ recorded imports allocated to partner countries.",
    missingReason: missing,
  });
  const shareAfter = ind({
    id: "scenario.import.partner_share_scenario",
    label: `${partnerName}'s share in the scenario`,
    value: noData ? null : result!.partnerShareAfter,
    unit: "share",
    provenance: "scenario",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method:
      "The partner's recorded imports less the affected amount, ÷ the new total; every other partner unchanged (stated, not modelled).",
    missingReason: noData || result!.partnerShareAfter === null ? "not_applicable" : undefined,
  });
  const hhiBefore = ind({
    id: "scenario.import.hhi_baseline",
    label: "Partner concentration (HHI)",
    value: noData ? null : result!.hhiBefore,
    unit: "HHI",
    provenance: "derived",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method: "Herfindahl–Hirschman Index of partner shares of recorded imports: Σ(100 × share)², 0–10,000.",
    missingReason: missing,
  });
  const hhiAfter = ind({
    id: "scenario.import.hhi_scenario",
    label: "Partner concentration (HHI) in the scenario",
    value: noData ? null : result!.hhiAfter,
    unit: "HHI",
    provenance: "scenario",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method:
      "HHI of partner shares after the affected amount is removed from the disrupted partner; other partners unchanged (stated). Null when no recorded imports remain.",
    missingReason: noData || result!.hhiAfter === null ? "not_applicable" : undefined,
  });
  const unreplacedShare = ind({
    id: "scenario.import.unreplaced_share",
    label: "Unreplaced share (your substitution assumption)",
    value: noData ? null : result!.unreplacedShare,
    unit: "share",
    provenance: "scenario",
    sourceIds: ["S01"],
    referencePeriod: windowLabel,
    coverage,
    method: `(1 − substitution ${params.substitution} %) × affected ÷ recorded imports from partner countries. The substitution share is a user assumption: there is no evidence here of actual substitution capacity.`,
    missingReason: missing,
  });

  const zero = (id: string, base: Indicator<number>) => ({
    ...base,
    id,
    provenance: "scenario" as const,
    value: base.value === null ? null : 0,
  });
  const rows: ResultRow[] = noData
    ? []
    : [
        row("total", "Recorded imports from partner countries", total, residual),
        row("partner", `Recorded imports from ${partnerName}`, partnerBefore, partnerAfter),
        row(
          "affected",
          "Recorded imports affected",
          zero("scenario.import.affected_baseline", affected),
          affected,
        ),
        row(
          "share",
          "Share of recorded imports affected",
          zero("scenario.import.share_baseline", share),
          share,
        ),
        row("partner-share", `${partnerName}'s share`, shareBefore, shareAfter),
        row("hhi", "Partner concentration (HHI)", hhiBefore, hhiAfter),
        ...(params.substitution > 0
          ? [
              row(
                "unreplaced",
                "Unreplaced share",
                zero("scenario.import.unreplaced_baseline", unreplacedShare),
                unreplacedShare,
              ),
            ]
          : []),
      ];

  const headlines: Headline[] = [
    {
      id: "affected",
      label: "Recorded imports affected",
      indicator: affected,
      detail: noData
        ? ""
        : `${params.reduction} % of ${measureText(result!.partnerBaseline, measure)} from ${partnerName}`,
    },
    {
      id: "share",
      label: "Share of recorded imports affected",
      indicator: share,
      detail: noData
        ? ""
        : `of ${measureText(result!.total, measure)} from partner countries, ${windowLabel}`,
    },
    {
      id: "residual",
      label: "Recorded imports remaining",
      indicator: residual,
      detail: noData ? "" : `Baseline ${measureText(result!.total, measure)} · no substitution assumed`,
    },
    {
      id: "hhi",
      label: "Partner concentration (HHI)",
      indicator: hhiAfter,
      detail: noData ? "" : `Baseline ${formatHhi(hhiBefore.value)} · other partners unchanged`,
    },
  ];

  const reasons: string[] = [];
  let level: ConfidenceLevel = "high";
  const lower = (l: ConfidenceLevel) => {
    if (l === "low" || level === "high") level = l;
  };
  if (noData) {
    lower("low");
    reasons.push("No month of the scenario is in the trade snapshot.");
  } else {
    if (result!.outside.length) {
      lower("low");
      reasons.push(
        `${result!.outside.length} month${result!.outside.length === 1 ? "" : "s"} of the scenario fall outside the snapshot (${formatMonth(snapshot.months.first)} to ${formatMonth(snapshot.months.last)}) and are left out, not estimated.`,
      );
    }
    if (result!.partnerAbsent.length) {
      lower("moderate");
      reasons.push(
        `${partnerName} recorded no imports in ${result!.partnerAbsent.map(formatMonth).join(", ")}: nothing is affected in those months.`,
      );
    }
    if (result!.provisional.length) {
      lower("moderate");
      reasons.push(
        `HMRC figures for ${result!.provisional.map(formatMonth).join(", ")} are provisional and may be revised.`,
      );
    }
    if (result!.suppressedRows > 0) {
      lower("moderate");
      reasons.push(
        `${result!.suppressedRows} suppressed HMRC row${result!.suppressedRows === 1 ? "" : "s"} in these months are not allocated to any partner (never redistributed).`,
      );
    }
    if (measure === "mass" && result!.total < 100) {
      lower("low");
      reasons.push("Fewer than 100 t were recorded: shares on a small base change a lot with small amounts.");
    }
    if (reasons.length === 0)
      reasons.push("Final HMRC figures for every month; the partner recorded imports in each one.");
  }
  reasons.push("Recorded trade only: partner = country of dispatch, not where the food was grown.");

  const assumptions = [
    `${partnerName}'s recorded imports fall by ${params.reduction} % for ${params.duration} month${params.duration === 1 ? "" : "s"} from ${formatMonth(start)}${params.recovery ? `, recovering linearly over ${params.recovery} month${params.recovery === 1 ? "" : "s"}` : ""}.`,
    "Every other partner's recorded imports stay at their baseline values (not modelled).",
    `Substitution: ${params.substitution} % of the affected volume assumed replaced from other sources (user assumption; default 0 %).`,
    "No stocks, alternative sourcing, price or demand response is modelled.",
  ];

  return {
    kind: "import",
    commodity: { id: snapshot.commodity.id, label },
    measure,
    start,
    startIsDefault,
    windowLabel,
    partner,
    partnerName,
    partnerIsDefault: params.partner === null,
    partners,
    years: yearsOf(snapshot),
    result,
    headlines,
    rows,
    confidence: { level, reasons },
    assumptions,
    map: importMap(snapshot, result, baseShares, ukAnchor, flowCount, view, measure, windowLabel),
    defaultYear: parseMonthKey(defaultStart(snapshot)).year,
    range: { first, last, provisionalFrom: snapshot.months.provisionalFrom },
  };
}

function yearsOf(snapshot: TradeSnapshot): number[] {
  const a = parseMonthKey(snapshot.months.first).year;
  const b = parseMonthKey(snapshot.months.last).year;
  return Array.from({ length: b - a + 1 }, (_, i) => b - i);
}

/**
 * The trade map for Scenario A: the same connections as the baseline (top partners by baseline
 * value) on a fixed width scale (the largest baseline connection), so a narrower line means less.
 * In the scenario view the disrupted partner's connection narrows (or disappears at 100 %) with its
 * baseline width dashed behind it, and partner fills show the scenario's shares.
 */
export function importMap(
  snapshot: TradeSnapshot,
  result: ImportDisruptionResult | null,
  baseShares: PartnerShare[],
  ukAnchor: [number, number],
  flowCount: number,
  view: ScenarioView,
  measure: Measure,
  windowLabel: string,
): OriginsMapModel {
  const meta = new Map(snapshot.partners.map((p) => [p.key, p]));
  const flowable = (key: string) => {
    const p = meta.get(key);
    return Boolean(p && p.geometry !== "none" && p.point && key !== "GB");
  };
  const flows = baseShares.filter((s) => flowable(s.key)).slice(0, Math.max(0, flowCount));
  const scaleMax = flows[0]?.value ?? 0;
  const baseWidth = new Map(
    flows.map((f, i) => [
      f.key,
      flowWidths(
        flows.map((x) => x.value),
        1.5,
        12,
        scaleMax,
      )[i]!,
    ]),
  );
  const scenario = view === "scenario" && result !== null;
  const shares = scenario ? result.sharesAfter : baseShares;
  const byKey = new Map(shares.map((s) => [s.key, s]));
  const disrupted = result?.partner ?? null;
  // A fully disrupted partner has no share in the scenario: kept on the map at 0 (class 0).
  const keys = [
    ...shares.map((s) => s.key),
    ...(disrupted && !byKey.has(disrupted) && scenario ? [disrupted] : []),
  ];
  const partners: OriginsMapPartner[] = keys.flatMap((key) => {
    const p = meta.get(key);
    if (!p) return [];
    const s = byKey.get(key);
    const value = s?.value ?? 0;
    const share = s?.share ?? 0;
    const isFlow = baseWidth.has(key);
    const width = !isFlow
      ? 0
      : scenario
        ? value > 0
          ? flowWidths([value], 1.5, 12, scaleMax)[0]!
          : 0
        : baseWidth.get(key)!;
    const ghost = scenario && key === disrupted && isFlow ? baseWidth.get(key)! : undefined;
    return [
      {
        key,
        name: p.name,
        iso2: p.iso2,
        geometry: p.geometry,
        point: p.point,
        share,
        shareClass: shareClass(share),
        valueText: `${measureText(value, measure)} · ${formatShare(share)}${scenario ? " (scenario)" : ""}`,
        flow: isFlow && width > 0,
        flowWidth: width,
        ...(ghost !== undefined && ghost > width ? { ghostWidth: ghost } : {}),
      },
    ];
  });
  return {
    commodityId: snapshot.commodity.id,
    periodLabel: `${windowLabel} · ${view}${result ? ` · ${result.partner} ${result.affected.toFixed(3)}` : ""}`,
    measure,
    partners,
    ukAnchor,
    fill: "share",
    frame: frameFor(
      snapshot.commodity.id,
      flows.map((f) => meta.get(f.key)!.point!),
      ukAnchor,
    ),
  };
}

// ---------------------------------------------------------------------------------------------
// B — supermarket closure
// ---------------------------------------------------------------------------------------------

export type ClosurePart = "gb" | "ni";

export interface ClosureParts {
  gb: ScenarioClosure;
  ni: ScenarioClosure;
}

export interface CouncilInfo {
  code: string;
  name: string;
  nation: string;
}

export interface StoreRef {
  part: ClosurePart;
  index: number;
}

export interface StoreOption {
  id: number;
  name: string;
  retailer: string;
  council: string;
  part: ClosurePart;
}

/** Finds a supermarket by GEOLYTIX id in the closure inputs. */
export function findStore(parts: ClosureParts, id: number | null): StoreRef | null {
  if (id === null) return null;
  for (const part of ["gb", "ni"] as const) {
    const index = parts[part].stores.id.indexOf(id);
    if (index >= 0) return { part, index };
  }
  return null;
}

/** Every supermarket, for the search list (name order). */
export function storeOptions(parts: ClosureParts, councils: Map<string, CouncilInfo>): StoreOption[] {
  const out: StoreOption[] = [];
  for (const part of ["gb", "ni"] as const) {
    const d = parts[part];
    d.stores.id.forEach((id, i) => {
      const code = d.councils[d.stores.council[i]!]!;
      out.push({
        id,
        name: d.stores.name[i]!,
        retailer: d.stores.retailer[i]!,
        council: councils.get(code)?.name ?? code,
        part,
      });
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

/** Search by store name, retailer or council (case- and accent-insensitive); at most `limit`. */
export function searchStores(options: readonly StoreOption[], query: string, limit = 25): StoreOption[] {
  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return options
    .filter((o) => {
      const hay = norm(`${o.name} ${o.retailer} ${o.council}`);
      return words.every((w) => hay.includes(w));
    })
    .slice(0, limit);
}

/**
 * The supermarket in a council that is the nearest for the most residents (the closure preset):
 * computed from the published inputs, never chosen by hand. Null when the council has none.
 */
export function mostReliedOn(data: ScenarioClosure, council: string): number | null {
  const c = data.councils.indexOf(council);
  if (c < 0) return null;
  const pop = new Map<number, number>();
  data.areas.nearest.forEach((n, i) => {
    const s = n[0]!;
    if (data.stores.council[s] === c) pop.set(s, (pop.get(s) ?? 0) + data.areas.population[i]!);
  });
  let best: number | null = null;
  let bestPop = -1;
  for (const [s, p] of pop)
    if (p > bestPop || (p === bestPop && data.stores.id[s]! < data.stores.id[best!]!)) {
      best = s;
      bestPop = p;
    }
  return best === null ? null : data.stores.id[best]!;
}

export interface AffectedRow {
  code: string;
  name: string;
  council: string;
  population: number;
  beforeKm: number;
  afterKm: number | null;
  increaseKm: number | null;
  newStore: string | null;
  census: number;
}

export interface ClosureModel {
  kind: "closure";
  part: ClosurePart;
  store: {
    id: number;
    name: string;
    retailer: string;
    format: string;
    sizeBand: string;
    council: CouncilInfo;
    point: [number, number];
  };
  result: ClosureResult;
  affected: AffectedRow[];
  councilsReached: { council: CouncilInfo; areas: number; population: number }[];
  takeover: {
    id: number;
    name: string;
    retailer: string;
    areas: number;
    population: number;
    km: number | null;
  }[];
  nearestOther: { name: string; km: number } | null;
  headlines: Headline[];
  rows: ResultRow[];
  confidence: Confidence;
  assumptions: string[];
  map: ScenarioClosureMapModel;
  /** Census years of the affected residents (Scotland: 2022). */
  censusYears: number[];
}

const AREA_KIND: Record<string, string> = {
  E: "LSOA (2021)",
  W: "LSOA (2021)",
  S: "Data Zone (2022)",
  N: "Data Zone (2021)",
};

/** Fixed symbol scale for the closure map: 3,000 residents → 12 px (area ∝ residents). */
export function areaRadius(population: number): number {
  return Math.min(14, 3 + 9 * Math.sqrt(Math.max(0, population) / 3000));
}

export function buildClosureModel(
  parts: ClosureParts,
  ref: StoreRef,
  councils: Map<string, CouncilInfo>,
  view: ScenarioView,
  storesPeriod: string,
): ClosureModel {
  const d = parts[ref.part];
  const S = d.stores;
  const A = d.areas;
  const i = ref.index;
  const councilOf = (k: number): CouncilInfo => {
    const code = d.councils[k]!;
    return councils.get(code) ?? { code, name: code, nation: "" };
  };
  const result = closureImpact(d, i);
  const council = councilOf(S.council[i]!);
  const census = (code: string) => d.census[code[0]!] ?? 2021;
  const km = (m: number | null) => (m === null ? null : m / 1000);
  const affected: AffectedRow[] = result.affected.map((a) => ({
    code: A.code[a.index]!,
    name: A.name[a.index]!,
    council: councilOf(a.council).name,
    population: a.population,
    beforeKm: a.before / 1000,
    afterKm: km(a.after),
    increaseKm: km(a.increase),
    newStore: a.newStore === null ? null : S.name[a.newStore]!,
    census: census(A.code[a.index]!),
  }));
  const censusYears = [...new Set(affected.map((a) => a.census))].sort();
  const sx = S.x[i]!;
  const sy = S.y[i]!;
  const grid = d.grid === "EPSG:2157" ? "Irish Transverse Mercator" : "British National Grid";
  const period = `${storesPeriod}; Census ${censusYears.length ? censusYears.join(" and ") : "2021"}`;
  const coverage = `Small areas whose nearest mapped supermarket (GEOLYTIX, 280 m² and over) is ${S.name[i]}, anywhere in ${ref.part === "gb" ? "Great Britain" : "Northern Ireland"}`;
  const sources: [string, ...string[]] =
    ref.part === "gb" ? ["S11", "S15", "S17", "S18"] : ["S11", "S16", "S18"];
  const method = `Each small area's nearest supermarket by straight-line distance from its population-weighted centroid, in the ${grid}, over every supermarket of ${ref.part === "gb" ? "Great Britain" : "Northern Ireland"} (so stores beyond the council boundary count). Closing this store moves the areas whose nearest it was to their next nearest. Not travel time.`;

  const popAffected = ind({
    id: "scenario.closure.population",
    label: "Residents whose nearest supermarket changes",
    value: result.populationAffected,
    unit: "residents (small areas)",
    provenance: "scenario",
    sourceIds: sources,
    referencePeriod: period,
    coverage,
    method: `${method} Residents: Census usual residents of those areas, as published.`,
    scope: "local",
  });
  const areasAffected = ind({
    id: "scenario.closure.areas",
    label: "Small areas whose nearest supermarket changes",
    value: result.affected.length,
    unit: "small areas",
    provenance: "scenario",
    sourceIds: sources,
    referencePeriod: period,
    coverage,
    method,
    scope: "local",
  });
  const meanIncrease = ind({
    id: "scenario.closure.mean_increase",
    label: "Average extra straight-line distance",
    value: km(result.meanIncrease),
    unit: "km (straight-line)",
    provenance: "scenario",
    sourceIds: sources,
    referencePeriod: period,
    coverage,
    method: `Population-weighted mean of (distance to the new nearest supermarket − distance to the closed one) over the affected areas. ${method}`,
    scope: "local",
    missingReason: "not_applicable",
  });
  const maxIncrease = ind({
    id: "scenario.closure.max_increase",
    label: "Largest extra straight-line distance",
    value: km(result.maxIncrease),
    unit: "km (straight-line)",
    provenance: "scenario",
    sourceIds: sources,
    referencePeriod: period,
    coverage,
    method,
    scope: "local",
    missingReason: "not_applicable",
  });
  const nearbyIndicator = (radius: number, value: number, provenance: ProvenanceClass, suffix: string) =>
    ind({
      id: `scenario.closure.nearby_${radius}_${suffix}`,
      label: `Supermarkets within ${radius / 1000} km of ${S.name[i]}`,
      value,
      unit: "supermarkets",
      provenance,
      sourceIds: ["S11"],
      referencePeriod: storesPeriod,
      coverage: `GEOLYTIX supermarkets (280 m² and over) within ${radius / 1000} km straight-line of the closed store, any council`,
      method: `Count of supermarkets whose straight-line distance from the closed store, in the ${grid}, is at most ${radius / 1000} km${suffix === "scenario" ? ", without the closed store" : ", including it"}.`,
      scope: "local",
    });
  const r2 = result.nearby.find((n) => n.metres === 2000)!;
  const cd = result.councilDistances;
  const councilCoverage = `Every small area of ${council.name} (${cd.areas.toLocaleString("en-GB")} areas)`;
  const councilMean = (value: number | null, provenance: ProvenanceClass, suffix: string) =>
    ind({
      id: `scenario.closure.council_mean_${suffix}`,
      label: `Average straight-line distance to the nearest supermarket, ${council.name}`,
      value: km(value),
      unit: "km (straight-line)",
      provenance,
      sourceIds: sources,
      referencePeriod: period,
      coverage: councilCoverage,
      method: `Population-weighted mean over the council's small areas. ${method}`,
      scope: "local",
    });
  const beyond = (t: { metres: number; before: number; after: number }, which: "before" | "after") =>
    ind({
      id: `scenario.closure.beyond_${t.metres}_${which}`,
      label: `Residents more than ${t.metres / 1000} km from a supermarket, ${council.name}`,
      value: t[which],
      unit: "residents (small areas)",
      provenance: which === "before" ? "derived" : "scenario",
      sourceIds: sources,
      referencePeriod: period,
      coverage: councilCoverage,
      method: `Σ residents of the council's small areas whose nearest supermarket is more than ${t.metres / 1000} km away in a straight line. ${method}`,
      scope: "local",
    });
  const hhiIndicator = (value: number | null, provenance: ProvenanceClass, suffix: string, stores: number) =>
    ind({
      id: `scenario.closure.retailer_hhi_${suffix}`,
      label: `Retailer concentration of supermarkets, ${council.name}`,
      value,
      unit: "HHI",
      provenance,
      sourceIds: ["S11", "S14"],
      referencePeriod: storesPeriod,
      coverage: `${stores} GEOLYTIX supermarkets in ${council.name}`,
      method:
        "Herfindahl–Hirschman Index of retailer shares of the council's supermarkets by count: Σ(100 × share)², 0–10,000. Counts, not floor space or sales.",
      scope: "local",
      missingReason: "not_applicable",
    });
  const t2 = cd.thresholds.find((t) => t.metres === 2000)!;
  const none = (base: Indicator<number>, id: string): Indicator<number> => ({
    ...base,
    id,
    value: 0,
    provenance: "derived",
    method: "The baseline: every supermarket open, so no area's nearest supermarket changes.",
  });
  const rows: ResultRow[] = [
    row(
      "areas",
      "Small areas whose nearest supermarket changes",
      none(areasAffected, "scenario.closure.areas_baseline"),
      areasAffected,
    ),
    row(
      "population",
      "Residents whose nearest supermarket changes",
      none(popAffected, "scenario.closure.population_baseline"),
      popAffected,
    ),
    ...(result.maxIncrease === null
      ? []
      : [
          row(
            "max-increase",
            "Largest extra straight-line distance",
            none(maxIncrease, "scenario.closure.max_baseline"),
            maxIncrease,
          ),
        ]),
    row(
      "council-mean",
      `Average distance to the nearest supermarket, ${council.name}`,
      councilMean(cd.meanBefore, "derived", "baseline"),
      councilMean(cd.meanAfter, "scenario", "scenario"),
    ),
    ...cd.thresholds.map((t) =>
      row(
        `beyond-${t.metres}`,
        `Residents more than ${t.metres / 1000} km from one, ${council.name}`,
        beyond(t, "before"),
        beyond(t, "after"),
      ),
    ),
    ...result.nearby.map((n) =>
      row(
        `nearby-${n.metres}`,
        `Supermarkets within ${n.metres / 1000} km of the closed store`,
        nearbyIndicator(n.metres, n.before, "measured", "baseline"),
        nearbyIndicator(n.metres, n.after, "scenario", "scenario"),
      ),
    ),
    row(
      "retailer-hhi",
      `Retailer concentration (HHI), ${council.name}`,
      hhiIndicator(result.retailerBefore.hhi, "derived", "baseline", result.retailerBefore.stores),
      hhiIndicator(result.retailerAfter.hhi, "scenario", "scenario", result.retailerAfter.stores),
    ),
  ];

  const headlines: Headline[] = [
    {
      id: "population",
      label: "Residents whose nearest supermarket changes",
      indicator: popAffected,
      detail: `${result.affected.length.toLocaleString("en-GB")} small area${result.affected.length === 1 ? "" : "s"} · ${censusYears.includes(2022) ? "Census 2021 and 2022" : "Census 2021"}`,
    },
    {
      id: "mean-increase",
      label: "Average extra distance (straight-line)",
      indicator: meanIncrease,
      detail:
        result.maxIncrease === null
          ? "No area's nearest supermarket changes"
          : `Up to ${formatKm(result.maxIncrease / 1000)} · population-weighted · not travel time`,
    },
    {
      id: "nearby",
      label: "Supermarkets within 2 km",
      indicator: nearbyIndicator(2000, r2.after, "scenario", "scenario"),
      detail: `${r2.before} before the closure, including it · straight-line`,
    },
    {
      id: "beyond",
      label: `Residents > 2 km, ${council.name}`,
      indicator: beyond(t2, "after"),
      detail: `${t2.before.toLocaleString("en-GB")} before · straight-line · council`,
    },
  ];

  const reasons: string[] = [
    "Straight-line distance from a population-weighted centroid: a proxy for proximity, not travel time, cost or opening hours.",
    "GEOLYTIX v46 (June 2026) supermarkets of 280 m² and over; smaller stores and markets are not counted.",
  ];
  let level: ConfidenceLevel = "moderate";
  if (ref.part === "ni") {
    level = "low";
    reasons.push(
      "Supermarkets in the Republic of Ireland are not in the data, so distances near the border may be overstated.",
    );
  }
  if (result.maxIncrease !== null && result.maxIncrease > 10_000) {
    level = "low";
    reasons.push(
      "Some new distances exceed 10 km: islands and estuaries are crossed in a straight line, which no route does.",
    );
  }
  if (result.unresolved > 0) {
    level = "low";
    reasons.push(
      `${result.unresolved} area${result.unresolved === 1 ? " has" : "s have"} no other supermarket in the data.`,
    );
  }
  if (censusYears.includes(2022) && censusYears.length > 1)
    reasons.push("Scotland's residents are from Census 2022, the others from Census 2021.");

  const assumptions = [
    `${S.name[i]} closes; every other supermarket stays open.`,
    "Residents use their nearest supermarket by straight-line distance (a proxy, not observed shopping).",
    "No new store opens and no store changes its size or hours.",
    "Each small area is represented by its population-weighted centroid.",
  ];

  // Map: areas, links to their nearest supermarket before (closed) or after, the stores that take over.
  const point = (part: ScenarioClosure, j: number): [number, number] => [
    part.stores.lon[j]!,
    part.stores.lat[j]!,
  ];
  const closedPoint = point(d, i);
  const areas: ScenarioMapArea[] = result.affected.map((a) => ({
    code: A.code[a.index]!,
    point: [A.lon[a.index]!, A.lat[a.index]!],
    radius: areaRadius(a.population),
    cls: increaseClass(a.increase),
    from: closedPoint,
    to: a.newStore === null ? null : point(d, a.newStore),
  }));
  const takeoverStores = result.takeover.map((t) => ({ id: S.id[t.store]!, point: point(d, t.store) }));
  const pts = [closedPoint, ...areas.map((a) => a.point), ...takeoverStores.map((t) => t.point)];
  const pad = 0.004;
  const bbox: BBox = [
    Math.min(...pts.map((p) => p[0])) - pad,
    Math.min(...pts.map((p) => p[1])) - pad,
    Math.max(...pts.map((p) => p[0])) + pad,
    Math.max(...pts.map((p) => p[1])) + pad,
  ];
  const map: ScenarioClosureMapModel = {
    key: `closure:${S.id[i]}`,
    view,
    closed: { id: S.id[i]!, point: closedPoint },
    areas,
    takeover: takeoverStores,
    frame: { key: `closure:${S.id[i]}`, bbox },
  };

  return {
    kind: "closure",
    part: ref.part,
    store: {
      id: S.id[i]!,
      name: S.name[i]!,
      retailer: S.retailer[i]!,
      format: S.format[i]!,
      sizeBand: S.sizeBand[i]!,
      council,
      point: closedPoint,
    },
    result,
    affected,
    councilsReached: result.byCouncil.map((c) => ({
      council: councilOf(c.council),
      areas: c.areas,
      population: c.population,
    })),
    takeover: result.takeover.map((t) => ({
      id: S.id[t.store]!,
      name: S.name[t.store]!,
      retailer: S.retailer[t.store]!,
      areas: t.areas,
      population: t.population,
      km: Math.hypot(S.x[t.store]! - sx, S.y[t.store]! - sy) / 1000,
    })),
    nearestOther: result.nearestOther
      ? { name: S.name[result.nearestOther.store]!, km: result.nearestOther.metres / 1000 }
      : null,
    headlines,
    rows,
    confidence: { level, reasons },
    assumptions,
    map,
    censusYears,
  };
}

/** The national map frame before a supermarket is picked. */
export const CLOSURE_UK_FRAME: ScenarioClosureMapModel = {
  key: "closure:none",
  view: "scenario",
  closed: null,
  areas: [],
  takeover: [],
  frame: { key: "closure:none", bbox: UK_EXTENT_110M as BBox },
};

export function areaKind(code: string): string {
  return AREA_KIND[code[0]!] ?? "Small area";
}

// ---------------------------------------------------------------------------------------------
// C — domestic production shock
// ---------------------------------------------------------------------------------------------

type ProductionEntry = UkProduction["commodities"][number];
type PublishedEntry = Extract<ProductionEntry, { status: "published" }>;

export interface ProductionModel {
  kind: "production";
  basket: string;
  label: string;
  status: "published" | "not_published";
  /** Why Defra publishes no balance for the basket (not_published). */
  note: string | null;
  available: { basket: string }[];
  entry: PublishedEntry | null;
  result: ProductionShockResult | null;
  headlines: Headline[];
  rows: ResultRow[];
  /** Measures the balance does not contain (shown as not available, never estimated). */
  notInBalance: string[];
  confidence: Confidence;
  assumptions: string[];
}

function measureOf(entry: PublishedEntry, key: string) {
  return entry.measures.find((m) => m.key === key) ?? null;
}

export function buildProductionModel(
  doc: UkProduction,
  basket: string,
  label: string,
  params: ProductionScenario,
): ProductionModel {
  const entry = doc.commodities.find((c) => c.basket === basket);
  const available = doc.commodities
    .filter((c) => c.status === "published")
    .map((c) => ({ basket: c.basket }));
  const notInBalance = ["Consumption (household or total)", "Stocks and stock changes"];
  const empty = {
    kind: "production" as const,
    basket,
    label,
    available,
    entry: null,
    result: null,
    headlines: [],
    rows: [],
    notInBalance,
    assumptions: [],
  };
  if (!entry || entry.status !== "published")
    return {
      ...empty,
      status: "not_published",
      note:
        entry && entry.status === "not_published"
          ? entry.note
          : "No Defra supply balance is held for this basket.",
      confidence: {
        level: "low",
        reasons: ["No published UK supply balance: the scenario is not computed."],
      },
    };
  const production = measureOf(entry, "production");
  const imports = measureOf(entry, "imports");
  const exports = measureOf(entry, "exports");
  const totalSupply = measureOf(entry, "totalSupply");
  if (!production || !imports || !exports || !totalSupply)
    return {
      ...empty,
      status: "not_published",
      note: "Defra's balance for this basket lacks one of production, imports, exports or total supply.",
      confidence: { level: "low", reasons: ["Incomplete balance: the scenario is not computed."] },
    };
  const result = productionShock(
    {
      production: production.value,
      imports: imports.value,
      exports: exports.value,
      totalSupply: totalSupply.value,
    },
    params.reduction / 100,
  );
  const ref = `${entry.year}${entry.provisional ? " (provisional)" : ""}`;
  const coverage = `United Kingdom, ${entry.scope ?? label}`;
  const source: [string, ...string[]] = [entry.sourceId];
  const kt = (v: number) => v * 1000;
  const published = (key: string, m: { label: string; value: number }) =>
    ind({
      id: `scenario.production.${key}_baseline`,
      label: m.label,
      value: kt(m.value),
      unit: "t",
      provenance: "official_estimate",
      sourceIds: source,
      referencePeriod: ref,
      coverage,
      method: `${entry.table}, as published (thousand tonnes).`,
    });
  const modelled = (key: string, labelText: string, value: number) =>
    ind({
      id: `scenario.production.${key}_scenario`,
      label: labelText,
      value: kt(value),
      unit: "t",
      provenance: "scenario",
      sourceIds: source,
      referencePeriod: ref,
      coverage,
      method: `UK production × (1 − ${params.reduction} %); imports and exports held at their published values (no import response modelled), so total supply falls by the production removed. All figures from ${entry.table}.`,
    });
  const shareInd = (value: number | null, provenance: ProvenanceClass, suffix: string) =>
    ind({
      id: `scenario.production.share_${suffix}`,
      label: "UK production as a share of total supply",
      value,
      unit: "share",
      provenance,
      sourceIds: source,
      referencePeriod: ref,
      coverage,
      method:
        suffix === "baseline"
          ? `Production ÷ total supply from the same Defra table (published as ${measureOf(entry, "productionShare")?.value ?? "—"} %).`
          : `Production after the shock ÷ total supply after the shock (same table; imports and exports held).`,
      missingReason: "not_applicable",
    });
  const rows: ResultRow[] = [
    row(
      "production",
      "Domestic output (as Defra defines it)",
      published("production", production),
      modelled("production", production.label, result.productionAfter),
    ),
    row("imports", "Imports (Defra annual, not HMRC monthly)", published("imports", imports), {
      ...published("imports", imports),
      id: "scenario.production.imports_scenario",
      provenance: "scenario",
      method: "Held at the published value: no import response is modelled.",
    }),
    row("exports", "Exports (Defra annual)", published("exports", exports), {
      ...published("exports", exports),
      id: "scenario.production.exports_scenario",
      provenance: "scenario",
      method: "Held at the published value.",
    }),
    row(
      "supply",
      "Total supply (supply to the UK market)",
      published("supply", totalSupply),
      modelled("supply", totalSupply.label, result.supplyAfter),
    ),
    row(
      "share",
      "UK production as a share of total supply",
      shareInd(result.shareBefore, "derived", "baseline"),
      shareInd(result.shareAfter, "scenario", "scenario"),
    ),
  ];
  const removed = ind({
    id: "scenario.production.removed",
    label: "Production removed",
    value: kt(result.removed),
    unit: "t",
    provenance: "scenario",
    sourceIds: source,
    referencePeriod: ref,
    coverage,
    method: `${params.reduction} % of published UK production (${production.label}).`,
  });
  const removedShare = ind({
    id: "scenario.production.removed_share",
    label: "Production removed, as a share of total supply",
    value: result.removedShareOfSupply,
    unit: "share",
    provenance: "scenario",
    sourceIds: source,
    referencePeriod: ref,
    coverage,
    method: "Production removed ÷ published total supply (same table and year).",
    missingReason: "not_applicable",
  });
  const headlines: Headline[] = [
    {
      id: "removed",
      label: "UK production removed",
      indicator: removed,
      detail: `${params.reduction} % of ${formatTonnes(kt(production.value))} · ${ref}`,
    },
    {
      id: "removed-share",
      label: "Equivalent share of total supply",
      indicator: removedShare,
      detail: `of ${formatTonnes(kt(totalSupply.value))} total supply · imports held`,
    },
    {
      id: "share",
      label: "Production share of supply",
      indicator: rows[4]!.scenario,
      detail: `${formatShare(result.shareBefore)} published baseline → scenario`,
    },
    {
      id: "supply",
      label: "Total supply in the scenario",
      indicator: rows[3]!.scenario,
      detail: `Baseline ${formatTonnes(kt(totalSupply.value))} · no import response`,
    },
  ];
  const reasons: string[] = [
    `One published Defra balance (${entry.table}), one year: definitions are consistent within it.`,
  ];
  let level: ConfidenceLevel = "high";
  if (entry.provisional) {
    level = "moderate";
    reasons.push(`Defra's ${entry.year} figures are provisional.`);
  }
  if (Math.abs(result.identityGap) > 0.5) {
    level = "moderate";
    reasons.push("Total supply differs from production + imports − exports by more than rounding.");
  }
  reasons.push("Annual totals: no seasonal timing, stocks or consumption response.");
  return {
    kind: "production",
    basket,
    label,
    status: "published",
    note: null,
    available,
    entry,
    result,
    headlines,
    rows,
    notInBalance,
    confidence: { level, reasons },
    assumptions: [
      `UK production of ${label.toLowerCase()} is ${params.reduction} % lower in ${entry.year} (a hypothetical shock to the published figure).`,
      "Imports and exports stay at their published values: no import response, stock draw or substitution is modelled.",
      "Defra's own definitions are used throughout (e.g. home production marketed, carcase weight equivalent); nothing is combined with HMRC monthly trade.",
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// D — port disruption
// ---------------------------------------------------------------------------------------------

export interface PortOption {
  locode: string;
  name: string;
  international: number | null;
}

export interface FoodEntryEvidence {
  /** Attributable UKFSR groups (their labels) and their summed share (%), latest year. */
  groups: string[];
  percent: number | null;
  year: number;
  /** Why no share is attributed, or a caveat on a partial match. */
  note: string | null;
}

export interface PortModel {
  kind: "port";
  ports: PortOption[];
  year: number;
  selected: {
    locode: string;
    name: string;
    nation: string;
    byGroup: { group: string; value: number | null }[];
  } | null;
  result: PortDisruptionResult | null;
  food: FoodEntryEvidence | null;
  headlines: Headline[];
  rows: ResultRow[];
  confidence: Confidence;
  assumptions: string[];
  map: RiskMapModel;
}

/** UKFSR port-of-entry groups that include an entry point which is not the port (never attributed). */
function notAttributable(g: RiskPortEntry["portOfEntry"]["groups"][number]): string | null {
  if (/eurotunnel/i.test(g.label) || /not a seaport/i.test(g.linkNote ?? ""))
    return `UKFSR's "${g.label}" figure includes the Channel Tunnel, which is not a seaport; the share entering through the port alone is not published, so no food, feed and drink exposure is computed.`;
  return null;
}

export function foodEntryEvidence(entry: RiskPortEntry, locode: string): FoodEntryEvidence {
  const last = entry.portOfEntry.years.length - 1;
  const year = entry.portOfEntry.years[last]!;
  const linked = entry.portOfEntry.groups.filter((g) => g.locodes.includes(locode));
  if (linked.length === 0)
    return {
      groups: [],
      percent: null,
      year,
      note: 'UKFSR names no port of entry for food, feed and drink imports at this port (its smaller ports are grouped as "Other recorded ports"), so no food exposure is computed.',
    };
  const blocked = linked.map(notAttributable).find((n) => n !== null);
  if (blocked) return { groups: linked.map((g) => g.label), percent: null, year, note: blocked };
  const values = linked.map((g) => g.values[last] ?? null);
  const percent = values.every((v) => v !== null) ? values.reduce<number>((s, v) => s + v!, 0) : null;
  const partial = linked.filter((g) => /part of/i.test(g.linkNote ?? "")).map((g) => g.label);
  return {
    groups: linked.map((g) => g.label),
    percent,
    year,
    note: partial.length
      ? `UKFSR's figure covers ${partial.join(" and ")} only, part of DfT's statistical port.`
      : linked.length > 1
        ? `Sum of UKFSR's ${linked.length} groups within this statistical port.`
        : null,
  };
}

export function buildPortModel(
  ports: RiskPorts,
  entry: RiskPortEntry,
  params: PortScenario,
  view: ScenarioView,
  copyright: string,
): PortModel {
  const regions = { domestic: ports.domesticRegion, unspecified: ports.unspecifiedRegion };
  const last = ports.years.length - 1;
  const year = ports.years[last]!;
  const latest = (p: RiskPorts["ports"][number], m: "international" | "agricultural" | "roro") =>
    portSeries(p, m, regions)[last] ?? null;
  const sumOf = (m: "international" | "agricultural") => {
    const v = ports.ports.map((p) => latest(p, m)).filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) : null;
  };
  const totalInt = sumOf("international");
  const totalAgri = sumOf("agricultural");
  const options: PortOption[] = ports.ports
    .map((p) => ({ locode: p.locode, name: p.name, international: latest(p, "international") }))
    .sort((a, b) => (b.international ?? -1) - (a.international ?? -1) || a.name.localeCompare(b.name));
  const port = params.port ? (ports.ports.find((p) => p.locode === params.port) ?? null) : null;
  const max = Math.max(0, ...options.map((o) => o.international ?? 0));
  const scenario = view === "scenario";
  const map: RiskMapModel = {
    ports: ports.ports
      .filter((p) => p.point)
      .map((p) => {
        const v = latest(p, "international");
        const selected = p.locode === port?.locode;
        return {
          locode: p.locode,
          name: p.name,
          point: p.point as [number, number],
          radius: proportionalRadius(v, max),
          valueText: `${formatTonnes(v === null ? null : v * 1000)} from abroad, ${year}`,
          foodEntry: false,
          ...(selected && scenario && params.reduction > 0
            ? {
                scenarioRadius: proportionalRadius(v === null ? null : v * (1 - params.reduction / 100), max),
              }
            : {}),
        };
      }),
    selectedPort: port?.locode ?? null,
    portKey: `scenario|${year}|${view}|${params.reduction}`,
    portsCopyright: copyright,
    roads: null,
    roadsNi: null,
    rail: null,
    regions: null,
    frame: { key: "scenario-port", bbox: [-8.3, 49.8, 1.9, 60.9] },
  };
  const base = {
    kind: "port" as const,
    ports: options,
    year,
    map,
  };
  if (!port)
    return {
      ...base,
      selected: null,
      result: null,
      food: null,
      headlines: [],
      rows: [],
      confidence: { level: "moderate", reasons: [] },
      assumptions: [],
    };

  const food = foodEntryEvidence(entry, port.locode);
  const result = portDisruption({
    reduction: params.reduction / 100,
    months: params.months,
    international: latest(port, "international"),
    agricultural: latest(port, "agricultural"),
    roro: latest(port, "roro"),
    totalInternational: totalInt,
    totalAgricultural: totalAgri,
    foodEntryPercent: food.percent,
  });
  const ref = `${year}`;
  const share =
    params.months === 12 ? "the year" : `${params.months} month${params.months === 1 ? "" : "s"} of the year`;
  const coverage = `${port.name} (DfT major port statistics, inwards loaded abroad)`;
  const kt = (v: number | null) => (v === null ? null : v * 1000);
  const tonnes = (
    id: string,
    labelText: string,
    value: number | null,
    provenance: ProvenanceClass,
    method: string,
  ) =>
    ind({
      id,
      label: labelText,
      value: kt(value),
      unit: "t",
      provenance,
      sourceIds: ["S23"],
      referencePeriod: ref,
      coverage,
      method,
      missingReason: "not_published",
    });
  const even =
    params.months === 12 ? "" : " DfT publishes annual tonnage, so an even spread over the year is assumed.";
  const intl = result.international;
  const agri = result.agricultural;
  const intlScenario = intl.baseline === null ? null : intl.baseline - (intl.affected ?? 0);
  const rows: ResultRow[] = [
    row(
      "international",
      `Inward tonnage from abroad over ${share}`,
      tonnes(
        "scenario.port.international_baseline",
        "Inward tonnage from abroad",
        intl.baseline === null ? null : (intl.baseline * params.months) / 12,
        "measured",
        `DfT PORT0499: inwards loaded abroad, ${year}${params.months < 12 ? ` × ${params.months} ÷ 12` : ""}.${even}`,
      ),
      tonnes(
        "scenario.port.international_scenario",
        "Inward tonnage from abroad in the scenario",
        intlScenario === null ? null : (intl.baseline! * params.months) / 12 - (intl.affected ?? 0),
        "scenario",
        `Baseline × (1 − ${params.reduction} %) over ${share}.${even} Every cargo group reduced alike.`,
      ),
    ),
    row(
      "agricultural",
      `Agricultural products inwards over ${share}`,
      tonnes(
        "scenario.port.agricultural_baseline",
        "Agricultural products inwards",
        agri.baseline === null ? null : (agri.baseline * params.months) / 12,
        "measured",
        `DfT PORT0499 cargo category 23 "Agricultural products (eg grain, soya, tapioca)", inwards loaded abroad, ${year}.${even}`,
      ),
      tonnes(
        "scenario.port.agricultural_scenario",
        "Agricultural products inwards in the scenario",
        agri.baseline === null ? null : (agri.baseline * params.months) / 12 - (agri.affected ?? 0),
        "scenario",
        `Baseline × (1 − ${params.reduction} %).${even}`,
      ),
    ),
  ];
  const shareUk = ind({
    id: "scenario.port.share_uk_affected",
    label: "Share of UK major-port inward tonnage affected",
    value: intl.shareOfUkAffected,
    unit: "share",
    provenance: "scenario",
    sourceIds: ["S23"],
    referencePeriod: ref,
    coverage: "All DfT major ports, inwards loaded abroad",
    method: `${port.name}'s inward tonnage from abroad × ${params.reduction} % ÷ all major ports' inward tonnage from abroad (${year}). During the disruption, not over the year.`,
    missingReason: "not_published",
  });
  const foodInd = ind({
    id: "scenario.port.food_entry_affected",
    label: "Food, feed and drink import volume affected (UKFSR share)",
    value: result.foodEntryAffected === null ? null : result.foodEntryAffected / 100,
    unit: "share",
    provenance: "scenario",
    sourceIds: ["S03"],
    referencePeriod: `${food.year} (UKFSR 2024)`,
    coverage: "UK imports of food, feed and drink by volume, by recorded port of entry (HMRC via UKFSR)",
    method: `UKFSR's share of UK food, feed and drink import volume entering at ${food.groups.join(" + ") || port.name} × ${params.reduction} %. During the disruption. Never inferred from partner countries. Not applicable where UKFSR's port of entry is not this port alone.`,
    missingReason: "not_applicable",
  });
  const headlines: Headline[] = [
    {
      id: "international",
      label: "Inward freight affected",
      indicator: tonnes(
        "scenario.port.international_affected",
        "Inward freight affected",
        intl.affected,
        "scenario",
        rows[0]!.scenario.method,
      ),
      detail: `${params.reduction} % for ${share} · all cargo, ${year}`,
    },
    {
      id: "share-uk",
      label: "Share of UK major-port inwards",
      indicator: shareUk,
      detail: `${port.name}: ${formatShare(intl.shareOfUk)} of the UK's inward tonnage from abroad`,
    },
    {
      id: "agricultural",
      label: "Agricultural products affected",
      indicator: tonnes(
        "scenario.port.agricultural_affected",
        "Agricultural products affected",
        agri.affected,
        "scenario",
        rows[1]!.scenario.method,
      ),
      detail:
        agri.baseline === null || agri.baseline === 0
          ? "DfT records no agricultural products inwards here"
          : `grain, soya, tapioca… · ${formatShare(agri.shareOfUk)} of UK major-port agricultural inwards`,
    },
    {
      id: "food",
      label: "Food, feed and drink entry share",
      indicator: foodInd,
      detail:
        food.percent === null
          ? "Not attributable to this port (see method)"
          : `${food.percent.toFixed(1)} % entered here in ${food.year} (UKFSR)`,
    },
  ];
  const reasons: string[] = [
    "DfT annual tonnage by port: no commodity routing for Ro-Ro and container traffic.",
  ];
  let level: ConfidenceLevel = "moderate";
  if (params.months < 12)
    reasons.push(
      "An even spread of the year's tonnage over months is assumed (DfT publishes annual figures).",
    );
  if (food.percent === null) {
    reasons.push(food.note ?? "No food, feed and drink share is attributable to this port.");
  } else {
    reasons.push(
      `UKFSR's food, feed and drink shares are for ${food.year}, DfT's tonnage for ${year}: different years.`,
    );
  }
  if (intl.baseline === null) {
    level = "low";
    reasons.push(`DfT has no ${year} inward figure for this port.`);
  }
  return {
    ...base,
    selected: {
      locode: port.locode,
      name: port.name,
      nation: port.nation,
      byGroup: Object.entries(port.inwardsByGroup).map(([group, values]) => ({
        group,
        value: values[last] ?? null,
      })),
    },
    result,
    food,
    headlines,
    rows,
    confidence: { level, reasons },
    assumptions: [
      `${port.name} handles ${params.reduction} % less inward freight for ${share}; every cargo group is reduced alike.`,
      "No traffic diverts to other ports and nothing is assumed about where the cargo came from (partner countries are never linked to ports).",
      "Food exposure only where the data records food flows at the port (UKFSR port of entry; DfT agricultural products).",
    ],
  };
}

export { SCENARIO_NOTE };
