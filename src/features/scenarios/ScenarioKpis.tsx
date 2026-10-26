import { useEffect, useRef, useState } from "react";
import { formatByUnit } from "@/analysis/format";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { describeDataError } from "@/services/data/errors";
import { SCENARIO_LETTERS } from "@/state/scenarioParams";
import { useAppStore } from "@/state/store";
import type { ScenarioKind } from "@/state/urlState";
import { KPI_LABELS, shortLabelOf } from "./kpiLabels";
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
    <KpiCard
      key={l.label}
      label={l.label}
      shortLabel={l.short}
      state={state}
      note={note}
      emptyText="Not computed"
    />
  ));
}

function Cards({ kind, headlines }: { kind: ScenarioKind; headlines: Headline[] }) {
  return headlines.map((h, i) => (
    <KpiCard
      key={h.id}
      label={h.label}
      shortLabel={shortLabelOf(kind, i)}
      state={h.indicator.value === null && !h.indicator.missingReason ? "empty" : "ready"}
      indicator={h.indicator}
      detail={h.detail}
    />
  ));
}

/** The words a screen reader hears for a headline value ("—" would be read as "dash"). */
function spoken(h: Headline): string {
  return h.indicator.value === null ? "not available" : formatByUnit(h.indicator.value, h.indicator.unit);
}

/**
 * Announces the updated result once the settings rest (WCAG 4.1.3 status messages): a slider
 * or preset changes every card without moving focus, so screen-reader users would not otherwise
 * know the figures changed. Not on first display; debounced so a drag gives one announcement.
 */
export const ANNOUNCE_DELAY_MS = 800;

function ResultAnnouncer({ kind, headlines }: { kind: ScenarioKind; headlines: Headline[] | null }) {
  const text = headlines?.length
    ? headlines
        .slice(0, 2)
        .map((h) => `${h.label}: ${spoken(h)}`)
        .join("; ")
    : "";
  const [said, setSaid] = useState("");
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!text) return;
    if (shown.current === null) {
      shown.current = text; // first result on screen: nothing changed yet
      return;
    }
    if (text === shown.current) return;
    const t = setTimeout(() => {
      shown.current = text;
      setSaid(`Scenario ${SCENARIO_LETTERS[kind]} updated. ${text}.`);
    }, ANNOUNCE_DELAY_MS);
    return () => clearTimeout(t);
  }, [kind, text]);
  return (
    <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {said}
    </p>
  );
}

function headlinesOf(s: ReturnType<typeof useActiveScenario>, kind: ScenarioKind): Headline[] | null {
  switch (kind) {
    case "import":
      return s.import.model?.result?.used.length ? s.import.model.headlines : null;
    case "closure":
      return s.closure.model?.headlines ?? null;
    case "production":
      return s.production.model?.status === "published" ? s.production.model.headlines : null;
    case "port":
      return s.port.model?.selected ? s.port.model.headlines : null;
  }
}

/** Baseline → scenario key figures (SC-03): the scenario value, with the baseline in the detail line. */
export function ScenarioKpis() {
  const kind = useAppStore((s) => s.scenarioKind);
  const s = useActiveScenario();
  return (
    <>
      <KpiCards kind={kind} s={s} />
      <ResultAnnouncer kind={kind} headlines={headlinesOf(s, kind)} />
    </>
  );
}

function KpiCards({ kind, s }: { kind: ScenarioKind; s: ReturnType<typeof useActiveScenario> }) {
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
      return <Cards kind={kind} headlines={a.model.headlines} />;
    }
    case "closure": {
      const c = s.closure;
      if (c.status === "error")
        return <Placeholder kind={kind} state="error" note={describeDataError(c.error)} />;
      if (c.status === "loading") return <Placeholder kind={kind} state="loading" />;
      if (!c.model) return <Placeholder kind={kind} state="empty" note="Pick a supermarket to close" />;
      return <Cards kind={kind} headlines={c.model.headlines} />;
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
      return <Cards kind={kind} headlines={p.model.headlines} />;
    }
    case "port": {
      const d = s.port;
      if (d.status === "error")
        return <Placeholder kind={kind} state="error" note={describeDataError(d.error)} />;
      if (!d.model) return <Placeholder kind={kind} state="loading" />;
      if (!d.model.selected) return <Placeholder kind={kind} state="empty" note="Choose a port" />;
      return <Cards kind={kind} headlines={d.model.headlines} />;
    }
  }
}
