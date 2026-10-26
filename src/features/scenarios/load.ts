/** The Scenario Lab chunk (entry.ts), shared by the lazy wrappers and the startup prefetch. */
export const loadScenarios = () => import("./entry");

/** Starts downloading the Scenario Lab chunk early (startup prefetch when the link opens it). */
export function preloadScenarios(): void {
  void loadScenarios().catch(() => undefined);
}
