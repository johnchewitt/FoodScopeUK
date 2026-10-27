import { KpiCard } from "@/components/dashboard/KpiCard";
import { useAppStore } from "@/state/store";
import { KPI_LABELS as SCENARIO_KPI_LABELS } from "@/features/scenarios/kpiLabels";
import { INSIGHTS_KPI_LABELS } from "./labels";
import { useInsightsAssessment } from "./useInsights";

/** The assessment's key figures (the report's KPIs; every value an Indicator, P1). */
export function InsightsKpis() {
  const kind = useAppStore((s) => s.insightsKind);
  const scenarioKind = useAppStore((s) => s.scenarioKind);
  const a = useInsightsAssessment();
  const report = a && a.kind === kind ? a.report : null;
  if (!report) {
    const state =
      a?.kind === kind && a.status === "error"
        ? "error"
        : a?.kind === kind && a.status === "empty"
          ? "empty"
          : "loading";
    const labels = kind === "scenario" ? SCENARIO_KPI_LABELS[scenarioKind] : INSIGHTS_KPI_LABELS[kind];
    return labels.map((l) => (
      <KpiCard
        key={l.label}
        label={l.label}
        shortLabel={l.short}
        state={state}
        note={
          state === "error"
            ? (a?.error ?? undefined)
            : state === "empty"
              ? (a?.emptyText ?? undefined)
              : undefined
        }
        emptyText="Not selected"
      />
    ));
  }
  return report.kpis.map((k) => (
    <KpiCard
      key={k.id}
      label={k.label}
      shortLabel={k.short}
      state={k.indicator.value === null && !k.indicator.missingReason ? "empty" : "ready"}
      indicator={k.indicator}
      detail={k.detail}
    />
  ));
}
