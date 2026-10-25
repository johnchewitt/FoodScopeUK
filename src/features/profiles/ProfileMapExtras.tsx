import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { formatCount, formatKm, formatShare } from "@/analysis/format";
import {
  breakLabels,
  DECILE_CLASS_LABELS,
  DISTANCE_BREAKS_KM,
  NO_CAR_BREAKS,
  noCarShare,
} from "@/analysis/profile";
import { STORE_LAYER_LABELS } from "@/analysis/retail";
import { GrocerLegendItem, GrocerTooltipBody, StoreSymbol } from "@/features/access/AccessMapExtras";
import { useAppStore } from "@/state/store";
import { AREA_MEASURE_LABELS, ppfiDecile, ppfiDomainOf } from "./model";
import { useProfile, useProfileMapSync } from "./useProfile";

/** Publishes the profile's map models while the module is open (no UI). */
export function ProfileMapSync() {
  const p = useProfile();
  useProfileMapSync(p);
  return null;
}

/** Class labels for the small-area measure (fixed classes, last = most salient). */
function measureClassLabels(measure: ReturnType<typeof useAppStore.getState>["areaMeasure"]): string[] {
  if (measure === "no-car") return breakLabels(NO_CAR_BREAKS, (v) => formatShare(v));
  if (measure === "distance") return breakLabels(DISTANCE_BREAKS_KM, (v) => formatKm(v));
  return DECILE_CLASS_LABELS;
}

/** Map legend (spec §7.4: units, class scheme, data date; LP-06, P7, P12). */
export function ProfileLegend() {
  const p = useProfile();
  const breakpoint = useAppStore((s) => s.breakpoint);
  const storeLayers = useAppStore((s) => s.storeLayers);
  const measure = useAppStore((s) => s.areaMeasure);
  if (p.status !== "ready" || !p.map) return null;
  const am = p.areaMap;
  const labels = measureClassLabels(measure);
  const counts = am ? labels.map((_, i) => am.areas.filter((a) => am.classOf[a.code] === i).length) : [];
  const noData = am ? am.areas.filter((a) => (am.classOf[a.code] ?? null) === null).length : 0;
  const deep = p.deep.deep;
  return (
    <details className="map-legend map-legend--access glass" open={breakpoint === "desktop"} key={breakpoint}>
      <summary>
        <span>Legend · {p.council ? p.council.name : "UK councils"}</span>
        <ChevronDown size={14} aria-hidden="true" className="map-legend__chev" />
      </summary>
      <ul className="map-legend__symbols">
        <li>
          <span
            className={`council-sample${p.council ? " council-sample--selected" : ""}`}
            aria-hidden="true"
          />
          {p.council ? "Selected council (May 2025)" : "Council boundaries (May 2025)"}
        </li>
        {p.map.compareCouncils.length > 0 && (
          <li>
            <span className="council-sample council-sample--compare" aria-hidden="true" />
            Comparison councils
          </li>
        )}
        {(["supermarket", "convenience", "other"] as const)
          .filter((l) => storeLayers.includes(l))
          .map((l) => (
            <li key={l}>
              <StoreSymbol layer={l} />
              {STORE_LAYER_LABELS[l].label}
            </li>
          ))}
        {p.map.grocers && <GrocerLegendItem count={p.map.grocers.points.length} />}
      </ul>
      {am && deep && (
        <>
          <p className="map-legend__title">{AREA_MEASURE_LABELS[measure]}</p>
          <ul className="map-legend__classes map-legend__classes--one">
            {labels
              .map((label, i) => ({ label, i }))
              .reverse()
              .map(({ label, i }) => (
                <li key={label}>
                  <span className="swatch" data-class={am.firstColour + i} aria-hidden="true" />
                  {label}
                  <span className="map-legend__count">{counts[i]}</span>
                </li>
              ))}
            <li>
              <span className="swatch swatch--hatch" aria-hidden="true" />
              No data
              <span className="map-legend__count">{noData}</span>
            </li>
          </ul>
          <p className="map-legend__note">
            {ppfiDomainOf(measure) || measure === "deprivation"
              ? `Deciles within ${measure === "deprivation" ? deep.profile.deprivation.within : deep.profile.ppfi.within}; 1 = ${measure === "deprivation" ? "most deprived" : "highest priority"}. `
              : measure === "distance"
                ? "Straight-line from each area's population-weighted centroid. "
                : "Census 2021 households. "}
            Numbers are small areas per class; fixed classes.
          </p>
        </>
      )}
    </details>
  );
}

/** Tooltip for the small area, store, NI grocer or council under the pointer. */
export function ProfileTooltip() {
  const hoverArea = useAppStore((s) => s.hoverArea);
  const hover = useAppStore((s) => s.hoverAccess);
  const measure = useAppStore((s) => s.areaMeasure);
  const p = useProfile();
  if (p.status !== "ready") return null;
  let body: ReactNode = null;
  let at: { x: number; y: number } | null = null;
  const d = p.deep.deep;
  if (hoverArea && d) {
    at = hoverArea;
    const census = d.areas.find((a) => a.code === hoverArea.code);
    const ppfi = d.ppfi.find((x) => x.code === hoverArea.code);
    const dep = d.deprivation.find((x) => x.code === hoverArea.code);
    const domain = ppfiDomainOf(measure);
    let value = "";
    if (domain && ppfi) {
      const dec = ppfiDecile(ppfi.ppfi, domain);
      value = dec === null ? "PPFI: data unavailable" : `PPFI decile ${dec} of 10 (1 = highest priority)`;
    } else if (measure === "deprivation" && dep)
      value = `Deprivation decile ${dep.decile} of 10 (1 = most deprived)`;
    else if (measure === "no-car" && census) {
      const s = noCarShare(census.households, census.noCarHouseholds);
      value =
        s === null ? "No car or van: data unavailable" : `${formatShare(s)} of households with no car or van`;
    } else if (measure === "distance" && census)
      value =
        census.toSupermarket === null
          ? "Distance: data unavailable"
          : `${formatKm(census.toSupermarket / 1000)} straight-line to the nearest supermarket`;
    body = (
      <>
        <strong>{census?.name ?? ppfi?.name ?? dep?.name ?? hoverArea.code}</strong>
        <span>{value}</span>
        {census && <span>{formatCount(census.population)} residents (Census 2021)</span>}
        <span className="map-tooltip__hint">Click for details</span>
      </>
    );
  } else if (hover) {
    at = hover;
    if (hover.kind === "store") {
      const s = p.access.stores?.find((x) => String(x.id) === hover.id);
      if (s)
        body = (
          <>
            <strong>{s.name}</strong>
            <span>
              {s.retailer} · {STORE_LAYER_LABELS[s.layer].label.toLowerCase()}
            </span>
          </>
        );
    } else if (hover.kind === "grocer") {
      const g = p.access.grocersDoc?.features.find((f) => String(f.properties.id) === hover.id);
      if (g) body = <GrocerTooltipBody grocer={g.properties} />;
    } else if (hover.kind === "cluster") {
      body = (
        <>
          <strong>{formatCount(Number(hover.id))} stores</strong>
          <span className="map-tooltip__hint">Click to zoom in</span>
        </>
      );
    } else {
      const c = p.councils?.find((x) => x.code === hover.id);
      if (c)
        body = (
          <>
            <strong>{c.name}</strong>
            <span>
              {c.nation} · {c.code}
              {c.deep ? " · deep profile" : ""}
            </span>
            <span className="map-tooltip__hint">Click to open its profile</span>
          </>
        );
    }
  }
  if (!body || !at) return null;
  return (
    <div className="map-tooltip glass" style={{ left: at.x + 14, top: at.y + 14 }} role="status">
      {body}
    </div>
  );
}
