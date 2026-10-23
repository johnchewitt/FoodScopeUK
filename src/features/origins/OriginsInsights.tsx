import { BookOpenCheck, MapPin, MapPinOff, X } from "lucide-react";
import { useMemo } from "react";
import { formatGbp, formatPercentagePoints, formatShare, formatTonnes } from "@/analysis/format";
import { formatMonth, parseMonthKey } from "@/analysis/trade";
import { ChartFrame } from "@/components/charts/ChartFrame";
import type { ChartEventParams } from "@/components/charts/useEChart";
import { ProvenanceBadge } from "@/components/dashboard/ProvenanceBadge";
import { ErrorState } from "@/components/states/ErrorState";
import { Notice } from "@/components/states/Notice";
import { SkeletonLines } from "@/components/states/Skeleton";
import { describeDataError } from "@/services/data/errors";
import { findDataset, useManifest } from "@/services/data/queries";
import { useAppStore } from "@/state/store";
import { CaveatChip } from "./CaveatChip";
import { CommodityIcon } from "./CommodityIcon";
import { shareOption, trendOption } from "./charts";
import type { OriginsModel } from "./model";
import { NonCountryList, PartnerTable } from "./PartnerTable";
import { useOrigins } from "./useOrigins";

const MONTH_LABEL = /^([A-Z][a-z]{2}) (\d{4})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function SelectedPartner({ model }: { model: OriginsModel }) {
  const selectPartner = useAppStore((s) => s.selectPartner);
  const sel = model.selected;
  if (!sel) return null;
  const r = sel.row;
  return (
    <section className="panel-section selected-partner" aria-labelledby="selected-heading" aria-live="polite">
      <div className="selected-partner__head">
        <h3 id="selected-heading" className="selected-partner__title">
          {sel.name}
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
      {r ? (
        <>
          <p className="control-hint">
            Recorded import partner (country of dispatch) · rank {r.rank} of {model.rows.length}
            {r.hmrcNames.join(", ") !== r.name ? ` · recorded by HMRC as ${r.hmrcNames.join(", ")}` : ""}
          </p>
          <dl className="stat-grid">
            <div>
              <dt>Net mass</dt>
              <dd>{formatTonnes(r.tonnes)}</dd>
            </div>
            <div>
              <dt>Value</dt>
              <dd>{formatGbp(r.gbp)}</dd>
            </div>
            <div>
              <dt>Share ({model.measure === "mass" ? "net mass" : "value"})</dt>
              <dd>{formatShare(r.share)}</dd>
            </div>
            <div>
              <dt>Change vs {model.status.comparisonLabel ?? "a year earlier"}</dt>
              <dd>{r.changePp === null ? "Not available" : formatPercentagePoints(r.changePp)}</dd>
            </div>
          </dl>
          <p className="control-hint">
            {r.geometry === "none" ? (
              <>
                <MapPinOff size={12} aria-hidden="true" /> Not drawn on the map: no outline or label point at
                this scale.
              </>
            ) : r.geometry === "point" ? (
              <>
                <MapPin size={12} aria-hidden="true" /> Shown as a point: too small for the 1:110m outlines.
              </>
            ) : null}
          </p>
        </>
      ) : (
        <p className="empty-line">
          No recorded imports of {model.commodity.label.toLowerCase()} from {sel.name} in {model.periodText}.
        </p>
      )}
    </section>
  );
}

function DataNotes({ model }: { model: OriginsModel }) {
  const manifest = useManifest();
  const openOverlay = useAppStore((s) => s.openOverlay);
  const dataset = findDataset(manifest.data, `trade.${model.commodity.id}`);
  return (
    <section className="panel-section" aria-labelledby="notes-heading">
      <h3 id="notes-heading" className="panel-section__title">
        About these figures
      </h3>
      <ul className="notes-list">
        <li>
          <ProvenanceBadge cls="measured" /> tonnes and £ (HMRC Overseas Trade Statistics, source S01).{" "}
          <ProvenanceBadge cls="derived" /> shares, HHI and changes, calculated here.
        </li>
        <li>
          {model.commodity.definition} CN8 codes: {model.commodity.cn8.map((c) => c.code).join(", ")}. EU and
          non-EU import flows combined.
        </li>
        <li>
          Monthly data {formatMonth(model.range.first)} – {formatMonth(model.range.last)}
          {model.range.provisionalFrom
            ? `; months from ${formatMonth(model.range.provisionalFrom)} are provisional (HMRC revises data for up to 18 months)`
            : ""}
          . Net mass for some EU trade is estimated by HMRC; value is the CIF statistical value.
        </li>
        {dataset && (
          <li>
            Retrieved {dataset.retrieval.retrievedAt.slice(0, 10)} from the HMRC API by the data pipeline;
            snapshot {manifest.data?.snapshotId}.
          </li>
        )}
      </ul>
      <button type="button" className="text-btn" onClick={() => openOverlay("evidence")}>
        <BookOpenCheck size={16} aria-hidden="true" /> Evidence and limitations
      </button>
    </section>
  );
}

/** Food Origins insights: selected partner, partner shares, table and monthly trend (FO-05/06/11). */
export function OriginsInsights() {
  const { status, error, model, snapshot } = useOrigins();
  const partner = useAppStore((s) => s.partner);
  const period = useAppStore((s) => s.period);
  const selectPartner = useAppStore((s) => s.selectPartner);
  const setYearMonth = useAppStore((s) => s.setYearMonth);
  const setYear = useAppStore((s) => s.setYear);

  const focusKey = model ? (model.selected?.key ?? model.shares[0]?.key ?? null) : null;
  const focusName = model ? (model.selected?.name ?? model.shares[0]?.name ?? null) : null;
  const trend = useMemo(
    () =>
      model && snapshot
        ? trendOption({
            snapshot,
            measure: model.measure,
            focusKey,
            focusName,
            period: { start: model.period.start, end: model.period.end },
            provisionalFrom: model.range.provisionalFrom,
          })
        : null,
    [model, snapshot, focusKey, focusName],
  );
  const share = useMemo(() => (model ? shareOption(model.shares, partner) : null), [model, partner]);

  if (status === "error")
    return (
      <section className="panel-section">
        <ErrorState title="Trade data could not be loaded" body={describeDataError(error)} />
      </section>
    );
  if (!model)
    return (
      <section className="panel-section">
        <SkeletonLines label="Loading trade data" />
      </section>
    );

  const onShareClick = (p: ChartEventParams) => {
    const key = (p.data as { key?: string } | undefined)?.key;
    if (key && key !== "__others") selectPartner(key);
  };
  const onTrendClick = (p: ChartEventParams) => {
    const m = MONTH_LABEL.exec(p.name ?? "");
    if (!m) return;
    const year = Number(m[2]);
    if (period === "year") setYear(year);
    else setYearMonth(year, MONTHS.indexOf(m[1]!) + 1);
  };
  const anchor = parseMonthKey(model.period.anchor);

  return (
    <>
      <section className="panel-section" aria-labelledby="origins-summary">
        <div className="origins-summary">
          <span className="origins-summary__icon">
            <CommodityIcon id={model.commodity.id} size={22} />
          </span>
          <div>
            <h3 id="origins-summary" className="origins-summary__title">
              {model.commodity.label} · {model.periodText}
            </h3>
            <p className="origins-summary__sub">
              Recorded UK imports by {model.measure === "mass" ? "net mass" : "value"} ·{" "}
              {model.commodity.hsScope}
            </p>
          </div>
        </div>
        <div className="chip-row">
          {model.status.provisional && (
            <span
              className="chip chip--amber"
              title="HMRC data is provisional for up to 18 months after publication"
            >
              Provisional
            </span>
          )}
          {model.status.smallBase && <span className="chip chip--amber">Small base (&lt; 100 t)</span>}
          {model.period.mode === "rolling12" && (
            <span className="chip">
              12 months to {MONTHS[anchor.month - 1]} {anchor.year}
            </span>
          )}
        </div>
        {model.status.unavailableText && <Notice tone="info">{model.status.unavailableText}.</Notice>}
        {model.status.nilMonths.length > 0 && (
          <Notice tone="info">
            No recorded imports in {model.status.nilMonths.map(formatMonth).join(", ")}.
          </Notice>
        )}
        <CaveatChip />
      </section>

      <SelectedPartner model={model} />

      <section className="panel-section">
        <ChartFrame
          title="Share of recorded imports"
          option={share?.option ?? null}
          description={share?.description}
          emptyTitle="No partner shares"
          emptyBody={
            model.status.noData ? "No published data for this period." : "No recorded imports in this period."
          }
          onEvents={{ click: onShareClick }}
          height={Math.min(260, 26 * Math.min(11, model.shares.length) + 12)}
          meta={<ProvenanceBadge cls="derived" />}
        />
      </section>

      <section className="panel-section" aria-labelledby="partners-heading">
        <h3 id="partners-heading" className="panel-section__title">
          Recorded import partners
        </h3>
        <PartnerTable model={model} />
      </section>

      <section className="panel-section" aria-labelledby="unattributed-heading">
        <h3 id="unattributed-heading" className="panel-section__title">
          Not attributed to a country
        </h3>
        <NonCountryList rows={model.nonCountry} measure={model.measure} />
      </section>

      <section className="panel-section">
        <ChartFrame
          title="Monthly recorded imports"
          option={trend?.option ?? null}
          description={trend?.description}
          onEvents={{ click: onTrendClick }}
          height={190}
          meta={<ProvenanceBadge cls="measured" />}
        >
          <p className="control-hint">
            Shaded: selected period. Green line: {focusName ?? "top partner"}. Click a month to move the
            timeline.
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
                        All partners
                      </th>
                      {focusName && (
                        <th scope="col" className="num">
                          {focusName}
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {trend.table.map((row) => (
                      <tr key={row.month}>
                        <th scope="row">{row.month}</th>
                        <td className="num">{row.total}</td>
                        {focusName && <td className="num">{row.focus}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </ChartFrame>
      </section>

      <DataNotes model={model} />
    </>
  );
}
