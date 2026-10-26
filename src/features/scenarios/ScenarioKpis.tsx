import { KpiCard } from "@/components/dashboard/KpiCard";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import type { ScenarioKind } from "@/state/urlState";
import { KPI_LABELS } from "./kpiLabels";
import type { Headline } from "./model";
import { useActiveScenario } from "./useScenario";

function Placeholder({
  kind,
  state,
  note,
}: {
  kind: ScenarioKind;
  state: "loading" | "empty" | "error";
  note?: string;
}) {
  return KPI_LABELS[kind].map((l) => (
    <KpiCard key={l} label={l} state={state} note={note} emptyText="Not computed" />
  ));
}

function Cards({ headlines }: { headlines: Headline[] }) {
  return headlines.map((h) => (
    <KpiCard
      key={h.id}
      label={h.label}
      state={h.indicator.value === null && !h.indicator.missingReason ? "empty" : "ready"}
      indicator={h.indicator}
      detail={h.detail}
    />
  ));
}

/** Baseline → scenario key figures (SC-03): the scenario value, with the baseline in the detail line. */
export function ScenarioKpis() {
  const kind = useAppStore((s) => s.scenarioKind);
  const s = useActiveScenario();
  switch (kind) {
    case "import": {
      const a = s.import;
      if (a.status === "error")
        return <Placeholder kind={kind} state="error" note={describeDataError(a.error)} />;
      if (!a.model) return <Placeholder kind={kind} state="loading" />;
      if (!a.model.result || a.model.result.used.length === 0)
        return (
          <Placeholder kind={kind} state="empty" note="No month of the scenario is in the trade snapshot" />
        );
      return <Cards headlines={a.model.headlines} />;
    }
    case "closure": {
      const c = s.closure;
      if (c.status === "error")
        return <Placeholder kind={kind} state="error" note={describeDataError(c.error)} />;
      if (c.status === "loading") return <Placeholder kind={kind} state="loading" />;
      if (!c.model) return <Placeholder kind={kind} state="empty" note="Pick a supermarket to close" />;
      return <Cards headlines={c.model.headlines} />;
    }
    case "production": {
      const p = s.production;
      if (p.status === "error")
        return <Placeholder kind={kind} state="error" note={describeDataError(p.error)} />;
      if (!p.model) return <Placeholder kind={kind} state="loading" />;
      if (p.model.status !== "published")
        return (
          <Placeholder
            kind={kind}
            state="empty"
            note="Defra publishes no UK supply balance for this basket"
          />
        );
      return <Cards headlines={p.model.headlines} />;
    }
    case "port": {
      const d = s.port;
      if (d.status === "error")
        return <Placeholder kind={kind} state="error" note={describeDataError(d.error)} />;
      if (!d.model) return <Placeholder kind={kind} state="loading" />;
      if (!d.model.selected) return <Placeholder kind={kind} state="empty" note="Choose a port" />;
      return <Cards headlines={d.model.headlines} />;
    }
  }
}
