import { GitCompareArrows, Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { formatCount } from "@/analysis/format";
import { searchCouncils } from "@/analysis/profile";
import { STORE_LAYER_LABELS, STORE_LAYERS } from "@/analysis/retail";
import { StoreSymbol } from "@/features/access/AccessMapExtras";
import { NATIONS } from "@/features/access/model";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonLines } from "@/components/states/Skeleton";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import { MAX_COMPARE, type AreaMeasure } from "@/state/urlState";
import {
  AREA_MEASURE_LABELS,
  measureGeography,
  PPFI_DOMAINS,
  type CouncilRow,
  type DeepProfile,
  type Nation,
} from "./model";
import { useProfile, type ProfileData } from "./useProfile";

const INITIAL_LIST = 12;

/** Council search by name or GSS code (LP-01). `onPick` receives the council. */
function CouncilSearch({
  councils,
  onPick,
  label,
  placeholder,
  exclude = [],
}: {
  councils: readonly CouncilRow[];
  onPick: (c: CouncilRow) => void;
  label: string;
  placeholder: string;
  exclude?: readonly string[];
}) {
  const [query, setQuery] = useState("");
  const listId = useId();
  const results = useMemo(
    () => searchCouncils(councils, query, 10).filter((c) => !exclude.includes(c.code)),
    [councils, query, exclude],
  );
  const open = query.trim().length >= 1;
  return (
    <>
      <label className="search-field">
        <Search size={15} aria-hidden="true" />
        <span className="visually-hidden">{label}</span>
        <input
          type="search"
          className="search-field__input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-controls={open ? listId : undefined}
          autoComplete="off"
        />
      </label>
      {open && (
        <ul id={listId} className="search-results" aria-label={`${label}: matches`} aria-live="polite">
          {results.length === 0 ? (
            <li className="empty-line">No council matches “{query.trim()}”.</li>
          ) : (
            results.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  className="search-results__item"
                  onClick={() => {
                    onPick(c);
                    setQuery("");
                  }}
                >
                  <span>
                    <span className="search-results__name">{c.name}</span>
                    <span className="search-results__meta">
                      {c.nation} · {c.code}
                      {c.deep ? " · deep profile" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </>
  );
}

/** Choose a council: search, deep-profile shortcuts, nation filter and list (LP-01). */
function CouncilPicker({ p }: { p: ProfileData }) {
  const lad = useAppStore((s) => s.lad);
  const setLad = useAppStore((s) => s.setLad);
  const [nation, setNation] = useState<Nation | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const councils = p.councils!;
  const deep = councils.filter((c) => c.deep);
  const listed = councils.filter((c) => nation === "all" || c.nation === nation);
  const visible = showAll ? listed : listed.slice(0, INITIAL_LIST);
  return (
    <section className="panel-section" aria-labelledby="council-pick-heading">
      <h3 id="council-pick-heading" className="panel-section__title">
        Choose a council
      </h3>
      <CouncilSearch
        councils={councils}
        onPick={(c) => setLad(c.code)}
        label="Council name or code"
        placeholder="Name or code, e.g. Belfast"
      />
      {deep.length > 0 && (
        <div className="button-row" role="group" aria-label="Councils with a deep profile">
          {deep.map((c) => (
            <button
              key={c.code}
              type="button"
              className="chip-btn"
              aria-pressed={lad === c.code}
              onClick={() => setLad(c.code)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="segmented segmented--fill nation-filter" role="radiogroup" aria-label="Nation">
        {(["all", ...NATIONS] as const).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={nation === n}
            onClick={() => {
              setNation(n);
              setShowAll(false);
            }}
          >
            {n === "all" ? "All" : n === "Northern Ireland" ? "NI" : n}
          </button>
        ))}
      </div>
      <ul className="council-list" aria-label={`Councils${nation === "all" ? "" : ` in ${nation}`}`}>
        {visible.map((c) => (
          <li key={c.code}>
            <button
              type="button"
              className="council-list__item"
              aria-current={c.code === lad ? "true" : undefined}
              onClick={() => setLad(c.code)}
            >
              <span className="council-list__name">{c.name}</span>
              <span className="council-list__meta">
                {c.code}
                {c.deep && <span className="chip chip--cyan">Deep</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {listed.length > INITIAL_LIST && (
        <button type="button" className="text-btn" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${listed.length} councils`}
        </button>
      )}
      <p className="control-hint">
        {formatCount(councils.length)} councils, May 2025 boundaries (ONS). You can also click a council on
        the map. Deep profiles (small areas) are published for {deep.map((c) => c.name).join(" and ")}.
      </p>
    </section>
  );
}

/** Comparison councils (LP-07): up to three beside the selected one. */
function ComparePicker({ p }: { p: ProfileData }) {
  const lad = useAppStore((s) => s.lad);
  const compare = useAppStore((s) => s.compare);
  const toggle = useAppStore((s) => s.toggleCompare);
  const setLad = useAppStore((s) => s.setLad);
  const setCompare = useAppStore((s) => s.setCompare);
  const openOverlay = useAppStore((s) => s.openOverlay);
  const councils = p.councils!;
  const name = (code: string) => councils.find((c) => c.code === code)?.name ?? code;
  const deep = councils.filter((c) => c.deep);
  return (
    <section className="panel-section" aria-labelledby="compare-heading">
      <h3 id="compare-heading" className="panel-section__title">
        Compare councils
      </h3>
      {compare.length > 0 && (
        <ul className="chip-row" aria-label="Councils in the comparison">
          {compare.map((code) => (
            <li key={code}>
              <button
                type="button"
                className="chip-btn"
                onClick={() => toggle(code)}
                aria-label={`Remove ${name(code)}`}
              >
                {name(code)} <X size={13} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {lad && compare.length < MAX_COMPARE && (
        <CouncilSearch
          councils={councils}
          onPick={(c) => toggle(c.code)}
          label="Add a council to compare"
          placeholder="Add a council"
          exclude={[lad, ...compare]}
        />
      )}
      <div className="button-row">
        {deep.length === 2 && (
          <button
            type="button"
            className="chip-btn"
            onClick={() => {
              setLad(deep[0]!.code);
              setCompare([deep[1]!.code]);
              openOverlay("compare");
            }}
          >
            <GitCompareArrows size={15} aria-hidden="true" /> {deep[0]!.name} and {deep[1]!.name}
          </button>
        )}
        <button
          type="button"
          className="chip-btn"
          disabled={!lad || compare.length === 0}
          onClick={() => openOverlay("compare")}
        >
          Open comparison
        </button>
      </div>
      <p className="control-hint">
        {lad
          ? `The selected council and up to ${MAX_COMPARE} others, side by side. Comparison councils are dashed on the map.`
          : "Choose a council first."}
      </p>
    </section>
  );
}

/** Small-area map measure (LP-04, LP-06), deep profiles only. */
function AreaMeasurePicker({ p }: { p: ProfileData }) {
  const measure = useAppStore((s) => s.areaMeasure);
  const setMeasure = useAppStore((s) => s.setAreaMeasure);
  const deep = p.deep.deep;
  const missing = new Set<string>(deep?.profile.ppfi.domainsWithoutData ?? []);
  return (
    <section className="panel-section" aria-labelledby="area-measure-heading">
      <h3 id="area-measure-heading" className="panel-section__title">
        Neighbourhood map
      </h3>
      {!p.council?.deep ? (
        <p className="control-hint">
          Small-area maps are published for the deep profiles only in this release (Belfast and Manchester).
          Other councils follow in Release 2.
        </p>
      ) : (
        <>
          <label className="field-row field-row--stack">
            <span>Shade small areas by</span>
            <select
              className="select"
              value={measure}
              onChange={(e) => setMeasure(e.target.value as AreaMeasure)}
            >
              <optgroup label="Priority Places for Food Index (within the nation)">
                <option value="ppfi">{AREA_MEASURE_LABELS.ppfi}</option>
                {PPFI_DOMAINS.map((d) => (
                  <option key={d.key} value={d.measure} disabled={missing.has(d.key)}>
                    {d.label}
                    {missing.has(d.key) ? " (no Northern Ireland data)" : ""}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Other measures">
                <option value="deprivation">{AREA_MEASURE_LABELS.deprivation}</option>
                <option value="no-car">{AREA_MEASURE_LABELS["no-car"]}</option>
                <option value="distance">{AREA_MEASURE_LABELS.distance}</option>
              </optgroup>
            </select>
          </label>
          <p className="control-hint">
            {measure === "no-car" || measure === "distance"
              ? `${deep?.profile.geography.label ?? "Small areas"}, Census 2021 population.`
              : measure === "deprivation"
                ? `${deep?.profile.deprivation.index ?? "Deprivation"}, ranked within ${deep?.profile.deprivation.within ?? "the nation"}${deep?.deprivationGeography === "soa2011" ? ", on Super Output Areas (2011)" : ""}.`
                : `PPFI v2.1, ranked within ${deep?.profile.ppfi.within ?? "the nation"}${deep?.ppfiGeography === "soa2011" ? ", on Super Output Areas (2011)" : ""}. Decile 1 = highest priority.`}{" "}
            Click an area on the map, or a bar in a chart, for detail.
          </p>
          {deep && <AreaSelect deep={deep} />}
        </>
      )}
    </section>
  );
}

/** Keyboard route to any small area on the map (the map click's equivalent, LP-06). */
function AreaSelect({ deep }: { deep: DeepProfile }) {
  const measure = useAppStore((s) => s.areaMeasure);
  const area = useAppStore((s) => s.area);
  const selectArea = useAppStore((s) => s.selectArea);
  const kind = measureGeography(deep, measure);
  const options = useMemo(() => {
    const items =
      kind === deep.profile.geography.kind
        ? deep.areas.map((a) => ({ code: a.code, name: a.name }))
        : (kind === deep.ppfiGeography ? deep.ppfi : deep.deprivation).map((a) => ({
            code: a.code,
            name: a.name,
          }));
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, [deep, kind]);
  const value = options.some((o) => o.code === area) ? area! : "";
  return (
    <label className="field-row field-row--stack">
      <span>Small area ({formatCount(options.length)})</span>
      <select className="select" value={value} onChange={(e) => selectArea(e.target.value || null)}>
        <option value="">Choose an area…</option>
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.name} ({o.code})
          </option>
        ))}
      </select>
    </label>
  );
}

/** Store types on the map (shared with UK Food Access), and the NI grocers layer (S29). */
function MapStores({ p }: { p: ProfileData }) {
  const storeLayers = useAppStore((s) => s.storeLayers);
  const toggle = useAppStore((s) => s.toggleStoreLayer);
  const retailers = useAppStore((s) => s.retailers);
  const setRetailers = useAppStore((s) => s.setRetailers);
  const niGrocers = useAppStore((s) => s.niGrocers);
  const setNiGrocers = useAppStore((s) => s.setNiGrocers);
  const ni = p.council?.nation === "Northern Ireland";
  return (
    <section className="panel-section" aria-labelledby="profile-stores-heading">
      <h3 id="profile-stores-heading" className="panel-section__title">
        Stores on the map
      </h3>
      <ul className="check-list">
        {STORE_LAYERS.map((l) => (
          <li key={l}>
            <label className="check-row">
              <input type="checkbox" checked={storeLayers.includes(l)} onChange={() => toggle(l)} />
              <StoreSymbol layer={l} size={13} />
              <span className="check-row__text">{STORE_LAYER_LABELS[l].label}</span>
              {p.network && <span className="check-row__count">{formatCount(p.network.byLayer[l])}</span>}
            </label>
          </li>
        ))}
        {ni && (
          <li>
            <label className="check-row">
              <input type="checkbox" checked={niGrocers} onChange={() => setNiGrocers(!niGrocers)} />
              <span className="grocer-symbol" aria-hidden="true" />
              <span className="check-row__text">
                <span>Other NI grocers (FSA register)</span>
                <span className="check-row__hint">Not in GEOLYTIX; never counted in any rate</span>
              </span>
            </label>
          </li>
        )}
      </ul>
      {retailers !== null && (
        <p className="control-hint">
          Showing {retailers.length === 1 ? retailers[0] : `${retailers.length} retailers`} only.{" "}
          <button type="button" className="link-btn" onClick={() => setRetailers(null)}>
            Show every retailer
          </button>
        </p>
      )}
      <p className="control-hint">
        Counts are this council&rsquo;s stores. Store types are shared with UK Food Access.
      </p>
    </section>
  );
}

/** Local Authority Profiles controls (LP-01, LP-06, LP-07). */
export function ProfileControls() {
  const p = useProfile();
  if (p.status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Profile data could not be loaded" body={describeDataError(p.error)} />
      </section>
    );
  if (!p.councils)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading councils" />
      </section>
    );
  return (
    <>
      <CouncilPicker p={p} />
      <AreaMeasurePicker p={p} />
      <ComparePicker p={p} />
      <MapStores p={p} />
    </>
  );
}
