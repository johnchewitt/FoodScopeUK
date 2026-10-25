import Ajv, { type ValidateFunction } from "ajv";
import councilContextSchema from "../../../schemas/council-context.schema.json";
import councilPpfiSchema from "../../../schemas/council-ppfi.schema.json";
import farmingSchema from "../../../schemas/risk-farming.schema.json";
import portEntrySchema from "../../../schemas/risk-port-entry.schema.json";
import portsSchema from "../../../schemas/risk-ports.schema.json";
import waterSchema from "../../../schemas/risk-water-stress.schema.json";
import productionSchema from "../../../schemas/uk-production.schema.json";
import type { ValidationResult } from "@/services/data/validate";
import type { CouncilContext } from "@/types/generated/council-context";
import type { CouncilPpfi } from "@/types/generated/council-ppfi";
import type { RiskFarming } from "@/types/generated/risk-farming";
import type { RiskPortEntry } from "@/types/generated/risk-port-entry";
import type { RiskPorts } from "@/types/generated/risk-ports";
import type { RiskWaterStress } from "@/types/generated/risk-water-stress";
import type { UkProduction } from "@/types/generated/uk-production";

/**
 * Validators for the Risk Explorer datasets (ADR-06), compiled inside the lazy risks chunk so their
 * schemas do not add to the shell's bundle. The road and region outlines are drawn by the map from
 * their URLs (GeoJSON layers) and validated by the pipeline before publication.
 */
const ajv = new Ajv({ allErrors: false, strict: true, allowUnionTypes: true });
const water = ajv.compile<RiskWaterStress>(waterSchema);
const ports = ajv.compile<RiskPorts>(portsSchema);
const entry = ajv.compile<RiskPortEntry>(portEntrySchema);
const farming = ajv.compile<RiskFarming>(farmingSchema);
const councilPpfi = ajv.compile<CouncilPpfi>(councilPpfiSchema);
const production = ajv.compile<UkProduction>(productionSchema);
const context = ajv.compile<CouncilContext>(councilContextSchema);

function run<T>(fn: ValidateFunction<T>, data: unknown): ValidationResult<T> {
  if (fn(data)) return { ok: true, value: data, errors: [] };
  const errors = (fn.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}`);
  return { ok: false, errors };
}

export const validateWaterStress = (data: unknown) => run(water, data);
export const validatePorts = (data: unknown) => run(ports, data);
export const validatePortEntry = (data: unknown) => run(entry, data);
export const validateFarming = (data: unknown) => run(farming, data);
export const validateCouncilPpfi = (data: unknown) => run(councilPpfi, data);
export const validateUkProduction = (data: unknown) => run(production, data);
export const validateCouncilContext = (data: unknown) => run(context, data);
