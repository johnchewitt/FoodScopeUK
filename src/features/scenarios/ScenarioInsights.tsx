import { Download, FlaskConical, Link2, Trash2, Upload } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { formatByUnit, formatChange, formatKm, formatPopulation, formatTonnes } from "@/analysis/format";
import { formatMonth } from "@/analysis/trade";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { ProvenanceBadge } from "@/components/dashboard/ProvenanceBadge";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { Notice } from "@/components/states/Notice";
import { SkeletonLines } from "@/components/states/Skeleton";
import { describeDataError } from "@/services/data/errors";
import { SCENARIO_LETTERS, type ScenarioParams } from "@/state/scenarioParams";
import { useAppStore } from "@/state/store";
import type { Indicator } from "@/types/indicator";
import {
  BASELINE_COLOUR,
  closureDistanceChart,
  closureRetailerChart,
  closureThresholdChart,
  importMonthsChart,
  importSharesChart,
  portGroupChart,
  productionChart,
  SCENARIO_COLOUR,
  type ChartSpec,
} from "./charts";
import {
  closureMethodology,
  importMethodology,
  portMethodology,
  productionMethodology,
  SCENARIO_TITLES,
  type Methodology,
} from "./methodology";
import { areaKind, CONFIDENCE_LABELS, type Confidence, type ResultRow } from "./model";
import { MAX_COMPARE, scenarioLink, summaryCsv, type SummaryRecord } from "./saved";
import {
  closureNarrative,
  formatDelta,
  importNarrative,
  portNarrative,
  productionNarrative,
} from "./narrative";
import {
  useActiveScenario,
  useScenarioSummaries,
  type AnyScenarioModel,
  type ScenarioSummary,
} from "./useScenario";
import { deleteScenario, useSavedScenarios } from "./useSaved";

// ---------------------------------------------------------------------------------------------
// Shared pieces

function Section({
  id,
  title,
  children,
  open = true,
}: {
  id: string;
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      className="panel-section profile-section"
      open={open}
      aria-labelledby={`${id}-heading`}
      data-section={id}
    >
      <summary>
        <h3 id={`${id}-heading`} className="panel-section__title">
          {title}
        </h3>
      </summary>
      <div className="profile-section__body">{children}</div>
    </details>
  );
}

/** "Scenario Modelled" banner with the confidence rating and its reasons (brief §6, §8). */
function Banner({ summary, confidence }: { summary: string; confidence: Confidence }) {
  return (
    <section className="panel-section scenario-banner" aria-label="Scenario modelled">
      <p className="scenario-banner__head">
        <FlaskConical size={16} aria-hidden="true" />
        <ProvenanceBadge cls="scenario" />
        <span className="chip" data-confidence={confidence.level}>
          Data confidence: {CONFIDENCE_LABELS[confidence.level]}
        </span>
      </p>
      <p className="scenario-banner__summary">{summary}</p>
      <ul className="notes-list">
        {confidence.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <p className="control-hint">
        A static exposure calculation under your assumptions: not a forecast, and not a shortage.
      </p>
    </section>
  );
}

function Cell({ indicator }: { indicator: Indicator<number> }) {
  return (
    <td className="num" data-indicator={indicator.id} title={indicator.method}>
      {indicator.value === null ? "—" : formatByUnit(indicator.value, indicator.unit)}
    </td>
  );
}

/** Results dashboard (brief §6): baseline, scenario, absolute and relative change, with provenance. */
function ResultsTable({ rows, caption }: { rows: ResultRow[]; caption: string }) {
  if (rows.length === 0) return null;
  const sources = [
    ...new Set(rows.flatMap((r) => [...r.baseline.sourceIds, ...r.scenario.sourceIds])),
  ].sort();
  return (
    <div className="table-scroll">
      <table className="data-table data-table--compact scenario-results">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Measure</th>
            <th scope="col" className="num">
              Baseline
            </th>
            <th scope="col" className="num">
              Scenario <ProvenanceBadge cls="scenario" showLabel={false} />
            </th>
            <th scope="col" className="num">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} data-row={r.id}>
              <th scope="row">
                {r.label}
                <span className="scenario-results__badge">
                  <ProvenanceBadge cls={r.baseline.provenance} showLabel={false} />
                </span>
              </th>
              <Cell indicator={r.baseline} />
              <Cell indicator={r.scenario} />
              <td className="num scenario-results__change">
                {formatDelta(r.change, r.scenario.unit)}
                {r.scenario.unit !== "share" && r.relative !== null && (
                  <span className="scenario-results__rel">{formatChange(r.relative)}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="control-hint">
        Sources: {sources.join(", ")}. Baseline figures keep their published provenance (badge beside each
        measure); every scenario figure is Scenario-modelled. Hover a value for its method.
      </p>
    </div>
  );
}

function ChartLegend() {
  return (
    <p className="scenario-chart-legend">
      <span className="swatch swatch--inline" style={{ background: BASELINE_COLOUR }} aria-hidden="true" />{" "}
      Baseline
      <span
        className="swatch swatch--inline"
        style={{ background: SCENARIO_COLOUR }}
        aria-hidden="true"
      />{" "}
      Scenario
    </p>
  );
}

function Chart({ title, spec, empty }: { title: string; spec: ChartSpec | null; empty?: string }) {
  return (
    <ChartFrame
      title={title}
      option={spec?.option ?? null}
      description={spec?.description}
      height={spec?.height ?? 160}
      emptyTitle={empty ?? "Nothing to chart"}
      meta={<ProvenanceBadge cls="scenario" showLabel={false} />}
    >
      <ChartLegend />
    </ChartFrame>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="notes-list">
      {items.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  );
}

/** "Explain the model" (brief §8): every part of the method for the run on screen. */
function MethodologyPanel({ m }: { m: Methodology }) {
  const openEvidence = useAppStore((s) => s.openOverlay);
  return (
    <Section id="scenario-method" title="Explain the model" open={false}>
      <h4 className="scenario-method__h">Source data</h4>
      <ul className="notes-list">
        {m.sources.map((s) => (
          <li key={s.id + s.text}>
            <button type="button" className="source-btn" onClick={() => openEvidence("evidence")}>
              {s.id}
            </button>{" "}
            {s.text}
          </li>
        ))}
      </ul>
      <h4 className="scenario-method__h">Formula</h4>
      <pre className="scenario-formula">{m.formula.join("\n")}</pre>
      <h4 className="scenario-method__h">Geographic boundary</h4>
      <p>{m.boundary}</p>
      <h4 className="scenario-method__h">Your assumptions</h4>
      <List items={m.assumptions} />
      <h4 className="scenario-method__h">Known limitations</h4>
      <List items={m.limitations} />
      <h4 className="scenario-method__h">What the outputs mean</h4>
      <List items={m.means} />
      <h4 className="scenario-method__h">What they do not mean</h4>
      <List items={m.doesNotMean} />
    </Section>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <section className="panel-section" aria-busy="true">
      <SkeletonLines label={label} />
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Per-scenario panels

function ImportInsights() {
  const { import: a } = useActiveScenario();
  if (a.status === "error")
    return <ErrorState title="Trade data could not be loaded" body={describeDataError(a.error)} />;
  const m = a.model;
  if (!m) return <Loading label="Loading recorded imports" />;
  const r = m.result;
  return (
    <>
      <Banner summary={importNarrative(m)} confidence={m.confidence} />
      <Section id="scenario-results" title="Results">
        <ResultsTable rows={m.rows} caption={`Results of the ${m.commodity.label} supply disruption`} />
        {r && r.outside.length > 0 && (
          <Notice tone="warn">
            Left out (outside the snapshot): {r.outside.map(formatMonth).join(", ")}. Nothing is estimated for
            them.
          </Notice>
        )}
      </Section>
      {r && (
        <Section id="scenario-charts" title="Before and after">
          <Chart
            title={`Recorded imports from ${m.partnerName}, by month`}
            spec={importMonthsChart(r, m.measure)}
          />
          <Chart title="Partner shares of recorded imports" spec={importSharesChart(r)} />
        </Section>
      )}
      <MethodologyPanel m={importMethodology(m)} />
    </>
  );
}

function ClosureInsights() {
  const { closure: c } = useActiveScenario();
  const update = useAppStore((s) => s.updateScenario);
  if (c.status === "error")
    return <ErrorState title="The closure inputs could not be loaded" body={describeDataError(c.error)} />;
  if (c.status === "loading") return <Loading label="Loading every small area and supermarket in the UK" />;
  const m = c.model;
  if (!m)
    return (
      <>
        <section className="panel-section">
          <EmptyState
            title="Pick a supermarket to close"
            body="Click a supermarket on the map, search for one, or use a preset. The scenario then shows whose nearest supermarket would change."
          />
        </section>
        <MethodologyPanel m={closureMethodology(null)} />
      </>
    );
  const r = m.result;
  return (
    <>
      <Banner summary={closureNarrative(m)} confidence={m.confidence} />
      <Section id="scenario-results" title="Results">
        <ResultsTable rows={m.rows} caption={`Results of closing ${m.store.name}`} />
      </Section>
      {m.affected.length > 0 && (
        <Section id="scenario-areas" title="Neighbourhoods whose nearest supermarket changes">
          <div className="table-scroll">
            <table className="data-table data-table--compact">
              <caption className="visually-hidden">Small areas whose nearest supermarket changes</caption>
              <thead>
                <tr>
                  <th scope="col">Small area</th>
                  <th scope="col" className="num">
                    Residents
                  </th>
                  <th scope="col" className="num">
                    Before
                  </th>
                  <th scope="col" className="num">
                    After
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.affected.slice(0, 15).map((a) => (
                  <tr key={a.code}>
                    <th
                      scope="row"
                      title={`${areaKind(a.code)} ${a.code} · ${a.council}${a.newStore ? ` · new nearest: ${a.newStore}` : ""}`}
                    >
                      {a.name}
                    </th>
                    <td className="num">{formatPopulation(a.population, "small_area")}</td>
                    <td className="num">{formatKm(a.beforeKm)}</td>
                    <td className="num">{a.afterKm === null ? "none" : formatKm(a.afterKm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="control-hint">
            {m.affected.length > 15 ? `The 15 largest increases of ${m.affected.length}. ` : ""}Straight-line
            km from each area&rsquo;s population-weighted centroid; residents from Census{" "}
            {m.censusYears.join(" and ")}.
          </p>
          {m.councilsReached.length > 1 && (
            <p className="control-hint">
              Areas in {m.councilsReached.length} councils:{" "}
              {m.councilsReached
                .map((x) => `${x.council.name} (${formatPopulation(x.population, "small_area")})`)
                .join(", ")}
              . The closure reaches beyond {m.store.council.name}&rsquo;s boundary.
            </p>
          )}
          {m.takeover.length > 0 && (
            <>
              <h4 className="scenario-method__h">Supermarkets that become the nearest</h4>
              <ul className="notes-list">
                {m.takeover.slice(0, 6).map((t) => (
                  <li key={t.id}>
                    <button type="button" className="link-btn" onClick={() => update({ store: t.id })}>
                      {t.name}
                    </button>{" "}
                    for {formatPopulation(t.population, "small_area")} residents (
                    {t.km === null ? "—" : formatKm(t.km)} from the closed store)
                  </li>
                ))}
              </ul>
            </>
          )}
          {r.deciles.length > 0 && (
            <>
              <h4 className="scenario-method__h">
                Affected residents by deprivation decile (England, IoD 2025)
              </h4>
              <ul className="notes-list">
                {r.deciles.map((d) => (
                  <li key={d.decile}>
                    Decile {d.decile}
                    {d.decile === 1 ? " (most deprived 10 %)" : ""}:{" "}
                    {formatPopulation(d.population, "small_area")} residents in {d.areas} area
                    {d.areas === 1 ? "" : "s"}
                  </li>
                ))}
              </ul>
              <p className="control-hint">
                Deciles rank areas within England only; Wales, Scotland and Northern Ireland have none on
                these areas.
              </p>
            </>
          )}
        </Section>
      )}
      <Section id="scenario-charts" title="Before and after">
        <Chart
          title="Straight-line distance, most affected areas"
          spec={closureDistanceChart(m.affected)}
          empty="No area's nearest supermarket changes"
        />
        <Chart
          title={`Residents far from a supermarket, ${m.store.council.name}`}
          spec={closureThresholdChart(m)}
        />
        <Chart title={`Supermarkets by retailer, ${m.store.council.name}`} spec={closureRetailerChart(m)} />
      </Section>
      <MethodologyPanel m={closureMethodology(m)} />
    </>
  );
}

function ProductionInsights() {
  const { production: p } = useActiveScenario();
  const update = useAppStore((s) => s.updateScenario);
  if (p.status === "error")
    return <ErrorState title="Defra's balances could not be loaded" body={describeDataError(p.error)} />;
  const m = p.model;
  if (!m) return <Loading label="Loading Defra's supply balances" />;
  if (m.status !== "published")
    return (
      <>
        <section className="panel-section">
          <EmptyState
            title={`No UK supply balance for ${m.label.toLowerCase()}`}
            body={`${m.note ?? ""} The scenario is kept as a documented future extension for this basket.`}
          />
          <p className="control-hint">Baskets with a published balance:</p>
          <div className="text-btn-row">
            {m.available.map((a) => (
              <button
                key={a.basket}
                type="button"
                className="text-btn"
                onClick={() => update({ commodity: a.basket })}
              >
                {a.basket}
              </button>
            ))}
          </div>
        </section>
        <MethodologyPanel m={productionMethodology(m)} />
      </>
    );
  return (
    <>
      <Banner summary={productionNarrative(m)} confidence={m.confidence} />
      <Section id="scenario-results" title="Results">
        <ResultsTable rows={m.rows} caption={`Results of the ${m.label} production shock`} />
        <p className="control-hint">
          Not in this balance, so not shown or estimated: {m.notInBalance.join("; ").toLowerCase()}.
        </p>
        {m.entry?.notes.map((n) => (
          <p key={n} className="control-hint">
            Defra: {n}
          </p>
        ))}
      </Section>
      <Section id="scenario-charts" title="Before and after">
        <Chart title={`UK supply balance, ${m.label.toLowerCase()}`} spec={productionChart(m)} />
      </Section>
      <MethodologyPanel m={productionMethodology(m)} />
    </>
  );
}

function PortInsights() {
  const { port: d } = useActiveScenario();
  const reduction = useAppStore((s) => s.portReduction);
  const months = useAppStore((s) => s.portMonths);
  if (d.status === "error")
    return <ErrorState title="Port data could not be loaded" body={describeDataError(d.error)} />;
  const m = d.model;
  if (!m) return <Loading label="Loading port freight" />;
  if (!m.selected)
    return (
      <>
        <section className="panel-section">
          <EmptyState
            title="Choose a port"
            body="Pick a major port in the list or on the map, then set the capacity reduction."
          />
        </section>
        <MethodologyPanel m={portMethodology(m)} />
      </>
    );
  return (
    <>
      <Banner summary={portNarrative(m, reduction, months)} confidence={m.confidence} />
      <Section id="scenario-results" title="Results">
        <ResultsTable rows={m.rows} caption={`Results of the ${m.selected.name} disruption`} />
        <h4 className="scenario-method__h">Commodity evidence at this port</h4>
        <ul className="notes-list">
          <li>
            DfT agricultural products (grain, soya, tapioca…):{" "}
            {m.result?.agricultural.baseline
              ? formatTonnes(m.result.agricultural.baseline * 1000)
              : "none recorded"}{" "}
            inwards in {m.year}.
          </li>
          <li>
            UKFSR food, feed and drink port of entry:{" "}
            {m.food?.percent !== null && m.food
              ? `${m.food.percent.toFixed(1)} % of UK import volume (${m.food.year})`
              : "not attributable"}
            .{m.food?.note ? ` ${m.food.note}` : ""}
          </li>
          <li>
            Containers and roll-on/roll-off units carry no commodity in DfT&rsquo;s statistics: general
            freight capacity only.
          </li>
        </ul>
      </Section>
      <Section id="scenario-charts" title="Before and after">
        <Chart
          title={`${m.selected.name}: inward tonnage by cargo group (${m.year})`}
          spec={portGroupChart(m, reduction)}
        />
      </Section>
      <MethodologyPanel m={portMethodology(m)} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Saved scenarios: compare and export (brief §7)

function headlinesOf(model: AnyScenarioModel | null) {
  return model ? model.headlines : [];
}

function confidenceOf(model: AnyScenarioModel | null): string {
  return model ? CONFIDENCE_LABELS[model.confidence.level] : "—";
}

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function linkBase(): string {
  return typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`;
}

function Comparison({ items }: { items: ScenarioSummary[] }) {
  if (items.length === 0) return null;
  return (
    <div className="table-scroll">
      <table className="data-table data-table--compact scenario-compare">
        <caption className="visually-hidden">Saved scenarios compared</caption>
        <thead>
          <tr>
            <th scope="col">Scenario</th>
            {items.map((s) => (
              <th key={s.id} scope="col">
                <span className="scenario-letter">{SCENARIO_LETTERS[s.params.kind]}</span> {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map((i) => (
            <tr key={i}>
              <th scope="row">
                <span className="visually-hidden">Key figure </span>
                {i + 1}
              </th>
              {items.map((s) => {
                const h = headlinesOf(s.model)[i];
                return (
                  <td key={s.id}>
                    {h ? (
                      <>
                        <span className="scenario-compare__label">{h.label}</span>
                        <strong data-indicator={h.indicator.id}>
                          {formatByUnit(h.indicator.value, h.indicator.unit)}
                        </strong>
                      </>
                    ) : (
                      (s.note ?? "—")
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <th scope="row">Data confidence</th>
            {items.map((s) => (
              <td key={s.id}>{confidenceOf(s.model)}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="control-hint">
        Each scenario keeps its own measures: figures of different kinds are not combined or ranked (no
        composite score). Results are recomputed from the current published data.
      </p>
    </div>
  );
}

function SavedPanel({ current, currentName }: { current: ScenarioParams; currentName: string }) {
  const { saved, persisted } = useSavedScenarios();
  const applyScenario = useAppStore((s) => s.applyScenario);
  const [compare, setCompare] = useState<string[]>([]);
  const chosen = useMemo(() => saved.filter((s) => compare.includes(s.id)), [saved, compare]);
  const all = useMemo(
    () => [{ id: "current", name: `${currentName} (current)`, params: current }, ...chosen],
    [current, currentName, chosen],
  );
  const summaries = useScenarioSummaries(all);
  const toggle = (id: string) =>
    setCompare((c) =>
      c.includes(id) ? c.filter((x) => x !== id) : c.length >= MAX_COMPARE ? c : [...c, id],
    );
  const records: SummaryRecord[] = summaries.map((s) => ({
    scenario: s.name,
    kind: `${SCENARIO_LETTERS[s.params.kind]} ${SCENARIO_TITLES[s.params.kind].title}`,
    link: scenarioLink(s.params, linkBase()),
    rows: s.model ? s.model.rows : [],
    assumptions: s.model ? s.model.assumptions : [],
    confidence: confidenceOf(s.model),
  }));
  const ready = summaries.every((s) => s.model !== null || (s.note !== null && s.note !== "Loading…"));
  return (
    <Section id="scenario-saved" title="Saved scenarios, comparison and export">
      {!persisted && (
        <Notice tone="warn">
          This browser does not allow saving: scenarios are kept until the page is closed.
        </Notice>
      )}
      {saved.length === 0 ? (
        <p className="control-hint">No saved scenarios yet: name and save one in the controls.</p>
      ) : (
        <ul className="saved-list" aria-label="Saved scenarios">
          {saved.map((s) => (
            <li key={s.id}>
              <label className="saved-list__compare">
                <input
                  type="checkbox"
                  checked={compare.includes(s.id)}
                  disabled={!compare.includes(s.id) && compare.length >= MAX_COMPARE}
                  onChange={() => toggle(s.id)}
                />
                <span>
                  <span className="scenario-letter">{SCENARIO_LETTERS[s.params.kind]}</span> {s.name}
                </span>
              </label>
              <span className="saved-list__actions">
                <button
                  type="button"
                  className="tool-btn"
                  aria-label={`Open ${s.name}`}
                  onClick={() => applyScenario(s.params)}
                >
                  <Upload size={14} aria-hidden="true" />
                </button>
                <a
                  className="tool-btn"
                  aria-label={`Link to ${s.name}`}
                  href={scenarioLink(s.params, linkBase())}
                >
                  <Link2 size={14} aria-hidden="true" />
                </a>
                <button
                  type="button"
                  className="tool-btn"
                  aria-label={`Delete ${s.name}`}
                  onClick={() => deleteScenario(s.id)}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="control-hint">Tick up to {MAX_COMPARE} to compare them with the current scenario.</p>
      {chosen.length > 0 && <Comparison items={summaries} />}
      <div className="text-btn-row">
        <button
          type="button"
          className="text-btn"
          disabled={!ready}
          onClick={() =>
            download("foodscope-scenarios.csv", summaryCsv(records, new Date()), "text/csv;charset=utf-8")
          }
        >
          <Download size={14} aria-hidden="true" /> Export summary (CSV)
        </button>
        <button
          type="button"
          className="text-btn"
          disabled={!ready}
          onClick={() =>
            download(
              "foodscope-scenarios.json",
              `${JSON.stringify(
                {
                  generated: new Date().toISOString(),
                  note: "Scenario-modelled: static exposure calculations under the stated assumptions; not forecasts or shortages.",
                  scenarios: summaries.map((s, i) => ({
                    name: s.name,
                    params: s.params,
                    link: records[i]!.link,
                    confidence: s.model?.confidence ?? null,
                    assumptions: s.model?.assumptions ?? [],
                    results: s.model?.rows ?? [],
                  })),
                },
                null,
                2,
              )}\n`,
              "application/json",
            )
          }
        >
          <Download size={14} aria-hidden="true" /> Export (JSON)
        </button>
      </div>
      <p className="control-hint">
        Exports hold each result with its baseline, scenario, change, provenance, sources and the link that
        reproduces it.
      </p>
    </Section>
  );
}

/** The Scenario Lab's explanatory results panel (SC-01, SC-03, brief §6–§8). */
export function ScenarioInsights() {
  const kind = useAppStore((s) => s.scenarioKind);
  const s = useActiveScenario();
  const name =
    kind === "import"
      ? `${s.import.model?.commodity.label ?? ""} · ${s.import.model?.partnerName ?? ""}`
      : kind === "closure"
        ? (s.closure.model?.store.name ?? "Supermarket closure")
        : kind === "production"
          ? `${s.production.model?.label ?? ""} production`
          : (s.port.model?.selected?.name ?? "Port disruption");
  return (
    <>
      <section className="panel-section" aria-labelledby="scenario-title-heading">
        <h3 id="scenario-title-heading" className="panel-section__title">
          {SCENARIO_LETTERS[kind]} · {SCENARIO_TITLES[kind].title}
        </h3>
        <p className="control-hint">{SCENARIO_TITLES[kind].hint}.</p>
      </section>
      {kind === "import" && <ImportInsights />}
      {kind === "closure" && <ClosureInsights />}
      {kind === "production" && <ProductionInsights />}
      {kind === "port" && <PortInsights />}
      <SavedPanel current={s.params} currentName={`${SCENARIO_LETTERS[kind]} · ${name}`} />
    </>
  );
}
