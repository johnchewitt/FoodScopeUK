import { lazy, Suspense } from "react";
import { FilterPanel } from "@/components/layout/FilterPanel";
import { InsightsPanel } from "@/components/layout/InsightsPanel";
import { KpiStrip } from "@/components/layout/KpiStrip";
import { NavRail } from "@/components/layout/NavRail";
import { TimelineBar } from "@/components/layout/TimelineBar";
import { TopBar } from "@/components/layout/TopBar";
import { loadMapHost } from "@/components/maps/loadMapHost";
import { MapControls } from "@/components/maps/MapControls";
import { EvidenceDialog } from "@/components/overlays/EvidenceDialog";
import { HelpDialog } from "@/components/overlays/HelpDialog";
import { SearchDialogLazy } from "@/features/search/lazy";
import {
  useBreakpoint,
  useKeyboardShortcuts,
  useMotionPreferencePersistence,
  useSystemReducedMotion,
  useUrlSync,
} from "@/state/hooks";
import { selectMapColourStyle, selectReducedMotion, useAppStore } from "@/state/store";
import { MapLoading } from "@/components/maps/MapLoading";
import { OriginsLegend, OriginsMapSync, OriginsTooltip } from "@/features/origins/OriginsMapExtras";
import { AccessMapExtrasLazy } from "@/features/access/lazy";
import { InsightsMapExtrasLazy } from "@/features/insights/lazy";
import { CompareDialogLazy, ProfileMapExtrasLazy } from "@/features/profiles/lazy";
import { RiskMapExtrasLazy } from "@/features/risks/lazy";
import { ScenarioMapExtrasLazy } from "@/features/scenarios/lazy";
import { SeasonalMapExtrasLazy } from "@/features/seasonal/lazy";
import { ErrorBoundary } from "./ErrorBoundary";

// The ArcGIS SDK is large; loading it lazily lets the shell paint first (PF-04).
const MapHost = lazy(loadMapHost);

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
  const mapStyle = useAppStore(selectMapColourStyle);

  return (
    <div className="app" data-motion={reduced ? "reduced" : "full"} data-map-style={mapStyle}>
      <a className="skip-link" href="#module-nav">
        Skip to navigation
      </a>
      <TopBar />
      <main
        className="stage"
        data-filter={filterOpen ? "open" : "closed"}
        data-insights={insightsOpen ? "open" : "closed"}
        data-bp={breakpoint}
        data-module={module}
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
        {module === "seasonal" && (
          <ErrorBoundary region="Map legend">
            <SeasonalMapExtrasLazy />
          </ErrorBoundary>
        )}
        {module === "access" && (
          <ErrorBoundary region="Map legend">
            <AccessMapExtrasLazy />
          </ErrorBoundary>
        )}
        {module === "profiles" && (
          <ErrorBoundary region="Map legend">
            <ProfileMapExtrasLazy />
          </ErrorBoundary>
        )}
        {module === "risks" && (
          <ErrorBoundary region="Map legend">
            <RiskMapExtrasLazy />
          </ErrorBoundary>
        )}
        {module === "scenarios" && (
          <ErrorBoundary region="Map legend">
            <ScenarioMapExtrasLazy />
          </ErrorBoundary>
        )}
        {module === "insights" && (
          <ErrorBoundary region="Map legend and report">
            <InsightsMapExtrasLazy />
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
      <SearchDialogLazy />
      <ErrorBoundary region="Council comparison">
        <CompareDialogLazy />
      </ErrorBoundary>
    </div>
  );
}
