/** The Local Authority Profiles chunk (entry.ts), shared by the lazy wrappers and the startup prefetch. */
export const loadProfiles = () => import("./entry");

/** Starts downloading the profiles chunk early (startup prefetch when the link opens a profile). */
export function preloadProfiles(): void {
  void loadProfiles().catch(() => undefined);
}
