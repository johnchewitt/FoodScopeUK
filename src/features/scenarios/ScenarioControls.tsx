import { Anchor, Factory, Link2, RotateCcw, Save, Search, Ship, Store, Undo2, X } from "lucide-react";
import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MONTHS_LONG } from "@/analysis/format";
import { ErrorState } from "@/components/states/ErrorState";
import { Notice } from "@/components/states/Notice";
import { SkeletonLines } from "@/components/states/Skeleton";
import { CommodityPicker } from "@/features/origins/CommodityPicker";
import { describeDataError } from "@/services/data/errors";
import { SCENARIO_LETTERS, type ScenarioParams } from "@/state/scenarioParams";
import { useAppStore } from "@/state/store";
import { SCENARIO_KINDS, SCENARIO_LIMITS, SCENARIO_VIEWS, type ScenarioKind } from "@/state/urlState";
import { SCENARIO_TITLES } from "./methodology";
import { mostReliedOn, searchStores } from "./model";
import { defaultName, scenarioLink } from "./saved";
import { useActiveScenario } from "./useScenario";
import { saveScenario } from "./useSaved";

const ICONS: Record<ScenarioKind, typeof Ship> = {
  import: Ship,
  closure: Store,
  production: Factory,
  port: Anchor,
};

/** The four scenarios as selectable cards (one radio group; arrows, Home and End move). */
function ScenarioCards() {
  const kind = useAppStore((s) => s.scenarioKind);
  const setKind = useAppStore((s) => s.setScenarioKind);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = SCENARIO_KINDS.length;
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? (i + 1) % n
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? (i - 1 + n) % n
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? n - 1
              : null;
    if (next === null) return;
    e.preventDefault();
    setKind(SCENARIO_KINDS[next]!);
    refs.current[next]?.focus();
  };
  return (
    <section className="panel-section" aria-labelledby="scenario-kind-heading">
      <h3 id="scenario-kind-heading" className="panel-section__title">
        Scenario
      </h3>
      <div className="scenario-cards" role="radiogroup" aria-labelledby="scenario-kind-heading">
        {SCENARIO_KINDS.map((k, i) => {
          const Icon = ICONS[k];
          const t = SCENARIO_TITLES[k];
          return (
            <button
              key={k}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={kind === k}
              tabIndex={kind === k ? 0 : -1}
              className="scenario-card"
              data-kind={k}
              onClick={() => setKind(k)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <span className="scenario-card__letter" aria-hidden="true">
                {SCENARIO_LETTERS[k]}
              </span>
              <Icon size={16} className="scenario-card__icon" aria-hidden="true" />
              <span className="scenario-card__text">
                <span className="scenario-card__title">{t.title}</span>
                <span className="scenario-card__hint">{t.hint}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  valueText,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  valueText?: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div className="field-row field-row--stack scenario-slider">
      <label htmlFor={id}>
        {label} <strong>{valueText ?? `${value}${suffix}`}</strong>
      </label>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={valueText ?? `${value}${suffix}`}
      />
      {hint && <p className="control-hint">{hint}</p>}
    </div>
  );
}

const months = (n: number) => `${n} month${n === 1 ? "" : "s"}`;

// ---------------------------------------------------------------------------------------------
// A

function ImportControls() {
  const { import: s } = useActiveScenario();
  const update = useAppStore((st) => st.updateScenario);
  const applyScenario = useAppStore((st) => st.applyScenario);
  const reduction = useAppStore((st) => st.scenarioReduction);
  const duration = useAppStore((st) => st.scenarioDuration);
  const recovery = useAppStore((st) => st.scenarioRecovery);
  const substitution = useAppStore((st) => st.scenarioSubstitution);
  const measure = useAppStore((st) => st.measure);
  if (s.status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Trade data could not be loaded" body={describeDataError(s.error)} />
      </section>
    );
  const m = s.model;
  const start = m?.start ?? null;
  const year = start ? Number(start.slice(0, 4)) : null;
  const month = start ? Number(start.slice(5, 7)) : null;
  return (
    <>
      <section className="panel-section" aria-labelledby="scenario-import-heading">
        <h3 id="scenario-import-heading" className="panel-section__title">
          Commodity and partner
        </h3>
        {s.index ? (
          <CommodityPicker index={s.index} unknownCommodity={s.unknownCommodity} />
        ) : (
          <SkeletonLines label="Loading commodities" />
        )}
        {m ? (
          <label className="field-row field-row--stack">
            <span>Recorded import partner</span>
            <select
              className="select"
              value={m.partnerIsDefault ? "" : (m.partner ?? "")}
              onChange={(e) => update({ partner: e.target.value || null })}
            >
              <option value="">
                Largest in these months{m.partners[0] ? ` (${m.partners[0].name})` : ""}
              </option>
              {m.partners.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name} · {(p.share * 100).toFixed(1)} %
                </option>
              ))}
            </select>
          </label>
        ) : (
          <SkeletonLines label="Loading partners" />
        )}
        <p className="control-hint">
          Partner = HMRC country of dispatch, not where the food was grown. Shares are of recorded imports
          from partner countries in the scenario's months.
        </p>
        <button
          type="button"
          className="text-btn"
          onClick={() =>
            m &&
            applyScenario({
              kind: "import",
              commodity: "tomatoes",
              partner: "ES",
              year: m.defaultYear,
              month: 1,
              reduction: 30,
              duration: 3,
              recovery: 0,
              substitution: 0,
              measure: "mass",
            })
          }
          disabled={!m}
        >
          Preset: Spanish tomatoes −30 % for three months from January {m?.defaultYear ?? ""}
        </button>
      </section>
      <section className="panel-section" aria-labelledby="scenario-assumptions-heading">
        <h3 id="scenario-assumptions-heading" className="panel-section__title">
          Your assumptions
        </h3>
        <div className="field-pair">
          <label className="field-row field-row--stack">
            <span>Baseline year</span>
            <select
              className="select"
              value={year ?? ""}
              onChange={(e) => update({ scenarioYear: Number(e.target.value), scenarioMonth: month ?? 1 })}
              disabled={!m}
            >
              {(m?.years ?? []).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label className="field-row field-row--stack">
            <span>Start month</span>
            <select
              className="select"
              value={month ?? ""}
              onChange={(e) => update({ scenarioMonth: Number(e.target.value), scenarioYear: year })}
              disabled={!m}
            >
              {MONTHS_LONG.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {m?.startIsDefault && (
          <p className="control-hint">
            Default: January of the latest complete calendar year in the snapshot.
          </p>
        )}
        <Slider
          label="Reduction in recorded imports from the partner"
          value={reduction}
          {...SCENARIO_LIMITS.reduction}
          suffix=" %"
          onChange={(v) => update({ scenarioReduction: v })}
        />
        <Slider
          label="Duration"
          value={duration}
          {...SCENARIO_LIMITS.duration}
          suffix=""
          valueText={months(duration)}
          onChange={(v) => update({ scenarioDuration: v })}
        />
        <Slider
          label="Recovery (linear)"
          value={recovery}
          {...SCENARIO_LIMITS.recovery}
          suffix=""
          valueText={recovery === 0 ? "immediate" : months(recovery)}
          onChange={(v) => update({ scenarioRecovery: v })}
        />
        <Slider
          label="Substitution"
          value={substitution}
          {...SCENARIO_LIMITS.substitution}
          step={5}
          suffix=" %"
          hint="User assumption — no evidence of actual substitution capacity. Default 0 %: nothing is assumed to replace the reduction."
          onChange={(v) => update({ scenarioSubstitution: v })}
        />
        <div className="segmented segmented--fill" role="radiogroup" aria-label="Measure">
          {(["mass", "value"] as const).map((ms) => (
            <button
              key={ms}
              type="button"
              role="radio"
              aria-checked={measure === ms}
              onClick={() => update({ measure: ms })}
            >
              {ms === "mass" ? "Net mass" : "Value"}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// B

function ClosureControls() {
  const { closure: c } = useActiveScenario();
  const store = useAppStore((s) => s.store);
  const update = useAppStore((s) => s.updateScenario);
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchStores(c.data.options, query), [c.data.options, query]);
  const presets = useMemo(() => {
    const parts = c.data.parts;
    if (!parts) return [];
    return [
      { label: "Manchester", id: mostReliedOn(parts.gb, "E08000003") },
      { label: "Belfast", id: mostReliedOn(parts.ni, "N09000003") },
    ].filter((p): p is { label: string; id: number } => p.id !== null);
  }, [c.data.parts]);
  if (c.status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="The closure inputs could not be loaded" body={describeDataError(c.error)} />
      </section>
    );
  if (c.status === "loading")
    return (
      <section className="panel-section" aria-busy="true">
        <SkeletonLines label="Loading every small area and supermarket in the UK" />
        <p className="control-hint" role="status">
          Loading the closure inputs ({c.data.loaded} of {c.data.total} files): 46,844 small areas and 7,173
          supermarkets with their three nearest, computed in advance.
        </p>
      </section>
    );
  const m = c.model;
  return (
    <section className="panel-section" aria-labelledby="scenario-closure-heading">
      <h3 id="scenario-closure-heading" className="panel-section__title">
        Supermarket to close
      </h3>
      {m ? (
        <div className="scenario-store">
          <Store size={16} aria-hidden="true" />
          <span>
            <strong>{m.store.name}</strong>
            <span className="scenario-store__meta">
              {m.store.retailer} · {m.store.council.name}
            </span>
          </span>
          <button
            type="button"
            className="tool-btn"
            aria-label={`Clear ${m.store.name}`}
            onClick={() => update({ store: null })}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="control-hint">
          Click a supermarket on the map, or find one by name, retailer or council.
        </p>
      )}
      {c.notSupermarket && (
        <Notice tone="warn">
          Store {store} is not one of the supermarkets (280 m² and over) the closure scenario uses. Pick a
          supermarket.
        </Notice>
      )}
      <label className="field-row field-row--stack">
        <span>Find a supermarket</span>
        <span className="search-field">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            className="search-field__input"
            value={query}
            placeholder="e.g. Tesco Hulme"
            onChange={(e) => setQuery(e.target.value)}
            aria-controls={query.trim() !== "" ? "scenario-store-results" : undefined}
          />
        </span>
      </label>
      {query.trim() !== "" && (
        <ul id="scenario-store-results" className="search-results" aria-label="Supermarkets found">
          {results.length === 0 && <li className="control-hint">No supermarket matches.</li>}
          {results.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="row-btn"
                onClick={() => {
                  update({ store: o.id });
                  setQuery("");
                }}
              >
                <strong>{o.name}</strong> <span className="scenario-store__meta">{o.council}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="control-hint" role="status" aria-live="polite">
        {query.trim() !== "" ? `${results.length} supermarket${results.length === 1 ? "" : "s"} shown.` : ""}
      </p>
      {presets.length > 0 && (
        <div className="text-btn-row">
          {presets.map((p) => (
            <button key={p.label} type="button" className="text-btn" onClick={() => update({ store: p.id })}>
              Preset: {p.label}'s most relied-on supermarket
            </button>
          ))}
        </div>
      )}
      <p className="control-hint">
        "Most relied-on": the supermarket that is the nearest for the most residents of the council, computed
        from the published data. Distances are straight-line, never travel time.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// C

function ProductionControls() {
  const { production: p } = useActiveScenario();
  const reduction = useAppStore((s) => s.productionReduction);
  const update = useAppStore((s) => s.updateScenario);
  const commodity = useAppStore((s) => s.commodity);
  if (p.status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Defra's balances could not be loaded" body={describeDataError(p.error)} />
      </section>
    );
  const available = new Set(p.model?.available.map((a) => a.basket) ?? []);
  const baskets = p.index?.commodities ?? [];
  return (
    <section className="panel-section" aria-labelledby="scenario-production-heading">
      <h3 id="scenario-production-heading" className="panel-section__title">
        Commodity and shock
      </h3>
      <label className="field-row field-row--stack">
        <span>Commodity (Defra UK supply balance)</span>
        <select className="select" value={commodity} onChange={(e) => update({ commodity: e.target.value })}>
          {baskets.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
              {available.has(b.id) ? "" : " — no Defra balance"}
            </option>
          ))}
        </select>
      </label>
      <Slider
        label="Reduction in UK production"
        value={reduction}
        {...SCENARIO_LIMITS.reduction}
        suffix=" %"
        onChange={(v) => update({ productionReduction: v })}
      />
      <button
        type="button"
        className="text-btn"
        onClick={() =>
          useAppStore.getState().applyScenario({ kind: "production", commodity: "wheat", reduction: 15 })
        }
      >
        Preset: UK wheat production −15 %
      </button>
      <p className="control-hint">
        Uses Defra's published annual supply balance only: production, imports, exports and total supply from
        one table and year. Imports and exports are held; nothing is combined with HMRC monthly trade.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// D

function PortControls() {
  const { port: p } = useActiveScenario();
  const port = useAppStore((s) => s.port);
  const reduction = useAppStore((s) => s.portReduction);
  const portMonths = useAppStore((s) => s.portMonths);
  const update = useAppStore((s) => s.updateScenario);
  if (p.status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Port data could not be loaded" body={describeDataError(p.error)} />
      </section>
    );
  const m = p.model;
  return (
    <section className="panel-section" aria-labelledby="scenario-port-heading">
      <h3 id="scenario-port-heading" className="panel-section__title">
        Port and capacity
      </h3>
      <label className="field-row field-row--stack">
        <span>Major port (DfT)</span>
        <select
          className="select"
          value={port ?? ""}
          onChange={(e) => update({ port: e.target.value || null })}
        >
          <option value="">Choose a port…</option>
          {(m?.ports ?? []).map((o) => (
            <option key={o.locode} value={o.locode}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <Slider
        label="Capacity reduction"
        value={reduction}
        {...SCENARIO_LIMITS.reduction}
        suffix=" %"
        onChange={(v) => update({ portReduction: v })}
      />
      <Slider
        label="Duration"
        value={portMonths}
        {...SCENARIO_LIMITS.portMonths}
        suffix=""
        valueText={months(portMonths)}
        hint="DfT publishes annual tonnage: shorter disruptions assume an even spread over the year."
        onChange={(v) => update({ portMonths: v })}
      />
      <button
        type="button"
        className="text-btn"
        onClick={() =>
          useAppStore.getState().applyScenario({ kind: "port", port: "GBDVR", reduction: 50, months: 1 })
        }
      >
        Preset: Dover −50 % for one month
      </button>
      <p className="control-hint">
        Or click a port on the map. Food exposure is computed only where the data records food flows at the
        port; a partner country is never assumed to use any port.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// View, reset, save, link

function ViewSwitch() {
  const view = useAppStore((s) => s.scenarioView);
  const setView = useAppStore((s) => s.setScenarioView);
  const kind = useAppStore((s) => s.scenarioKind);
  if (kind === "production") return null;
  return (
    <section className="panel-section" aria-labelledby="scenario-view-heading">
      <h3 id="scenario-view-heading" className="panel-section__title">
        Map shows
      </h3>
      <div className="segmented segmented--fill" role="radiogroup" aria-labelledby="scenario-view-heading">
        {SCENARIO_VIEWS.map((v) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}>
            {v === "scenario" ? "Scenario" : "Baseline"}
          </button>
        ))}
      </div>
    </section>
  );
}

function labelsFor(params: ScenarioParams, s: ReturnType<typeof useActiveScenario>) {
  return {
    commodity:
      params.kind === "import"
        ? s.import.model?.commodity.label
        : params.kind === "production"
          ? s.production.model?.label
          : undefined,
    partner: params.kind === "import" ? s.import.model?.partnerName : undefined,
    store: s.closure.model?.store.name,
    port: s.port.model?.selected?.name,
  };
}

function Actions() {
  const s = useActiveScenario();
  const reset = useAppStore((st) => st.resetScenarioToBaseline);
  const restore = useAppStore((st) => st.restoreScenarioDefaults);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const placeholder = defaultName(s.params, labelsFor(s.params, s));
  const base = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`;
  const copy = async () => {
    const link = scenarioLink(s.params, base);
    try {
      await navigator.clipboard.writeText(link);
      setStatus("Link copied: it reproduces this scenario.");
    } catch {
      setStatus(`Copy this link: ${link}`);
    }
  };
  return (
    <section className="panel-section" aria-labelledby="scenario-actions-heading">
      <h3 id="scenario-actions-heading" className="panel-section__title">
        Reset, save and share
      </h3>
      <div className="text-btn-row">
        <button type="button" className="text-btn" onClick={reset}>
          <RotateCcw size={14} aria-hidden="true" /> Reset to baseline
        </button>
        <button type="button" className="text-btn" onClick={restore}>
          <Undo2 size={14} aria-hidden="true" /> Restore defaults
        </button>
      </div>
      <form
        className="scenario-save"
        onSubmit={(e) => {
          e.preventDefault();
          const saved = saveScenario(name || placeholder, s.params);
          setName("");
          setStatus(`Saved "${saved.name}" in this browser.`);
        }}
      >
        <label className="field-row field-row--stack">
          <span>Scenario name</span>
          <input
            className="scenario-input"
            value={name}
            maxLength={80}
            placeholder={placeholder}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="text-btn-row">
          <button type="submit" className="text-btn">
            <Save size={14} aria-hidden="true" /> Save
          </button>
          <button type="button" className="text-btn" onClick={() => void copy()}>
            <Link2 size={14} aria-hidden="true" /> Copy link
          </button>
        </div>
      </form>
      <p className="control-hint" role="status" aria-live="polite">
        {status}
      </p>
      <p className="control-hint">
        Saved scenarios stay in this browser; the link holds every setting, so anyone can reopen the same run.
      </p>
    </section>
  );
}

/** Scenario Lab controls (SC-01 – SC-05): the scenario, its settings, the map view and actions. */
export function ScenarioControls() {
  const kind = useAppStore((s) => s.scenarioKind);
  return (
    <>
      <ScenarioCards />
      {kind === "import" && <ImportControls />}
      {kind === "closure" && <ClosureControls />}
      {kind === "production" && <ProductionControls />}
      {kind === "port" && <PortControls />}
      <ViewSwitch />
      <Actions />
    </>
  );
}
