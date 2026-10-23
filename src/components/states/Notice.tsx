import { Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  tone?: "info" | "warn";
  children: ReactNode;
}

/** Inline notice for stale data or partial failures (SH-05: "partial" and "stale" states). */
export function Notice({ tone = "info", children }: Props) {
  const Icon = tone === "warn" ? TriangleAlert : Info;
  return (
    <div
      className={`notice${tone === "warn" ? " notice--warn" : ""}`}
      role={tone === "warn" ? "alert" : "status"}
    >
      <Icon size={16} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/** Lists the sources that failed while others succeeded. */
export function PartialNotice({ failed }: { failed: string[] }) {
  if (failed.length === 0) return null;
  return (
    <Notice tone="warn">
      Some information is unavailable: {failed.join(", ")}. Everything else shown here loaded normally.
    </Notice>
  );
}

/** Shown when a source's reference period is older than its expected cadence. */
export function StaleBanner({ source, period }: { source: string; period: string }) {
  return (
    <Notice tone="warn">
      {source} was last updated for {period}, which is older than its usual release cycle.
    </Notice>
  );
}
