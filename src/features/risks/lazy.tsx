import { lazy, Suspense } from "react";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { SkeletonLines } from "@/components/states/Skeleton";
import { useAppStore } from "@/state/store";
import { loadRisks as load } from "./load";

/**
 * The Risk Explorer is loaded only when the module is opened, so its code (validators, models,
 * charts, explanations) does not add to the shell's initial bundle (B1), like Seasonal Supply,
 * UK Food Access and Local Authority Profiles.
 */
const Controls = lazy(() => load().then((m) => ({ default: m.RiskControls })));
const Insights = lazy(() => load().then((m) => ({ default: m.RiskInsights })));
const Kpis = lazy(() => load().then((m) => ({ default: m.RiskKpis })));
const MapExtras = lazy(() =>
  load().then((m) => ({
    default: function RiskMapExtras() {
      return (
        <>
          <m.RiskMapSync />
          <m.RiskLegend />
          <m.RiskTooltip />
        </>
      );
    },
  })),
);

/** Labels shown while the chunk loads (the cards of the view in the URL). */
const KPI_LABELS: Record<string, string[]> = {
  supply: [
    "Recorded imports",
    "Recorded import partners",
    "Top supplier share",
    "Partner concentration (HHI)",
  ],
  logistics: ["Major ports", "Largest port", "Short Straits share of food imports", "Road delay (England)"],
  access: ["Priority share (selected council)", "Rank within nation", "Nation's share"],
};

export function RiskControlsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading the Risk Explorer" />
        </section>
      }
    >
      <Controls />
    </Suspense>
  );
}

export function RiskInsightsLazy() {
  return (
    <Suspense
      fallback={
        <section className="panel-section">
          <SkeletonLines label="Loading the risk evidence" />
        </section>
      }
    >
      <Insights />
    </Suspense>
  );
}

export function RiskKpisLazy() {
  const view = useAppStore((s) => s.riskView);
  return (
    <Suspense
      fallback={(KPI_LABELS[view] ?? []).map((l) => (
        <KpiCard key={l} label={l} state="loading" />
      ))}
    >
      <Kpis />
    </Suspense>
  );
}

export function RiskMapExtrasLazy() {
  return (
    <Suspense fallback={null}>
      <MapExtras />
    </Suspense>
  );
}
