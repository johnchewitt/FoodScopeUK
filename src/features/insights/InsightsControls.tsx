import { Link2, Save, Settings2, Trash2, Upload, X } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { ErrorState } from "@/components/states/ErrorState";
import { Notice } from "@/components/states/Notice";
import { SkeletonLines } from "@/components/states/Skeleton";
import { CommodityPicker } from "@/features/origins/CommodityPicker";
import { resolveCommodity, useTradeIndex } from "@/features/origins/useOrigins";
import { CouncilSearch } from "@/features/profiles/ProfileControls";
import { useProfile } from "@/features/profiles/useProfile";
import { SCENARIO_TITLES } from "@/features/scenarios/methodology";
import { mostReliedOn } from "@/features/scenarios/model";
import { useActiveScenario } from "@/features/scenarios/useScenario";
import { useSavedScenarios } from "@/features/scenarios/useSaved";
import { describeDataError } from "@/services/data/errors";
import { SCENARIO_LETTERS } from "@/state/scenarioParams";
import { selectUrlState, useAppStore } from "@/state/store";
import {
  INSIGHTS_KINDS,
  parseUrlState,
  SCENARIO_KINDS,
  serializeUrlState,
  type PeriodMode,
} from "@/state/urlState";
import { ExportPanel } from "./ExportPanel";
import { KIND_LABELS } from "./labels";
import { REPORT_TITLES } from "./report";
import { deleteReport, saveReport, useSavedReports } from "./savedReports";

/** Councils offered as one-click examples (both have a deep profile, Stage 5). */
const QUICK_COUNCILS = [
  { code: "N09000003", name: "Belfast" },
  { code: "E08000003", name: "Manchester" },
] as const;

/** The three assessment types (one radio group; arrows, Home and End move; URL `ia`). */
function KindPicker() {
  const kind = useAppStore((s) => s.insightsKind);
  const setKind = useAppStore((s) => s.setInsightsKind);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = INSIGHTS_KINDS.length;
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
    setKind(INSIGHTS_KINDS[next]!);
    refs.current[next]?.focus();
  };
  return (
    <section className="panel-section" aria-labelledby="insights-kind-heading">
      <h3 id="insights-kind-heading" className="panel-section__title">
        Assessment
      </h3>
      <div className="assessment-picker" role="radiogroup" aria-labelledby="insights-kind-heading">
        {INSIGHTS_KINDS.map((k, i) => {
          const Icon = KIND_LABELS[k].icon;
          const checked = kind === k;
          return (
            <button
              key={k}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className="assessment-picker__item"
              onClick={() => setKind(k)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="assessment-picker__text">
                <span className="assessment-picker__label">{KIND_LABELS[k].label}</span>
                <span className="assessment-picker__title">{REPORT_TITLES[k]}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="control-hint">{KIND_LABELS[kind].hint}.</p>
    </section>
  );
}

function AuthorityControls() {
  const p = useProfile();
  const lad = useAppStore((s) => s.lad);
  const setLad = useAppStore((s) => s.setLad);
  if (p.status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Council data could not be loaded" body={describeDataError(p.error)} />
      </section>
    );
  if (!p.councils)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading the councils" />
      </section>
    );
  return (
    <section className="panel-section" aria-labelledby="insights-council-heading">
      <h3 id="insights-council-heading" className="panel-section__title">
        Council
      </h3>
      <CouncilSearch
        councils={p.councils}
        onPick={(c) => setLad(c.code)}
        label="Council name or code"
        placeholder="Name or code, e.g. Manchester"
      />
      <div className="button-row" role="group" aria-label="Example councils">
        {QUICK_COUNCILS.map((c) => (
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
      {p.council ? (
        <p className="selected-line">
          <span>
            <strong>{p.council.name}</strong> · {p.council.nation} · {p.council.code}
          </span>
          <button
            type="button"
            className="tool-btn"
            aria-label="Clear the council"
            onClick={() => setLad(null)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </p>
      ) : (
        <p className="control-hint">
          Search for any of the UK&rsquo;s 361 councils, or click one on the map.
        </p>
      )}
    </section>
  );
}

const PERIODS: { id: PeriodMode; label: string }[] = [
  { id: "rolling12", label: "Latest 12 months" },
  { id: "year", label: "Calendar year" },
];

function CommodityControls() {
  const index = useTradeIndex();
  const commodity = useAppStore((s) => s.commodity);
  const period = useAppStore((s) => s.period);
  const setPeriod = useAppStore((s) => s.setPeriod);
  const year = useAppStore((s) => s.year);
  const setYear = useAppStore((s) => s.setYear);
  const measure = useAppStore((s) => s.measure);
  const setMeasure = useAppStore((s) => s.setMeasure);
  if (index.error)
    return (
      <section className="panel-section">
        <ErrorState title="The trade index could not be loaded" body={describeDataError(index.error)} />
      </section>
    );
  if (!index.data)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading the commodities" />
      </section>
    );
  const entry = resolveCommodity(index.data, commodity);
  const first = Number(entry?.months.first.slice(0, 4) ?? 2019);
  const last = Number(entry?.months.last.slice(0, 4) ?? 2026);
  const lastComplete = entry?.months.last.endsWith("-12") ? last : last - 1;
  const years = Array.from({ length: lastComplete - first + 1 }, (_, i) => lastComplete - i);
  return (
    <>
      <CommodityPicker index={index.data} unknownCommodity={Boolean(entry && entry.id !== commodity)} />
      <section className="panel-section" aria-labelledby="insights-period-heading">
        <h3 id="insights-period-heading" className="panel-section__title">
          Period and measure
        </h3>
        <div
          className="segmented segmented--fill"
          role="radiogroup"
          aria-labelledby="insights-period-heading"
        >
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={(period === "month" ? "rolling12" : period) === p.id}
              onClick={() => {
                setPeriod(p.id);
                if (p.id === "year" && (year === null || year > lastComplete)) setYear(lastComplete);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === "year" && (
          <label className="field-row">
            <span>Year</span>
            <select
              className="select"
              value={year ?? lastComplete}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="segmented segmented--fill" role="radiogroup" aria-label="Measure">
          {(["mass", "value"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={measure === m}
              onClick={() => setMeasure(m)}
            >
              {m === "mass" ? "Net mass" : "Value (£)"}
            </button>
          ))}
        </div>
        {period === "month" && (
          <p className="control-hint">
            A single month is too short for an assessment: the latest 12 months are used.
          </p>
        )}
      </section>
    </>
  );
}

function ScenarioControls() {
  const active = useActiveScenario();
  const kind = useAppStore((s) => s.scenarioKind);
  const setKind = useAppStore((s) => s.setScenarioKind);
  const setModule = useAppStore((s) => s.setModule);
  const applyScenario = useAppStore((s) => s.applyScenario);
  const selectStore = useAppStore((s) => s.selectStore);
  const { saved } = useSavedScenarios();
  const parts = active.closure.data.parts;
  return (
    <>
      <section className="panel-section" aria-labelledby="insights-scenario-heading">
        <h3 id="insights-scenario-heading" className="panel-section__title">
          Scenario
        </h3>
        <div
          className="segmented segmented--fill segmented--stack"
          role="radiogroup"
          aria-labelledby="insights-scenario-heading"
        >
          {SCENARIO_KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>
              <span className="scenario-letter">{SCENARIO_LETTERS[k]}</span> {SCENARIO_TITLES[k].title}
            </button>
          ))}
        </div>
        <p className="control-hint">
          {SCENARIO_TITLES[kind].hint}. The settings are the Scenario Lab&rsquo;s.
        </p>
        {kind === "closure" && parts && (
          <div className="button-row" role="group" aria-label="Example closures">
            {QUICK_COUNCILS.map((c) => {
              const part = c.code.startsWith("N") ? parts.ni : parts.gb;
              const id = mostReliedOn(part, c.code);
              return id === null ? null : (
                <button key={c.code} type="button" className="chip-btn" onClick={() => selectStore(id)}>
                  {c.name}&rsquo;s most relied-on supermarket
                </button>
              );
            })}
          </div>
        )}
        <button type="button" className="text-btn" onClick={() => setModule("scenarios")}>
          <Settings2 size={15} aria-hidden="true" /> Adjust in the Scenario Lab
        </button>
      </section>
      {saved.length > 0 && (
        <section className="panel-section" aria-labelledby="insights-saved-scenarios">
          <h3 id="insights-saved-scenarios" className="panel-section__title">
            Saved scenarios
          </h3>
          <ul className="saved-list" aria-label="Saved scenarios">
            {saved.map((s) => (
              <li key={s.id}>
                <span>
                  <span className="scenario-letter">{SCENARIO_LETTERS[s.params.kind]}</span> {s.name}
                </span>
                <span className="saved-list__actions">
                  <button
                    type="button"
                    className="tool-btn"
                    aria-label={`Assess ${s.name}`}
                    onClick={() => applyScenario(s.params)}
                  >
                    <Upload size={14} aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Saved report configurations: the URL state of an assessment, kept in this browser. */
function SavedReports() {
  const { reports, persisted } = useSavedReports();
  const kind = useAppStore((s) => s.insightsKind);
  const hydrate = useAppStore((s) => s.hydrateFromUrl);
  const [name, setName] = useState("");
  const query = useAppStore((s) => serializeUrlState(selectUrlState(s)));
  return (
    <section className="panel-section" aria-labelledby="insights-saved-reports">
      <h3 id="insights-saved-reports" className="panel-section__title">
        Saved reports
      </h3>
      {!persisted && (
        <Notice tone="warn">
          This browser does not allow saving: reports are kept until the page is closed.
        </Notice>
      )}
      <form
        className="scenario-save"
        onSubmit={(e) => {
          e.preventDefault();
          saveReport({ name: name || REPORT_TITLES[kind], kind, query });
          setName("");
        }}
      >
        <label className="visually-hidden" htmlFor="report-name">
          Report name
        </label>
        <input
          id="report-name"
          className="scenario-input"
          placeholder="Name this report configuration"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="text-btn-row">
          <button type="submit" className="text-btn">
            <Save size={14} aria-hidden="true" /> Save configuration
          </button>
        </div>
      </form>
      {reports.length === 0 ? (
        <p className="control-hint">
          Saved configurations hold the selections only; figures are rebuilt from the current data.
        </p>
      ) : (
        <ul className="saved-list" aria-label="Saved reports">
          {reports.map((r) => (
            <li key={r.id}>
              <span>
                <span className="chip">{KIND_LABELS[r.kind].label}</span> {r.name}
              </span>
              <span className="saved-list__actions">
                <button
                  type="button"
                  className="tool-btn"
                  aria-label={`Open ${r.name}`}
                  onClick={() => hydrate(parseUrlState(r.query))}
                >
                  <Upload size={14} aria-hidden="true" />
                </button>
                <a
                  className="tool-btn"
                  aria-label={`Link to ${r.name}`}
                  href={`${window.location.pathname}${r.query}`}
                >
                  <Link2 size={14} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="tool-btn"
                  aria-label={`Delete ${r.name}`}
                  onClick={() => deleteReport(r.id)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** ConsultingWhere Insights controls (CI-01): assessment type, subject, export and saved reports. */
export function InsightsControls() {
  const kind = useAppStore((s) => s.insightsKind);
  return (
    <>
      <KindPicker />
      {kind === "authority" ? (
        <AuthorityControls />
      ) : kind === "commodity" ? (
        <CommodityControls />
      ) : (
        <ScenarioControls />
      )}
      <ExportPanel />
      <SavedReports />
    </>
  );
}
