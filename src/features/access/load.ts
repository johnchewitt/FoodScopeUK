/** The UK Food Access chunk (entry.ts), shared by the lazy wrappers and the startup prefetch. */
export const loadAccess = () => import("./entry");

/** Starts downloading the Food Access chunk early (startup prefetch when the link opens UK Food Access). */
export function preloadAccess(): void {
  void loadAccess().catch(() => undefined);
}
