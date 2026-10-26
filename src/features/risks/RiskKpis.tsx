import { formatShare } from "@/analysis/format";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import {
  allocatedIndicator,
  councilRankIndicator,
  councilShareIndicator,
  entryShareIndicator,
  nationShareIndicator,
  portIndicator,
  portsTotalIndicator,
  srnDelayIndicator,
  stressShareIndicator,
  topPortShareIndicator,
} from "./indicators";
import { changeText, PORT_MEASURE_LABELS } from "./model";
import { ACCESS_KPI_LABELS, LOGISTICS_KPI_LABELS, PPFI_LABELS, SUPPLY_KPI_LABELS } from "./labels";
import { useRiskAccess, useRiskLogistics, useRiskSupply } from "./useRisk";

function Loading({ labels, error }: { labels: string[]; error: Error | null }) {
  return labels.map((l) => (
    <KpiCard
      key={l}
      label={l}
      state={error ? "error" : "loading"}
      note={error ? describeDataError(error) : undefined}
    />
  ));
}

function SupplyKpis() {
  const { model, error } = useRiskSupply();
  if (!model) return <Loading labels={SUPPLY_KPI_LABELS} error={error} />;
  const k = model.origins.kpis;
  const noData = model.origins.status.noData;
  const state = noData ? "empty" : "ready";
  return (
    <>
      <KpiCard
        label="Recorded imports"
        state={state}
        indicator={k.imports}
        detail={k.importsDetail}
        caution={k.comparisonCaution}
        emptyText="No data for this period"
      />
      <KpiCard
        label="Recorded import partners"
        state={state}
        indicator={k.partners}
        detail={k.partnersDetail}
      />
      <KpiCard label="Top supplier share" state={state} indicator={k.top} detail={k.topDetail} />
      <KpiCard
        label="Partner concentration (HHI)"
        state={state}
        indicator={k.concentration}
        detail={k.concentrationDetail}
        caution={k.comparisonCaution}
      />
      <KpiCard
        label="From high or critical water stress"
        state={state}
        indicator={stressShareIndicator(model)}
        detail={`${formatShare(model.stress.byClass.noData)} from partners without a value · national figures`}
      />
      <KpiCard
        label="Data availability"
        state={state}
        indicator={allocatedIndicator(model)}
        detail={`${model.provisionalMonths} provisional month${model.provisionalMonths === 1 ? "" : "s"} · allocated to a partner country`}
      />
    </>
  );
}

function LogisticsKpis() {
  const { model, error } = useRiskLogistics();
  if (!model) return <Loading labels={LOGISTICS_KPI_LABELS} error={error} />;
  const total = portsTotalIndicator(model);
  const prevTotal = model.totals[model.totals.length - 2] ?? null;
  const lastTotal = model.totals[model.totals.length - 1] ?? null;
  const sel = model.selected;
  return (
    <>
      <KpiCard
        label={sel ? sel.name : "Major ports"}
        state="ready"
        indicator={sel ? portIndicator(sel, model) : total}
        detail={
          sel
            ? `${changeText(sel.latest, sel.previous, model.latestYear - 1)} · ${formatShare(sel.shareOfTotal)} of all major ports`
            : `${PORT_MEASURE_LABELS[model.measure].short}, ${model.ports.length} ports · ${changeText(lastTotal, prevTotal, model.latestYear - 1)}`
        }
      />
      <KpiCard
        label="Largest port"
        state="ready"
        indicator={topPortShareIndicator(model)}
        detail={`${model.ports[0]?.name ?? "—"}, share of ${PORT_MEASURE_LABELS[model.measure].short.toLowerCase()}`}
      />
      <KpiCard
        label="Short Straits share of food imports"
        state="ready"
        indicator={entryShareIndicator(model)}
        detail="Dover, Folkestone and the Channel Tunnel · UKFSR 2024"
      />
      <KpiCard
        label="Road delay (England)"
        state="ready"
        indicator={srnDelayIndicator(model)}
        detail="Strategic Road Network, seconds per vehicle per mile, 12 months"
      />
      <KpiCard
        label="Data availability"
        state="ready"
        indicator={{
          id: "risk.logistics.availability",
          label: "Ports located on the map",
          value: model.ports.filter((p) => p.point).length,
          unit: "ports",
          provenance: "derived",
          sourceIds: ["S23", "S36"],
          referencePeriod: String(model.latestYear),
          coverage: `${model.ports.length} DfT major ports`,
          method:
            "Ports with a map location: DfT's rough location, or EMODnet's for the same UN/LOCODE. Roads cover Great Britain only and railway lines Northern Ireland only; rail freight and distribution centres are not available.",
          scope: "national_context",
        }}
        detail={`of ${model.ports.length} · NI roads, GB rail and depots not available`}
      />
    </>
  );
}

function AccessKpis() {
  const { model, error } = useRiskAccess();
  if (!model) return <Loading labels={ACCESS_KPI_LABELS} error={error} />;
  const label = PPFI_LABELS[model.measure];
  const sel = model.selected;
  // The baseline is the selected council's own nation; otherwise the ranking nation.
  const baseNation = sel ? sel.nation : model.nation;
  const baseShare = model.nationShares.get(baseNation) ?? null;
  const inNation = model.rows.filter((r) => r.nation === model.nation && r.share !== null);
  const above = inNation.filter((r) => r.share! >= 0.4);
  const nationsWithData = new Set(model.rows.filter((r) => r.share !== null).map((r) => r.nation)).size;
  return (
    <>
      {sel ? (
        <KpiCard
          label={`Priority share: ${sel.name}`}
          state={sel.share === null ? "empty" : "ready"}
          indicator={councilShareIndicator(sel, label)}
          detail={`${sel.priority ?? 0} of ${sel.areas} small areas · ${label}`}
          caution={
            sel.fewAreas
              ? `Only ${sel.areas} small areas: one area moves the share by ${formatShare(1 / sel.areas)}.`
              : null
          }
          emptyText="Data unavailable in this nation"
        />
      ) : (
        <KpiCard
          label="Priority share (selected council)"
          state="empty"
          emptyText="Select a council"
          note="Click a council on the map or choose one in the controls."
        />
      )}
      {sel ? (
        <KpiCard
          label="Rank within nation"
          state={sel.rank ? "ready" : "empty"}
          indicator={councilRankIndicator(sel)}
          detail={`Within ${sel.nation} only, highest share first`}
          emptyText="Not ranked (no data)"
        />
      ) : (
        <KpiCard label="Rank within nation" state="empty" emptyText="Select a council" />
      )}
      <KpiCard
        label={`${baseNation}'s share`}
        state={baseShare === null ? "empty" : "ready"}
        indicator={nationShareIndicator(baseNation, baseShare, label)}
        detail={`All small areas of ${baseNation} · the baseline for its councils`}
        emptyText="No data for this measure"
      />
      <KpiCard
        label={`Councils in ${model.nation} at 40 % or more`}
        state={inNation.length === 0 ? "empty" : "ready"}
        indicator={{
          id: "risk.access.councils_above",
          label: `Councils in ${model.nation} with 40 % or more of their small areas in deciles 1–2`,
          value: inNation.length === 0 ? null : above.length,
          unit: "councils",
          provenance: "derived",
          sourceIds: ["S13"],
          referencePeriod: "Priority Places for Food Index v2.1",
          coverage: `Councils in ${model.nation} with data for the measure`,
          method: `Councils of ${model.nation} whose share of small areas in ${model.nation}'s deciles 1–2 is at least 40 %, twice the about 20 % of the nation's areas in those deciles by construction. Counted within one nation only (the ranking nation), never across nations.`,
          scope: "local",
          comparabilityGroup: model.nation,
          ...(inNation.length === 0 ? { missingReason: "not_covered" as const } : {}),
        }}
        detail={`of ${inNation.length} councils · ${label}`}
        emptyText="No data for this measure"
      />
      <KpiCard
        label="Data availability"
        state="ready"
        indicator={{
          id: "risk.access.availability",
          label: "Nations with data for the measure",
          value: nationsWithData,
          unit: "nations",
          provenance: "derived",
          sourceIds: ["S13"],
          referencePeriod: "Priority Places for Food Index v2.1",
          coverage: "England, Wales, Scotland, Northern Ireland",
          method:
            "Nations whose councils have data for the measure. Northern Ireland has no data for supermarket accessibility, online deliveries and fuel poverty.",
          scope: "local",
        }}
        detail={`of 4 · ${model.nations.reduce((s, n) => s + n.areas, 0).toLocaleString("en-GB")} small areas in 361 councils`}
      />
    </>
  );
}

/** Floating KPI cards for the active Risk Explorer view. */
export function RiskKpis() {
  const view = useAppStore((s) => s.riskView);
  return view === "supply" ? <SupplyKpis /> : view === "logistics" ? <LogisticsKpis /> : <AccessKpis />;
}
