import { Skeleton } from "@/components/states/Skeleton";
import type { Indicator } from "@/types/indicator";
import { Metric } from "./Metric";

export type KpiState = "loading" | "empty" | "error" | "ready";

interface Props {
  label: string;
  state: KpiState;
  indicator?: Indicator<number | string> | null;
  /** Explains an empty or error state. */
  note?: string;
}

/** Floating KPI card. Shows a value only when a provenance-complete indicator is supplied. */
export function KpiCard({ label, state, indicator, note }: Props) {
  return (
    <article className="kpi-card glass" aria-label={label} data-state={state}>
      <h3 className="kpi-card__label" title={label}>
        {label}
      </h3>
      {state === "loading" && (
        <div style={{ marginTop: 10 }}>
          <Skeleton width="60%" height={22} label={`Loading ${label}`} />
        </div>
      )}
      {state === "ready" && indicator && (
        <div style={{ marginTop: 6 }}>
          <Metric indicator={indicator} compact />
          <p className="kpi-card__meta">
            {indicator.referencePeriod}, {indicator.coverage}
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
