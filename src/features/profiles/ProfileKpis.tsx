import { formatCount } from "@/analysis/format";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { rateIndicator } from "@/features/access/indicators";
import { describeDataError } from "@/services/data/errors";
import { beyondIndicator, noCarIndicator, populationIndicator, storesIndicator } from "./indicators";
import { useProfile } from "./useProfile";

const PROFILE_KPI_LABELS = [
  "Residents",
  "Mapped grocery stores",
  "Supermarkets per 10,000 residents",
  "Residents > 1 km from a supermarket (straight-line)",
  "Households with no car or van",
];

/** Local Authority Profiles KPI cards. Values come only from provenance-complete indicators. */
export function ProfileKpis() {
  const p = useProfile();
  const c = p.council;
  if (p.status !== "ready" || !c || !p.network) {
    const state = p.status === "error" ? "error" : p.status === "ready" ? "empty" : "loading";
    return PROFILE_KPI_LABELS.map((label) => (
      <KpiCard
        key={label}
        label={label}
        state={state}
        emptyText={state === "empty" ? "No council chosen" : undefined}
        note={p.error ? describeDataError(p.error) : p.status === "ready" ? "Choose a council" : undefined}
      />
    ));
  }
  const sup = p.rates.supermarkets;
  const beyond = p.deep.deep?.beyondSupermarket.find((b) => b.thresholdKm === 1) ?? null;
  const car = c.context?.carAvailability ?? null;
  return (
    <>
      <KpiCard
        label="Residents"
        state="ready"
        indicator={populationIndicator(c)}
        detail={`Mid-2025 · ${c.name}`}
      />
      <KpiCard
        label="Mapped grocery stores"
        state="ready"
        indicator={storesIndicator(c, p.network.total)}
        detail={`${formatCount(p.network.byLayer.supermarket)} supermarkets · June 2026`}
      />
      {sup ? (
        <KpiCard
          label="Supermarkets per 10,000 residents"
          state="ready"
          indicator={rateIndicator(
            "supermarkets",
            sup.per10k,
            sup.stores,
            sup.population,
            `${c.name} (${c.nation})`,
          )}
          detail={`${formatCount(sup.stores)} supermarkets · mid-2025 population`}
        />
      ) : (
        <KpiCard label="Supermarkets per 10,000 residents" state="empty" emptyText="Data unavailable" />
      )}
      {beyond ? (
        <KpiCard
          label="Residents > 1 km from a supermarket (straight-line)"
          state="ready"
          indicator={beyondIndicator(c, beyond, "supermarket")}
          detail="Census 2021 small areas · straight-line"
        />
      ) : (
        <KpiCard
          label="Residents > 1 km from a supermarket (straight-line)"
          state={c.deep && p.deep.status === "loading" ? "loading" : "empty"}
          emptyText="Data unavailable"
          note={c.deep ? undefined : "Small areas for the deep profiles only (Belfast, Manchester)"}
        />
      )}
      {car ? (
        <KpiCard
          label="Households with no car or van"
          state="ready"
          indicator={noCarIndicator(c)}
          detail="Census 2021"
        />
      ) : (
        <KpiCard
          label="Households with no car or van"
          state="empty"
          emptyText="Data unavailable"
          note="Scotland's census (2022) is not included"
        />
      )}
    </>
  );
}
