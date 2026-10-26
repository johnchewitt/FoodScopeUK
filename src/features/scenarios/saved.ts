/**
 * Named scenarios (Stage 7 brief §7): saved in this browser only (localStorage), shared as a link
 * (the URL holds the whole scenario, SC-05), compared and exported. Only parameters are stored:
 * results are always recomputed from the current published data, so a saved scenario never shows
 * stale or edited figures. Storage can be missing or blocked: every access is guarded.
 */
import { DEFAULT_URL_STATE, serializeUrlState } from "@/state/urlState";
import {
  parseScenarioParams,
  SCENARIO_LETTERS,
  stateFromParams,
  type ScenarioParams,
} from "@/state/scenarioParams";
import { formatByUnit } from "@/analysis/format";
import { PROVENANCE_LABELS } from "@/types/indicator";
import type { ResultRow } from "./model";

export const SAVED_KEY = "foodscope.scenarios.v1";
export const MAX_SAVED = 12;
export const MAX_COMPARE = 4;
const MAX_NAME = 80;

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  params: ScenarioParams;
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Saved scenarios, newest first; invalid entries are dropped, never trusted. */
export function loadSaved(store: Storage | null = storage()): SavedScenario[] {
  if (!store) return [];
  try {
    const raw = store.getItem(SAVED_KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.flatMap((item): SavedScenario[] => {
      if (!item || typeof item !== "object") return [];
      const o = item as Record<string, unknown>;
      const params = parseScenarioParams(o.params);
      if (!params || typeof o.id !== "string" || typeof o.name !== "string" || typeof o.savedAt !== "string")
        return [];
      return [{ id: o.id.slice(0, 40), name: cleanName(o.name), savedAt: o.savedAt.slice(0, 40), params }];
    });
  } catch {
    return [];
  }
}

/** Writes the list; false when the browser does not allow storage (the list stays for this visit). */
export function persistSaved(list: readonly SavedScenario[], store: Storage | null = storage()): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVED_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

/** Adds a scenario at the top; the same name replaces the older one; at most MAX_SAVED kept. */
export function addSaved(
  list: readonly SavedScenario[],
  name: string,
  params: ScenarioParams,
  now: Date,
  id: string,
): SavedScenario[] {
  const clean = cleanName(name) || "Untitled scenario";
  const entry: SavedScenario = { id, name: clean, savedAt: now.toISOString(), params };
  return [entry, ...list.filter((s) => s.name !== clean)].slice(0, MAX_SAVED);
}

export function removeSaved(list: readonly SavedScenario[], id: string): SavedScenario[] {
  return list.filter((s) => s.id !== id);
}

/** The link that reproduces a scenario (SC-05), relative to the app's own address. */
export function scenarioLink(params: ScenarioParams, base: string): string {
  const qs = serializeUrlState({ ...DEFAULT_URL_STATE, module: "scenarios", ...stateFromParams(params) });
  return `${base}${qs}`;
}

/** A default name from the settings, e.g. "A · tomatoes · ES −30 % for 3 months from 2025-01". */
export function defaultName(
  params: ScenarioParams,
  labels: { commodity?: string; partner?: string; store?: string; port?: string },
): string {
  const letter = SCENARIO_LETTERS[params.kind];
  switch (params.kind) {
    case "import":
      return `${letter} · ${labels.commodity ?? params.commodity} · ${labels.partner ?? params.partner ?? "largest partner"} −${params.reduction} % for ${params.duration} month${params.duration === 1 ? "" : "s"}`;
    case "closure":
      return `${letter} · closure of ${labels.store ?? (params.store === null ? "no store" : `store ${params.store}`)}`;
    case "production":
      return `${letter} · ${labels.commodity ?? params.commodity} production −${params.reduction} %`;
    case "port":
      return `${letter} · ${labels.port ?? params.port ?? "no port"} −${params.reduction} % for ${params.months} month${params.months === 1 ? "" : "s"}`;
  }
}

// ---------------------------------------------------------------------------------------------
// Export

/** RFC 4180 field: quoted when it holds a comma, quote or line break; formulas neutralised. */
export function csvField(v: string | number | null): string {
  if (v === null) return "";
  // Numbers to 6 decimal places at most (floating-point noise is not precision).
  let s = typeof v === "number" ? String(Math.round(v * 1e6) / 1e6) : v;
  // Spreadsheet formula injection: a leading =, +, - or @ in text is prefixed with an apostrophe.
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface SummaryRecord {
  scenario: string;
  kind: string;
  link: string;
  rows: ResultRow[];
  assumptions: string[];
  confidence: string;
}

/**
 * CSV of the results (one line per scenario and measure): raw values in the indicator's unit, the
 * formatted values as shown, provenance and sources, so the export is checkable against the screen.
 */
export function summaryCsv(records: readonly SummaryRecord[], generated: Date): string {
  const header = [
    "scenario",
    "kind",
    "measure",
    "unit",
    "baseline",
    "scenario_value",
    "change",
    "relative_change",
    "baseline_shown",
    "scenario_shown",
    "baseline_provenance",
    "scenario_provenance",
    "sources",
    "reference_period",
    "confidence",
    "link",
  ];
  const lines = [header.join(",")];
  for (const r of records)
    for (const row of r.rows)
      lines.push(
        [
          r.scenario,
          r.kind,
          row.label,
          row.scenario.unit,
          row.baseline.value,
          row.scenario.value,
          row.change,
          row.relative,
          formatByUnit(row.baseline.value, row.baseline.unit),
          formatByUnit(row.scenario.value, row.scenario.unit),
          PROVENANCE_LABELS[row.baseline.provenance],
          PROVENANCE_LABELS[row.scenario.provenance],
          [...new Set([...row.baseline.sourceIds, ...row.scenario.sourceIds])].join(" "),
          row.scenario.referencePeriod,
          r.confidence,
          r.link,
        ]
          .map(csvField)
          .join(","),
      );
  lines.push(
    csvField(
      `Scenario-modelled: static exposure calculations under the stated assumptions; not forecasts or shortages. Generated ${generated.toISOString()} by FOODSCOPE UK.`,
    ),
  );
  return `${lines.join("\r\n")}\r\n`;
}
