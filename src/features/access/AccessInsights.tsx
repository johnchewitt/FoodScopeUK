import { BookOpenCheck, Focus, Info, LocateFixed, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCount, formatKm, formatPer10k, formatPerKm2, formatPopulation } from "@/analysis/format";
import {
  FORMAT_LABELS,
  PROVISION,
  SIZE_BAND_LABELS,
  STORE_LAYER_LABELS,
  type Provision,
} from "@/analysis/retail";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Metric } from "@/components/dashboard/Metric";
import { ProvenanceBadge } from "@/components/dashboard/ProvenanceBadge";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonLines } from "@/components/states/Skeleton";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import { StoreSymbol } from "./AccessMapExtras";
import { PROVISION_NOTE } from "./note";
import { STORE_ZOOM } from "./AccessControls";
import { comparisonOption, comparisonRows } from "./charts";
import { rateIndicator } from "./indicators";
import { classLabels, NATIONS, type AccessStore, type Nation } from "./model";
import { useAccess, type AccessData } from "./useAccess";

const INITIAL_ROWS = 15;

function ProvisionNoteBlock() {
  return (
    <section className="panel-section">
      <p className="provision-callout" role="note">
        <Info size={15} aria-hidden="true" />
        <span>{PROVISION_NOTE}</span>
      </p>
    </section>
  );
}

/** Store detail card (SM-05): only fields present in the data, plus source and snapshot date. */
function StoreCard({ a, store }: { a: AccessData; store: AccessStore }) {
  const selectStore = useAppStore((s) => s.selectStore);
  const issue = useAppStore((s) => s.issueMapCommand);
  const setPoint = useAppStore((s) => s.setProximityPoint);
  const storeLayers = useAppStore((s) => s.storeLayers);
  const retailers = useAppStore((s) => s.retailers);
  const toggleLayer = useAppStore((s) => s.toggleStoreLayer);
  const setRetailers = useAppStore((s) => s.setRetailers);
  const council = store.lad ? a.doc?.councils.find((c) => c.code === store.lad) : undefined;
  const hiddenByLayer = !storeLayers.includes(store.layer);
  const hiddenByRetailer = retailers !== null && !retailers.includes(store.retailer);
  const address = [store.address, store.town, store.postcode].filter(Boolean).join(", ");
  return (
    <section className="panel-section selected-partner" aria-labelledby="store-heading" aria-live="polite">
      <div className="selected-partner__head">
        <h3 id="store-heading" className="selected-partner__title">
          <StoreSymbol layer={store.layer} size={13} /> {store.name}
        </h3>
        <button
          type="button"
          className="tool-btn"
          onClick={() => selectStore(null)}
          aria-label="Clear store selection"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Retailer</dt>
          <dd>
            {store.retailer}
            {store.fascia !== store.retailer ? ` · ${store.fascia}` : ""}
          </dd>
        </div>
        {address && (
          <div>
            <dt>Address</dt>
            <dd>{address}</dd>
          </div>
        )}
        <div>
          <dt>Type</dt>
          <dd>
            {STORE_LAYER_LABELS[store.layer].label} · {SIZE_BAND_LABELS[store.sizeBand]} ·{" "}
            {FORMAT_LABELS[store.format]}
          </dd>
        </div>
        <div>
          <dt>Council</dt>
          <dd>
            {store.crownDependency
              ? `${store.crownDependency}: Crown Dependency, no UK council`
              : (council?.name ?? store.lad)}
            {store.councilMatch === "nearest"
              ? " (nearest council: the point is just outside its boundary)"
              : ""}
          </dd>
        </div>
      </dl>
      {(hiddenByLayer || hiddenByRetailer) && (
        <p className="control-hint">
          Hidden by your filters.{" "}
          {hiddenByLayer && (
            <button type="button" className="link-btn" onClick={() => toggleLayer(store.layer)}>
              Show {STORE_LAYER_LABELS[store.layer].label.toLowerCase()}
            </button>
          )}
          {hiddenByRetailer && (
            <button
              type="button"
              className="link-btn"
              onClick={() => setRetailers([...retailers!, store.retailer])}
            >
              Show {store.retailer}
            </button>
          )}
        </p>
      )}
      <div className="button-row">
        <button
          type="button"
          className="chip-btn"
          onClick={() => issue({ type: "goToPoint", center: [store.lon, store.lat], zoom: STORE_ZOOM })}
        >
          <Focus size={15} aria-hidden="true" /> Zoom to store
        </button>
        <button type="button" className="chip-btn" onClick={() => setPoint([store.lon, store.lat])}>
          <LocateFixed size={15} aria-hidden="true" /> Measure from here
        </button>
      </div>
      <p className="control-hint">
        <ProvenanceBadge cls="measured" /> GEOLYTIX Grocery Retail Points v46 (June 2026), source S11 · stores
        snapshot {a.sources.snapshot ?? "—"}
        {store.coordinateSource === "bng" ? " · location from its British National Grid reference" : ""}
      </p>
    </section>
  );
}

/** Selected council (SM-06, SM-08): counts by type, rates and their denominators. */
function CouncilCard({ a }: { a: AccessData }) {
  const c = a.council!;
  const setLad = useAppStore((s) => s.setLad);
  const issue = useAppStore((s) => s.issueMapCommand);
  const p = c.provision[a.measure];
  return (
    <section className="panel-section selected-partner" aria-labelledby="council-heading" aria-live="polite">
      <div className="selected-partner__head">
        <h3 id="council-heading" className="selected-partner__title">
          {c.name}
        </h3>
        <button
          type="button"
          className="tool-btn"
          onClick={() => setLad(null)}
          aria-label="Clear council selection"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <p className="control-hint">
        {c.nation} · {c.code}
      </p>
      <Metric
        indicator={rateIndicator(a.measure, p.per10k, p.stores, c.population, `${c.name} (${c.nation})`)}
      />
      <p className="control-hint">
        {p.classIndex === null ? "No data class" : `Class: ${classLabels(a.measure)[p.classIndex]}`} ·{" "}
        {PROVISION[a.measure].label.toLowerCase()}
      </p>
      <dl className="stat-grid">
        {(["supermarket", "convenience", "other"] as const).map((l) => (
          <div key={l}>
            <dt>{STORE_LAYER_LABELS[l].label}</dt>
            <dd>{formatCount(c.byLayer[l])}</dd>
          </div>
        ))}
        <div>
          <dt>Residents (mid-2025)</dt>
          <dd>{c.population === null ? "Not available" : formatPopulation(c.population, "authority")}</dd>
        </div>
        <div>
          <dt>Land area</dt>
          <dd>{c.landAreaKm2 === null ? "Not available" : `${formatCount(c.landAreaKm2)} km²`}</dd>
        </div>
        <div>
          <dt>{PROVISION[a.measure].short} per km²</dt>
          <dd>{p.perKm2 === null ? "—" : formatPerKm2(p.perKm2)}</dd>
        </div>
      </dl>
      {c.note && <p className="control-hint">{c.note}</p>}
      <div className="button-row">
        <button
          type="button"
          className="chip-btn"
          onClick={() => issue({ type: "focusCouncil", code: c.code })}
        >
          <Focus size={15} aria-hidden="true" /> Zoom to council
        </button>
      </div>
    </section>
  );
}

/** Straight-line proximity results (SM-07, P7). */
function ProximityResults({ a }: { a: AccessData }) {
  const selectStore = useAppStore((s) => s.selectStore);
  const n = a.nearby!;
  return (
    <section className="panel-section" aria-labelledby="nearby-heading" aria-live="polite">
      <h3 id="nearby-heading" className="panel-section__title">
        Straight-line proximity
      </h3>
      <p className="proximity-summary">
        <strong>{formatCount(n.withinCount)}</strong> of the stores shown are within{" "}
        <strong>{formatKm(n.radiusM / 1000)}</strong> straight-line distance of the point.
      </p>
      {n.nearest.length === 0 ? (
        <p className="empty-line">No stores are shown. Choose a store type.</p>
      ) : (
        <ol className="nearest-list" aria-label={`Nearest ${n.nearest.length} stores shown`}>
          {n.nearest.map(({ store, metres }) => (
            <li key={store.id}>
              <button type="button" className="nearest-list__item" onClick={() => selectStore(store.id)}>
                <StoreSymbol layer={store.layer} />
                <span className="nearest-list__name">{store.name}</span>
                <span className="nearest-list__dist">{formatKm(metres / 1000)}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="control-hint">
        <ProvenanceBadge cls="derived" /> Straight-line distance in the{" "}
        {n.crs === "EPSG:2157" ? "Irish Transverse Mercator" : "British National Grid"} grid, not walking or
        driving distance or time. Store presence is not affordability, choice or nutritional access.
      </p>
    </section>
  );
}

/** Provision comparison with denominators (SM-09). */
function Comparison({ a }: { a: AccessData }) {
  const rows = useMemo(
    () => (a.totals ? comparisonRows(a.totals, a.council, a.measure) : []),
    [a.totals, a.council, a.measure],
  );
  const chart = useMemo(
    () =>
      comparisonOption(
        rows,
        a.council?.nation ?? null,
        `${a.measureDef.short.toLowerCase()} per 10,000 residents`,
      ),
    [rows, a.council, a.measureDef],
  );
  return (
    <section className="panel-section">
      <ChartFrame
        title={`${a.measureDef.label}: ${a.council ? `${a.council.name}, ` : ""}nations and UK`}
        option={chart?.option ?? null}
        description={chart?.description}
        height={a.council ? 168 : 140}
        meta={<ProvenanceBadge cls="derived" showLabel={false} />}
      >
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <caption className="visually-hidden">
              {a.measureDef.label} with numerators and denominators, stores June 2026, population mid-2025
            </caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col" className="num">
                  Stores
                </th>
                <th scope="col" className="num">
                  Residents
                </th>
                <th scope="col" className="num">
                  Per 10,000
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} data-selected={r.kind === "council" || undefined}>
                  <th scope="row">{r.label}</th>
                  <td className="num">{formatCount(r.stores)}</td>
                  <td className="num">
                    {r.population === null ? "—" : formatPopulation(r.population, "authority")}
                  </td>
                  <td className="num">{r.per10k === null ? "—" : formatPer10k(r.per10k)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="control-hint">
          Nations and the UK are sums of their councils. Population: ONS mid-2025 estimates, the same year for
          all four nations. Stores: GEOLYTIX June 2026, all retailers.
        </p>
      </ChartFrame>
    </section>
  );
}

type SortKey = "per10k" | "perKm2" | "name";

/** Retail network density by council (SM-08). */
function DensityTable({ a }: { a: AccessData }) {
  const setLad = useAppStore((s) => s.setLad);
  const issue = useAppStore((s) => s.issueMapCommand);
  const lad = useAppStore((s) => s.lad);
  const [sort, setSort] = useState<SortKey>("per10k");
  const [nation, setNation] = useState<Nation | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const rows = useMemo(() => {
    const list = (a.provision ?? []).filter((r) => nation === "all" || r.nation === nation);
    const key = (r: Provision) => (sort === "per10k" ? r.per10k : r.perKm2);
    return [...list].sort((x, y) =>
      sort === "name"
        ? x.name.localeCompare(y.name)
        : (key(y) ?? -1) - (key(x) ?? -1) || x.name.localeCompare(y.name),
    );
  }, [a.provision, sort, nation]);
  const visible = showAll ? rows : rows.slice(0, INITIAL_ROWS);
  return (
    <section className="panel-section" aria-labelledby="density-heading">
      <h3 id="density-heading" className="panel-section__title">
        {a.measureDef.short} by council
      </h3>
      <div className="field-row">
        <label className="field-inline">
          <span>Sort</span>
          <select
            className="select select--small"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="per10k">Per 10,000 residents</option>
            <option value="perKm2">Per km²</option>
            <option value="name">Name</option>
          </select>
        </label>
        <label className="field-inline">
          <span>Nation</span>
          <select
            className="select select--small"
            value={nation}
            onChange={(e) => setNation(e.target.value as Nation | "all")}
          >
            <option value="all">All</option>
            {NATIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table className="data-table data-table--compact partner-table">
          <caption className="visually-hidden">
            {a.measureDef.short} by council: stores, per 10,000 residents and per km² of land
          </caption>
          <thead>
            <tr>
              <th scope="col">Council</th>
              <th scope="col" className="num">
                Stores
              </th>
              <th scope="col" className="num" title="Stores per 10,000 residents (mid-2025)">
                /10k
              </th>
              <th scope="col" className="num" title="Stores per km² of land">
                /km²
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.code}
                data-selected={r.code === lad || undefined}
                onClick={() => {
                  setLad(r.code);
                  issue({ type: "focusCouncil", code: r.code });
                }}
              >
                <th scope="row">
                  <button
                    type="button"
                    className="row-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLad(r.code);
                      issue({ type: "focusCouncil", code: r.code });
                    }}
                  >
                    {r.name}
                  </button>
                </th>
                <td className="num">{formatCount(r.stores)}</td>
                <td className="num">{r.per10k === null ? "—" : formatPer10k(r.per10k)}</td>
                <td className="num">{r.perKm2 === null ? "—" : formatPerKm2(r.perKm2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > INITIAL_ROWS && (
        <button type="button" className="text-btn" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${rows.length} councils`}
        </button>
      )}
      <p className="control-hint">
        Land area excludes inland water (ONS; NISRA&rsquo;s estimate for Northern Ireland). Councils are the
        May 2025 boundaries; a kernel density surface is planned for Release 2.
      </p>
    </section>
  );
}

function DataNotes({ a }: { a: AccessData }) {
  const openOverlay = useAppStore((s) => s.openOverlay);
  return (
    <section className="panel-section" aria-labelledby="access-notes-heading">
      <h3 id="access-notes-heading" className="panel-section__title">
        About these figures
      </h3>
      <ul className="notes-list">
        <li>
          <ProvenanceBadge cls="measured" /> store locations and counts (GEOLYTIX v46, June 2026, S11).{" "}
          <ProvenanceBadge cls="derived" /> rates and distances, calculated here.
        </li>
        <li>
          Classes by size band (under 280 m² convenience; 280 m² and over supermarket); forecourt, motorway,
          station, airport and hospital stores are a separate type. Wholesale and mainly non-food stores are
          not included.
        </li>
        <li>
          Population and land area: ONS mid-2025 estimates (S18) on May 2025 councils (S14). The 125 stores in
          Guernsey, Jersey and the Isle of Man are on the map but in no council figure.
        </li>
        <li>
          Stores snapshot {a.sources.snapshot ?? "—"}
          {a.sources.storesFrom === "arcgis-feature-layer"
            ? "; stores read from the hosted layer in config.json"
            : ""}
          . ONS&rsquo;s own supermarket counts (S12, 2024) are used to check these figures, not shown.
        </li>
      </ul>
      <button type="button" className="text-btn" onClick={() => openOverlay("evidence")}>
        <BookOpenCheck size={16} aria-hidden="true" /> Evidence and limitations
      </button>
    </section>
  );
}

/** UK Food Access insights (SM-05 – SM-10). */
export function AccessInsights() {
  const a = useAccess();
  if (a.status === "error")
    return (
      <>
        <ProvisionNoteBlock />
        <section className="panel-section">
          <ErrorState title="Store data could not be loaded" body={describeDataError(a.error)} />
        </section>
      </>
    );
  if (a.status !== "ready")
    return (
      <>
        <ProvisionNoteBlock />
        <section className="panel-section">
          <SkeletonLines label="Loading stores and councils" />
        </section>
      </>
    );
  return (
    <>
      <ProvisionNoteBlock />
      {a.selected && <StoreCard a={a} store={a.selected} />}
      {a.council && <CouncilCard a={a} />}
      {a.nearby && <ProximityResults a={a} />}
      <Comparison a={a} />
      <DensityTable a={a} />
      <DataNotes a={a} />
    </>
  );
}
