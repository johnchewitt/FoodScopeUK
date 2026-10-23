import { MONTHS_SHORT } from "@/analysis/format";
import { parseMonthKey, type MonthKey } from "@/analysis/trade";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonLines } from "@/components/states/Skeleton";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import type { PeriodMode } from "@/state/urlState";
import { CaveatChip } from "./CaveatChip";
import { CommodityPicker } from "./CommodityPicker";
import { resolveCommodity, useOrigins } from "./useOrigins";

const PERIODS: { id: PeriodMode; label: string; hint: string }[] = [
  { id: "rolling12", label: "12 months", hint: "Rolling 12 months ending at the timeline month" },
  { id: "month", label: "Month", hint: "The single month selected on the timeline" },
  { id: "year", label: "Year", hint: "A calendar year" },
];

function yearsIn(first: MonthKey, last: MonthKey): number[] {
  const a = parseMonthKey(first).year;
  const b = parseMonthKey(last).year;
  return Array.from({ length: b - a + 1 }, (_, i) => b - i);
}

/** Food Origins controls (FO-01 commodity, FO-02 measure, FO-03 connections, FO-07 period). */
export function OriginsControls() {
  const { status, error, index, model, unknownCommodity } = useOrigins();
  const commodity = useAppStore((s) => s.commodity);
  const period = useAppStore((s) => s.period);
  const setPeriod = useAppStore((s) => s.setPeriod);
  const year = useAppStore((s) => s.year);
  const setYear = useAppStore((s) => s.setYear);
  const measure = useAppStore((s) => s.measure);
  const setMeasure = useAppStore((s) => s.setMeasure);
  const flowCount = useAppStore((s) => s.flowCount);
  const setFlowCount = useAppStore((s) => s.setFlowCount);

  if (status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Trade data could not be loaded" body={describeDataError(error)} />
      </section>
    );
  if (!index)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading commodities" />
      </section>
    );

  const active = resolveCommodity(index, commodity);
  const range = active?.months;
  const years = range ? yearsIn(range.first, range.last) : [];
  const shownYear = model ? parseMonthKey(model.period.anchor).year : (year ?? years[0]);

  return (
    <>
      <CommodityPicker index={index} unknownCommodity={unknownCommodity} />

      <section className="panel-section" aria-labelledby="period-heading">
        <h3 id="period-heading" className="panel-section__title">
          Period
        </h3>
        <div className="segmented segmented--fill" role="radiogroup" aria-labelledby="period-heading">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={period === p.id}
              title={p.hint}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="field-row">
          <span>Year</span>
          <select
            className="select"
            value={shownYear ?? ""}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-describedby="period-hint"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
                {range && y === parseMonthKey(range.last).year && parseMonthKey(range.last).month < 12
                  ? ` (to ${MONTHS_SHORT[parseMonthKey(range.last).month - 1]})`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <p id="period-hint" className="control-hint">
          {model ? (
            <>
              Showing <strong>{model.periodText}</strong>
              {period !== "year" ? ". Choose the month on the timeline." : "."}
            </>
          ) : (
            "Loading period…"
          )}
        </p>
      </section>

      <section className="panel-section" aria-labelledby="measure-heading">
        <h3 id="measure-heading" className="panel-section__title">
          Measure
        </h3>
        <div className="segmented segmented--fill" role="radiogroup" aria-labelledby="measure-heading">
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
        <p className="control-hint">
          Shares, map shading, connections and charts use this measure. Value is HMRC&rsquo;s statistical
          value (cost, insurance and freight to the UK border).
        </p>
      </section>

      <section className="panel-section" aria-labelledby="flows-heading">
        <h3 id="flows-heading" className="panel-section__title">
          Connections to the UK
        </h3>
        <label className="field-row field-row--stack">
          <span>
            Draw the top <strong>{flowCount}</strong> partners
          </span>
          <input
            type="range"
            className="range"
            min={3}
            max={25}
            step={1}
            value={flowCount}
            onChange={(e) => setFlowCount(Number(e.target.value))}
            aria-valuetext={`Top ${flowCount} partners`}
          />
        </label>
        <p className="control-hint">
          Line width is proportional to recorded {measure === "mass" ? "net mass" : "value"}. Lines are
          symbolic, not shipping routes.
        </p>
        <CaveatChip />
      </section>
    </>
  );
}
