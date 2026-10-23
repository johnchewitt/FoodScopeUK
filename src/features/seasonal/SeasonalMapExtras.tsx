import { CalendarX2, ChevronDown } from "lucide-react";
import { formatMonth } from "@/analysis/trade";
import { CLASS_LABELS } from "@/features/origins/legend";
import { formatMeasure } from "@/features/origins/model";
import { useAppStore } from "@/state/store";
import { useSeasonal, useSeasonalMapSync } from "./useSeasonal";

/** Publishes the selected month's map model while Seasonal Supply is open (no UI). */
export function SeasonalMapSync() {
  const { model } = useSeasonal();
  useSeasonalMapSync(model);
  return null;
}

/** Map legend: share classes and the fixed connection-width scale (spec §7.4). */
export function SeasonalLegend() {
  const { model } = useSeasonal();
  const breakpoint = useAppStore((s) => s.breakpoint);
  if (!model) return null;
  const scale = model.flowScale;
  return (
    <details className="map-legend glass" open={breakpoint === "desktop"} key={breakpoint}>
      <summary>
        <span>Legend · {model.monthLabel}</span>
        <ChevronDown size={14} aria-hidden="true" className="map-legend__chev" />
      </summary>
      <p className="map-legend__title">
        Share of the month&rsquo;s recorded imports ({model.measure === "mass" ? "net mass" : "value"}), fixed
        classes
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
      <p className="map-legend__title">Connections to the UK · same scale every month</p>
      <div className="map-legend__flows">
        <span className="flow-sample flow-sample--thin" aria-hidden="true" />
        <span>smallest</span>
        <span className="flow-sample flow-sample--thick" aria-hidden="true" />
        <span>{scale ? formatMeasure(scale.value, model.measure) : "—"}</span>
      </div>
      <p className="map-legend__note">
        Width is linear (1.5–12 px); 12 px is the largest monthly value from one partner since{" "}
        {formatMonth(model.range.first)}
        {scale ? ` (${scale.name}, ${formatMonth(scale.month)})` : ""}. Lines are symbolic links to a single
        UK point, not shipping routes. Partner = country of dispatch.
      </p>
    </details>
  );
}

/** Tooltip for the partner under the pointer, with the selected month's exact values. */
export function SeasonalTooltip() {
  const hover = useAppStore((s) => s.hoverPartner);
  const { model } = useSeasonal();
  if (!hover || !model) return null;
  const partner = model.map.partners.find((p) => p.key === hover.key || p.iso2 === hover.key);
  const row = partner ? model.current?.rows.find((r) => r.key === partner.key) : undefined;
  return (
    <div className="map-tooltip glass" style={{ left: hover.x + 14, top: hover.y + 14 }} role="status">
      {partner && row ? (
        <>
          <strong>{partner.name}</strong>
          <span>
            {partner.valueText} · rank {row.rank} · {model.monthLabel}
          </span>
          <span className="map-tooltip__hint">Recorded import partner · click to select</span>
        </>
      ) : (
        <>
          <strong>{hover.name ?? hover.key}</strong>
          <span>
            {model.available ? `No recorded imports in ${model.monthLabel}` : model.monthUnavailableText}
          </span>
        </>
      )}
    </div>
  );
}

/** Over the map when the selected month has no figures: the empty map is explained, not left blank. */
export function MissingMonthBanner() {
  const { model } = useSeasonal();
  if (!model || model.available) return null;
  return (
    <div className="map-banner glass" role="status">
      <CalendarX2 size={18} aria-hidden="true" />
      <span>
        <strong>{model.monthUnavailableText}.</strong> Nothing is drawn or estimated for this month. Choose a
        published month on the timeline.
      </span>
    </div>
  );
}
