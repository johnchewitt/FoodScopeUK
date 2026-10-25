import { ChevronDown } from "lucide-react";
import { formatShare } from "@/analysis/format";
import { FARM_BREAKS, FARM_UNITS, STRESS_CLASSES, STRESS_LABELS, type FarmMeasure } from "@/analysis/risk";
import { CLASS_LABELS } from "@/features/origins/legend";
import { formatMeasure } from "@/features/origins/model";
import { useAppStore } from "@/state/store";
import { PORT_MEASURE_LABELS, PRIORITY_CLASS_LABELS } from "./model";
import { FARM_LABELS, PPFI_LABELS } from "./labels";
import {
  useRiskAccess,
  useRiskAccessMapSync,
  useRiskLogistics,
  useRiskLogisticsMapSync,
  useRiskSupply,
  useRiskSupplyMapSync,
} from "./useRisk";

function SupplySync() {
  const { model } = useRiskSupply();
  useRiskSupplyMapSync(model);
  return null;
}

function LogisticsSync() {
  const { model } = useRiskLogistics();
  useRiskLogisticsMapSync(model);
  return null;
}

function AccessSync() {
  const { map } = useRiskAccess();
  useRiskAccessMapSync(map);
  return null;
}

/** Publishes the active view's map model to the store (ADR-03: store → map). No UI. */
export function RiskMapSync() {
  const view = useAppStore((s) => s.riskView);
  return view === "supply" ? <SupplySync /> : view === "logistics" ? <LogisticsSync /> : <AccessSync />;
}

function Legend({ title, children }: { title: string; children: React.ReactNode }) {
  const breakpoint = useAppStore((s) => s.breakpoint);
  return (
    <details
      className="map-legend glass"
      open={breakpoint === "desktop"}
      key={breakpoint}
      data-legend="risks"
    >
      <summary>
        <span>Legend · {title}</span>
        <ChevronDown size={14} aria-hidden="true" className="map-legend__chev" />
      </summary>
      {children}
    </details>
  );
}

function SupplyLegend() {
  const { model } = useRiskSupply();
  if (!model) return null;
  const o = model.origins;
  const maxFlow = o.shares.find((s) => o.map.partners.some((p) => p.key === s.key && p.flow));
  return (
    <Legend title={o.periodText}>
      {model.fill === "stress" ? (
        <>
          <p className="map-legend__title">Partners&rsquo; national water stress (FAO SDG 6.4.2)</p>
          <ul className="map-legend__classes">
            {STRESS_CLASSES.map((c, i) => (
              <li key={c}>
                <span className="swatch" data-risk={i + 1} aria-hidden="true" />
                {STRESS_LABELS[c]}
              </li>
            ))}
            <li>
              <span className="swatch swatch--hatch" aria-hidden="true" />
              No data
            </li>
          </ul>
          <p className="map-legend__note">
            Whole-country figures (mostly 2022); only recorded partners are shaded.
          </p>
        </>
      ) : (
        <>
          <p className="map-legend__title">Share of recorded imports, fixed classes</p>
          <ul className="map-legend__classes">
            {CLASS_LABELS.map((label, i) => (
              <li key={label}>
                <span className="swatch" data-class={i} aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="map-legend__title">Connections to the UK</p>
      <div className="map-legend__flows">
        <span className="flow-sample flow-sample--thin" aria-hidden="true" />
        <span>smallest drawn</span>
        <span className="flow-sample flow-sample--thick" aria-hidden="true" />
        <span>{maxFlow ? formatMeasure(maxFlow.value, o.measure) : "—"}</span>
      </div>
      <p className="map-legend__note">Symbolic links, not routes. Partner = country of dispatch.</p>
    </Legend>
  );
}

function farmClassLabels(measure: FarmMeasure): string[] {
  const b = FARM_BREAKS[measure];
  const f = (v: number) => (measure === "wheat" ? `${v} %` : v.toLocaleString("en-GB"));
  return [
    `Below ${f(b[0])}`,
    `${f(b[0])} – ${f(b[1])}`,
    `${f(b[1])} – ${f(b[2])}`,
    `${f(b[2])} – ${f(b[3])}`,
    `${f(b[3])} and over`,
  ];
}

function LogisticsLegend() {
  const { model } = useRiskLogistics();
  const roads = useAppStore((s) => s.roads);
  if (!model) return null;
  const farm = model.farmingMeasure;
  return (
    <Legend title={`Ports ${model.latestYear}`}>
      <p className="map-legend__title">{PORT_MEASURE_LABELS[model.measure].short} (area ∝ tonnage)</p>
      <ul className="map-legend__classes">
        <li>
          <span className="port-sample port-sample--large" aria-hidden="true" />
          Major port
        </li>
        <li>
          <span className="port-sample port-sample--entry" aria-hidden="true" />
          UKFSR food entry point
        </li>
        <li>
          <span className="port-sample port-sample--empty" aria-hidden="true" />
          No tonnage for the measure
        </li>
      </ul>
      {roads && (
        <>
          <p className="map-legend__title">Road corridors (Great Britain)</p>
          <ul className="map-legend__classes">
            <li>
              <span className="road-sample road-sample--strategic" aria-hidden="true" />
              Motorway or trunk
            </li>
            <li>
              <span className="road-sample road-sample--primary" aria-hidden="true" />
              Primary A road
            </li>
          </ul>
        </>
      )}
      {farm && (
        <>
          <p className="map-legend__title">
            {FARM_LABELS[farm]}: {FARM_UNITS[farm]}
            {model.farmingYear ? `, June ${model.farmingYear}` : ""}
          </p>
          <ul className="map-legend__classes">
            {farmClassLabels(farm).map((l, i) => (
              <li key={l}>
                <span className="swatch" data-class={i + 1} aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="map-legend__note">
        Tonnage of all cargo, not food flows. Port points are rough locations.
      </p>
    </Legend>
  );
}

function AccessLegend() {
  const { model } = useRiskAccess();
  if (!model) return null;
  return (
    <Legend title={PPFI_LABELS[model.measure]}>
      <p className="map-legend__title">Council&rsquo;s small areas in its own nation&rsquo;s deciles 1–2</p>
      <ul className="map-legend__classes">
        {PRIORITY_CLASS_LABELS.map((l, i) => (
          <li key={l}>
            <span className="swatch" data-risk={i} aria-hidden="true" />
            {l}
          </li>
        ))}
        <li>
          <span className="swatch swatch--hatch" aria-hidden="true" />
          No data (Northern Ireland, three domains)
        </li>
      </ul>
      <p className="map-legend__note">
        About 20 % of each nation&rsquo;s areas by construction. Compare within a nation only.
      </p>
    </Legend>
  );
}

export function RiskLegend() {
  const view = useAppStore((s) => s.riskView);
  return view === "supply" ? <SupplyLegend /> : view === "logistics" ? <LogisticsLegend /> : <AccessLegend />;
}

function SupplyTooltip() {
  const hover = useAppStore((s) => s.hoverPartner);
  const { model } = useRiskSupply();
  if (!hover || !model) return null;
  const o = model.origins;
  const partner = o.map.partners.find((p) => p.key === hover.key || p.iso2 === hover.key);
  const row = partner ? o.rows.find((r) => r.key === partner.key) : undefined;
  const stress = partner ? model.stressOf.get(partner.key) : undefined;
  return (
    <div
      className="map-tooltip glass"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
      role="status"
      data-hover-key={hover.key}
    >
      {partner && row ? (
        <>
          <strong>{partner.name}</strong>
          <span>
            {partner.valueText} · rank {row.rank}
          </span>
          <span>
            Water stress:{" "}
            {stress
              ? `${STRESS_LABELS[stress.class].split(" (")[0]} (${formatShare(stress.value / 100)}, ${stress.year})`
              : "no data"}
          </span>
          <span className="map-tooltip__hint">Click to show its estimated exposure</span>
        </>
      ) : (
        <>
          <strong>{hover.name ?? hover.key}</strong>
          <span>No recorded imports in {o.periodText}</span>
        </>
      )}
    </div>
  );
}

function LogisticsTooltip() {
  const hover = useAppStore((s) => s.hoverRisk);
  const { model } = useRiskLogistics();
  if (!hover || !model || hover.kind !== "port") return null;
  const port = model.map.ports.find((p) => p.locode === hover.id);
  const row = model.ports.find((p) => p.locode === hover.id);
  if (!port || !row) return null;
  return (
    <div
      className="map-tooltip glass"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
      role="status"
      data-hover-port={hover.id}
    >
      <strong>{port.name}</strong>
      <span>{port.valueText}</span>
      <span>{formatShare(row.shareOfTotal)} of all major ports</span>
      {row.foodEntry.length > 0 && <span>UKFSR food entry point: {row.foodEntry.join(", ")}</span>}
      <span className="map-tooltip__hint">Click to select</span>
    </div>
  );
}

function AccessTooltip() {
  const hover = useAppStore((s) => s.hoverAccess);
  const { model } = useRiskAccess();
  if (!hover || !model || hover.kind !== "council") return null;
  const row = model.byCode.get(hover.id);
  if (!row) return null;
  return (
    <div
      className="map-tooltip glass"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
      role="status"
      data-hover-council={hover.id}
    >
      <strong>
        {row.name} ({row.nation})
      </strong>
      <span>
        {row.share === null
          ? "No data for this measure"
          : `${formatShare(row.share)} of its ${row.areas} small areas in deciles 1–2`}
      </span>
      {row.rank && (
        <span>
          Rank {row.rank.rank}
          {row.rank.tied ? "=" : ""} of {row.rank.of} in {row.nation}
        </span>
      )}
      <span className="map-tooltip__hint">Click to select</span>
    </div>
  );
}

export function RiskTooltip() {
  const view = useAppStore((s) => s.riskView);
  return view === "supply" ? (
    <SupplyTooltip />
  ) : view === "logistics" ? (
    <LogisticsTooltip />
  ) : (
    <AccessTooltip />
  );
}
