import { Crosshair, LocateFixed, MapPin, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { formatCount, formatKm } from "@/analysis/format";
import {
  PROVISION,
  retailerCounts,
  searchStores,
  STORE_LAYER_LABELS,
  STORE_LAYERS,
  type ProvisionMeasure,
} from "@/analysis/retail";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonLines } from "@/components/states/Skeleton";
import { describeDataError } from "@/services/data/errors";
import { PROXIMITY_RADIUS_KM_MAX, useAppStore } from "@/state/store";
import type { CouncilLayer } from "@/state/urlState";
import { StoreSymbol } from "./AccessMapExtras";
import type { AccessStore } from "./model";
import { useAccess } from "./useAccess";

const INITIAL_RETAILERS = 12;
/** Zoom for a store found by search: street level. */
export const STORE_ZOOM = 15;

const COUNCIL_LAYERS: { id: CouncilLayer; label: string }[] = [
  { id: "supermarkets", label: "Supermarkets" },
  { id: "convenience", label: "Convenience" },
  { id: "all", label: "All" },
  { id: "off", label: "Off" },
];

/** Store search by name, town or postcode within the dataset (SM-05). */
function StoreSearch({ stores }: { stores: readonly AccessStore[] }) {
  const [query, setQuery] = useState("");
  const selectStore = useAppStore((s) => s.selectStore);
  const issue = useAppStore((s) => s.issueMapCommand);
  const results = useMemo(() => searchStores(stores, query, 8), [stores, query]);
  const listId = useId();
  const pick = (s: AccessStore) => {
    selectStore(s.id);
    issue({ type: "goToPoint", center: [s.lon, s.lat], zoom: STORE_ZOOM });
    setQuery("");
  };
  return (
    <section className="panel-section" aria-labelledby="store-search-heading">
      <h3 id="store-search-heading" className="panel-section__title">
        Find a store
      </h3>
      <label className="search-field">
        <Search size={15} aria-hidden="true" />
        <span className="visually-hidden">Store name, town or postcode</span>
        <input
          type="search"
          className="search-field__input"
          placeholder="Name, town or postcode"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-controls={query.trim().length >= 2 ? listId : undefined}
          autoComplete="off"
        />
      </label>
      {query.trim().length >= 2 && (
        <ul id={listId} className="search-results" aria-label="Matching stores" aria-live="polite">
          {results.length === 0 ? (
            <li className="empty-line">No store matches “{query.trim()}” in the GEOLYTIX data.</li>
          ) : (
            results.map((s) => (
              <li key={s.id}>
                <button type="button" className="search-results__item" onClick={() => pick(s)}>
                  <StoreSymbol layer={s.layer} />
                  <span>
                    <span className="search-results__name">{s.name}</span>
                    <span className="search-results__meta">
                      {[s.town, s.postcode].filter(Boolean).join(" · ") || s.retailer}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </section>
  );
}

function StoreTypes({ counts }: { counts: NonNullable<ReturnType<typeof useAccess>["counts"]> }) {
  const storeLayers = useAppStore((s) => s.storeLayers);
  const toggle = useAppStore((s) => s.toggleStoreLayer);
  const niGrocers = useAppStore((s) => s.niGrocers);
  const setNiGrocers = useAppStore((s) => s.setNiGrocers);
  return (
    <section className="panel-section" aria-labelledby="store-types-heading">
      <h3 id="store-types-heading" className="panel-section__title">
        Store types
      </h3>
      <ul className="check-list">
        {STORE_LAYERS.map((l) => (
          <li key={l}>
            <label className="check-row">
              <input type="checkbox" checked={storeLayers.includes(l)} onChange={() => toggle(l)} />
              <StoreSymbol layer={l} size={13} />
              <span className="check-row__text">
                <span>{STORE_LAYER_LABELS[l].label}</span>
                <span className="check-row__hint">{STORE_LAYER_LABELS[l].detail}</span>
              </span>
              <span className="check-row__count" title="Stores in the data (GEOLYTIX, June 2026)">
                {formatCount(counts[l].total)}
              </span>
            </label>
          </li>
        ))}
        <li>
          <label className="check-row">
            <input type="checkbox" checked={niGrocers} onChange={() => setNiGrocers(!niGrocers)} />
            <span className="grocer-symbol" aria-hidden="true" />
            <span className="check-row__text">
              <span>Other NI grocers (FSA register)</span>
              <span className="check-row__hint">
                Northern Ireland grocers GEOLYTIX does not map; never counted in any rate
              </span>
            </span>
          </label>
        </li>
      </ul>
      <p className="control-hint">
        Size bands and formats from the GEOLYTIX fields (decision D5). Wholesale and mainly non-food stores
        are not included.
      </p>
    </section>
  );
}

function Retailers({ stores }: { stores: readonly AccessStore[] }) {
  const storeLayers = useAppStore((s) => s.storeLayers);
  const retailers = useAppStore((s) => s.retailers);
  const setRetailers = useAppStore((s) => s.setRetailers);
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => retailerCounts(stores, storeLayers), [stores, storeLayers]);
  const all = useMemo(() => [...new Set(stores.map((s) => s.retailer))].sort(), [stores]);
  const shownRows = showAll ? rows : rows.slice(0, INITIAL_RETAILERS);
  const isOn = (r: string) => retailers === null || retailers.includes(r);
  const toggle = (r: string) => {
    const current = retailers ?? all;
    const next = current.includes(r) ? current.filter((x) => x !== r) : [...current, r];
    setRetailers(next.length === all.length ? null : next);
  };
  return (
    <section className="panel-section" aria-labelledby="retailers-heading">
      <div className="panel-section__head">
        <h3 id="retailers-heading" className="panel-section__title">
          Retailers
        </h3>
        <div className="text-btn-row">
          <button
            type="button"
            className="text-btn"
            onClick={() => setRetailers(null)}
            disabled={retailers === null}
          >
            All
          </button>
          <button
            type="button"
            className="text-btn"
            onClick={() => setRetailers([])}
            disabled={retailers?.length === 0}
          >
            None
          </button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="empty-line">Choose a store type to list its retailers.</p>
      ) : (
        <ul className="check-list check-list--dense" aria-label="Retailers, with stores in the types shown">
          {shownRows.map((r) => (
            <li key={r.retailer}>
              <label className="check-row">
                <input type="checkbox" checked={isOn(r.retailer)} onChange={() => toggle(r.retailer)} />
                <span className="check-row__text">{r.retailer}</span>
                <span className="check-row__count">{formatCount(r.stores)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {rows.length > INITIAL_RETAILERS && (
        <button type="button" className="text-btn" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${rows.length} retailers`}
        </button>
      )}
      <p className="control-hint">Counts are stores of the types shown. Symbols are brand-neutral.</p>
    </section>
  );
}

function CouncilShading() {
  const councilLayer = useAppStore((s) => s.councilLayer);
  const setCouncilLayer = useAppStore((s) => s.setCouncilLayer);
  return (
    <section className="panel-section" aria-labelledby="council-layer-heading">
      <h3 id="council-layer-heading" className="panel-section__title">
        Council shading
      </h3>
      <div className="segmented segmented--fill" role="radiogroup" aria-labelledby="council-layer-heading">
        {COUNCIL_LAYERS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={councilLayer === c.id}
            title={c.id === "off" ? "Outlines only" : PROVISION[c.id as ProvisionMeasure].label}
            onClick={() => setCouncilLayer(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="control-hint">
        {councilLayer === "off"
          ? "Councils are outlined only."
          : `${PROVISION[councilLayer].label}, in fixed classes so maps stay comparable. Shaded at national and regional scale.`}
      </p>
    </section>
  );
}

/** Straight-line proximity tool (SM-07, P7). */
function Proximity() {
  const picking = useAppStore((s) => s.proximityPicking);
  const setPicking = useAppStore((s) => s.setProximityPicking);
  const point = useAppStore((s) => s.proximityPoint);
  const setPoint = useAppStore((s) => s.setProximityPoint);
  const count = useAppStore((s) => s.proximityCount);
  const setCount = useAppStore((s) => s.setProximityCount);
  const radiusKm = useAppStore((s) => s.proximityRadiusKm);
  const setRadius = useAppStore((s) => s.setProximityRadiusKm);
  const mapView = useAppStore((s) => s.mapView);
  return (
    <section className="panel-section" aria-labelledby="proximity-heading">
      <h3 id="proximity-heading" className="panel-section__title">
        Straight-line proximity
      </h3>
      <div className="button-row">
        <button
          type="button"
          className="chip-btn"
          aria-pressed={picking}
          onClick={() => setPicking(!picking)}
          title="Then click a place on the map"
        >
          <Crosshair size={15} aria-hidden="true" /> {picking ? "Click the map…" : "Choose a point"}
        </button>
        <button
          type="button"
          className="chip-btn"
          disabled={!mapView}
          onClick={() => mapView && setPoint(mapView.center)}
          title="Measure from the centre of the map (keyboard: pan with the arrow keys first)"
        >
          <LocateFixed size={15} aria-hidden="true" /> Map centre
        </button>
        {point && (
          <button
            type="button"
            className="chip-btn"
            onClick={() => setPoint(null)}
            aria-label="Clear the point"
          >
            <X size={15} aria-hidden="true" /> Clear
          </button>
        )}
      </div>
      <label className="field-row">
        <span>Nearest stores</span>
        <select className="select" value={count} onChange={(e) => setCount(Number(e.target.value))}>
          {[1, 3, 5, 10, 20].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="field-row field-row--stack">
        <span>
          Radius <strong>{formatKm(radiusKm)}</strong> (straight-line)
        </span>
        <input
          type="range"
          className="range"
          min={0.5}
          max={PROXIMITY_RADIUS_KM_MAX}
          step={0.5}
          value={radiusKm}
          onChange={(e) => setRadius(Number(e.target.value))}
          aria-valuetext={`${formatKm(radiusKm)} straight-line`}
        />
      </label>
      <p className="control-hint">
        <MapPin size={12} aria-hidden="true" /> Straight-line distance in the national grid (British National
        Grid; Irish Transverse Mercator in Northern Ireland), among the stores shown. Not walking or driving
        distance or time.
      </p>
    </section>
  );
}

/** UK Food Access controls (SM-03, SM-05, SM-06, SM-07). */
export function AccessControls() {
  const a = useAccess();
  if (a.status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Store data could not be loaded" body={describeDataError(a.error)} />
      </section>
    );
  if (!a.stores || !a.counts)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading stores" />
      </section>
    );
  return (
    <>
      <StoreSearch stores={a.stores} />
      <StoreTypes counts={a.counts} />
      <Retailers stores={a.stores} />
      <CouncilShading />
      <Proximity />
    </>
  );
}
