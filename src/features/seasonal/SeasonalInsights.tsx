import { BookOpenCheck, X } from "lucide-react";
import { useMemo } from "react";
import {
  formatGbp,
  formatHhi,
  formatPercentagePoints,
  formatShare,
  formatTonnes,
  MONTHS_SHORT,
} from "@/analysis/format";
import { formatMonth, MONTHS_SHORT_EN } from "@/analysis/trade";
import { ChartFrame } from "@/components/charts/ChartFrame";
import type { ChartEventParams } from "@/components/charts/useEChart";
import { ProvenanceBadge } from "@/components/dashboard/ProvenanceBadge";
import { ErrorState } from "@/components/states/ErrorState";
import { Notice } from "@/components/states/Notice";
import { SkeletonLines } from "@/components/states/Skeleton";
import { DOMESTIC_PRODUCTION_RULE } from "@/content/domesticProduction";
import { CaveatChip } from "@/features/origins/CaveatChip";
import { CommodityIcon } from "@/features/origins/CommodityIcon";
import { formatMeasure } from "@/features/origins/model";
import { NonCountryList, PartnerTable } from "@/features/origins/PartnerTable";
import { describeDataError } from "@/services/data/errors";
import { familySnapshot, findDataset, useManifest } from "@/services/data/queries";
import { useAppStore } from "@/state/store";
import { hhiOption, monthCompareOption, partnerMonthsOption, trendOption, yoyOption } from "./charts";
import { likeForLikeText, type MonthSummary, type SeasonalModel } from "./model";
import { SeasonalHeatmap } from "./SeasonalHeatmap";
import { useSeasonal } from "./useSeasonal";

function monthFromChart(p: ChartEventParams): number | null {
  const i = MONTHS_SHORT_EN.indexOf(String(p.name ?? ""));
  return i >= 0 ? i + 1 : null;
}

function cell(s: MonthSummary, f: (s: MonthSummary) => string): string {
  return s.available ? f(s) : s.info.state === "not_yet_published" ? "Not yet published" : "—";
}

function MonthComparisonSection({ model }: { model: SeasonalModel }) {
  const setCompareMonth = useAppStore((s) => s.setCompareMonth);
  const c = model.monthComparison;
  const chart = useMemo(() => monthCompareOption(model), [model]);
  if (!c) return null;
  const other = model.measure === "mass" ? "Value" : "Net mass";
  const rows: [string, (s: MonthSummary) => string][] = [
    ["Recorded imports", (s) => formatMeasure(s.total, model.measure)],
    [other, (s) => (model.measure === "mass" ? formatGbp(s.otherTotal) : formatTonnes(s.otherTotal))],
    ["Partners", (s) => String(s.partners ?? "—")],
    ["Top partner", (s) => (s.top ? `${s.top.name} ${formatShare(s.top.share)}` : "—")],
    ["Top 3 share", (s) => formatShare(s.cr3)],
    ["HHI", (s) => formatHhi(s.hhi)],
  ];
  return (
    <section className="panel-section month-compare" aria-labelledby="month-compare-heading">
      <div className="selected-partner__head">
        <h3 id="month-compare-heading" className="panel-section__title">
          Compare months · {c.title}
        </h3>
        <button
          type="button"
          className="tool-btn"
          aria-label="Stop comparing months"
          onClick={() => setCompareMonth(null)}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <table className="data-table data-table--compact">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Measure</span>
            </th>
            <th scope="col" className="num">
              {c.a.label}
            </th>
            <th scope="col" className="num">
              {c.b.label}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, f]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td className="num">{cell(c.a, f)}</td>
              <td className="num">{cell(c.b, f)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ChartFrame
        title="Share by partner"
        option={chart?.option ?? null}
        description={chart?.description}
        emptyTitle="Nothing to compare"
        emptyBody="One of the months has no published figures."
        height={Math.min(260, 22 * c.partners.length + 30)}
        meta={<ProvenanceBadge cls="derived" />}
        merge
      >
        <details className="data-details">
          <summary>Data table</summary>
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th scope="col">Partner</th>
                <th scope="col" className="num">
                  {c.a.label}
                </th>
                <th scope="col" className="num">
                  {c.b.label}
                </th>
              </tr>
            </thead>
            <tbody>
              {c.partners.map((p) => (
                <tr key={p.key}>
                  <th scope="row">{p.name}</th>
                  <td className="num">{formatShare(p.a)}</td>
                  <td className="num">{formatShare(p.b)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </ChartFrame>
    </section>
  );
}

function SelectedPartnerSection({ model }: { model: SeasonalModel }) {
  const partner = useAppStore((s) => s.partner);
  const selectPartner = useAppStore((s) => s.selectPartner);
  const chart = useMemo(() => (partner ? partnerMonthsOption(model, partner) : null), [model, partner]);
  if (!partner) return null;
  const row = model.current?.rows.find((r) => r.key === partner) ?? null;
  const name =
    row?.name ??
    model.heatmap.rows.find((r) => r.key === partner)?.name ??
    model.current?.selected?.name ??
    partner;
  return (
    <section
      className="panel-section selected-partner"
      aria-labelledby="season-partner-heading"
      aria-live="polite"
    >
      <div className="selected-partner__head">
        <h3 id="season-partner-heading" className="selected-partner__title">
          {name}
        </h3>
        <button
          type="button"
          className="tool-btn"
          onClick={() => selectPartner(null)}
          aria-label="Clear partner selection"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {!model.available ? (
        <p className="empty-line">{model.monthUnavailableText}.</p>
      ) : row ? (
        <>
          <p className="control-hint">
            Recorded import partner (country of dispatch) · rank {row.rank} of {model.current!.rows.length} in{" "}
            {model.monthLabel}
          </p>
          <dl className="stat-grid">
            <div>
              <dt>Net mass</dt>
              <dd>{formatTonnes(row.tonnes)}</dd>
            </div>
            <div>
              <dt>Value</dt>
              <dd>{formatGbp(row.gbp)}</dd>
            </div>
            <div>
              <dt>Share</dt>
              <dd>{formatShare(row.share)}</dd>
            </div>
            <div>
              <dt>
                vs{" "}
                {model.compareYear !== null
                  ? `${MONTHS_SHORT[model.month - 1]} ${model.compareYear}`
                  : "a year earlier"}
              </dt>
              <dd>{row.changePp === null ? "Not available" : formatPercentagePoints(row.changePp)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="empty-line">
          No recorded imports of {model.commodity.label.toLowerCase()} from {name} in {model.monthLabel}.
        </p>
      )}
      {chart && (
        <ChartFrame
          title={`${name} by month, ${model.year}`}
          option={chart.option}
          description={chart.description}
          height={120}
          meta={<ProvenanceBadge cls="measured" />}
          merge
        />
      )}
    </section>
  );
}

function DataHandling({ model }: { model: SeasonalModel }) {
  const manifest = useManifest();
  const openOverlay = useAppStore((s) => s.openOverlay);
  const dataset = findDataset(manifest.data, `trade.${model.commodity.id}`);
  const codes = model.codes.all;
  const scale = model.flowScale;
  return (
    <section className="panel-section" aria-labelledby="handling-heading">
      <h3 id="handling-heading" className="panel-section__title">
        How missing and changing data is handled
      </h3>
      {model.notices.length > 0 && (
        <ul className="notes-list" aria-label="Notes for this view">
          {model.notices.map((n) => (
            <li key={n.id} data-tone={n.tone}>
              {n.text}.
            </li>
          ))}
        </ul>
      )}
      <ul className="notes-list">
        <li>
          <strong>Missing months</strong> are never estimated or interpolated: they stay empty and hatched. A
          published month with no trade is shown as “no recorded imports”, not as missing.
        </li>
        <li>
          <strong>Partial years</strong> are compared like for like (only months published in both years);
          annual figures need all 12 months.
        </li>
        <li>
          <strong>Map transitions</strong> ease connection widths for at most 0.35 s (instant with reduced
          motion). Numbers on cards, tooltips and tables always show the exact month.
          {scale && (
            <>
              {" "}
              Widths use one fixed scale: 12 px = {formatMeasure(scale.value, model.measure)}, the largest
              monthly value from one partner ({scale.name}, {formatMonth(scale.month)}).
            </>
          )}
        </li>
        <li>
          <strong>Series breaks</strong> (January 2021, January 2022) raise a warning when the comparison year
          is on the other side.
        </li>
        <li>
          <strong>UK seasonal production</strong> is not shown: no verified monthly series exists for these
          commodities. {DOMESTIC_PRODUCTION_RULE}
        </li>
      </ul>
      <details className="data-details">
        <summary>Commodity codes in this basket ({codes.length})</summary>
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th scope="col">CN8</th>
                <th scope="col">Recorded</th>
                <th scope="col">Description (HMRC)</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.code}>
                  <th scope="row">
                    <code>{c.code}</code>
                  </th>
                  <td>
                    {c.firstMonth && c.lastMonth
                      ? `${formatMonth(c.firstMonth)} – ${formatMonth(c.lastMonth)}`
                      : c.monthsRecorded === 0
                        ? "No records since Jan 2019"
                        : "—"}
                  </td>
                  <td>{c.description || "No description from HMRC"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      {dataset && (
        <p className="control-hint">
          HMRC Overseas Trade Statistics (S01), retrieved {dataset.retrieval.retrievedAt.slice(0, 10)}; trade
          snapshot {familySnapshot(manifest.data, "trade")}. Code history derived by the pipeline from the
          same cached responses.
        </p>
      )}
      <button type="button" className="text-btn" onClick={() => openOverlay("evidence")}>
        <BookOpenCheck size={16} aria-hidden="true" /> Evidence and limitations
      </button>
    </section>
  );
}

/** Seasonal Supply insights: month comparison, heatmap, trend, year-on-year, concentration and notes. */
export function SeasonalInsights() {
  const { status, error, model } = useSeasonal();
  const setYearMonth = useAppStore((s) => s.setYearMonth);
  const trend = useMemo(() => (model ? trendOption(model) : null), [model]);
  const yoy = useMemo(() => (model ? yoyOption(model) : null), [model]);
  const hhi = useMemo(() => (model ? hhiOption(model) : null), [model]);

  if (status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Trade data could not be loaded" body={describeDataError(error)} />
      </section>
    );
  if (!model)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading seasonal data" />
      </section>
    );

  const onMonthClick = (p: ChartEventParams) => {
    const m = monthFromChart(p);
    if (m) setYearMonth(model.year, m);
  };
  const s = model.seasonality;
  const lfl = likeForLikeText(model);

  return (
    <>
      <section className="panel-section" aria-labelledby="seasonal-summary">
        <div className="origins-summary">
          <span className="origins-summary__icon">
            <CommodityIcon id={model.commodity.id} size={22} />
          </span>
          <div>
            <h3 id="seasonal-summary" className="origins-summary__title">
              {model.commodity.label} · {model.monthLabel}
            </h3>
            <p className="origins-summary__sub">
              Recorded UK imports by {model.measure === "mass" ? "net mass" : "value"} ·{" "}
              {model.commodity.hsScope}
            </p>
          </div>
        </div>
        <div className="chip-row">
          {model.monthInfo.provisional && (
            <span
              className="chip chip--amber"
              title="HMRC data is provisional for up to 18 months after publication"
            >
              Provisional
            </span>
          )}
          {model.current?.status.smallBase && (
            <span className="chip chip--amber">Small base (&lt; 100 t)</span>
          )}
          {model.monthInfo.state === "nil" && <span className="chip">No recorded imports</span>}
          {model.compareYear !== null && <span className="chip">Compared with {model.compareYear}</span>}
          {model.comparability.seriesBreaks.length > 0 && (
            <span className="chip chip--amber">Series break between years</span>
          )}
        </div>
        {!model.available && (
          <Notice tone="info">{model.monthUnavailableText}. Nothing is estimated for it.</Notice>
        )}
        <CaveatChip />
      </section>

      <MonthComparisonSection model={model} />
      <SelectedPartnerSection model={model} />

      <section className="panel-section" aria-labelledby="heatmap-heading">
        <h3 id="heatmap-heading" className="panel-section__title">
          Seasonal partner heatmap · {model.year}
        </h3>
        <SeasonalHeatmap model={model} />
      </section>

      <section className="panel-section">
        <ChartFrame
          title={`Monthly recorded imports · ${model.year}${model.compareYear !== null ? ` vs ${model.compareYear}` : ""}`}
          option={trend?.option ?? null}
          description={trend?.description}
          onEvents={{ click: onMonthClick }}
          height={170}
          meta={<ProvenanceBadge cls="measured" />}
          merge
        >
          <div className="series-key" aria-hidden="true">
            <span className="series-key__item">
              <span className="series-key__line" data-series="year" />
              {model.year}
            </span>
            {model.compareYear !== null && (
              <span className="series-key__item">
                <span className="series-key__line" data-series="compare" />
                {model.compareYear}
              </span>
            )}
            <span className="series-key__item">
              <span className="series-key__rule" />
              {MONTHS_SHORT[model.month - 1]} (selected)
            </span>
          </div>
          <dl className="stat-grid stat-grid--3">
            <div>
              <dt>Peak month</dt>
              <dd>
                {!s.complete
                  ? "Year incomplete"
                  : s.peakMonth
                    ? `${MONTHS_SHORT[s.peakMonth - 1]} · ${formatShare(s.peakShare)}`
                    : "No recorded imports"}
              </dd>
            </div>
            <div>
              <dt>Lowest month</dt>
              <dd>
                {!s.complete
                  ? "Year incomplete"
                  : s.troughMonth
                    ? `${MONTHS_SHORT[s.troughMonth - 1]} · ${formatShare(s.troughShare)}`
                    : "No recorded imports"}
              </dd>
            </div>
            <div>
              <dt title="Coefficient of variation of monthly totals">Month-to-month variation</dt>
              <dd>{!s.complete ? "Year incomplete" : s.cv !== null ? formatShare(s.cv) : "—"}</dd>
            </div>
          </dl>
          <p className="control-hint">
            Peak and lowest: share of the year&rsquo;s recorded imports; variation: standard deviation ÷ mean
            of the 12 monthly totals. Click a month to move the timeline.
          </p>
          {trend && (
            <details className="data-details">
              <summary>Data table</summary>
              <div className="table-scroll table-scroll--tall">
                <table className="data-table data-table--compact">
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col" className="num">
                        {model.year}
                      </th>
                      <th scope="col" className="num">
                        {model.compareYear ?? "—"}
                      </th>
                      <th scope="col" className="num">
                        Change
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.table.map((r) => (
                      <tr key={r.month}>
                        <th scope="row">{r.month}</th>
                        <td className="num">{r.year}</td>
                        <td className="num">{r.compare}</td>
                        <td className="num">{r.change}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </ChartFrame>
      </section>

      <section className="panel-section">
        <ChartFrame
          title={`Year-on-year change by month${model.compareYear !== null ? ` · ${model.year} vs ${model.compareYear}` : ""}`}
          option={yoy?.option ?? null}
          description={yoy?.description}
          emptyTitle="No comparison year"
          emptyBody={model.compareYearNote ?? undefined}
          onEvents={{ click: onMonthClick }}
          height={140}
          meta={<ProvenanceBadge cls="derived" />}
          merge
        >
          <p className="control-hint">
            {lfl ? `${lfl} (months published in both years).` : ""} Cyan: higher than {model.compareYear};
            amber: lower. No bar where either month has no figures.
          </p>
        </ChartFrame>
      </section>

      <section className="panel-section">
        <ChartFrame
          title="Monthly concentration (HHI)"
          option={hhi?.option ?? null}
          description={hhi?.description}
          onEvents={{ click: onMonthClick }}
          height={140}
          meta={<ProvenanceBadge cls="derived" />}
          merge
        >
          <p className="control-hint">
            Herfindahl–Hirschman Index of partner shares in each month (0–10,000): higher means fewer partners
            supply most of the month&rsquo;s recorded imports.
          </p>
        </ChartFrame>
      </section>

      <section className="panel-section" aria-labelledby="season-partners-heading">
        <h3 id="season-partners-heading" className="panel-section__title">
          Recorded import partners · {model.monthLabel}
        </h3>
        {model.current ? (
          <>
            <PartnerTable model={model.current} />
            <h4 className="panel-section__subtitle">Not attributed to a country</h4>
            <NonCountryList rows={model.current.nonCountry} measure={model.measure} />
          </>
        ) : (
          <p className="empty-line">{model.monthUnavailableText}.</p>
        )}
      </section>

      <DataHandling model={model} />
    </>
  );
}
