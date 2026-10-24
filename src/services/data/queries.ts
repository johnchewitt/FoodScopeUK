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

/** Query options for config.json, shared by `useAppConfig` and the startup prefetch. */
export const configQuery = {
  queryKey: ["config"] as const,
  queryFn: ({ signal }: { signal?: AbortSignal }) => loadConfig(signal),
  ...STATIC,
};

export function useAppConfig(): UseQueryResult<AppConfig, Error> {
  return useQuery(configQuery);
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

/** Display names of the dataset families (folders inside a snapshot; ADR-0021). */
export const FAMILY_LABELS: Record<string, string> = {
  trade: "Trade",
  local: "Stores and population",
};

/**
 * The snapshot date a dataset family is taken from. Each family refreshes on its own schedule
 * (ADR-0021); manifests written before families existed name one snapshot for everything.
 */
export function familySnapshot(manifest: DataManifest | undefined, family: string): string | null {
  if (!manifest) return null;
  if (manifest.snapshots) return manifest.snapshots[family] ?? null;
  return manifest.snapshotId;
}

/** Families and their snapshot dates, oldest family name first (stable display order). */
export function familySnapshots(
  manifest: DataManifest | undefined,
): { family: string; label: string; id: string }[] {
  if (!manifest) return [];
  const entries = manifest.snapshots
    ? Object.entries(manifest.snapshots)
    : manifest.snapshotId
      ? [["trade", manifest.snapshotId] as [string, string]]
      : [];
  const order = Object.keys(FAMILY_LABELS);
  return entries
    .map(([family, id]) => ({ family, label: FAMILY_LABELS[family] ?? family, id }))
    .sort((a, b) => {
      const ia = order.indexOf(a.family);
      const ib = order.indexOf(b.family);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.family.localeCompare(b.family);
    });
}

export type FreshnessState = "none" | "current" | "stale" | "error" | "loading";

/** Summarises data freshness for the header indicator (SH-03): one snapshot date per data family. */
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
  const families = familySnapshots(manifest);
  if (families.length <= 1)
    return {
      state: "current",
      label: `Snapshot ${manifest.snapshotId}`,
      detail: `${statistical.length} statistical datasets in snapshot ${manifest.snapshotId}.`,
    };
  return {
    state: "current",
    label: families.map((f) => `${f.label} ${f.id}`).join(" · "),
    detail: `${statistical.length} statistical datasets. Each kind of data comes from its own latest snapshot: ${families
      .map((f) => `${f.label.toLowerCase()} ${f.id}`)
      .join(", ")}.`,
  };
}
