import { MapPinOff, Navigation } from "lucide-react";
import { useState } from "react";
import { formatGbp, formatPercentagePoints, formatShare, formatTonnes } from "@/analysis/format";
import { useAppStore } from "@/state/store";
import type { NonCountryRow, OriginsModel } from "./model";

const INITIAL_ROWS = 15;

/**
 * Partner table (FO-06): rank, partner, tonnes, £, share and change in share. Selecting a row
 * selects the partner everywhere (map, charts, cards). Trade not attributed to a country is listed
 * separately and never redistributed (P12).
 */
export function PartnerTable({ model }: { model: OriginsModel }) {
  const selected = useAppStore((s) => s.partner);
  const selectPartner = useAppStore((s) => s.selectPartner);
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? model.rows : model.rows.slice(0, INITIAL_ROWS);
  const shareWord = model.measure === "mass" ? "net mass" : "value";

  if (model.rows.length === 0) {
    return (
      <p className="empty-line">
        {model.status.noData
          ? "No published data for this period."
          : `No recorded imports of ${model.commodity.label.toLowerCase()} in ${model.periodText}.`}
      </p>
    );
  }

  return (
    <>
      <div className="table-scroll">
        <table className="data-table data-table--compact partner-table">
          <caption className="visually-hidden">
            Recorded import partners for {model.commodity.label.toLowerCase()}, {model.periodText}. Share of{" "}
            {shareWord} allocated to countries; change in percentage points vs{" "}
            {model.status.comparisonLabel ?? "no comparison period"}.
            {model.status.comparisonCaution ? ` ${model.status.comparisonCaution}` : ""}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="num">
                #
              </th>
              <th scope="col">Partner</th>
              <th scope="col" className="num">
                Tonnes
              </th>
              <th scope="col" className="num">
                £
              </th>
              <th scope="col" className="num">
                Share
              </th>
              <th
                scope="col"
                className="num"
                title={`Change in share vs the same period a year earlier, percentage points${
                  model.status.comparisonCaution ? `. ${model.status.comparisonCaution}` : ""
                }`}
                data-caution={model.status.comparisonCaution ? "true" : undefined}
              >
                ± pp{model.status.comparisonCaution && <span className="caution-mark" aria-hidden="true" />}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isSel = r.key === selected;
              return (
                <tr key={r.key} data-selected={isSel}>
                  <td className="num muted">{r.rank}</td>
                  <th scope="row">
                    <button
                      type="button"
                      className="row-btn"
                      aria-pressed={isSel}
                      onClick={() => selectPartner(r.key)}
                      title={
                        r.hmrcNames.join(", ") !== r.name
                          ? `Recorded by HMRC as ${r.hmrcNames.join(", ")}`
                          : undefined
                      }
                    >
                      {r.name}
                      {r.geometry === "none" && (
                        <MapPinOff size={12} aria-label="not drawn on the map" className="row-flag" />
                      )}
                      {r.isFlow && (
                        <Navigation
                          size={11}
                          aria-label="connection drawn"
                          className="row-flag row-flag--flow"
                        />
                      )}
                    </button>
                  </th>
                  <td className="num">{formatTonnes(r.tonnes)}</td>
                  <td className="num">{formatGbp(r.gbp)}</td>
                  <td className="num">{formatShare(r.share)}</td>
                  <td className="num" data-sign={r.changePp === null ? "none" : Math.sign(r.changePp)}>
                    {r.changePp === null ? "—" : formatPercentagePoints(r.changePp).replace(" pp", "")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {model.rows.length > INITIAL_ROWS && (
        <button type="button" className="text-btn text-btn--quiet" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show top 15 only" : `Show all ${model.rows.length} partners`}
        </button>
      )}
      {model.status.comparisonNote && <p className="control-hint">{model.status.comparisonNote}.</p>}
    </>
  );
}

export function NonCountryList({ rows, measure }: { rows: NonCountryRow[]; measure: "mass" | "value" }) {
  if (rows.length === 0) {
    return (
      <p className="empty-line">
        None in this period: HMRC recorded a partner country for all of this trade, and none was suppressed.
      </p>
    );
  }
  return (
    <table className="data-table data-table--compact">
      <thead>
        <tr>
          <th scope="col">Category</th>
          <th scope="col" className="num">
            {measure === "mass" ? "Tonnes" : "£"}
          </th>
          <th scope="col" className="num">
            Of all trade
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const v = measure === "mass" ? r.tonnes : r.gbp;
          return (
            <tr key={r.key}>
              <th scope="row" title={r.note}>
                {r.label}
              </th>
              <td className="num">
                {v === null ? "Not published" : measure === "mass" ? formatTonnes(v) : formatGbp(v)}
              </td>
              <td className="num">{r.shareOfTotal === null ? "—" : formatShare(r.shareOfTotal)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
