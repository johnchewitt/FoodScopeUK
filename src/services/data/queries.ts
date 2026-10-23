import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { AppConfig } from "@/types/generated/config";
import type { DataManifest, Dataset } from "@/types/generated/manifest";
import { DataLoadError } from "./errors";
import { fetchJson, publicUrl } from "./fetchJson";
import { validateConfig, validateManifest } from "./validate";

export const DEFAULT_CONFIG: AppConfig = {
  schemaVersion: 1,
  featureFlags: { globe3d: false },
  hostedLayers: {},
};

export async function loadConfig(signal?: AbortSignal): Promise<AppConfig> {
  const raw = await fetchJson(publicUrl("config.json"), "Configuration (config.json)", signal);
  const result = validateConfig(raw);
  if (!result.ok || !result.value) {
    throw new DataLoadError(
      "validation",
      "Configuration (config.json)",
      "schema validation failed",
      result.errors,
    );
  }
  return result.value;
}

export async function loadManifest(signal?: AbortSignal): Promise<DataManifest> {
  const raw = await fetchJson(publicUrl("data/manifest.json"), "Data index (manifest.json)", signal);
  const result = validateManifest(raw);
  if (!result.ok || !result.value) {
    throw new DataLoadError(
      "validation",
      "Data index (manifest.json)",
      "schema validation failed",
      result.errors,
    );
  }
  return result.value;
}

/** Static snapshots never change for a given deploy (ADR-01). */
export const STATIC = { staleTime: Infinity, gcTime: Infinity, retry: 1 } as const;

export function useAppConfig(): UseQueryResult<AppConfig, Error> {
  return useQuery({ queryKey: ["config"], queryFn: ({ signal }) => loadConfig(signal), ...STATIC });
}

/** Query options for the data index, shared by `useManifest` and the startup prefetch. */
export const manifestQuery = {
  queryKey: ["manifest"] as const,
  queryFn: ({ signal }: { signal?: AbortSignal }) => loadManifest(signal),
  ...STATIC,
};

export function useManifest(): UseQueryResult<DataManifest, Error> {
  return useQuery(manifestQuery);
}

export function findDataset(manifest: DataManifest | undefined, id: string): Dataset | undefined {
  return manifest?.datasets.find((d) => d.id === id);
}

export function datasetUrl(dataset: Dataset): string {
  return publicUrl(`data/${dataset.path}`);
}

export type FreshnessState = "none" | "current" | "stale" | "error" | "loading";

/** Summarises data freshness for the header indicator (SH-03). Stage 1: no statistical snapshot. */
export function summariseFreshness(
  manifest: DataManifest | undefined,
  status: "pending" | "error" | "success",
): { state: FreshnessState; label: string; detail: string } {
  if (status === "pending")
    return { state: "loading", label: "Checking data", detail: "Loading the data index." };
  if (status === "error" || !manifest)
    return { state: "error", label: "Data index unavailable", detail: "The data index could not be loaded." };
  const statistical = manifest.datasets.filter((d) => d.role === "statistical");
  if (!manifest.snapshotId || statistical.length === 0) {
    return {
      state: "none",
      label: "No statistics loaded",
      detail: "No dated statistical snapshot has been published yet. Reference map layers only.",
    };
  }
  return {
    state: "current",
    label: `Snapshot ${manifest.snapshotId}`,
    detail: `${statistical.length} statistical datasets in snapshot ${manifest.snapshotId}.`,
  };
}
