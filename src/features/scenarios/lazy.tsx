import { lazy, Suspense } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SkeletonLines } from "@/components/states/Skeleton";
import { useAppStore } from "@/state/store";
import { KPI_LABELS } from "./kpiLabels";
import { loadScenarios as load } from "./load";

/**
 * The Scenario Lab is loaded only when the module is opened, so its code (models, validators,
 * charts, methodology) does not add to the shell's initial bundle (B1), like the other modules.
 */
const Controls = lazy(() => load().then((m) => ({ default: m.ScenarioControls })));
const Insights = lazy(() => load().then((m) => ({ default: m.ScenarioInsights })));
const Kpis = lazy(() => load().then((m) => ({ default: m.ScenarioKpis })));
const MapExtras = lazy(() =>
  load().then((m) => ({
    default: function ScenarioMapExtras() {
      return (
        <>
          <m.ScenarioMapSync />
          <m.ScenarioLegend />
          <m.ScenarioTooltip />
        </>
      );
    },
  })),
);

export function ScenarioControlsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading the Scenario Lab" />
        </section>
      }
    >
      <Controls />
    </Suspense>
  );
}

export function ScenarioInsightsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading the scenario results" />
        </section>
      }
    >
      <Insights />
    </Suspense>
  );
}

export function ScenarioKpisLazy() {
  const kind = useAppStore((s) => s.scenarioKind);
  return (
    <Suspense
      fallback={KPI_LABELS[kind].map((l) => (
        <KpiCard key={l} label={l} state="loading" />
      ))}
    >
      <Kpis />
    </Suspense>
  );
}

export function ScenarioMapExtrasLazy() {
  return (
    <Suspense fallback={null}>
      <MapExtras />
    </Suspense>
  );
}
