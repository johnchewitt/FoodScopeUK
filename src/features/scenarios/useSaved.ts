import { useSyncExternalStore } from "react";
import type { ScenarioParams } from "@/state/scenarioParams";
import { addSaved, loadSaved, persistSaved, removeSaved, type SavedScenario } from "./saved";

/**
 * Saved scenarios shared by the controls (save) and the insights panel (list, compare, export):
 * one list per page, read from localStorage once and written back on every change. When the
 * browser blocks storage the list still works for the visit and `persisted` says so.
 */
let list: SavedScenario[] | null = null;
let persisted = true;
const listeners = new Set<() => void>();

function current(): SavedScenario[] {
  if (list === null) list = loadSaved();
  return list;
}

function set(next: SavedScenario[]): void {
  list = next;
  persisted = persistSaved(next);
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let seq = 0;
function newId(): string {
  seq += 1;
  return `s${Date.now().toString(36)}${seq.toString(36)}`;
}

export function saveScenario(name: string, params: ScenarioParams): SavedScenario {
  const next = addSaved(current(), name, params, new Date(), newId());
  set(next);
  return next[0]!;
}

export function deleteScenario(id: string): void {
  set(removeSaved(current(), id));
}

/** For tests: forget the in-memory list so the next read comes from storage. */
export function resetSavedForTests(): void {
  list = null;
  persisted = true;
}

export function useSavedScenarios(): { saved: SavedScenario[]; persisted: boolean } {
  const saved = useSyncExternalStore(subscribe, current, current);
  return { saved, persisted };
}
