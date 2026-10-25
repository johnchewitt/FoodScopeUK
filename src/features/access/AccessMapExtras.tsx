import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { formatCount, formatKm, formatPer10k } from "@/analysis/format";
import { STORE_LAYER_LABELS, type StoreLayer } from "@/analysis/retail";
import { REGISTER_GROCERS_MIN_ZOOM } from "@/map/layerIds";
import { selectLocalScale, useAppStore } from "@/state/store";
import { classLabels } from "./model";
import { useAccess, useAccessMapSync } from "./useAccess";

/** Publishes the Food Access map model to the store while the module is open (no UI). */
export function AccessMapSync() {
  const { map } = useAccess();
  useAccessMapSync(map);
  return null;
}

/** Brand-neutral store symbol (SM-04), drawn with the active basemap's map tokens. */
export function StoreSymbol({ layer, size = 12 }: { layer: StoreLayer; size?: number }) {
  const fill = `var(--fs-map-store-${layer})`;
  const stroke = "var(--fs-map-store-outline)";
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" className="store-symbol">
      {layer === "supermarket" ? (
        <circle cx="6" cy="6" r="4.6" fill={fill} stroke={stroke} strokeWidth="1.2" />
      ) : layer === "convenience" ? (
        <rect x="2.4" y="2.4" width="7.2" height="7.2" fill={fill} stroke={stroke} strokeWidth="1.1" />
      ) : (
        <path d="M6 1.6 L10.6 10 L1.4 10 Z" fill={fill} stroke={stroke} strokeWidth="1.1" />
      )}
    </svg>
  );
}

/** Map legend (spec §7.4: units, class scheme and data date; SM-04, SM-06, P7, P12). */
export function AccessLegend() {
  const a = useAccess();
  const breakpoint = useAppStore((s) => s.breakpoint);
  const local = useAppStore(selectLocalScale);
  const storeLayers = useAppStore((s) => s.storeLayers);
  const retailers = useAppStore((s) => s.retailers);
  if (a.status !== "ready" || !a.map || !a.counts) return null;
  const choropleth = a.map.choropleth;
  const labels = classLabels(a.measure);
  return (
    <details className="map-legend map-legend--access glass" open={breakpoint === "desktop"} key={breakpoint}>
      <summary>
        <span>Legend · stores June 2026</span>
        <ChevronDown size={14} aria-hidden="true" className="map-legend__chev" />
      </summary>
      <p className="map-legend__title">
        {storeLayers.length ? "Stores shown" : "No store types shown"}
        {retailers !== null ? ` · ${retailers.length} retailer${retailers.length === 1 ? "" : "s"}` : ""}
      </p>
      <ul className="map-legend__symbols">
        {(["supermarket", "convenience", "other"] as const)
          .filter((l) => storeLayers.includes(l))
          .map((l) => (
            <li key={l}>
              <StoreSymbol layer={l} />
              {STORE_LAYER_LABELS[l].label}
            </li>
          ))}
        <li>
          <span className="cluster-sample" aria-hidden="true">
            12
          </span>
          {local ? "Groups appear when zoomed out" : "Group of nearby stores (count); zoom in for each store"}
        </li>
        {a.grocers && <GrocerLegendItem count={a.grocers.points.length} />}
      </ul>
      {choropleth ? (
        <>
          <p className="map-legend__title">{a.measureDef.label}, councils, fixed classes</p>
          <ul className="map-legend__classes map-legend__classes--one">
            {labels.map((label, i) => (
              <li key={label}>
                <span className="swatch" data-class={i} aria-hidden="true" />
                {label}
                <span className="map-legend__count">{choropleth.classes[i]!.length}</span>
              </li>
            ))}
            <li>
              <span className="swatch swatch--hatch" aria-hidden="true" />
              No data
              <span className="map-legend__count">{choropleth.noData.length}</span>
            </li>
          </ul>
          <p className="map-legend__note">
            {local ? "Outlined at this scale; zoom out for shading. " : ""}Numbers are councils per class.
            Rates use all retailers and ONS mid-2025 population.
          </p>
        </>
      ) : (
        <p className="map-legend__note">Council shading is off. Councils are outlined.</p>
      )}
      {a.nearby && (
        <>
          <p className="map-legend__title">Straight-line proximity</p>
          <p className="map-legend__note">
            <span className="ring-sample" aria-hidden="true" /> {formatKm(a.nearby.radiusM / 1000)} radius and
            straight lines to the nearest stores shown. Not walking or driving routes.
          </p>
        </>
      )}
    </details>
  );
}

/** NI grocer from the FSA register (S29): name, group and place; never counted in rates. */
export function GrocerTooltipBody({
  grocer,
}: {
  grocer: { name: string; group: string | null; town: string | null; postcode: string | null };
}) {
  return (
    <>
      <strong>{grocer.name}</strong>
      <span>
        {grocer.group ?? "Independent grocer"} · {[grocer.town, grocer.postcode].filter(Boolean).join(" ")}
      </span>
      <span className="map-tooltip__hint">FSA register (not in GEOLYTIX); not counted in any rate</span>
    </>
  );
}

/** Legend entry for the NI grocers layer (S29). */
export function GrocerLegendItem({ count }: { count: number }) {
  const zoom = useAppStore((s) => s.mapView?.zoom ?? null);
  const hidden = zoom !== null && zoom < REGISTER_GROCERS_MIN_ZOOM;
  return (
    <li data-hidden-at-scale={hidden || undefined}>
      <span className="grocer-symbol" aria-hidden="true" />
      <span>
        Other NI grocers, FSA register ({formatCount(count)}); not counted
        {hidden && <span className="map-legend__sub">Zoom in to Northern Ireland to see them</span>}
      </span>
    </li>
  );
}

/** Tooltip for the store, cluster or council under the pointer. */
export function AccessTooltip() {
  const hover = useAppStore((s) => s.hoverAccess);
  const module = useAppStore((s) => s.module);
  const a = useAccess();
  if (!hover || module !== "access" || a.status !== "ready") return null;
  let body: ReactNode;
  if (hover.kind === "store") {
    const s = a.stores?.find((x) => String(x.id) === hover.id);
    if (!s) return null;
    body = (
      <>
        <strong>{s.name}</strong>
        <span>
          {s.retailer} · {STORE_LAYER_LABELS[s.layer].label.toLowerCase()}
        </span>
        <span className="map-tooltip__hint">Click for details</span>
      </>
    );
  } else if (hover.kind === "grocer") {
    const g = a.grocersDoc?.features.find((f) => String(f.properties.id) === hover.id);
    if (!g) return null;
    body = <GrocerTooltipBody grocer={g.properties} />;
  } else if (hover.kind === "cluster") {
    body = (
      <>
        <strong>{formatCount(Number(hover.id))} stores</strong>
        <span className="map-tooltip__hint">Click to zoom in</span>
      </>
    );
  } else {
    const row = a.provision?.find((p) => p.code === hover.id);
    if (!row) return null;
    body = (
      <>
        <strong>{row.name}</strong>
        <span>
          {row.per10k === null
            ? "No population figure"
            : `${formatPer10k(row.per10k)} ${a.measureDef.short.toLowerCase()} per 10,000 residents`}{" "}
          · {formatCount(row.stores)} stores
        </span>
        <span className="map-tooltip__hint">Click to select</span>
      </>
    );
  }
  return (
    <div className="map-tooltip glass" style={{ left: hover.x + 14, top: hover.y + 14 }} role="status">
      {body}
    </div>
  );
}
