import { BookOpen, Briefcase, FileText } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonLines } from "@/components/states/Skeleton";
import { useAppStore } from "@/state/store";
import { BrandPlate } from "./BrandPlate";
import { CONSULTING, SERVICES } from "./content";
import { ReportBody } from "./ReportBody";
import { useInsightsAssessment } from "./useInsights";

type Tab = "assessment" | "services" | "about";

const TABS: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: "assessment", label: "Assessment", icon: FileText },
  { id: "services", label: "Services", icon: Briefcase },
  { id: "about", label: "About", icon: BookOpen },
];

function Assessment() {
  const kind = useAppStore((s) => s.insightsKind);
  const a = useInsightsAssessment();
  if (!a || a.kind !== kind || a.status === "loading")
    return (
      <section className="panel-section">
        <SkeletonLines label="Building the assessment from the published data" />
      </section>
    );
  if (a.status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="The assessment could not be built" body={a.error ?? undefined} />
      </section>
    );
  if (a.status === "empty" || !a.report)
    return (
      <section className="panel-section">
        <EmptyState title="Nothing selected yet" body={a.emptyText ?? undefined} />
      </section>
    );
  return <ReportBody report={a.report} checksum={a.checksum} layout="panel" />;
}

/** The consulting services catalogue (CI-04): generic capability descriptions (P14, CI-05). */
export function ServicesCatalogue({ layout = "panel" }: { layout?: "panel" | "full" }) {
  return (
    <div className={`services services--${layout}`}>
      <p className="scope-note">
        Generic descriptions of the kinds of work this demonstrator illustrates. They name no clients,
        projects, accreditations or contracts
        {CONSULTING.status.approval === "draft-for-approval"
          ? " (draft wording, awaiting ConsultingWhere approval)"
          : ""}
        .
      </p>
      <ol className="service-list">
        {SERVICES.map((s) => (
          <li key={s.id} className="service" id={`service-${s.id}`}>
            <h4 className="service__title">{s.title}</h4>
            <p className="service__strap">{s.strapline}</p>
            <details>
              <summary>Challenges, approach, deliverables and value</summary>
              <div className="service__grid">
                <div>
                  <h5>Challenges</h5>
                  <ul>
                    {s.challenges.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5>Approach</h5>
                  <ul>
                    {s.approach.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5>Deliverables</h5>
                  <ul>
                    {s.deliverables.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5>Value</h5>
                  <ul>
                    {s.value.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

function About() {
  const a = CONSULTING.about;
  return (
    <section className="panel-section about-cw">
      <BrandPlate />
      <h3 className="panel-section__title">{a.title}</h3>
      {a.paragraphs.map((p) => (
        <p key={p} className="report-intro">
          {p}
        </p>
      ))}
      <h4 className="report-subhead">How these assessments are made</h4>
      <ul className="notes-list">
        {a.principles.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <p className="scope-note">{CONSULTING.status.note}</p>
    </section>
  );
}

/** ConsultingWhere Insights panel: the assessment, the services catalogue and About. */
export function InsightsInsights() {
  const [tab, setTab] = useState<Tab>("assessment");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next =
      e.key === "ArrowRight"
        ? (i + 1) % TABS.length
        : e.key === "ArrowLeft"
          ? (i - 1 + TABS.length) % TABS.length
          : null;
    if (next === null) return;
    e.preventDefault();
    setTab(TABS[next]!.id);
    refs.current[next]?.focus();
  };
  return (
    <>
      <div className="insights-tabs" role="tablist" aria-label="ConsultingWhere Insights">
        {TABS.map((t, i) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`insights-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`insights-tabpanel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              <Icon size={14} aria-hidden="true" /> {t.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`insights-tabpanel-${tab}`} aria-labelledby={`insights-tab-${tab}`}>
        {tab === "assessment" ? (
          <Assessment />
        ) : tab === "services" ? (
          <section className="panel-section">
            <h3 className="panel-section__title">Consulting services</h3>
            <ServicesCatalogue />
          </section>
        ) : (
          <About />
        )}
      </div>
    </>
  );
}
