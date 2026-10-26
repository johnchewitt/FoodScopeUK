/**
 * ConsultingWhere Insights report model (Stage 8, CI-02, EX-01 – EX-05, ADR-0027).
 *
 * One plain, serialisable object per assessment. The panel, the full-report view, the PDF and the
 * CSV are all rendered from it, and its SHA-256 checksum is printed in the PDF footer and shown on
 * screen, so exported figures are the figures on screen (EX-02). Every number is an `Indicator`
 * with its provenance (P1, P2); findings refer to the indicators they rest on.
 */
import type { DataManifest } from "@/types/generated/manifest";
import type { Indicator } from "@/types/indicator";
import type { InsightsKind } from "@/state/urlState";

export type ReportIndicator = Indicator<number | string>;

/** A key figure: the card on screen and the KPI tile in the PDF. */
export interface ReportKpi {
  id: string;
  /** The full label (accessible name, PDF tile) and the short one the card shows. */
  label: string;
  short: string;
  indicator: ReportIndicator;
  detail: string;
}

/** What a sentence of the report says about its scope (P6: national context is labelled as such). */
export type FindingScope = "local" | "national_context" | "scenario" | "method";

export interface ReportFinding {
  text: string;
  scope: FindingScope;
  /** Indicator ids the sentence rests on (all listed in `indicators`). */
  indicatorIds: string[];
}

export interface ReportTable {
  id: string;
  caption: string;
  columns: string[];
  /** Right-aligned (numeric) columns. */
  numeric: boolean[];
  rows: string[][];
  note?: string;
}

export type ChartFormat = "tonnes" | "gbp" | "share" | "count" | "km" | "hhi" | "population" | "percent";

/** A chart drawn from report data only: the panel draws it dark, the PDF light (same values). */
export interface ReportChart {
  id: string;
  title: string;
  kind: "bar" | "pairedBar" | "line" | "column";
  format: ChartFormat;
  categories: string[];
  series: {
    name: string;
    role: "observed" | "comparison" | "baseline" | "scenario";
    values: (number | null)[];
  }[];
  /** Text alternative (AX-06) and the PDF caption. */
  description: string;
  source: string;
}

export interface ReportSection {
  id: string;
  title: string;
  /** Shown beside the title: e.g. "National context — not this council's own supply chain". */
  scopeNote?: string;
  intro?: string;
  findings: ReportFinding[];
  tables: ReportTable[];
  chartIds: string[];
  notes: string[];
}

/** A potential piece of consultancy work (CI-02): never a claim of a requirement or budget (CI-05). */
export interface WorkPackage {
  id: string;
  serviceId: string;
  title: string;
  /** True when a stated rule on the figures points to it; false: offered as a supporting capability. */
  indicated: boolean;
  /** Why it appears (the rule and the figures): "Why am I seeing this?" (CI-03). */
  why: string;
  challenge: string;
  evidence: string[];
  analysis: string;
  additionalData: string[];
  tasks: string[];
  deliverables: string[];
  stakeholders: string[];
  limitations: string[];
}

/** A stated rule and whether it fired (CI-03). */
export interface RuleCheck {
  id: string;
  rule: string;
  fired: boolean;
  observed: string;
  serviceId: string;
}

export interface SourceRef {
  id: string;
  title: string;
  publisher: string;
  licence: string;
  url: string | null;
}

export interface DatasetRef {
  id: string;
  title: string;
  snapshot: string | null;
  referencePeriod: string;
  retrievedAt: string | null;
  licence: string;
  attribution: string;
}

export interface AssessmentReport {
  schema: "foodscope.insights.report.v1";
  kind: InsightsKind;
  /** "Local Authority Food Security Assessment", … */
  title: string;
  /** The geography, commodity or scenario. */
  subject: string;
  subjectCode: string | null;
  subtitle: string;
  /** Area and assessment context (one paragraph). */
  context: string;
  executiveSummary: ReportFinding[];
  kpis: ReportKpi[];
  sections: ReportSection[];
  charts: ReportChart[];
  workPackages: WorkPackage[];
  rules: RuleCheck[];
  methodology: string[];
  limitations: string[];
  /** Every indicator the report shows, once (the CSV export). */
  indicators: ReportIndicator[];
  sources: SourceRef[];
  datasets: DatasetRef[];
  /** Snapshot id of each data family the report draws on. */
  snapshots: { family: string; id: string }[];
  disclaimer: string;
  /** The application link that reproduces this report (set by the caller from the URL state). */
  link: string;
}

export const REPORT_TITLES: Record<InsightsKind, string> = {
  authority: "Local Authority Food Security Assessment",
  commodity: "Commodity Supply Resilience Assessment",
  scenario: "Food Supply Disruption Scenario Assessment",
};

/** Printed on every report and PDF page (brief §6). */
export const EXPLORATORY_NOTE =
  "Exploratory geospatial assessment prepared with FOODSCOPE UK from published open data. It is not a commissioned food security audit, does not represent the views of any public body, and implies no requirement, budget or procurement by any organisation.";

export function finding(text: string, scope: FindingScope, ...indicators: ReportIndicator[]): ReportFinding {
  return { text, scope, indicatorIds: indicators.map((i) => i.id) };
}

/** Collects indicators once each (by id; the first wins), keeping their order of appearance. */
export class IndicatorSet {
  private readonly byId = new Map<string, ReportIndicator>();
  add<T extends ReportIndicator>(i: T): T {
    if (!this.byId.has(i.id)) this.byId.set(i.id, i);
    return i;
  }
  addAll(list: readonly ReportIndicator[]): void {
    for (const i of list) this.add(i);
  }
  list(): ReportIndicator[] {
    return [...this.byId.values()];
  }
}

/** Data sources and dataset versions of the manifest the report used (EX-01: "data snapshot ID"). */
export function datasetRefs(
  manifest: DataManifest | undefined,
  ids: readonly string[],
): { datasets: DatasetRef[]; sources: SourceRef[] } {
  const datasets: DatasetRef[] = [];
  const sourceIds: string[] = [];
  for (const id of ids) {
    const d = manifest?.datasets.find((x) => x.id === id);
    if (!d) continue;
    const snapshot = /snapshots\/(\d{4}-\d{2}-\d{2})\//.exec(d.path)?.[1] ?? null;
    datasets.push({
      id: d.id,
      title: d.title,
      snapshot,
      referencePeriod: d.referencePeriod,
      retrievedAt: d.retrieval?.retrievedAt ?? null,
      licence: d.licence,
      attribution: d.attribution,
    });
    for (const s of d.sourceIds) if (!sourceIds.includes(s)) sourceIds.push(s);
  }
  const catalogue = manifest?.catalogue ?? [];
  const sources = sourceIds
    .map((id) => catalogue.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => ({
      id: c.id,
      title: c.title,
      publisher: c.publisher,
      licence: c.licence,
      url: c.url ?? null,
    }))
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  return { datasets, sources };
}

/** Snapshot ids by family for the datasets used. */
export function snapshotsOf(datasets: readonly DatasetRef[]): { family: string; id: string }[] {
  const out = new Map<string, string>();
  for (const d of datasets) {
    const family = d.id.split(".")[0]!;
    if (d.snapshot && !out.has(family)) out.set(family, d.snapshot);
  }
  return [...out.entries()]
    .map(([family, id]) => ({ family, id }))
    .sort((a, b) => a.family.localeCompare(b.family));
}
