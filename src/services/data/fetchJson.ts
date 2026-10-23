import { DataLoadError } from "./errors";

export const FETCH_TIMEOUT_MS = 15_000;

/** Resolves a path under the deployed base (GitHub Pages sub-path aware). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base.endsWith("/") ? base : `${base}/`}${path.replace(/^\/+/, "")}`;
}

/** Fetches and parses JSON with a timeout and typed errors. Validation is the caller's job. */
export async function fetchJson(url: string, resource: string, signal?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let response: Response;
  try {
    response = await fetch(url, { signal: combined, headers: { Accept: "application/json" } });
  } catch (err) {
    if (timeout.aborted) throw new DataLoadError("timeout", resource, "timed out");
    if (signal?.aborted) throw err;
    throw new DataLoadError("network", resource, err instanceof Error ? err.message : "network error");
  }
  if (!response.ok) throw new DataLoadError("http", resource, `HTTP ${response.status}`);
  try {
    return await response.json();
  } catch {
    throw new DataLoadError("parse", resource, "invalid JSON");
  }
}
