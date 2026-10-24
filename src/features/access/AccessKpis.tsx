import { formatCount } from "@/analysis/format";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import { densityIndicator, mappedStoresIndicator, rateIndicator } from "./indicators";
import { useAccess } from "./useAccess";

const ACCESS_KPI_LABELS = [
  "Mapped stores",
  "Per 10,000 residents",
  "Per km² of land",
  "Population beyond threshold (straight-line)",
];

/** UK Food Access KPI cards. Values come only from provenance-complete indicators. */
export function AccessKpis() {
  const a = useAccess();
  const storeLayers = useAppStore((s) => s.storeLayers);
  const retailers = useAppStore((s) => s.retailers);
  const beyond = (
    <KpiCard
      key="beyond"
      label={ACCESS_KPI_LABELS[3]!}
      state="empty"
      note="Needs small-area population: added with Local Authority Profiles (build stage 5)"
    />
  );
  if (a.status !== "ready" || !a.shown || !a.stores || !a.totals) {
    const state = a.status === "error" ? "error" : "loading";
    return (
      <>
        {ACCESS_KPI_LABELS.slice(0, 3).map((label) => (
          <KpiCard
            key={label}
            label={label}
            state={state}
            note={a.error ? describeDataError(a.error) : undefined}
          />
        ))}
        {beyond}
      </>
    );
  }
  const c = a.council;
  const area = c ? `${c.name} (${c.nation})` : "United Kingdom (361 councils)";
  const p = c ? c.provision[a.measure] : null;
  const uk = a.totals.uk;
  const rate = p
    ? rateIndicator(a.measure, p.per10k, p.stores, c!.population, area)
    : rateIndicator(a.measure, uk.per10k, uk.stores, uk.population, area);
  const density = p
    ? densityIndicator(a.measure, p.perKm2, p.stores, c!.landAreaKm2, area)
    : densityIndicator(a.measure, uk.perKm2, uk.stores, uk.landAreaKm2, area);
  return (
    <>
      <KpiCard
        label="Mapped stores"
        state="ready"
        indicator={mappedStoresIndicator(a.shown.length, storeLayers, retailers)}
        detail={`of ${formatCount(a.stores.length)} in the data · June 2026`}
      />
      <KpiCard
        label="Per 10,000 residents"
        state="ready"
        indicator={rate}
        detail={`${a.measureDef.short} · ${c ? c.name : "United Kingdom"}`}
      />
      <KpiCard
        label="Per km² of land"
        state="ready"
        indicator={density}
        detail={`${a.measureDef.short} · ${c ? c.name : "United Kingdom"}`}
      />
      {beyond}
    </>
  );
}
