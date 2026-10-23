import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { KeyboardEvent } from "react";
import { getModule } from "@/app/modules";
import { MONTHS_LONG, MONTHS_SHORT } from "@/analysis/format";
import { addMonths, monthDiff, monthKey, parseMonthKey } from "@/analysis/trade";
import { useOrigins } from "@/features/origins/useOrigins";
import { useAppStore } from "@/state/store";

function PlayButton({ note }: { note: string }) {
  return (
    <button
      type="button"
      className="timeline__play"
      aria-disabled="true"
      aria-label={`Play through months (${note})`}
      title={note}
      onClick={(e) => e.preventDefault()}
    >
      <Play size={16} aria-hidden="true" />
    </button>
  );
}

/**
 * Food Origins timeline: the months of the selected year, with unpublished months disabled.
 * Choosing a month sets the single month or the end of the rolling 12 months (FO-07).
 */
function OriginsTimeline() {
  const { model, status } = useOrigins();
  const period = useAppStore((s) => s.period);
  const setPeriod = useAppStore((s) => s.setPeriod);
  const setYearMonth = useAppStore((s) => s.setYearMonth);

  if (!model) {
    return (
      <section className="timeline" aria-label="Timeline">
        <div className="timeline__bar glass">
          <PlayButton note={status === "error" ? "monthly data unavailable" : "loading"} />
          <p className="timeline__status" aria-live="polite">
            {status === "error" ? "Monthly trade data could not be loaded." : "Loading monthly data…"}
          </p>
        </div>
      </section>
    );
  }

  const { first, last } = model.range;
  const anchor = model.period.anchor;
  const { year } = parseMonthKey(anchor);
  const inRange = (key: string) => monthDiff(first, key) >= 0 && monthDiff(key, last) >= 0;
  const inPeriod = new Set(model.period.available);
  const move = (delta: number) => {
    const next = addMonths(anchor, delta);
    if (!inRange(next)) return;
    const p = parseMonthKey(next);
    setYearMonth(p.year, p.month);
  };
  const choose = (m: number) => {
    const key = monthKey(year, m);
    if (!inRange(key)) return;
    if (period === "year") setPeriod("month");
    setYearMonth(year, m);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") move(1);
    else if (e.key === "ArrowLeft") move(-1);
    else if (e.key === "Home") move(-monthDiff(first, anchor));
    else if (e.key === "End") move(monthDiff(anchor, last));
    else return;
    e.preventDefault();
  };

  return (
    <section className="timeline" aria-label="Timeline">
      <div className="timeline__bar glass">
        <PlayButton note="play arrives with Seasonal Supply in build stage 3" />
        <button
          type="button"
          className="tool-btn timeline__step"
          onClick={() => move(-1)}
          aria-label="Previous month"
          aria-disabled={!inRange(addMonths(anchor, -1))}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <div className="timeline__track">
          <div className="timeline__months" role="group" aria-label={`Month, ${year}`} onKeyDown={onKeyDown}>
            {MONTHS_SHORT.map((label, i) => {
              const m = i + 1;
              const key = monthKey(year, m);
              const available = inRange(key);
              return (
                <button
                  key={label}
                  type="button"
                  className="month-btn"
                  aria-pressed={period !== "year" && key === anchor}
                  aria-disabled={!available}
                  data-in-period={inPeriod.has(key)}
                  title={
                    available
                      ? `${MONTHS_LONG[i]} ${year}`
                      : `${MONTHS_LONG[i]} ${year}: not yet published by HMRC`
                  }
                  onClick={() => choose(m)}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="timeline__status" aria-live="polite">
            <span className="timeline__year">{year}</span> Showing {model.periodText}
            {model.status.provisional ? " · provisional" : ""} · latest published{" "}
            {MONTHS_SHORT[parseMonthKey(last).month - 1]} {parseMonthKey(last).year}
          </p>
        </div>
        <button
          type="button"
          className="tool-btn timeline__step"
          onClick={() => move(1)}
          aria-label="Next month"
          aria-disabled={!inRange(addMonths(anchor, 1))}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

/**
 * Bottom timeline. Food Origins drives its period from it (Stage 2); other modules keep the
 * Stage 1 preview (month selection is real navigation state, mirrored to the URL).
 */
export function TimelineBar() {
  const module = useAppStore((s) => s.module);
  const month = useAppStore((s) => s.month);
  const setMonth = useAppStore((s) => s.setMonth);
  const stepMonth = useAppStore((s) => s.stepMonth);
  const mod = getModule(module);
  if (!mod.usesTimeline) return null;
  if (module === "origins") return <OriginsTimeline />;

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
        <PlayButton note="available once monthly data is loaded" />
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
            {month ? `${MONTHS_LONG[month - 1]} selected. ` : ""}Preview only: monthly data for this module is
            added in build stage {mod.buildStage}.
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
