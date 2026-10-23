import { lazy, Suspense } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SkeletonLines } from "@/components/states/Skeleton";
import { loadSeasonal as load } from "./load";

/**
 * Seasonal Supply is loaded only when the module is opened, so its code (model, charts, heatmap,
 * timeline) does not add to the shell's initial bundle (PF budgets, backlog B1).
 */
const Controls = lazy(() => load().then((m) => ({ default: m.SeasonalControls })));
const Insights = lazy(() => load().then((m) => ({ default: m.SeasonalInsights })));
const Kpis = lazy(() => load().then((m) => ({ default: m.SeasonalKpis })));
const Timeline = lazy(() => load().then((m) => ({ default: m.SeasonalTimeline })));
const MapExtras = lazy(() =>
  load().then((m) => ({
    default: function SeasonalMapExtras() {
      return (
        <>
          <m.SeasonalMapSync />
          <m.SeasonalLegend />
          <m.SeasonalTooltip />
          <m.MissingMonthBanner />
        </>
      );
    },
  })),
);

const KPI_LABELS = [
  "Recorded imports",
  "Change vs a year earlier",
  "Top recorded partner",
  "Monthly concentration (HHI)",
];

export function SeasonalControlsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading Seasonal Supply" />
        </section>
      }
    >
      <Controls />
    </Suspense>
  );
}

export function SeasonalInsightsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading Seasonal Supply" />
        </section>
      }
    >
      <Insights />
    </Suspense>
  );
}

export function SeasonalKpisLazy() {
  return (
    <Suspense
      fallback={KPI_LABELS.map((l) => (
        <KpiCard key={l} label={l} state="loading" />
      ))}
    >
      <Kpis />
    </Suspense>
  );
}

export function SeasonalTimelineLazy() {
  return (
    <Suspense
      fallback={
        <section className="timeline timeline--seasonal" aria-label="Timeline">
          <div className="timeline__bar glass season-tl">
            <p className="timeline__status">Loading monthly data…</p>
          </div>
        </section>
      }
    >
      <Timeline />
    </Suspense>
  );
}

export function SeasonalMapExtrasLazy() {
  return (
    <Suspense fallback={null}>
      <MapExtras />
    </Suspense>
  );
}
