/** The Risk Explorer chunk (entry.ts), shared by the lazy wrappers and the startup prefetch. */
export const loadRisks = () => import("./entry");

/** Starts downloading the Risk Explorer chunk early (startup prefetch when the link opens it). */
export function preloadRisks(): void {
  void loadRisks().catch(() => undefined);
}
