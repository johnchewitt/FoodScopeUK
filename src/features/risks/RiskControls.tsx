import { CircleOff } from "lucide-react";
import { FARM_UNITS } from "@/analysis/risk";
import { formatShare, MONTHS_SHORT } from "@/analysis/format";
import { parseMonthKey, type MonthKey } from "@/analysis/trade";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonLines } from "@/components/states/Skeleton";
import { CommodityPicker } from "@/features/origins/CommodityPicker";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import {
  FARM_LAYERS,
  NATIONS,
  PORT_MEASURES,
  PPFI_MEASURES,
  RISK_VIEWS,
  type FarmLayer,
  type Nation,
  type PeriodMode,
  type PpfiMeasure,
} from "@/state/urlState";
import { FARM_LABELS, PPFI_LABELS, VIEW_LABELS } from "./labels";
import { PORT_MEASURE_LABELS } from "./model";
import { useRiskAccess, useRiskLogistics, useRiskSupply } from "./useRisk";

const PERIODS: { id: PeriodMode; label: string }[] = [
  { id: "rolling12", label: "12 months" },
  { id: "year", label: "Year" },
  { id: "month", label: "Month" },
];

function yearsIn(first: MonthKey, last: MonthKey): number[] {
  const a = parseMonthKey(first).year;
  const b = parseMonthKey(last).year;
  return Array.from({ length: b - a + 1 }, (_, i) => b - i);
}

/** The three views (RK-01): one radio group, kept in the URL (rv). */
export function ViewSwitch() {
  const view = useAppStore((s) => s.riskView);
  const setView = useAppStore((s) => s.setRiskView);
  return (
    <section className="panel-section" aria-labelledby="risk-view-heading">
      <h3 id="risk-view-heading" className="panel-section__title">
        View
      </h3>
      <div
        className="segmented segmented--fill segmented--stack"
        role="radiogroup"
        aria-labelledby="risk-view-heading"
      >
        {RISK_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={view === v}
            title={VIEW_LABELS[v].hint}
            onClick={() => setView(v)}
          >
            {VIEW_LABELS[v].label}
          </button>
        ))}
      </div>
      <p className="control-hint">
        {VIEW_LABELS[view].hint}. The three views are kept separate: no score combines them.
      </p>
    </section>
  );
}

function SupplyControls() {
  const { status, error, index, model, unknownCommodity } = useRiskSupply();
  const period = useAppStore((s) => s.period);
  const setPeriod = useAppStore((s) => s.setPeriod);
  const year = useAppStore((s) => s.year);
  const setYear = useAppStore((s) => s.setYear);
  const month = useAppStore((s) => s.month);
  const setYearMonth = useAppStore((s) => s.setYearMonth);
  const measure = useAppStore((s) => s.measure);
  const setMeasure = useAppStore((s) => s.setMeasure);
  const fill = useAppStore((s) => s.riskFill);
  const setFill = useAppStore((s) => s.setRiskFill);
  const partner = useAppStore((s) => s.partner);
  const selectPartner = useAppStore((s) => s.selectPartner);

  if (status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Supply data could not be loaded" body={describeDataError(error)} />
      </section>
    );
  if (!index || !model)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading the supply data" />
      </section>
    );
  const range = model.origins.range;
  const years = yearsIn(range.first, range.last);
  const anchor = parseMonthKey(model.origins.period.anchor);
  return (
    <>
      <CommodityPicker index={index} unknownCommodity={unknownCommodity} />
      <section className="panel-section" aria-labelledby="risk-period-heading">
        <h3 id="risk-period-heading" className="panel-section__title">
          Period
        </h3>
        <div className="segmented segmented--fill" role="radiogroup" aria-labelledby="risk-period-heading">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={period === p.id}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="field-pair">
          <label className="field-row">
            <span>Year</span>
            <select
              className="select"
              value={period === "year" ? (year ?? anchor.year) : anchor.year}
              onChange={(e) =>
                period === "year"
                  ? setYear(Number(e.target.value))
                  : setYearMonth(Number(e.target.value), anchor.month)
              }
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          {period !== "year" && (
            <label className="field-row">
              <span>{period === "rolling12" ? "Ending" : "Month"}</span>
              <select
                className="select"
                value={month ?? anchor.month}
                onChange={(e) => setYearMonth(anchor.year, Number(e.target.value))}
              >
                {MONTHS_SHORT.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="control-hint">
          Showing <strong>{model.origins.periodText}</strong>
          {model.origins.status.unavailableText ? ` (${model.origins.status.unavailableText})` : ""}.
        </p>
      </section>
      <section className="panel-section" aria-labelledby="risk-measure-heading">
        <h3 id="risk-measure-heading" className="panel-section__title">
          Measure
        </h3>
        <div className="segmented segmented--fill" role="radiogroup" aria-labelledby="risk-measure-heading">
          <button
            type="button"
            role="radio"
            aria-checked={measure === "mass"}
            onClick={() => setMeasure("mass")}
          >
            Net mass (t)
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={measure === "value"}
            onClick={() => setMeasure("value")}
          >
            Value (£)
          </button>
        </div>
      </section>
      <section className="panel-section" aria-labelledby="risk-fill-heading">
        <h3 id="risk-fill-heading" className="panel-section__title">
          Map colour
        </h3>
        <div className="segmented segmented--fill" role="radiogroup" aria-labelledby="risk-fill-heading">
          <button type="button" role="radio" aria-checked={fill === "share"} onClick={() => setFill("share")}>
            Share of imports
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={fill === "stress"}
            onClick={() => setFill("stress")}
          >
            Water stress
          </button>
        </div>
        <p className="control-hint">
          {fill === "stress"
            ? "Partners shaded by their national level of water stress (FAO, mostly 2022). A national figure: it does not describe where the produce was grown."
            : "Partners shaded by their share of recorded imports; connection widths follow the measure."}
        </p>
      </section>
      <section className="panel-section" aria-labelledby="risk-partner-heading">
        <h3 id="risk-partner-heading" className="panel-section__title">
          Supplier disruption
        </h3>
        <label className="field-row field-row--stack">
          <span>Recorded partner</span>
          <select
            className="select"
            value={partner ?? ""}
            onChange={(e) => selectPartner(e.target.value || null)}
            aria-describedby="risk-partner-hint"
          >
            <option value="">None selected</option>
            {model.origins.rows.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name} ({formatShare(r.share)})
              </option>
            ))}
          </select>
        </label>
        <p id="risk-partner-hint" className="control-hint">
          Shows the estimated exposure if recorded imports from one partner stopped: its share of recorded
          supply, month by month. Not a shortage; substitution is modelled in the Scenario Lab. You can also
          click a partner on the map.
        </p>
      </section>
    </>
  );
}

function LogisticsControls() {
  const { status, error, model } = useRiskLogistics();
  const measure = useAppStore((s) => s.portMeasure);
  const setMeasure = useAppStore((s) => s.setPortMeasure);
  const port = useAppStore((s) => s.port);
  const selectPort = useAppStore((s) => s.selectPort);
  const roads = useAppStore((s) => s.roads);
  const setRoads = useAppStore((s) => s.setRoads);
  const rail = useAppStore((s) => s.rail);
  const setRail = useAppStore((s) => s.setRail);
  const farm = useAppStore((s) => s.farmLayer);
  const setFarm = useAppStore((s) => s.setFarmLayer);
  if (status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Port data could not be loaded" body={describeDataError(error)} />
      </section>
    );
  if (!model)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading ports" />
      </section>
    );
  return (
    <>
      <section className="panel-section" aria-labelledby="port-measure-heading">
        <h3 id="port-measure-heading" className="panel-section__title">
          Port symbols ({model.latestYear})
        </h3>
        <div
          className="segmented segmented--fill segmented--stack"
          role="radiogroup"
          aria-labelledby="port-measure-heading"
        >
          {PORT_MEASURES.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={measure === m}
              onClick={() => setMeasure(m)}
            >
              {PORT_MEASURE_LABELS[m].short}
            </button>
          ))}
        </div>
        <p className="control-hint">
          {PORT_MEASURE_LABELS[measure].long}. Circle area is proportional to tonnage.
        </p>
        <label className="field-row field-row--stack">
          <span>Port</span>
          <select className="select" value={port ?? ""} onChange={(e) => selectPort(e.target.value || null)}>
            <option value="">None selected</option>
            {model.ports.map((p) => (
              <option key={p.locode} value={p.locode}>
                {p.name} ({p.nation})
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="panel-section" aria-labelledby="layers-heading">
        <h3 id="layers-heading" className="panel-section__title">
          Layers
        </h3>
        <div className="setting-row">
          <span>
            Strategic road corridors
            <span className="setting-row__hint">Motorways, trunk and primary A roads (Great Britain)</span>
          </span>
          <calcite-switch
            label="Strategic road corridors"
            checked={roads}
            oncalciteSwitchChange={(e) => setRoads(e.target.checked)}
          />
        </div>
        <div className="setting-row">
          <span>
            Railway lines
            <span className="setting-row__hint">Northern Ireland (Translink NIR network, 2015)</span>
          </span>
          <calcite-switch
            label="Railway lines"
            checked={rail}
            oncalciteSwitchChange={(e) => setRail(e.target.checked)}
          />
        </div>
        <label className="field-row field-row--stack">
          <span>Agricultural production regions</span>
          <select className="select" value={farm} onChange={(e) => setFarm(e.target.value as FarmLayer)}>
            {FARM_LAYERS.map((f) => (
              <option key={f} value={f}>
                {FARM_LABELS[f]}
                {f === "off" ? "" : ` (${FARM_UNITS[f]})`}
              </option>
            ))}
          </select>
        </label>
        <p className="control-hint">
          Defra June survey{model.farmingYear ? ` ${model.farmingYear}` : ""}, by Defra region of England and
          devolved country.
        </p>
      </section>
      <section className="panel-section" aria-labelledby="unavailable-heading">
        <h3 id="unavailable-heading" className="panel-section__title">
          Not available
        </h3>
        <ul className="unavailable-list">
          <li>
            <CircleOff size={14} aria-hidden="true" /> Northern Ireland road corridors: DfI&rsquo;s open files
            have no line work, and OSNI&rsquo;s open service could not be reached by the data pipeline.
          </li>
          <li>
            <CircleOff size={14} aria-hidden="true" /> Great Britain&rsquo;s railway lines: no open, official
            line dataset in this build.
          </li>
          <li>
            <CircleOff size={14} aria-hidden="true" /> Rail freight routes and terminals: no open, official
            mapped dataset found (the railway lines show where track runs, not freight).
          </li>
          <li>
            <CircleOff size={14} aria-hidden="true" /> Distribution centres: no authoritative public register.
          </li>
          <li>
            <CircleOff size={14} aria-hidden="true" /> Food flows through ports: DfT records no commodity for
            containers or roll-on/roll-off traffic.
          </li>
        </ul>
      </section>
    </>
  );
}

function AccessControls() {
  const { status, error, model } = useRiskAccess();
  const measure = useAppStore((s) => s.ppfiMeasure);
  const setMeasure = useAppStore((s) => s.setPpfiMeasure);
  const lad = useAppStore((s) => s.lad);
  const setLad = useAppStore((s) => s.setLad);
  const rankNation = useAppStore((s) => s.rankNation);
  const setRankNation = useAppStore((s) => s.setRankNation);
  if (status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Priority places data could not be loaded" body={describeDataError(error)} />
      </section>
    );
  if (!model)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading councils" />
      </section>
    );
  return (
    <>
      <section className="panel-section" aria-labelledby="ppfi-heading">
        <h3 id="ppfi-heading" className="panel-section__title">
          Priority Places for Food Index
        </h3>
        <label className="field-row field-row--stack">
          <span>Measure</span>
          <select
            className="select"
            value={measure}
            onChange={(e) => setMeasure(e.target.value as PpfiMeasure)}
          >
            {PPFI_MEASURES.map((m) => (
              <option key={m} value={m}>
                {PPFI_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <p className="control-hint">
          Councils are shaded by the share of their small areas in their own nation&rsquo;s two
          highest-priority deciles (about 20 % of each nation&rsquo;s areas).
        </p>
      </section>
      <section className="panel-section" aria-labelledby="council-heading">
        <h3 id="council-heading" className="panel-section__title">
          Council
        </h3>
        <label className="field-row field-row--stack">
          <span>Council</span>
          <select className="select" value={lad ?? ""} onChange={(e) => setLad(e.target.value || null)}>
            <option value="">None selected</option>
            {NATIONS.map((n) => (
              <optgroup key={n} label={n}>
                {model.rows
                  .filter((r) => r.nation === n)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field-row field-row--stack">
          <span>Rank councils within</span>
          <select
            className="select"
            value={rankNation ?? ""}
            onChange={(e) => setRankNation((e.target.value || null) as Nation | null)}
          >
            <option value="">
              {model.selected ? `${model.selected.nation} (selected council)` : "England"}
            </option>
            {NATIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <p className="control-hint">
          Deciles are set within each nation, so councils are compared and ranked within their own nation
          only.
        </p>
      </section>
    </>
  );
}

/** Risk Explorer controls: the view switch and the active view's filters. */
export function RiskControls() {
  const view = useAppStore((s) => s.riskView);
  return (
    <>
      <ViewSwitch />
      {view === "supply" ? (
        <SupplyControls />
      ) : view === "logistics" ? (
        <LogisticsControls />
      ) : (
        <AccessControls />
      )}
    </>
  );
}
