import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/states/Skeleton";
import type { Indicator } from "@/types/indicator";
import { Metric } from "./Metric";
import { ProvenanceBadge } from "./ProvenanceBadge";

export type KpiState = "loading" | "empty" | "error" | "ready";

interface Props {
  label: string;
  state: KpiState;
  indicator?: Indicator<number | string> | null;
  /** Explains an empty or error state. */
  note?: string;
  /** Context line under a ready value (replaces the default "period, coverage" line). */
  detail?: ReactNode;
  /**
   * Comparability caution for the figure or its comparison (P11), e.g. a series break. Shown as an
   * amber marker beside the label; the full sentence is the marker's accessible name and tooltip.
   */
  caution?: string | null;
}

/** Floating KPI card. Shows a value only when a provenance-complete indicator is supplied. */
export function KpiCard({ label, state, indicator, note, detail, caution }: Props) {
  const showCaution = state === "ready" && Boolean(indicator) && Boolean(caution);
  return (
    <article
      className="kpi-card glass"
      aria-label={label}
      data-state={state}
      data-caution={showCaution ? "true" : undefined}
    >
      <h3 className="kpi-card__label" title={indicator?.method ?? label}>
        <span className="kpi-card__label-text">{label}</span>
        {showCaution && (
          <span className="kpi-card__caution" role="img" aria-label={`Caution: ${caution}`} title={caution!}>
            <TriangleAlert size={13} aria-hidden="true" />
          </span>
        )}
        {state === "ready" && indicator && (
          <span className="kpi-card__badge">
            <ProvenanceBadge cls={indicator.provenance} showLabel={false} />
          </span>
        )}
      </h3>
      {state === "loading" && (
        <div style={{ marginTop: 10 }}>
          <Skeleton width="60%" height={22} label={`Loading ${label}`} />
        </div>
      )}
      {state === "ready" && indicator && (
        <div style={{ marginTop: 6 }}>
          <Metric indicator={indicator} compact />
          <p className="kpi-card__meta" title={typeof detail === "string" ? detail : undefined}>
            {detail ?? `${indicator.referencePeriod}, ${indicator.coverage}`}
          </p>
        </div>
      )}
      {(state === "empty" || (state === "ready" && !indicator)) && (
        <>
          <div className="kpi-card__empty">
            <span className="kpi-card__empty-bar" aria-hidden="true" />
            No data loaded
          </div>
          {note && <p className="kpi-card__meta">{note}</p>}
        </>
      )}
      {state === "error" && (
        <>
          <div className="kpi-card__empty" style={{ color: "var(--fs-amber)" }}>
            Could not load
          </div>
          {note && <p className="kpi-card__meta">{note}</p>}
        </>
      )}
    </article>
  );
}
