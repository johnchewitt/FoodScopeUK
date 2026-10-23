import { getModule } from "@/app/modules";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { useAppStore } from "@/state/store";

/**
 * Floating KPI cards for the active module. In Stage 1 no statistical data is loaded, so each
 * card names the measure it will show and says when it arrives — no placeholder numbers (P14).
 */
export function KpiStrip() {
  const module = useAppStore((s) => s.module);
  const mod = getModule(module);
  const note =
    mod.release > 1 ? `Planned for Release ${mod.release}` : `Added in build stage ${mod.buildStage}`;

  return (
    <section className="kpi-strip" aria-label={`${mod.label} key figures`}>
      {mod.plannedKpis.map((label) => (
        <KpiCard key={label} label={label} state="empty" note={note} />
      ))}
    </section>
  );
}
