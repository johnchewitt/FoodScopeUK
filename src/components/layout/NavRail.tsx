import { BookOpenCheck, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { MODULES } from "@/app/modules";
import { useAppStore } from "@/state/store";

/** Left navigation between modules (SH-02). Becomes a drawer on mobile. */
export function NavRail() {
  const active = useAppStore((s) => s.module);
  const setModule = useAppStore((s) => s.setModule);
  const filterOpen = useAppStore((s) => s.filterPanelOpen);
  const toggleFilterPanel = useAppStore((s) => s.toggleFilterPanel);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen);

  return (
    <nav id="module-nav" className="rail glass" aria-label="Modules" data-mobile-open={mobileNavOpen}>
      <ul className="rail__list">
        {MODULES.map((m) => {
          const Icon = m.icon;
          const current = m.id === active;
          return (
            <li key={m.id}>
              <button
                type="button"
                className="rail__item"
                aria-current={current ? "page" : undefined}
                onClick={() => setModule(m.id)}
                title={`${m.label} — ${m.question}`}
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                <span className="rail__label">{m.railLabel}</span>
                {m.release > 1 && (
                  <span className="rail__release" title={`Planned for Release ${m.release}`}>
                    R{m.release}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="rail__foot">
        <button
          type="button"
          className="rail__item"
          onClick={() => openOverlay("evidence")}
          title="Evidence and limitations"
        >
          <BookOpenCheck size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="rail__label">Evidence</span>
        </button>
        <button
          type="button"
          className="rail__item hide-compact"
          aria-expanded={filterOpen}
          aria-controls="filter-panel"
          onClick={() => toggleFilterPanel()}
          title={filterOpen ? "Hide controls ([)" : "Show controls ([)"}
        >
          {filterOpen ? (
            <PanelLeftClose size={20} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <PanelLeftOpen size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
          <span className="rail__label">{filterOpen ? "Hide" : "Controls"}</span>
        </button>
      </div>
    </nav>
  );
}
