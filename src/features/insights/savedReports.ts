/**
 * Saved report configurations (brief §7): a name and the URL state that reproduces the assessment
 * (assessment type, council, commodity, period, measure or scenario), kept in this browser only.
 * Only the configuration is stored: figures are always rebuilt from the current published data, so
 * a saved report never holds stale or edited numbers. Storage may be missing or blocked: every
 * access is guarded, and the list still works for the visit.
 */
import { useSyncExternalStore } from "react";
import { INSIGHTS_KINDS, parseUrlState, serializeUrlState, type InsightsKind } from "@/state/urlState";

export const REPORTS_KEY = "foodscope.reports.v1";
export const MAX_REPORTS = 20;
const MAX_NAME = 80;

export interface SavedReport {
  id: string;
  name: string;
  savedAt: string;
  kind: InsightsKind;
  /** The query string (?m=insights&ia=…) that reproduces the assessment. */
  query: string;
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function cleanReportName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

/** A stored query is re-parsed and re-serialised: unknown parameters are dropped, never trusted. */
export function normaliseQuery(query: string): string | null {
  if (typeof query !== "string" || query.length > 2000) return null;
  const state = parseUrlState(query.startsWith("?") ? query : `?${query}`);
  if (state.module !== "insights") return null;
  return serializeUrlState(state);
}

export function loadReports(store: Storage | null = storage()): SavedReport[] {
  if (!store) return [];
  try {
    const raw = store.getItem(REPORTS_KEY);
    if (!raw) return [];
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.flatMap((item): SavedReport[] => {
      if (!item || typeof item !== "object") return [];
      const o = item as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.name !== "string" || typeof o.savedAt !== "string") return [];
      if (typeof o.query !== "string" || !(INSIGHTS_KINDS as readonly unknown[]).includes(o.kind)) return [];
      const query = normaliseQuery(o.query);
      if (!query) return [];
      return [
        {
          id: o.id.slice(0, 40),
          name: cleanReportName(o.name) || "Untitled report",
          savedAt: o.savedAt.slice(0, 40),
          kind: o.kind as InsightsKind,
          query,
        },
      ];
    });
  } catch {
    return [];
  }
}

export function persistReports(list: readonly SavedReport[], store: Storage | null = storage()): boolean {
  if (!store) return false;
  try {
    store.setItem(REPORTS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** Adds a report configuration at the top; the same name replaces the older one. */
export function addReport(
  list: readonly SavedReport[],
  entry: { name: string; kind: InsightsKind; query: string },
  now: Date,
  id: string,
): SavedReport[] {
  const query = normaliseQuery(entry.query);
  if (!query) return [...list];
  const name = cleanReportName(entry.name) || "Untitled report";
  const saved: SavedReport = { id, name, savedAt: now.toISOString(), kind: entry.kind, query };
  return [saved, ...list.filter((r) => r.name !== name)].slice(0, MAX_REPORTS);
}

export function removeReport(list: readonly SavedReport[], id: string): SavedReport[] {
  return list.filter((r) => r.id !== id);
}

// ---------------------------------------------------------------------------------------------
// One list per page, shared by the components that show it

let list: SavedReport[] | null = null;
let persisted = true;
const listeners = new Set<() => void>();
let seq = 0;

function current(): SavedReport[] {
  if (list === null) list = loadReports();
  return list;
}

function set(next: SavedReport[]): void {
  list = next;
  persisted = persistReports(next);
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function saveReport(entry: { name: string; kind: InsightsKind; query: string }): void {
  seq += 1;
  set(addReport(current(), entry, new Date(), `r${Date.now().toString(36)}${seq.toString(36)}`));
}

export function deleteReport(id: string): void {
  set(removeReport(current(), id));
}

export function useSavedReports(): { reports: SavedReport[]; persisted: boolean } {
  const reports = useSyncExternalStore(subscribe, current, current);
  return { reports, persisted };
}

/** For tests: forget the in-memory list so the next read comes from storage. */
export function resetReportsForTests(): void {
  list = null;
  persisted = true;
}
