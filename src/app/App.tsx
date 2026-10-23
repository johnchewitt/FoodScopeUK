import { lazy, Suspense } from "react";
import { FilterPanel } from "@/components/layout/FilterPanel";
import { InsightsPanel } from "@/components/layout/InsightsPanel";
import { KpiStrip } from "@/components/layout/KpiStrip";
import { NavRail } from "@/components/layout/NavRail";
import { TimelineBar } from "@/components/layout/TimelineBar";
import { TopBar } from "@/components/layout/TopBar";
import { MapControls } from "@/components/maps/MapControls";
import { EvidenceDialog } from "@/components/overlays/EvidenceDialog";
import { HelpDialog } from "@/components/overlays/HelpDialog";
import {
  useBreakpoint,
  useKeyboardShortcuts,
  useMotionPreferencePersistence,
  useSystemReducedMotion,
  useUrlSync,
} from "@/state/hooks";
import { selectReducedMotion, useAppStore } from "@/state/store";
import { MapLoading } from "@/components/maps/MapLoading";
import { OriginsLegend, OriginsMapSync, OriginsTooltip } from "@/features/origins/OriginsMapExtras";
import { ErrorBoundary } from "./ErrorBoundary";

// The ArcGIS SDK is large; loading it lazily lets the shell paint first (PF-04).
const MapHost = lazy(() => import("@/components/maps/MapHost"));

export function App() {
  useBreakpoint();
  useSystemReducedMotion();
  useMotionPreferencePersistence();
  useUrlSync();
  useKeyboardShortcuts();

  const reduced = useAppStore(selectReducedMotion);
  const filterOpen = useAppStore((s) => s.filterPanelOpen);
  const insightsOpen = useAppStore((s) => s.insightsOpen);
  const breakpoint = useAppStore((s) => s.breakpoint);
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen);
  const closeMobileNav = useAppStore((s) => s.toggleMobileNav);
  const module = useAppStore((s) => s.module);

  return (
    <div className="app" data-motion={reduced ? "reduced" : "full"}>
      <a className="skip-link" href="#module-nav">
        Skip to navigation
      </a>
      <TopBar />
      <main
        className="stage"
        data-filter={filterOpen ? "open" : "closed"}
        data-insights={insightsOpen ? "open" : "closed"}
        data-bp={breakpoint}
      >
        <ErrorBoundary region="Map">
          <Suspense fallback={<MapLoading />}>
            <MapHost />
          </Suspense>
        </ErrorBoundary>
        {breakpoint === "mobile" && mobileNavOpen && (
          <div className="scrim" aria-hidden="true" onClick={() => closeMobileNav(false)} />
        )}
        <NavRail />
        <ErrorBoundary region="Controls panel">
          <FilterPanel />
        </ErrorBoundary>
        <ErrorBoundary region="Key figures">
          <KpiStrip />
        </ErrorBoundary>
        <MapControls />
        {module === "origins" && (
          <ErrorBoundary region="Map legend">
            <OriginsMapSync />
            <OriginsLegend />
            <OriginsTooltip />
          </ErrorBoundary>
        )}
        <ErrorBoundary region="Timeline">
          <TimelineBar />
        </ErrorBoundary>
        <ErrorBoundary region="Insights panel">
          <InsightsPanel />
        </ErrorBoundary>
      </main>
      <EvidenceDialog />
      <HelpDialog />
    </div>
  );
}
