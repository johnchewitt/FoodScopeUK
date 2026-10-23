import { KpiCard } from "@/components/dashboard/KpiCard";
import { describeDataError } from "@/services/data/errors";
import { useOrigins } from "./useOrigins";

/** Food Origins KPI cards (FO-05). Values come only from provenance-complete indicators. */
export function OriginsKpis() {
  const { status, error, model } = useOrigins();
  const labels = [
    "Recorded imports",
    "Recorded import partners",
    "Top recorded partner",
    "Partner concentration (HHI)",
  ];

  if (status !== "ready" || !model) {
    const state = status === "error" ? "error" : "loading";
    return (
      <>
        {labels.map((label) => (
          <KpiCard
            key={label}
            label={label}
            state={state}
            note={error ? describeDataError(error) : undefined}
          />
        ))}
      </>
    );
  }
  const k = model.kpis;
  return (
    <>
      <KpiCard
        label="Recorded imports"
        state="ready"
        indicator={k.imports}
        detail={k.importsDetail}
        caution={k.comparisonCaution}
      />
      <KpiCard
        label="Recorded import partners"
        state="ready"
        indicator={k.partners}
        detail={k.partnersDetail}
      />
      <KpiCard label="Top recorded partner" state="ready" indicator={k.top} detail={k.topDetail} />
      <KpiCard
        label="Partner concentration (HHI)"
        state="ready"
        indicator={k.concentration}
        detail={k.concentrationDetail}
        caution={k.comparisonCaution}
      />
    </>
  );
}
