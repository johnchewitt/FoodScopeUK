import { formatByUnit } from "@/analysis/format";
import { useAppStore } from "@/state/store";
import { provenanceProblems, type Indicator } from "@/types/indicator";
import { ProvenanceBadge } from "./ProvenanceBadge";

const MISSING_TEXT: Record<NonNullable<Indicator["missingReason"]>, string> = {
  suppressed: "Suppressed by the publisher",
  not_published: "Not published",
  not_applicable: "Not applicable",
  not_covered: "Data unavailable (not covered by this source)",
  small_base: "Base too small to show",
};

/**
 * The only way to put a number on screen (ADR-09, P1). Refuses to render a value that lacks
 * provenance: in development this is logged as an error, in production it shows "Source unavailable".
 */
export function Metric({
  indicator,
  compact = false,
}: {
  indicator: Indicator<number | string>;
  compact?: boolean;
}) {
  const openEvidence = useAppStore((s) => s.openOverlay);
  const problems = provenanceProblems(indicator);

  if (problems.length > 0) {
    if (import.meta.env.DEV) console.error(`Metric "${indicator.id}" blocked: ${problems.join(", ")}`);
    return (
      <div className="metric metric--unavailable" data-indicator={indicator.id}>
        <span className="metric__value">Source unavailable</span>
      </div>
    );
  }

  const text =
    indicator.value === null && indicator.missingReason
      ? MISSING_TEXT[indicator.missingReason]
      : formatByUnit(indicator.value, indicator.unit);

  return (
    <div className="metric" data-indicator={indicator.id}>
      <span className="metric__value">{text}</span>
      {!compact && (
        <span className="metric__meta">
          <ProvenanceBadge cls={indicator.provenance} />
          <span className="chip">{indicator.referencePeriod}</span>
          {indicator.scope === "national_context" && (
            <span className="chip chip--amber">National context</span>
          )}
          <button
            type="button"
            className="source-btn"
            onClick={() => openEvidence("evidence")}
            aria-label={`Sources: ${indicator.sourceIds.join(", ")}. Open evidence and limitations`}
          >
            {indicator.sourceIds.join(" ")}
          </button>
        </span>
      )}
    </div>
  );
}
