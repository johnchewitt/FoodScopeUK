import { Info } from "lucide-react";
import { lazy, Suspense } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SkeletonLines } from "@/components/states/Skeleton";
import { loadAccess as load } from "./load";
import { PROVISION_NOTE } from "./note";

/**
 * UK Food Access is loaded only when the module is opened, so its code (store model, validators,
 * national grids, charts) does not add to the shell's initial bundle (backlog B1).
 */
const Controls = lazy(() => load().then((m) => ({ default: m.AccessControls })));
const Insights = lazy(() => load().then((m) => ({ default: m.AccessInsights })));
const Kpis = lazy(() => load().then((m) => ({ default: m.AccessKpis })));
const MapExtras = lazy(() =>
  load().then((m) => ({
    default: function AccessMapExtras() {
      return (
        <>
          <m.AccessMapSync />
          <m.AccessLegend />
          <m.AccessTooltip />
        </>
      );
    },
  })),
);

/** Labels shown while the chunk loads (same order as AccessKpis). */
const KPI_LABELS = [
  "Mapped stores",
  "Per 10,000 residents",
  "Per km² of land",
  "Population beyond threshold (straight-line)",
];

export function AccessControlsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading UK Food Access" />
        </section>
      }
    >
      <Controls />
    </Suspense>
  );
}

export function AccessInsightsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <p className="provision-callout" role="note">
            <span>{PROVISION_NOTE}</span>
          </p>
          <SkeletonLines label="Loading UK Food Access" />
        </section>
      }
    >
      <Insights />
    </Suspense>
  );
}

export function AccessKpisLazy() {
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

/** Map sync, legend and tooltip; the SM-10 note is drawn by the shell (always visible). */
export function AccessMapExtrasLazy() {
  return (
    <>
      <p className="provision-note glass" role="note">
        <Info size={14} aria-hidden="true" />
        <span>{PROVISION_NOTE}</span>
      </p>
      <Suspense fallback={null}>
        <MapExtras />
      </Suspense>
    </>
  );
}
