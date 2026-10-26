/**
 * The typed scenario model (Stage 7, SC-01 – SC-05). One discriminated union describes every
 * Scenario Lab run, so a saved scenario, a shared link and the current controls are the same
 * thing; a new simulation adds a member here, its URL fields and its model. Pure and serialisable.
 */
import type { Measure } from "./urlState";
import {
  DEFAULT_URL_STATE,
  SCENARIO_KINDS,
  SCENARIO_LIMITS,
  type ScenarioKind,
  type ScenarioView,
  type UrlState,
} from "./urlState";

/** A: international supply disruption (SC-A/E, spec §6.5). Percentages are whole numbers 0–100. */
export interface ImportScenario {
  kind: "import";
  commodity: string;
  /** Recorded import partner key; null = the largest partner in the baseline window. */
  partner: string | null;
  /** Baseline start; null = January of the latest complete calendar year in the snapshot. */
  year: number | null;
  month: number | null;
  reduction: number;
  duration: number;
  recovery: number;
  substitution: number;
  measure: Measure;
}

/** B: supermarket closure (SC-D): the GEOLYTIX id of the supermarket closed; null = none picked. */
export interface ClosureScenario {
  kind: "closure";
  store: number | null;
}

/** C: domestic production shock on Defra's published annual supply balance. */
export interface ProductionScenario {
  kind: "production";
  commodity: string;
  reduction: number;
}

/** D: port disruption on DfT's published port tonnage (and UKFSR's port-of-entry shares). */
export interface PortScenario {
  kind: "port";
  port: string | null;
  reduction: number;
  months: number;
}

export type ScenarioParams = ImportScenario | ClosureScenario | ProductionScenario | PortScenario;

export const SCENARIO_LETTERS: Record<ScenarioKind, string> = {
  import: "A",
  closure: "B",
  production: "C",
  port: "D",
};

/** The current scenario, read from the shared state. */
export function paramsFromState(s: UrlState): ScenarioParams {
  switch (s.scenarioKind) {
    case "import":
      return {
        kind: "import",
        commodity: s.commodity,
        partner: s.partner,
        year: s.scenarioYear,
        month: s.scenarioMonth,
        reduction: s.scenarioReduction,
        duration: s.scenarioDuration,
        recovery: s.scenarioRecovery,
        substitution: s.scenarioSubstitution,
        measure: s.measure,
      };
    case "closure":
      return { kind: "closure", store: s.store };
    case "production":
      return { kind: "production", commodity: s.commodity, reduction: s.productionReduction };
    case "port":
      return { kind: "port", port: s.port, reduction: s.portReduction, months: s.portMonths };
  }
}

const clampInt = (v: number, l: { min: number; max: number }) =>
  Math.min(l.max, Math.max(l.min, Math.round(Number.isFinite(v) ? v : l.min)));

/** The state fields that reproduce a scenario (applied by the store; other fields untouched). */
export function stateFromParams(p: ScenarioParams): Partial<UrlState> {
  const L = SCENARIO_LIMITS;
  switch (p.kind) {
    case "import":
      return {
        scenarioKind: "import",
        commodity: p.commodity,
        partner: p.partner,
        scenarioYear: p.year,
        scenarioMonth: p.month,
        scenarioReduction: clampInt(p.reduction, L.reduction),
        scenarioDuration: clampInt(p.duration, L.duration),
        scenarioRecovery: clampInt(p.recovery, L.recovery),
        scenarioSubstitution: clampInt(p.substitution, L.substitution),
        measure: p.measure,
      };
    case "closure":
      return { scenarioKind: "closure", store: p.store };
    case "production":
      return {
        scenarioKind: "production",
        commodity: p.commodity,
        productionReduction: clampInt(p.reduction, L.reduction),
      };
    case "port":
      return {
        scenarioKind: "port",
        port: p.port,
        portReduction: clampInt(p.reduction, L.reduction),
        portMonths: clampInt(p.months, L.portMonths),
      };
  }
}

/**
 * Reset to the baseline (SC-03): the disruption is removed (0 %, or no supermarket closed); the
 * selection (commodity, partner, months, port) stays, so the baseline being looked at is unchanged.
 */
export function baselineFor(kind: ScenarioKind): Partial<UrlState> {
  switch (kind) {
    case "import":
      return { scenarioReduction: 0, scenarioRecovery: 0, scenarioSubstitution: 0 };
    case "closure":
      return { store: null };
    case "production":
      return { productionReduction: 0 };
    case "port":
      return { portReduction: 0 };
  }
}

/** The default settings of a kind (the "Restore defaults" control). */
export function defaultsFor(kind: ScenarioKind): Partial<UrlState> {
  const D = DEFAULT_URL_STATE;
  switch (kind) {
    case "import":
      return {
        scenarioYear: D.scenarioYear,
        scenarioMonth: D.scenarioMonth,
        scenarioReduction: D.scenarioReduction,
        scenarioDuration: D.scenarioDuration,
        scenarioRecovery: D.scenarioRecovery,
        scenarioSubstitution: D.scenarioSubstitution,
      };
    case "closure":
      return {};
    case "production":
      return { productionReduction: D.productionReduction };
    case "port":
      return { portReduction: D.portReduction, portMonths: D.portMonths };
  }
}

/** True when the parameters describe no disruption at all (the scenario equals the baseline). */
export function isBaseline(p: ScenarioParams): boolean {
  if (p.kind === "closure") return p.store === null;
  return p.reduction === 0;
}

const COMMODITY_ID = /^[a-z][a-z0-9-]{0,39}$/;
const PARTNER_KEY = /^([A-Z]{2}|hmrc-\d{1,5})$/;
const PORT_CODE = /^GB[A-Z0-9]{3}$/;
const isInt = (v: unknown, l: { min: number; max: number }) =>
  typeof v === "number" && Number.isInteger(v) && v >= l.min && v <= l.max;

/** Checks a value read back from storage (never trusted): a valid scenario, or null. */
export function parseScenarioParams(v: unknown): ScenarioParams | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const L = SCENARIO_LIMITS;
  if (!(SCENARIO_KINDS as readonly unknown[]).includes(o.kind)) return null;
  switch (o.kind as ScenarioKind) {
    case "import": {
      const ok =
        typeof o.commodity === "string" &&
        COMMODITY_ID.test(o.commodity) &&
        (o.partner === null || (typeof o.partner === "string" && PARTNER_KEY.test(o.partner))) &&
        (o.year === null || isInt(o.year, { min: 1990, max: 2100 })) &&
        (o.month === null || isInt(o.month, { min: 1, max: 12 })) &&
        isInt(o.reduction, L.reduction) &&
        isInt(o.duration, L.duration) &&
        isInt(o.recovery, L.recovery) &&
        isInt(o.substitution, L.substitution) &&
        (o.measure === "mass" || o.measure === "value");
      if (!ok) return null;
      return {
        kind: "import",
        commodity: o.commodity as string,
        partner: o.partner as string | null,
        year: o.year as number | null,
        month: o.month as number | null,
        reduction: o.reduction as number,
        duration: o.duration as number,
        recovery: o.recovery as number,
        substitution: o.substitution as number,
        measure: o.measure as Measure,
      };
    }
    case "closure":
      return o.store === null || isInt(o.store, { min: 0, max: 999_999_999_999 })
        ? { kind: "closure", store: o.store as number | null }
        : null;
    case "production":
      return typeof o.commodity === "string" &&
        COMMODITY_ID.test(o.commodity) &&
        isInt(o.reduction, L.reduction)
        ? { kind: "production", commodity: o.commodity, reduction: o.reduction as number }
        : null;
    case "port":
      return (o.port === null || (typeof o.port === "string" && PORT_CODE.test(o.port))) &&
        isInt(o.reduction, L.reduction) &&
        isInt(o.months, L.portMonths)
        ? {
            kind: "port",
            port: o.port as string | null,
            reduction: o.reduction as number,
            months: o.months as number,
          }
        : null;
  }
}

/** The view a scenario map shows (baseline or scenario, SC-03). */
export type { ScenarioView };
