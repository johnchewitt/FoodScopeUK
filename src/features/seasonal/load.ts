/** The Seasonal Supply chunk (entry.ts), shared by the lazy wrappers and the startup prefetch. */
export const loadSeasonal = () => import("./entry");

/** Starts downloading the Seasonal chunk early (startup prefetch when the link opens Seasonal). */
export function preloadSeasonal(): void {
  void loadSeasonal().catch(() => undefined);
}
