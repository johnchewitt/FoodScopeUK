import { DataLoadError } from "./errors";

export const FETCH_TIMEOUT_MS = 15_000;

/** Resolves a path under the deployed base (GitHub Pages sub-path aware). */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base.endsWith("/") ? base : `${base}/`}${path.replace(/^\/+/, "")}`;
}

/**
 * Time allowed for a file of `bytes`: the base timeout plus 1 s per 250 kB, so a large layer on a
 * slow connection is not cut off while small files still fail fast.
 */
export function timeoutForBytes(bytes: number | undefined): number {
  return FETCH_TIMEOUT_MS + Math.ceil((bytes ?? 0) / 250_000) * 1000;
}

/** Fetches and parses JSON with a timeout and typed errors. Validation is the caller's job. */
export async function fetchJson(
  url: string,
  resource: string,
  signal?: AbortSignal,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<unknown> {
  const timeout = AbortSignal.timeout(timeoutMs);
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
