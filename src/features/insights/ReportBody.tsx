import { ChevronDown, CircleHelp, FileCheck2, Lightbulb, MapPinned, ShieldAlert } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { Metric } from "@/components/dashboard/Metric";
import { ProvenanceBadge } from "@/components/dashboard/ProvenanceBadge";
import { chartHeight, reportChartOption } from "./charts";
import { shortChecksum } from "./checksum";
import { serviceById } from "./content";
import type {
  AssessmentReport,
  ReportChart,
  ReportFinding,
  ReportIndicator,
  ReportSection,
  ReportTable,
  WorkPackage,
} from "./report";

export type ReportLayout = "panel" | "full";

const SCOPE_CHIPS: Partial<Record<ReportFinding["scope"], { label: string; cls: string }>> = {
  national_context: { label: "National context", cls: "chip chip--amber" },
  scenario: { label: "Scenario-modelled", cls: "chip chip--scenario" },
};

function Block({
  id,
  title,
  layout,
  open = true,
  children,
  aside,
}: {
  id: string;
  title: string;
  layout: ReportLayout;
  open?: boolean;
  children: ReactNode;
  aside?: ReactNode;
}) {
  const headingId = `${layout}-${id}-heading`;
  if (layout === "full")
    return (
      <section className="report-block" aria-labelledby={headingId} data-section={id}>
        <header className="report-block__head">
          <h3 id={headingId} className="report-block__title">
            {title}
          </h3>
          {aside}
        </header>
        {children}
      </section>
    );
  return (
    <details
      className="panel-section profile-section"
      open={open}
      aria-labelledby={headingId}
      data-section={id}
    >
      <summary>
        <h3 id={headingId} className="panel-section__title">
          {title}
        </h3>
      </summary>
      <div className="profile-section__body">
        {aside}
        {children}
      </div>
    </details>
  );
}

/** A finding with the indicators it rests on behind an "Evidence" disclosure (P1, P2). */
function Finding({
  f,
  byId,
  national = false,
}: {
  f: ReportFinding;
  byId: Map<string, ReportIndicator>;
  /** The whole report is national context (commodity): no chip on every line. */
  national?: boolean;
}) {
  const chip = national && f.scope === "national_context" ? undefined : SCOPE_CHIPS[f.scope];
  const evidence = f.indicatorIds.map((id) => byId.get(id)).filter((i): i is ReportIndicator => Boolean(i));
  return (
    <li className="finding" data-scope={f.scope}>
      <span className="finding__text">
        {f.text} {chip && <span className={chip.cls}>{chip.label}</span>}
      </span>
      {evidence.length > 0 && (
        <details className="finding__evidence">
          <summary>Evidence</summary>
          <ul>
            {evidence.map((i) => (
              <li key={i.id}>
                <span className="finding__evidence-label">{i.label}</span>
                <Metric indicator={i} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function Table({ t }: { t: ReportTable }) {
  return (
    <div className="table-scroll">
      <table className="data-table data-table--compact report-table">
        <caption>{t.caption}</caption>
        <thead>
          <tr>
            {t.columns.map((c, i) => (
              <th key={c} scope="col" className={t.numeric[i] ? "num" : undefined}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) =>
                ci === 0 ? (
                  <th key={ci} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={ci} className={t.numeric[ci] ? "num" : undefined}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {t.note && <p className="table-note">{t.note}</p>}
    </div>
  );
}

function Chart({ c }: { c: ReportChart }) {
  const option = useMemo(() => reportChartOption(c, "dark"), [c]);
  return (
    <ChartFrame title={c.title} option={option} description={c.description} height={chartHeight(c)}>
      {c.series.length > 1 && (
        <ul className="chart-legend" aria-label="Legend">
          {c.series.map((s) => (
            <li key={s.name}>
              <span className="chart-legend__swatch" data-role={s.role} aria-hidden="true" />
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <p className="table-note">Source: {c.source}</p>
    </ChartFrame>
  );
}

function SectionView({
  s,
  report,
  byId,
  layout,
}: {
  s: ReportSection;
  report: AssessmentReport;
  byId: Map<string, ReportIndicator>;
  layout: ReportLayout;
}) {
  const charts = s.chartIds
    .map((id) => report.charts.find((c) => c.id === id))
    .filter((c): c is ReportChart => Boolean(c));
  return (
    <Block
      id={s.id}
      title={s.title}
      layout={layout}
      open={layout === "full" || s.id === "retail" || s.id === "partners" || s.id === "results"}
      aside={s.scopeNote ? <p className="scope-note">{s.scopeNote}</p> : undefined}
    >
      {s.intro && <p className="report-intro">{s.intro}</p>}
      {s.findings.length > 0 && (
        <ul className="finding-list">
          {s.findings.map((f, i) => (
            <Finding key={i} f={f} byId={byId} national={report.kind === "commodity"} />
          ))}
        </ul>
      )}
      <div className={layout === "full" ? "report-figures" : undefined}>
        {charts.map((c) => (
          <Chart key={c.id} c={c} />
        ))}
      </div>
      {s.tables.map((t) => (
        <Table key={t.id} t={t} />
      ))}
      {s.notes.length > 0 && (
        <ul className="notes-list">
          {s.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="wp__list">
      <h5>{title}</h5>
      <ul>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

/** One potential work package with its evidence, data needs and "Why am I seeing this?" (CI-02, CI-03). */
function WorkPackageCard({ w, layout }: { w: WorkPackage; layout: ReportLayout }) {
  const [why, setWhy] = useState(false);
  const service = serviceById(w.serviceId);
  return (
    <li className="wp" data-indicated={w.indicated}>
      <div className="wp__head">
        <h4 className="wp__title">{w.title}</h4>
        <span className={w.indicated ? "chip chip--cyan" : "chip"}>
          {w.indicated ? "Indicated by the figures" : "Supporting capability"}
        </span>
      </div>
      <p className="wp__service">
        <Lightbulb size={13} aria-hidden="true" /> {service.title}
      </p>
      <p className="wp__challenge">{w.challenge}</p>
      <button type="button" className="text-btn" aria-expanded={why} onClick={() => setWhy((v) => !v)}>
        <CircleHelp size={14} aria-hidden="true" /> Why am I seeing this?
      </button>
      {why && <p className="wp__why">{w.why}</p>}
      <div className={layout === "full" ? "wp__grid" : undefined}>
        <List title="Supporting evidence" items={w.evidence} />
        <List title="Additional data required" items={w.additionalData} />
        {layout === "full" && <List title="Possible tasks" items={w.tasks} />}
        <List title="Deliverables" items={w.deliverables} />
        {layout === "full" && <List title="Stakeholders" items={w.stakeholders} />}
        <List title="Limitations" items={w.limitations} />
      </div>
      {layout === "full" && <p className="wp__analysis">Analysis: {w.analysis}</p>}
    </li>
  );
}

/**
 * The assessment report on screen: the same model as the PDF and CSV (EX-02). In the panel the
 * sections collapse; in the full-report view they read as a document.
 */
export function ReportBody({
  report,
  checksum,
  layout,
}: {
  report: AssessmentReport;
  checksum: string | null;
  layout: ReportLayout;
}) {
  const byId = useMemo(() => new Map(report.indicators.map((i) => [i.id, i])), [report]);
  const indicated = report.workPackages.filter((w) => w.indicated);
  return (
    <div className={`report report--${layout}`} data-report-kind={report.kind}>
      <header className="report__hero">
        <p className="report__eyebrow">
          <span>ConsultingWhere Insights</span> · <span>From geographic evidence to action</span>
        </p>
        <h2 className="report__title">{report.title}</h2>
        <p className="report__subtitle">{report.subtitle}</p>
        <p className="report__disclaimer" role="note">
          <ShieldAlert size={15} aria-hidden="true" /> {report.disclaimer}
        </p>
      </header>

      <Block id="summary" title="Executive summary" layout={layout}>
        <p className="report-intro">{report.context}</p>
        {layout === "full" && (
          <div className="report-kpis">
            {report.kpis.map((k) => (
              <div key={k.id} className="report-kpi">
                <span className="report-kpi__label">{k.label}</span>
                <Metric indicator={k.indicator} />
                <span className="report-kpi__detail">{k.detail}</span>
              </div>
            ))}
          </div>
        )}
        <ul className="finding-list finding-list--summary">
          {report.executiveSummary.map((f, i) => (
            <Finding key={i} f={f} byId={byId} national={report.kind === "commodity"} />
          ))}
        </ul>
      </Block>

      {report.sections.map((s) => (
        <SectionView key={s.id} s={s} report={report} byId={byId} layout={layout} />
      ))}

      <Block
        id="opportunities"
        title={
          report.kind === "scenario" ? "Interventions and further analysis" : "Consultancy opportunities"
        }
        layout={layout}
        aside={
          <p className="scope-note">
            {indicated.length} of {report.workPackages.length} indicated by stated rules. Possible further
            work, not a statement that any organisation has a requirement, budget or procurement.
          </p>
        }
      >
        <ol className="wp-list">
          {report.workPackages.map((w) => (
            <WorkPackageCard key={w.id} w={w} layout={layout} />
          ))}
        </ol>
        <details className="rules">
          <summary>
            <ChevronDown size={14} aria-hidden="true" /> The rules behind these suggestions
          </summary>
          <table className="data-table data-table--compact">
            <caption className="visually-hidden">Stated rules and whether they fired</caption>
            <thead>
              <tr>
                <th scope="col">Rule</th>
                <th scope="col">Observed</th>
                <th scope="col">Fired</th>
              </tr>
            </thead>
            <tbody>
              {report.rules.map((r) => (
                <tr key={r.id}>
                  <th scope="row">{r.rule}</th>
                  <td>{r.observed}</td>
                  <td>{r.fired ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Block>

      <Block id="method" title="Methodology and limitations" layout={layout} open={false}>
        <h4 className="report-subhead">Methodology</h4>
        <ul className="notes-list">
          {report.methodology.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <h4 className="report-subhead">Limitations</h4>
        <ul className="notes-list">
          {report.limitations.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Block>

      <Block id="sources" title="Sources, data versions and checksum" layout={layout} open={false}>
        <ul className="source-list">
          {report.sources.map((s) => (
            <li key={s.id}>
              <span className="chip">{s.id}</span> {s.title} — {s.publisher}. {s.licence}.
              {s.url && (
                <>
                  {" "}
                  <a href={s.url} target="_blank" rel="noreferrer">
                    Source
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
        <h4 className="report-subhead">Datasets</h4>
        <ul className="source-list">
          {report.datasets.map((d) => (
            <li key={d.id}>
              <MapPinned size={13} aria-hidden="true" /> {d.title} · snapshot {d.snapshot ?? "—"} ·{" "}
              {d.referencePeriod}
              {d.retrievedAt ? ` · retrieved ${d.retrievedAt.slice(0, 10)}` : ""}
            </li>
          ))}
        </ul>
        <p className="report-checksum">
          <FileCheck2 size={14} aria-hidden="true" /> Report checksum (SHA-256):{" "}
          <code title={checksum ?? undefined}>{checksum ? shortChecksum(checksum) : "computing…"}</code>
          <span className="visually-hidden">{checksum ?? ""}</span> · the PDF footer shows the same value.
        </p>
        <p className="report-provenance">
          <ProvenanceBadge cls="derived" /> Figures are as published or derived from published data; scenario
          figures are labelled Scenario-modelled.
        </p>
      </Block>
    </div>
  );
}
