import { Globe, Map as MapIcon, PanelLeftClose } from "lucide-react";
import { getModule } from "@/app/modules";
import { EmptyState } from "@/components/states/EmptyState";
import { selectReducedMotion, useAppStore } from "@/state/store";

/** Collapsible left panel: module controls (from Stage 3 onward) and map display settings. */
export function FilterPanel() {
  const module = useAppStore((s) => s.module);
  const open = useAppStore((s) => s.filterPanelOpen);
  const toggle = useAppStore((s) => s.toggleFilterPanel);
  const issueMapCommand = useAppStore((s) => s.issueMapCommand);
  const motionPreference = useAppStore((s) => s.motionPreference);
  const systemReduced = useAppStore((s) => s.systemPrefersReducedMotion);
  const reduced = useAppStore(selectReducedMotion);
  const setMotionPreference = useAppStore((s) => s.setMotionPreference);
  const lad = useAppStore((s) => s.lad);
  const mod = getModule(module);

  return (
    <aside
      id="filter-panel"
      className="panel filter-panel glass"
      data-open={open}
      aria-label={`${mod.label} controls`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="panel__header">
        <div className="panel__heading">
          <h2 className="panel__title">{mod.label}</h2>
          <p className="panel__subtitle">{mod.question}</p>
        </div>
        <button type="button" className="tool-btn" onClick={() => toggle(false)} aria-label="Hide controls">
          <PanelLeftClose size={17} aria-hidden="true" />
        </button>
      </div>

      <div className="panel__body scroll-area">
        <section className="panel-section" aria-labelledby="controls-heading">
          <h3 id="controls-heading" className="panel-section__title">
            Controls
          </h3>
          <EmptyState
            title="Not available in this build"
            body={
              mod.release > 1
                ? `This module is planned for Release ${mod.release}. These controls will appear here:`
                : `The controls for this module are added in build stage ${mod.buildStage}, together with their data:`
            }
          />
          <ul className="planned-list" aria-label="Planned controls">
            {mod.plannedControls.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {module === "profiles" && lad && (
            <p style={{ marginTop: 12 }}>
              This link selects local authority <code>{lad}</code>. Its profile appears once profiles are
              built.
            </p>
          )}
        </section>

        <section className="panel-section" aria-labelledby="view-heading">
          <h3 id="view-heading" className="panel-section__title">
            Map view
          </h3>
          <div className="segmented" role="group" aria-label="Fly to">
            <button type="button" onClick={() => issueMapCommand({ type: "goTo", target: "world" })}>
              <Globe size={15} aria-hidden="true" /> World
            </button>
            <button type="button" onClick={() => issueMapCommand({ type: "goTo", target: "uk" })}>
              <MapIcon size={15} aria-hidden="true" /> UK
            </button>
          </div>
          <div className="setting-row">
            <span>
              Reduce motion
              <span className="setting-row__hint">
                {systemReduced
                  ? "Your device already asks for reduced motion."
                  : "Turns off map flights and animated effects."}
              </span>
            </span>
            <calcite-switch
              label="Reduce motion"
              checked={reduced}
              disabled={systemReduced}
              oncalciteSwitchChange={(e) => setMotionPreference(e.target.checked ? "reduced" : "system")}
              data-preference={motionPreference}
            />
          </div>
        </section>
      </div>
    </aside>
  );
}
