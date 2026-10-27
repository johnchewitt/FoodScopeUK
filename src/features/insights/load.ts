/** The ConsultingWhere Insights chunk (entry.ts), shared by the lazy wrappers and the startup prefetch. */
export const loadInsights = () => import("./entry");

/** Starts downloading the Insights chunk early (startup prefetch when the link opens it). */
export function preloadInsights(): void {
  void loadInsights().catch(() => undefined);
}
