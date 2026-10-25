import { Sparkles } from "lucide-react";
import { MONTHS_LONG, MONTHS_SHORT } from "@/analysis/format";
import { isAvailable } from "@/analysis/seasonal";
import { ErrorState } from "@/components/states/ErrorState";
import { Notice } from "@/components/states/Notice";
import { SkeletonLines } from "@/components/states/Skeleton";
import { DOMESTIC_PRODUCTION_RULE } from "@/content/domesticProduction";
import { CaveatChip } from "@/features/origins/CaveatChip";
import { CommodityPicker } from "@/features/origins/CommodityPicker";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import { useSeasonal } from "./useSeasonal";

/** Seasonal Supply controls (SS-01 year and comparison, SS-07 supply view, SS-08 example). */
export function SeasonalControls() {
  const { status, error, index, model, unknownCommodity } = useSeasonal();
  const setYear = useAppStore((s) => s.setYear);
  const setCompareYear = useAppStore((s) => s.setCompareYear);
  const setCompareMonth = useAppStore((s) => s.setCompareMonth);
  const setCommodity = useAppStore((s) => s.setCommodity);
  const setYearMonth = useAppStore((s) => s.setYearMonth);
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
  if (!index || !model)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading seasonal data" />
      </section>
    );

  const { year, years } = model;
  const earlier = years.filter((y) => y < year).reverse();
  const lastMonth = Number(model.range.last.slice(5));
  const lastYear = years[years.length - 1]!;
  const yearOption = (y: number) =>
    y === lastYear && lastMonth < 12 ? `${y} (to ${MONTHS_SHORT[lastMonth - 1]})` : String(y);
  // SS-08: "How does the UK's tomato supply change between January and July?" — the latest
  // complete year in the snapshot.
  const exampleYear = lastMonth === 12 ? lastYear : lastYear - 1;
  const runExample = () => {
    setCommodity("tomatoes");
    setYearMonth(exampleYear, 1);
    setCompareMonth(7);
  };

  return (
    <>
      <CommodityPicker index={index} unknownCommodity={unknownCommodity} />

      <section className="panel-section" aria-labelledby="season-year-heading">
        <h3 id="season-year-heading" className="panel-section__title">
          Year and comparison
        </h3>
        <label className="field-row">
          <span>Year</span>
          <select className="select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[...years].reverse().map((y) => (
              <option key={y} value={y}>
                {yearOption(y)}
              </option>
            ))}
          </select>
        </label>
        <label className="field-row">
          <span>Compare with</span>
          <select
            className="select"
            value={model.compareYear ?? ""}
            disabled={earlier.length === 0}
            onChange={(e) => setCompareYear(Number(e.target.value))}
            aria-describedby="compare-year-hint"
          >
            {earlier.length === 0 && <option value="">No earlier year</option>}
            {earlier.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <p id="compare-year-hint" className="control-hint">
          {model.compareYear !== null
            ? `Year-on-year change, the trend and the heatmap's change view compare each month of ${year} with the same month of ${model.compareYear}.`
            : model.compareYearNote}
        </p>
        <label className="field-row">
          <span>Compare month</span>
          <select
            className="select"
            value={model.compareMonth ?? ""}
            onChange={(e) => setCompareMonth(e.target.value === "" ? null : Number(e.target.value))}
            aria-describedby="compare-month-hint"
          >
            <option value="">Off</option>
            {model.months.map((m, i) => (
              <option key={m.key} value={m.month} disabled={!isAvailable(m)}>
                {MONTHS_LONG[i]}
                {isAvailable(m) ? "" : " (not published)"}
              </option>
            ))}
          </select>
        </label>
        <p id="compare-month-hint" className="control-hint">
          Shows {MONTHS_SHORT[model.month - 1]} {year} beside another month of the same year in the Insights
          panel. The timeline marks it with a dashed outline.
        </p>
        <button type="button" className="text-btn example-btn" onClick={runExample}>
          <Sparkles size={15} aria-hidden="true" />
          Example: how does tomato supply change between January and July {exampleYear}?
        </button>
      </section>

      <section className="panel-section" aria-labelledby="season-measure-heading">
        <h3 id="season-measure-heading" className="panel-section__title">
          Measure
        </h3>
        <div className="segmented segmented--fill" role="radiogroup" aria-labelledby="season-measure-heading">
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

      <section className="panel-section" aria-labelledby="season-supply-heading">
        <h3 id="season-supply-heading" className="panel-section__title">
          Supply shown
        </h3>
        <div className="segmented segmented--fill" role="radiogroup" aria-labelledby="season-supply-heading">
          <button type="button" role="radio" aria-checked="true">
            Imports
          </button>
          <button
            type="button"
            role="radio"
            aria-checked="false"
            aria-disabled="true"
            aria-describedby="domestic-note"
            title="No verified monthly UK production series for this commodity"
          >
            UK production
          </button>
          <button
            type="button"
            role="radio"
            aria-checked="false"
            aria-disabled="true"
            aria-describedby="domestic-note"
            title="No verified monthly UK production series for this commodity"
          >
            Combined
          </button>
        </div>
        <Notice tone="info">
          <span id="domestic-note">
            <strong>UK seasonal production: not published monthly, not shown.</strong> There is no monthly UK
            production series for {model.commodity.label.toLowerCase()}. {model.domestic.detail}{" "}
            {DOMESTIC_PRODUCTION_RULE}
          </span>
        </Notice>
      </section>

      <section className="panel-section" aria-labelledby="season-flows-heading">
        <h3 id="season-flows-heading" className="panel-section__title">
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
          Line width uses one fixed scale for every month and year, so a thicker line always means more{" "}
          {measure === "mass" ? "tonnes" : "£"}. Lines are symbolic, not shipping routes.
        </p>
        <CaveatChip />
      </section>
    </>
  );
}
