import { CircleHelp, Download, Menu, PanelRight, Search, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { getModule } from "@/app/modules";
import { summariseFreshness, useManifest } from "@/services/data/queries";
import { useAppStore } from "@/state/store";
import { BrandMark } from "./BrandMark";

/** A header button for a capability that exists in the plan but not in this build. */
function PlannedTool({ icon, label, plannedFor }: { icon: ReactNode; label: string; plannedFor: string }) {
  return (
    <button
      type="button"
      className="tool-btn hide-compact"
      aria-disabled="true"
      title={`${label} — ${plannedFor}`}
      aria-label={`${label} (not available yet: ${plannedFor})`}
      onClick={(e) => e.preventDefault()}
    >
      {icon}
      <span className="tool-btn__label">{label}</span>
    </button>
  );
}

export function TopBar() {
  const module = useAppStore((s) => s.module);
  const insightsOpen = useAppStore((s) => s.insightsOpen);
  const toggleInsights = useAppStore((s) => s.toggleInsights);
  const filterOpen = useAppStore((s) => s.filterPanelOpen);
  const toggleFilterPanel = useAppStore((s) => s.toggleFilterPanel);
  const toggleMobileNav = useAppStore((s) => s.toggleMobileNav);
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const manifest = useManifest();
  const freshness = summariseFreshness(manifest.data, manifest.status);
  const mod = getModule(module);

  return (
    <header className="topbar">
      <div className="brand">
        <button
          type="button"
          className="tool-btn only-compact"
          aria-label="Open navigation"
          aria-expanded={mobileNavOpen}
          aria-controls="module-nav"
          onClick={() => toggleMobileNav()}
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <BrandMark className="brand__mark" />
        <div className="brand__text">
          <span className="brand__name">
            FOODSCOPE <span>UK</span>
          </span>
          <span className="brand__sub">Food Security &amp; Supply Chain Intelligence</span>
        </div>
        <span className="brand__by">
          Powered by <strong>ConsultingWhere</strong>
        </span>
      </div>

      <div className="topbar__context" aria-live="polite">
        <h1 className="topbar__module">{mod.label}</h1>
        <p className="topbar__question">{mod.question}</p>
      </div>

      <div className="topbar__tools">
        <PlannedTool
          icon={<Search size={17} aria-hidden="true" />}
          label="Search"
          plannedFor="arrives with local authority profiles (build stage 5)"
        />
        <button
          type="button"
          className="tool-btn"
          onClick={() => openOverlay("help")}
          aria-label="Help and keyboard shortcuts"
        >
          <CircleHelp size={17} aria-hidden="true" />
          <span className="tool-btn__label hide-compact">Help</span>
        </button>
        <PlannedTool
          icon={<Download size={17} aria-hidden="true" />}
          label="Export"
          plannedFor="profile PDF export arrives in build stage 8"
        />
        <span className="tool-sep hide-compact" aria-hidden="true" />
        <button
          type="button"
          className="freshness hide-compact"
          data-state={freshness.state}
          title={freshness.detail}
          onClick={() => openOverlay("evidence")}
          aria-label={`Data freshness: ${freshness.label}. ${freshness.detail} Open evidence and limitations.`}
        >
          <span className="freshness__dot" aria-hidden="true" />
          <span className="freshness__full">{freshness.label}</span>
          <span className="freshness__short" aria-hidden="true">
            {freshness.short}
          </span>
        </button>
        <div className="dim-toggle hide-compact" role="group" aria-label="Map dimension">
          <button type="button" aria-pressed="true">
            2D
          </button>
          <button
            type="button"
            aria-pressed="false"
            aria-disabled="true"
            title="3D globe is planned for Release 2"
            onClick={(e) => e.preventDefault()}
          >
            3D
          </button>
        </div>
        <button
          type="button"
          className="tool-btn only-compact"
          aria-pressed={filterOpen}
          aria-controls="filter-panel"
          onClick={() => toggleFilterPanel()}
          aria-label="Controls panel"
        >
          <SlidersHorizontal size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="tool-btn"
          aria-pressed={insightsOpen}
          aria-controls="insights-panel"
          onClick={() => toggleInsights()}
          title="Toggle insights panel (])"
          aria-label="Insights panel"
        >
          <PanelRight size={17} aria-hidden="true" />
          <span className="tool-btn__label">Insights</span>
        </button>
      </div>
    </header>
  );
}
