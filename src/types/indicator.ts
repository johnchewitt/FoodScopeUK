import type { IndicatorRecord } from "./generated/indicator";

/** Five provenance classes (spec P2). */
export type ProvenanceClass = IndicatorRecord["provenance"];

/** Indicator envelope (ADR-09). Every displayed value travels with its provenance. */
export type Indicator<T extends number | string = number> = Omit<IndicatorRecord, "value"> & {
  value: T | null;
};

export const PROVENANCE_CLASSES: readonly ProvenanceClass[] = [
  "measured",
  "official_estimate",
  "derived",
  "scenario",
  "illustrative",
];

export const PROVENANCE_LABELS: Record<ProvenanceClass, string> = {
  measured: "Measured",
  official_estimate: "Official estimate",
  derived: "Derived",
  scenario: "Scenario-modelled",
  illustrative: "Illustrative",
};

export const PROVENANCE_DESCRIPTIONS: Record<ProvenanceClass, string> = {
  measured: "Recorded directly in an official or open source.",
  official_estimate: "An estimate published by an official statistics producer.",
  derived: "Calculated by FOODSCOPE from measured or official values using a documented formula.",
  scenario: "Output of a scenario under stated user assumptions. Not a forecast.",
  illustrative: "Shown only to explain an idea. Not evidence.",
};

/** Returns the reasons an indicator cannot be displayed as evidence, or an empty array. */
export function provenanceProblems(indicator: Indicator<number | string>): string[] {
  const problems: string[] = [];
  if (!indicator.sourceIds || indicator.sourceIds.length === 0) problems.push("no source");
  if (!indicator.referencePeriod?.trim()) problems.push("no reference period");
  if (!indicator.unit?.trim()) problems.push("no unit");
  if (!indicator.coverage?.trim()) problems.push("no coverage");
  if (!indicator.method?.trim()) problems.push("no method");
  if (!PROVENANCE_CLASSES.includes(indicator.provenance)) problems.push("unknown provenance class");
  if (indicator.value === null && !indicator.missingReason) problems.push("missing value without a reason");
  return problems;
}
