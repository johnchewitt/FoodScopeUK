import { useEffect, useRef, useState, type RefObject } from "react";
import { getModule } from "@/app/modules";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { OriginsKpis } from "@/features/origins/OriginsKpis";
import { AccessKpisLazy } from "@/features/access/lazy";
import { SeasonalKpisLazy } from "@/features/seasonal/lazy";
import { useAppStore } from "@/state/store";

/**
 * Tracks whether a horizontally scrolling row has more content to either side, so the strip can
 * show a fade cue and become keyboard scrollable only when it actually overflows.
 */
function useOverflow(ref: RefObject<HTMLElement | null>) {
  const [state, setState] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const max = el.scrollWidth - el.clientWidth;
      const next = { start: el.scrollLeft > 1, end: max - el.scrollLeft > 1 };
      setState((prev) => (prev.start === next.start && prev.end === next.end ? prev : next));
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    for (const child of Array.from(el.children)) ro?.observe(child);
    const mo = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    mo?.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      el.removeEventListener("scroll", measure);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [ref]);
  return state;
}

/**
 * Floating KPI cards for the active module. Food Origins (Stage 2), Seasonal Supply (Stage 3) and
 * UK Food Access (Stage 4) show real indicators; other modules name the measure they will show and say when it arrives —
 * no placeholder numbers (P14).
 *
 * No card is ever hidden: when the map area is too narrow for all of them (laptops with both
 * panels open, tablets, phones) the row scrolls sideways, with a fade on the side that has more
 * cards and keyboard scrolling when focused.
 */
export function KpiStrip() {
  const module = useAppStore((s) => s.module);
  const mod = getModule(module);
  const note =
    mod.release > 1 ? `Planned for Release ${mod.release}` : `Added in build stage ${mod.buildStage}`;
  const ref = useRef<HTMLElement | null>(null);
  const overflow = useOverflow(ref);
  const scrollable = overflow.start || overflow.end;

  return (
    <section
      ref={ref}
      className="kpi-strip"
      aria-label={`${mod.label} key figures${scrollable ? " (scroll sideways for more)" : ""}`}
      data-overflow-start={overflow.start || undefined}
      data-overflow-end={overflow.end || undefined}
      tabIndex={scrollable ? 0 : undefined}
    >
      {module === "origins" ? (
        <OriginsKpis />
      ) : module === "seasonal" ? (
        <SeasonalKpisLazy />
      ) : module === "access" ? (
        <AccessKpisLazy />
      ) : (
        mod.plannedKpis.map((label) => <KpiCard key={label} label={label} state="empty" note={note} />)
      )}
    </section>
  );
}
