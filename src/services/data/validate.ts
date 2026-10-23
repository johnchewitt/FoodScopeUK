import Ajv, { type ValidateFunction } from "ajv";
import configSchema from "../../../schemas/config.schema.json";
import countryPointsSchema from "../../../schemas/country-points.schema.json";
import indicatorSchema from "../../../schemas/indicator.schema.json";
import manifestSchema from "../../../schemas/manifest.schema.json";
import tradeIndexSchema from "../../../schemas/trade-index.schema.json";
import tradeSnapshotSchema from "../../../schemas/trade-snapshot.schema.json";
import type { AppConfig } from "@/types/generated/config";
import type { CountryPoints } from "@/types/generated/country-points";
import type { IndicatorRecord } from "@/types/generated/indicator";
import type { DataManifest } from "@/types/generated/manifest";
import type { TradeIndex } from "@/types/generated/trade-index";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
ajv.addFormat("date-time", ISO_DATE_TIME);

const validators = {
  config: ajv.compile<AppConfig>(configSchema),
  manifest: ajv.compile<DataManifest>(manifestSchema),
  indicator: ajv.compile<IndicatorRecord>(indicatorSchema),
  tradeIndex: ajv.compile<TradeIndex>(tradeIndexSchema),
  tradeSnapshot: ajv.compile<TradeSnapshot>(tradeSnapshotSchema),
  countryPoints: ajv.compile<CountryPoints>(countryPointsSchema),
} as const;

export type SchemaId = keyof typeof validators;

export interface ValidationResult<T> {
  ok: boolean;
  value?: T;
  errors: string[];
}

function run<T>(fn: ValidateFunction<T>, data: unknown): ValidationResult<T> {
  if (fn(data)) return { ok: true, value: data, errors: [] };
  const errors = (fn.errors ?? []).map((e) => `${e.instancePath || "(root)"} ${e.message ?? "is invalid"}`);
  return { ok: false, errors };
}

export function validateConfig(data: unknown): ValidationResult<AppConfig> {
  return run(validators.config, data);
}

export function validateManifest(data: unknown): ValidationResult<DataManifest> {
  return run(validators.manifest, data);
}

export function validateIndicator(data: unknown): ValidationResult<IndicatorRecord> {
  return run(validators.indicator, data);
}

export function validateTradeIndex(data: unknown): ValidationResult<TradeIndex> {
  return run(validators.tradeIndex, data);
}

export function validateTradeSnapshot(data: unknown): ValidationResult<TradeSnapshot> {
  return run(validators.tradeSnapshot, data);
}

export function validateCountryPoints(data: unknown): ValidationResult<CountryPoints> {
  return run(validators.countryPoints, data);
}
