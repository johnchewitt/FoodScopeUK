import { BookOpenCheck, Eye, Lightbulb, Microscope, Ruler, Scale, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Metric } from "@/components/dashboard/Metric";
import { useAppStore } from "@/state/store";
import type { Explanation } from "./explain";

function Part({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="explain__part">
      <h4 className="explain__title">
        {icon}
        {title}
      </h4>
      {children}
    </div>
  );
}

/**
 * "Explain this risk" (Stage 6 brief): what is measured, why it matters, how it is calculated, the
 * observed evidence (with provenance), the sources, limitations, further evidence and options —
 * and, separately and labelled, the interpretation (never a forecast).
 */
export interface ExplainTopic {
  id: string;
  label: string;
}

export function ExplainPanel({
  explanation,
  open = false,
  topics,
  topic,
  onTopic,
}: {
  explanation: Explanation;
  open?: boolean;
  /** Alternative subjects in the same view (e.g. ports, roads, a farming region). */
  topics?: readonly ExplainTopic[];
  topic?: string;
  onTopic?: (id: string) => void;
}) {
  const openEvidence = useAppStore((s) => s.openOverlay);
  const e = explanation;
  return (
    <details
      className="panel-section explain"
      open={open}
      data-explain={e.kind}
      aria-labelledby="explain-heading"
    >
      <summary>
        <h3 id="explain-heading" className="panel-section__title">
          Explain this risk
        </h3>
        <span className="chip">{e.subject}</span>
      </summary>
      <div className="explain__body">
        {topics && topics.length > 1 && onTopic && (
          <div className="segmented segmented--fill explain__topics" role="radiogroup" aria-label="Explain">
            {topics.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={t.id === topic}
                onClick={() => onTopic(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
        <Part icon={<Eye size={14} aria-hidden="true" />} title="What is measured">
          <p>{e.measured}</p>
        </Part>
        <Part icon={<TriangleAlert size={14} aria-hidden="true" />} title="Why it matters">
          <p>{e.why}</p>
        </Part>
        <Part icon={<Ruler size={14} aria-hidden="true" />} title="How it is calculated">
          <p>{e.calculation}</p>
        </Part>
        <Part icon={<Microscope size={14} aria-hidden="true" />} title="Observed evidence">
          <dl className="explain__evidence">
            {e.observed.map((ind) => (
              <div key={ind.id} className="profile-row">
                <dt>{ind.label}</dt>
                <dd>
                  <Metric indicator={ind} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="control-hint">
            Sources:{" "}
            {e.sources.map((s, i) => (
              <span key={s.id}>
                {i > 0 && "; "}
                {s.label} ({s.id})
              </span>
            ))}
            .{" "}
            <button type="button" className="link-btn" onClick={() => openEvidence("evidence")}>
              Evidence and limitations
            </button>
          </p>
        </Part>
        <Part icon={<Scale size={14} aria-hidden="true" />} title="Interpretation (not a forecast)">
          <ul className="notes-list explain__interpretation">
            {e.interpretation.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Part>
        <Part icon={<TriangleAlert size={14} aria-hidden="true" />} title="Limitations">
          <ul className="notes-list">
            {e.limitations.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Part>
        <Part icon={<BookOpenCheck size={14} aria-hidden="true" />} title="Evidence that would help">
          <ul className="notes-list">
            {e.moreEvidence.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </Part>
        <Part icon={<Lightbulb size={14} aria-hidden="true" />} title="Options organisations often consider">
          <ul className="notes-list">
            {e.options.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <p className="control-hint">
            General options, not recommendations; nothing here describes any organisation's needs.
          </p>
        </Part>
      </div>
    </details>
  );
}
