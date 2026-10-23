import { getModule } from "@/app/modules";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { OriginsKpis } from "@/features/origins/OriginsKpis";
import { SeasonalKpisLazy } from "@/features/seasonal/lazy";
import { useAppStore } from "@/state/store";

/**
 * Floating KPI cards for the active module. Food Origins (Stage 2) and Seasonal Supply (Stage 3)
 * show real indicators; other
 * modules name the measure they will show and say when it arrives — no placeholder numbers (P14).
 */
export function KpiStrip() {
  const module = useAppStore((s) => s.module);
  const mod = getModule(module);
  const note =
    mod.release > 1 ? `Planned for Release ${mod.release}` : `Added in build stage ${mod.buildStage}`;

  return (
    <section className="kpi-strip" aria-label={`${mod.label} key figures`}>
      {module === "origins" ? (
        <OriginsKpis />
      ) : module === "seasonal" ? (
        <SeasonalKpisLazy />
      ) : (
        mod.plannedKpis.map((label) => <KpiCard key={label} label={label} state="empty" note={note} />)
      )}
    </section>
  );
}
