import Ajv, { type ValidateFunction } from "ajv";
import councilContextSchema from "../../../schemas/council-context.schema.json";
import indicatorsSchema from "../../../schemas/small-area-indicators.schema.json";
import boundariesSchema from "../../../schemas/small-areas.schema.json";
import productionSchema from "../../../schemas/uk-production.schema.json";
import type { ValidationResult } from "@/services/data/validate";
import type { CouncilContext } from "@/types/generated/council-context";
import type { SmallAreaIndicators } from "@/types/generated/small-area-indicators";
import type { SmallAreaBoundaries } from "@/types/generated/small-areas";
import type { UkProduction } from "@/types/generated/uk-production";

/**
 * Validators for the Local Authority Profiles datasets (ADR-06), compiled inside the lazy profiles
 * chunk so their schemas do not add to the shell's bundle.
 */
const ajv = new Ajv({ allErrors: false, strict: true, allowUnionTypes: true });
const context = ajv.compile<CouncilContext>(councilContextSchema);
const production = ajv.compile<UkProduction>(productionSchema);
const indicators = ajv.compile<SmallAreaIndicators>(indicatorsSchema);
const boundaries = ajv.compile<SmallAreaBoundaries>(boundariesSchema);

function run<T>(fn: ValidateFunction<T>, data: unknown): ValidationResult<T> {
  if (fn(data)) return { ok: true, value: data, errors: [] };
  const errors = (fn.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}`);
  return { ok: false, errors };
}

export const validateCouncilContext = (data: unknown) => run(context, data);
export const validateUkProduction = (data: unknown) => run(production, data);
export const validateAreaIndicators = (data: unknown) => run(indicators, data);
export const validateAreaBoundaries = (data: unknown) => run(boundaries, data);
