import Ajv, { type ValidateFunction } from "ajv";
import ladIndicatorsSchema from "../../../schemas/lad-indicators.schema.json";
import grocersSchema from "../../../schemas/ni-other-grocers.schema.json";
import storesSchema from "../../../schemas/stores.schema.json";
import type { ValidationResult } from "@/services/data/validate";
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import type { NiOtherGrocers } from "@/types/generated/ni-other-grocers";
import type { StoreCollection } from "@/types/generated/stores";

/**
 * Validators for the UK Food Access datasets (ADR-06). Compiled here, inside the lazy Food Access
 * chunk, so their schemas do not add to the shell's bundle.
 */
const ajv = new Ajv({ allErrors: false, strict: true, allowUnionTypes: true });
const stores = ajv.compile<StoreCollection>(storesSchema);
const indicators = ajv.compile<CouncilIndicators>(ladIndicatorsSchema);
const grocers = ajv.compile<NiOtherGrocers>(grocersSchema);

function run<T>(fn: ValidateFunction<T>, data: unknown): ValidationResult<T> {
  if (fn(data)) return { ok: true, value: data, errors: [] };
  const errors = (fn.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}`);
  return { ok: false, errors };
}

/** 19,183 stores: errors stop at the first one (allErrors off), which is enough to reject the file. */
export function validateStores(data: unknown): ValidationResult<StoreCollection> {
  return run(stores, data);
}

export function validateLadIndicators(data: unknown): ValidationResult<CouncilIndicators> {
  return run(indicators, data);
}

/** NI grocers from the FSA register that GEOLYTIX does not map (S29; supplementary layer). */
export function validateNiGrocers(data: unknown): ValidationResult<NiOtherGrocers> {
  return run(grocers, data);
}
