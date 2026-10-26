import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { formatKm, formatPopulation, formatShare, formatTonnes } from "@/analysis/format";
import { CLASS_LABELS } from "@/features/origins/legend";
import { useAppStore } from "@/state/store";
import { INCREASE_LABELS } from "./labels";
import { areaKind } from "./model";
import { useActiveScenario, useScenarioMapSync } from "./useScenario";

/** Publishes the active scenario's map model to the store (ADR-03: store → map). No UI. */
export function ScenarioMapSync() {
  useScenarioMapSync();
  return null;
}

function Legend({ title, children }: { title: string; children: ReactNode }) {
  const breakpoint = useAppStore((s) => s.breakpoint);
  return (
    <details
      className="map-legend glass"
      open={breakpoint === "desktop"}
      key={breakpoint}
      data-legend="scenarios"
    >
      <summary>
        <span>Legend · {title}</span>
        <ChevronDown size={14} aria-hidden="true" className="map-legend__chev" />
      </summary>
      {children}
    </details>
  );
}

function ViewChip() {
  const view = useAppStore((s) => s.scenarioView);
  return (
    <p className="map-legend__note">
      <span className={`chip ${view === "scenario" ? "chip--amber" : ""}`}>
        {view === "scenario" ? "Scenario-modelled" : "Baseline (as published)"}
      </span>
    </p>
  );
}

/** The map legend of the active scenario. */
export function ScenarioLegend() {
  const kind = useAppStore((s) => s.scenarioKind);
  const s = useActiveScenario();
  if (kind === "import") {
    const m = s.import.model;
    if (!m) return null;
    return (
      <Legend title={m.windowLabel}>
        <ViewChip />
        <p className="map-legend__title">Share of recorded imports, fixed classes</p>
        <ul className="map-legend__classes">
          {CLASS_LABELS.map((label, i) => (
            <li key={label}>
              <span className="swatch" data-class={i} aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
        <p className="map-legend__title">Connections to the UK</p>
        <ul className="map-legend__classes map-legend__classes--one">
          <li>
            <span className="flow-sample flow-sample--thick" aria-hidden="true" />
            Recorded (width ∝ baseline scale)
          </li>
          <li>
            <span className="flow-sample flow-sample--ghost" aria-hidden="true" />
            Baseline of the disrupted partner
          </li>
        </ul>
        <p className="map-legend__note">Symbolic links, not routes. Partner = country of dispatch.</p>
      </Legend>
    );
  }
  if (kind === "closure") {
    const m = s.closure.model;
    return (
      <Legend title={m ? m.store.name : "Pick a supermarket"}>
        <ViewChip />
        <p className="map-legend__title">Supermarkets (GEOLYTIX, 280 m² and over)</p>
        <ul className="map-legend__classes map-legend__classes--one">
          <li>
            <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true" className="store-symbol">
              <circle
                cx="6"
                cy="6"
                r="4.6"
                fill="var(--fs-map-store-supermarket)"
                stroke="var(--fs-map-store-outline)"
                strokeWidth="1.2"
              />
            </svg>
            Supermarket (click to close it)
          </li>
          <li>
            <span className="closed-sample" aria-hidden="true">
              ✕
            </span>
            Closed in the scenario
          </li>
          <li>
            <span className="takeover-sample" aria-hidden="true" />
            Becomes the nearest for some areas
          </li>
        </ul>
        <p className="map-legend__title">Extra straight-line distance (area ∝ residents)</p>
        <ul className="map-legend__classes">
          {INCREASE_LABELS.map((l, i) => (
            <li key={l}>
              <span className="swatch" data-risk={i} aria-hidden="true" />
              {l}
            </li>
          ))}
        </ul>
        <p className="map-legend__note">
          Dashed lines link each area to its nearest supermarket: straight lines, not routes or travel time.
        </p>
      </Legend>
    );
  }
  if (kind === "port") {
    const m = s.port.model;
    if (!m) return null;
    return (
      <Legend title={`Ports ${m.year}`}>
        <ViewChip />
        <p className="map-legend__title">Inward tonnage from abroad (area ∝ tonnage)</p>
        <ul className="map-legend__classes map-legend__classes--one">
          <li>
            <span className="port-sample port-sample--large" aria-hidden="true" />
            Major port
          </li>
          <li>
            <span className="port-sample port-sample--ghost" aria-hidden="true" />
            Selected port, baseline
          </li>
          <li>
            <span className="port-sample port-sample--scenario" aria-hidden="true" />
            Selected port, scenario
          </li>
        </ul>
        <p className="map-legend__note">All cargo, not food flows. Port points are rough locations.</p>
      </Legend>
    );
  }
  return (
    <Legend title="National">
      <p className="map-legend__note">
        Defra&rsquo;s UK supply balance has no geography below the UK: this scenario has no map layer.
      </p>
    </Legend>
  );
}

function ImportTooltip() {
  const hover = useAppStore((s) => s.hoverPartner);
  const { import: a } = useActiveScenario();
  const m = a.model;
  if (!hover || !m || !m.result) return null;
  const before = m.result.sharesBefore.find((p) => p.key === hover.key || `${p.key}` === hover.key);
  const after = m.result.sharesAfter.find((p) => p.key === before?.key);
  return (
    <div
      className="map-tooltip glass"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
      role="status"
      data-hover-key={hover.key}
    >
      <strong>{before?.name ?? hover.name ?? hover.key}</strong>
      {before ? (
        <>
          <span>Baseline: {formatShare(before.share)} of recorded imports</span>
          <span>Scenario: {formatShare(after?.share ?? 0)}</span>
        </>
      ) : (
        <span>No recorded imports in {m.windowLabel}</span>
      )}
    </div>
  );
}

function ClosureTooltip() {
  const hoverArea = useAppStore((s) => s.hoverScenario);
  const hoverStore = useAppStore((s) => s.hoverAccess);
  const { closure: c } = useActiveScenario();
  const m = c.model;
  if (hoverArea && m) {
    const a = m.affected.find((x) => x.code === hoverArea.code);
    if (!a) return null;
    return (
      <div
        className="map-tooltip glass"
        style={{ left: hoverArea.x + 14, top: hoverArea.y + 14 }}
        role="status"
        data-hover-area={a.code}
      >
        <strong>{a.name}</strong>
        <span>
          {areaKind(a.code)} · {formatPopulation(a.population, "small_area")} residents (Census {a.census})
        </span>
        <span>
          {formatKm(a.beforeKm)} →{" "}
          {a.afterKm === null ? "no other supermarket in the data" : formatKm(a.afterKm)}
          {a.increaseKm !== null ? ` (+${formatKm(a.increaseKm)})` : ""}
        </span>
        {a.newStore && <span>New nearest: {a.newStore}</span>}
        <span className="map-tooltip__hint">Straight-line, not travel time</span>
      </div>
    );
  }
  if (hoverStore && hoverStore.kind === "store" && c.data.options.length) {
    const id = Number(hoverStore.id);
    const o = c.data.options.find((x) => x.id === id);
    if (!o) return null;
    return (
      <div
        className="map-tooltip glass"
        style={{ left: hoverStore.x + 14, top: hoverStore.y + 14 }}
        role="status"
        data-hover-store={id}
      >
        <strong>{o.name}</strong>
        <span>
          {o.retailer} · {o.council}
        </span>
        <span className="map-tooltip__hint">
          {m?.store.id === id ? "Closed in this scenario" : "Click to close it"}
        </span>
      </div>
    );
  }
  if (hoverStore && hoverStore.kind === "cluster")
    return (
      <div
        className="map-tooltip glass"
        style={{ left: hoverStore.x + 14, top: hoverStore.y + 14 }}
        role="status"
      >
        <strong>{Number(hoverStore.id).toLocaleString("en-GB")} supermarkets</strong>
        <span className="map-tooltip__hint">Click to zoom in</span>
      </div>
    );
  return null;
}

function PortTooltip() {
  const hover = useAppStore((s) => s.hoverRisk);
  const { port: d } = useActiveScenario();
  if (!hover || hover.kind !== "port" || !d.model) return null;
  const o = d.model.ports.find((p) => p.locode === hover.id);
  if (!o) return null;
  return (
    <div
      className="map-tooltip glass"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
      role="status"
      data-hover-port={hover.id}
    >
      <strong>{o.name}</strong>
      <span>
        {formatTonnes(o.international === null ? null : o.international * 1000)} inwards from abroad,{" "}
        {d.model.year}
      </span>
      <span className="map-tooltip__hint">Click to disrupt this port</span>
    </div>
  );
}

export function ScenarioTooltip() {
  const kind = useAppStore((s) => s.scenarioKind);
  return kind === "import" ? (
    <ImportTooltip />
  ) : kind === "closure" ? (
    <ClosureTooltip />
  ) : kind === "port" ? (
    <PortTooltip />
  ) : null;
}
