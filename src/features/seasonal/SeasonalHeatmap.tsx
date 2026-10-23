import { useState, type MouseEvent } from "react";
import { formatPercentagePoints, formatShare, MONTHS_LONG, MONTHS_SHORT } from "@/analysis/format";
import {
  amountClass,
  CHANGE_BREAKS_PP,
  changeClass,
  isAvailable,
  MASS_BREAKS_T,
  VALUE_BREAKS_GBP,
} from "@/analysis/seasonal";
import { SHARE_BREAKS, shareClass } from "@/analysis/trade";
import { formatMeasure } from "@/features/origins/model";
import { useAppStore } from "@/state/store";
import { HEATMAP_MODES, type HeatmapMode } from "@/state/urlState";
import type { HeatRow, SeasonalModel } from "./model";

type CellKind = "gap" | "none" | "seq" | "div" | "nocompare";

interface Cell {
  kind: CellKind;
  cls: number | null;
  sign: "+" | "−" | null;
  text: string;
}

const pct = (b: number) => formatShare(b).replace(".0 %", " %");
const SHARE_LABELS = [
  `< ${pct(SHARE_BREAKS[0]!)}`,
  ...SHARE_BREAKS.slice(0, -1).map((b, i) => `${pct(b)}–${pct(SHARE_BREAKS[i + 1]!)}`),
  `≥ ${pct(SHARE_BREAKS[SHARE_BREAKS.length - 1]!)}`,
];
function amountLabels(measure: "mass" | "value"): string[] {
  const breaks = measure === "mass" ? MASS_BREAKS_T : VALUE_BREAKS_GBP;
  const f = (v: number) => formatMeasure(v, measure).replace(".0 ", " ").replace(".0m", "m");
  return [
    `< ${f(breaks[0]!)}`,
    ...breaks.slice(0, -1).map((b, i) => `${f(b)}–${f(breaks[i + 1]!)}`),
    `≥ ${f(breaks[breaks.length - 1]!)}`,
  ];
}
const pp = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}`;
const CHANGE_LABELS = [
  `< ${pp(CHANGE_BREAKS_PP[0]!)} pp`,
  `${pp(CHANGE_BREAKS_PP[0]!)} to ${pp(CHANGE_BREAKS_PP[1]!)} pp`,
  `${pp(CHANGE_BREAKS_PP[1]!)} to ${pp(CHANGE_BREAKS_PP[2]!)} pp`,
  `${pp(CHANGE_BREAKS_PP[2]!)} to ${pp(CHANGE_BREAKS_PP[3]!)} pp`,
  `≥ ${pp(CHANGE_BREAKS_PP[3]!)} pp`,
];

function cellFor(model: SeasonalModel, row: HeatRow, i: number, mode: HeatmapMode): Cell {
  const info = model.months[i]!;
  const label = `${row.name}, ${MONTHS_LONG[i]} ${model.year}`;
  if (!isAvailable(info))
    return {
      kind: "gap",
      cls: null,
      sign: null,
      text: `${label}: ${info.state === "not_yet_published" ? "not yet published" : "before this snapshot"}`,
    };
  const v = row.values[i] ?? 0;
  const s = row.shares[i];
  const amount = formatMeasure(v, model.measure);
  if (mode === "change") {
    const c = row.changePp[i];
    if (c === null || c === undefined) {
      const why =
        model.compareYear === null
          ? "no comparison year"
          : model.compareMonths && !isAvailable(model.compareMonths[i]!)
            ? `${MONTHS_SHORT[i]} ${model.compareYear} has no figures`
            : "no recorded imports in either month";
      return { kind: "nocompare", cls: null, sign: null, text: `${label}: ${why}` };
    }
    const cls = changeClass(c);
    return {
      kind: "div",
      cls,
      sign: cls === 2 ? null : c > 0 ? "+" : "−",
      text: `${label}: share ${formatPercentagePoints(c)} vs ${MONTHS_SHORT[i]} ${model.compareYear} (${s === null ? "—" : formatShare(s)} now)`,
    };
  }
  if (v <= 0) return { kind: "none", cls: null, sign: null, text: `${label}: no recorded imports` };
  const cls = mode === "share" ? shareClass(s ?? 0) : amountClass(v, model.measure);
  return {
    kind: "seq",
    cls,
    sign: null,
    text: `${label}: ${amount}, ${s === null ? "—" : formatShare(s)} of the month`,
  };
}

/**
 * Seasonal heatmap (SS-04, SS-05): top partners of the year × months, coloured with fixed classes
 * so years compare like for like (P11). Months without figures are hatched; "no recorded
 * imports" is its own state, never the lowest class (P12). It is a real table: every cell carries
 * its value as text for screen readers and keyboard users.
 */
export function SeasonalHeatmap({ model }: { model: SeasonalModel }) {
  const setHeatmap = useAppStore((s) => s.setHeatmap);
  const setYearMonth = useAppStore((s) => s.setYearMonth);
  const selectPartner = useAppStore((s) => s.selectPartner);
  const partner = useAppStore((s) => s.partner);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const mode = model.heatmap.mode;
  const amountWord = model.measure === "mass" ? "Tonnes" : "£";
  const modeLabels: Record<HeatmapMode, string> = {
    share: "Share",
    amount: amountWord,
    change: model.compareYear !== null ? `Change vs ${model.compareYear}` : "Change",
  };
  const legend =
    mode === "share" ? SHARE_LABELS : mode === "amount" ? amountLabels(model.measure) : CHANGE_LABELS;

  const showTip = (e: MouseEvent<HTMLElement>, text: string) => {
    const host = (e.currentTarget.closest(".heatmap") as HTMLElement | null)?.getBoundingClientRect();
    const r = e.currentTarget.getBoundingClientRect();
    if (host) setTip({ text, x: r.left - host.left + r.width / 2, y: r.top - host.top });
  };

  return (
    <div className="heatmap" onMouseLeave={() => setTip(null)}>
      <div className="segmented segmented--fill heatmap__modes" role="radiogroup" aria-label="Heatmap colour">
        {HEATMAP_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            aria-disabled={m === "change" && model.compareYear === null}
            onClick={() => (m === "change" && model.compareYear === null ? undefined : setHeatmap(m))}
          >
            {modeLabels[m]}
          </button>
        ))}
      </div>
      <p className="control-hint">
        Top {Math.min(10, model.heatmap.rows.filter((r) => r.kind === "partner").length)} recorded partners,{" "}
        {model.heatmap.rankedOn}.{" "}
        {mode === "share"
          ? "Share of each month's recorded imports allocated to countries."
          : mode === "amount"
            ? `Recorded ${model.measure === "mass" ? "net mass" : "value"} per month.`
            : `Change in share since the same month of ${model.compareYear}, percentage points.`}{" "}
        Same classes for every year and commodity.
      </p>
      <div className="table-scroll">
        <table className="heatmap__table" data-mode={mode}>
          <caption className="visually-hidden">
            {model.commodity.label} recorded import partners by month, {model.year}: {modeLabels[mode]}.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="heatmap__corner">
                <span className="visually-hidden">Partner</span>
              </th>
              {model.months.map((m, i) => (
                <th
                  key={m.key}
                  scope="col"
                  data-selected={m.month === model.month}
                  data-compare={model.compareMonth === m.month}
                >
                  <button
                    type="button"
                    className="heatmap__month"
                    aria-pressed={m.month === model.month}
                    aria-label={`${MONTHS_LONG[i]} ${model.year}`}
                    onClick={() => setYearMonth(model.year, m.month)}
                  >
                    {MONTHS_SHORT[i]!.slice(0, 1)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.heatmap.rows.map((row) => (
              <tr key={row.key} data-kind={row.kind} data-selected={row.key === partner}>
                <th scope="row">
                  {row.kind === "others" ? (
                    <span className="heatmap__name heatmap__name--others">{row.name}</span>
                  ) : (
                    <button
                      type="button"
                      className="heatmap__name"
                      aria-pressed={row.key === partner}
                      onClick={() => selectPartner(row.key)}
                      title={row.name}
                    >
                      {row.name}
                    </button>
                  )}
                </th>
                {model.months.map((m, i) => {
                  const c = cellFor(model, row, i, mode);
                  return (
                    <td
                      key={m.key}
                      className="heatmap__cell"
                      data-kind={c.kind}
                      data-class={c.cls ?? undefined}
                      data-selected={m.month === model.month}
                      data-compare={model.compareMonth === m.month}
                      onMouseEnter={(e) => showTip(e, c.text)}
                      onClick={() => setYearMonth(model.year, m.month)}
                    >
                      {c.sign && (
                        <span className="heatmap__sign" aria-hidden="true">
                          {c.sign}
                        </span>
                      )}
                      <span className="visually-hidden">{c.text}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {tip && (
        <div className="heatmap__tip" role="status" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </div>
      )}
      <ul className="heatmap__legend" aria-label="Heatmap legend">
        {legend.map((label, i) => (
          <li key={label}>
            <span
              className="heatmap__swatch"
              data-kind={mode === "change" ? "div" : "seq"}
              data-class={i}
              aria-hidden="true"
            />
            {label}
          </li>
        ))}
        {mode !== "change" && (
          <li>
            <span className="heatmap__swatch" data-kind="none" aria-hidden="true" />
            No recorded imports
          </li>
        )}
        <li>
          <span className="heatmap__swatch" data-kind="gap" aria-hidden="true" />
          {mode === "change" ? "No figures to compare" : "Not yet published"}
        </li>
      </ul>
    </div>
  );
}
