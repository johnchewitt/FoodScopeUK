import { lazy, Suspense } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SkeletonLines } from "@/components/states/Skeleton";
import { useAppStore } from "@/state/store";
import { loadProfiles as load } from "./load";

/**
 * Local Authority Profiles is loaded only when the module (or the comparison) is opened, so its
 * code (validators, profile model, charts) does not add to the shell's initial bundle (B1).
 */
const Controls = lazy(() => load().then((m) => ({ default: m.ProfileControls })));
const Insights = lazy(() => load().then((m) => ({ default: m.ProfileInsights })));
const Kpis = lazy(() => load().then((m) => ({ default: m.ProfileKpis })));
const Compare = lazy(() => load().then((m) => ({ default: m.CompareDialog })));
const MapExtras = lazy(() =>
  load().then((m) => ({
    default: function ProfileMapExtras() {
      return (
        <>
          <m.ProfileMapSync />
          <m.ProfileLegend />
          <m.ProfileTooltip />
        </>
      );
    },
  })),
);

/** Labels shown while the chunk loads (same order as ProfileKpis). */
const KPI_LABELS = [
  "Residents",
  "Mapped grocery stores",
  "Supermarkets per 10,000 residents",
  "Residents > 1 km from a supermarket (straight-line)",
  "Households with no car or van",
];

export function ProfileControlsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading Local Authority Profiles" />
        </section>
      }
    >
      <Controls />
    </Suspense>
  );
}

export function ProfileInsightsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading the profile" />
        </section>
      }
    >
      <Insights />
    </Suspense>
  );
}

export function ProfileKpisLazy() {
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

export function ProfileMapExtrasLazy() {
  return (
    <Suspense fallback={null}>
      <MapExtras />
    </Suspense>
  );
}

/** The comparison dialog (LP-07): loaded when the overlay is opened (view=compare). */
export function CompareDialogLazy() {
  const open = useAppStore((s) => s.overlay === "compare");
  if (!open) return null;
  return (
    <Suspense fallback={null}>
      <Compare />
    </Suspense>
  );
}
