import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { KeyboardEvent } from "react";
import { getModule } from "@/app/modules";
import { MONTHS_LONG, MONTHS_SHORT } from "@/analysis/format";
import { useAppStore } from "@/state/store";

/**
 * Bottom timeline placeholder (SS-01 preview). Month selection is real navigation state
 * (stored and mirrored to the URL) but no monthly data is loaded until build stage 3.
 */
export function TimelineBar() {
  const module = useAppStore((s) => s.module);
  const month = useAppStore((s) => s.month);
  const setMonth = useAppStore((s) => s.setMonth);
  const stepMonth = useAppStore((s) => s.stepMonth);
  const mod = getModule(module);
  if (!mod.usesTimeline) return null;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") stepMonth(1);
    else if (e.key === "ArrowLeft") stepMonth(-1);
    else if (e.key === "Home") setMonth(1);
    else if (e.key === "End") setMonth(12);
    else return;
    e.preventDefault();
  };

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline__bar glass">
        <button
          type="button"
          className="timeline__play"
          aria-disabled="true"
          aria-label="Play through months (available once monthly data is loaded)"
          title="Play is available once monthly data is loaded"
          onClick={(e) => e.preventDefault()}
        >
          <Play size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="tool-btn timeline__step"
          onClick={() => stepMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <div className="timeline__track">
          <div className="timeline__months" role="group" aria-label="Month" onKeyDown={onKeyDown}>
            {MONTHS_SHORT.map((label, i) => {
              const m = i + 1;
              return (
                <button
                  key={label}
                  type="button"
                  className="month-btn"
                  aria-pressed={month === m}
                  title={MONTHS_LONG[i]}
                  onClick={() => setMonth(month === m ? null : m)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="timeline__status" aria-live="polite">
            {month ? `${MONTHS_LONG[month - 1]} selected. ` : ""}Preview only: monthly trade data is added in
            build stage 3.
          </p>
        </div>
        <button
          type="button"
          className="tool-btn timeline__step"
          onClick={() => stepMonth(1)}
          aria-label="Next month"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
