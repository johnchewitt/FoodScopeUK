import { lazy, Suspense } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SkeletonLines } from "@/components/states/Skeleton";
import { useAppStore } from "@/state/store";
import { loadInsights as load } from "./load";

/**
 * ConsultingWhere Insights is loaded only when the module is opened, so its code (assessment
 * models, report views, services catalogue) does not add to the shell's initial bundle (B1). The
 * PDF writer is a further chunk, loaded only when a PDF is asked for.
 */
const Controls = lazy(() => load().then((m) => ({ default: m.InsightsControls })));
const Insights = lazy(() => load().then((m) => ({ default: m.InsightsInsights })));
const Kpis = lazy(() => load().then((m) => ({ default: m.InsightsKpis })));
const MapExtras = lazy(() => load().then((m) => ({ default: m.InsightsMapExtras })));

/** Labels shown while the chunk loads (the cards of the assessment in the URL). */
const KPI_LABELS: Record<string, string[]> = {
  authority: ["Residents", "Supermarkets / 10k", "Residents > 1 km", "PPFI priority areas"],
  commodity: ["Recorded imports", "Largest partner", "Partners", "High water stress"],
  scenario: ["Key figure 1", "Key figure 2", "Key figure 3", "Key figure 4"],
};

export function InsightsControlsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading ConsultingWhere Insights" />
        </section>
      }
    >
      <Controls />
    </Suspense>
  );
}

export function InsightsInsightsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading the assessment" />
        </section>
      }
    >
      <Insights />
    </Suspense>
  );
}

export function InsightsKpisLazy() {
  const kind = useAppStore((s) => s.insightsKind);
  return (
    <Suspense
      fallback={(KPI_LABELS[kind] ?? []).map((l) => (
        <KpiCard key={l} label={l} state="loading" />
      ))}
    >
      <Kpis />
    </Suspense>
  );
}

export function InsightsMapExtrasLazy() {
  return (
    <Suspense fallback={null}>
      <MapExtras />
    </Suspense>
  );
}
