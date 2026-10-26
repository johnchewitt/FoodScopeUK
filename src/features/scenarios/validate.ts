import Ajv from "ajv";
import closureSchema from "../../../schemas/scenario-closure.schema.json";
import type { ValidationResult } from "@/services/data/validate";
import type { ScenarioClosure } from "@/types/generated/scenario-closure";

/**
 * Validator for the Scenario Lab closure inputs (ADR-06), compiled inside the lazy Scenario Lab
 * chunk. JSON Schema cannot say that columns are the same length or that indices point at a
 * store, so `closureStructure` checks that too before anything is computed from the file.
 */
const ajv = new Ajv({ allErrors: false, strict: true, allowUnionTypes: true });
const closure = ajv.compile<ScenarioClosure>(closureSchema);

/** Column lengths and cross-references the schema cannot express; [] when consistent. */
export function closureStructure(d: ScenarioClosure): string[] {
  const problems: string[] = [];
  const nStores = d.stores.id.length;
  const nAreas = d.areas.code.length;
  for (const [key, col] of Object.entries(d.stores))
    if (col.length !== nStores) problems.push(`stores.${key} has ${col.length} entries, not ${nStores}`);
  for (const [key, col] of Object.entries(d.areas))
    if (col.length !== nAreas) problems.push(`areas.${key} has ${col.length} entries, not ${nAreas}`);
  const nCouncils = d.councils.length;
  if (d.stores.council.some((c) => c >= nCouncils)) problems.push("a store's council is out of range");
  if (d.areas.council.some((c) => c >= nCouncils)) problems.push("an area's council is out of range");
  for (let i = 0; i < nAreas && problems.length < 5; i++) {
    const near = d.areas.nearest[i]!;
    const dist = d.areas.distance[i]!;
    if (near.length !== d.k || dist.length !== d.k)
      problems.push(`area ${d.areas.code[i]}: not ${d.k} nearest`);
    else if (near[0]! < 0 || near.some((s) => s >= nStores))
      problems.push(`area ${d.areas.code[i]}: store out of range`);
    else if (dist.some((x, j) => j > 0 && near[j]! >= 0 && x < dist[j - 1]!))
      problems.push(`area ${d.areas.code[i]}: distances not in order`);
  }
  return problems;
}

export function validateClosure(data: unknown): ValidationResult<ScenarioClosure> {
  if (!closure(data)) {
    const errors = (closure.errors ?? []).map(
      (e) => `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}`,
    );
    return { ok: false, errors };
  }
  const problems = closureStructure(data);
  return problems.length ? { ok: false, errors: problems } : { ok: true, value: data, errors: [] };
}
