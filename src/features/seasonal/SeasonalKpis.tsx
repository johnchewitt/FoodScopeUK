import { KpiCard } from "@/components/dashboard/KpiCard";
import { describeDataError } from "@/services/data/errors";
import { useSeasonal } from "./useSeasonal";

/** Seasonal KPI cards for the selected month. Values come only from provenance-complete indicators. */
export function SeasonalKpis() {
  const { status, error, model } = useSeasonal();
  const labels = [
    "Recorded imports",
    "Change vs a year earlier",
    "Top recorded partner",
    "Monthly concentration (HHI)",
  ];
  if (status !== "ready" || !model)
    return (
      <>
        {labels.map((label) => (
          <KpiCard
            key={label}
            label={label}
            state={status === "error" ? "error" : "loading"}
            note={error ? describeDataError(error) : undefined}
          />
        ))}
      </>
    );
  const k = model.kpis;
  return (
    <>
      <KpiCard
        label={`Recorded imports · ${model.monthLabel}`}
        state="ready"
        indicator={k.imports}
        detail={k.importsDetail}
      />
      <KpiCard label={k.changeLabel} state="ready" indicator={k.change} detail={k.changeDetail} />
      <KpiCard label="Top recorded partner" state="ready" indicator={k.top} detail={k.topDetail} />
      <KpiCard label="Monthly concentration (HHI)" state="ready" indicator={k.hhi} detail={k.hhiDetail} />
    </>
  );
}
