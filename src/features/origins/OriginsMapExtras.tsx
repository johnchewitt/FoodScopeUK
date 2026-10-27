import { ChevronDown } from "lucide-react";
import { selectMapModule, useAppStore } from "@/state/store";
import { CLASS_LABELS } from "./legend";
import { formatMeasure } from "./model";
import { useOrigins, useOriginsMapSync } from "./useOrigins";

/** Publishes the Origins map model to the store while the module is open (no UI). */
export function OriginsMapSync() {
  const { model } = useOrigins();
  useOriginsMapSync(model);
  return null;
}

/** Map legend (spec §7.4: units, class scheme and data date; P4 wording). */
export function OriginsLegend() {
  const { model } = useOrigins();
  const breakpoint = useAppStore((s) => s.breakpoint);
  if (!model) return null;
  const maxFlow = model.shares.find((s) => model.map.partners.some((p) => p.key === s.key && p.flow));
  return (
    <details className="map-legend glass" open={breakpoint === "desktop"} key={breakpoint}>
      <summary>
        <span>Legend · {model.periodText}</span>
        <ChevronDown size={14} aria-hidden="true" className="map-legend__chev" />
      </summary>
      <p className="map-legend__title">
        Share of recorded imports ({model.measure === "mass" ? "net mass" : "value"}), fixed classes
      </p>
      <ul className="map-legend__classes">
        {CLASS_LABELS.map((label, i) => (
          <li key={label}>
            <span className="swatch" data-class={i} aria-hidden="true" />
            {label}
          </li>
        ))}
        <li>
          <span className="swatch swatch--none" aria-hidden="true" />
          No recorded imports
        </li>
        <li>
          <span className="swatch swatch--point" aria-hidden="true" />
          Partner too small for outlines
        </li>
      </ul>
      <p className="map-legend__title">Connections to the UK</p>
      <div className="map-legend__flows">
        <span className="flow-sample flow-sample--thin" aria-hidden="true" />
        <span>smallest drawn</span>
        <span className="flow-sample flow-sample--thick" aria-hidden="true" />
        <span>{maxFlow ? formatMeasure(maxFlow.value, model.measure) : "—"}</span>
      </div>
      <p className="map-legend__note">
        Width is linear in {model.measure === "mass" ? "tonnes" : "£"} (1.5–12 px). Lines are symbolic links
        to a single UK point, not shipping routes. Partner = country of dispatch.
      </p>
    </details>
  );
}

/** Tooltip for the partner under the pointer (screen position from the map hit test). */
export function OriginsTooltip() {
  const hover = useAppStore((s) => s.hoverPartner);
  // Consulting Insights (commodity assessment) draws the same trade map.
  const module = useAppStore(selectMapModule);
  const { model } = useOrigins();
  if (!hover || module !== "origins" || !model) return null;
  const partner = model.map.partners.find((p) => p.key === hover.key || p.iso2 === hover.key);
  const row = partner ? model.rows.find((r) => r.key === partner.key) : undefined;
  return (
    <div
      className="map-tooltip glass"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
      role="status"
      data-hover-key={hover.key}
      data-partner-key={partner?.key ?? ""}
    >
      {partner && row ? (
        <>
          <strong>{partner.name}</strong>
          <span>
            {partner.valueText} · rank {row.rank}
          </span>
          <span className="map-tooltip__hint">Recorded import partner · click to select</span>
        </>
      ) : (
        <>
          <strong>{hover.name ?? hover.key}</strong>
          <span>No recorded imports in {model.periodText}</span>
        </>
      )}
    </div>
  );
}
