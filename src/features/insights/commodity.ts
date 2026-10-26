/**
 * Commodity Supply Resilience Assessment (Stage 8, brief §3; CI-02, CI-03).
 *
 * Built from the Food Origins model (recorded partners, concentration), the Risk Explorer's supply
 * view (water stress of recorded partners, estimated exposure to the largest partner), the
 * snapshot's calendar years (seasonal sourcing, historical change) and Defra's published UK
 * balance. Everything here is national (P6): HMRC partner = country of dispatch (P3), and nothing
 * is a forecast or a shortage (P9).
 */
import { formatChange, formatCount, formatHhi, formatShare } from "@/analysis/format";
import { disruptionExposure, STRESS_CLASSES, STRESS_LABELS, type YearSummary } from "@/analysis/risk";
import { monthShares, seasonality, yearMatrix } from "@/analysis/seasonal";
import { formatMonth, MONTHS_SHORT_EN, relativeChange, seriesBreaksWithin, monthKey } from "@/analysis/trade";
import { formatMeasure } from "@/features/origins/model";
import { allocatedIndicator, stressShareIndicator } from "@/features/risks/indicators";
import type { SupplyModel } from "@/features/risks/model";
import { monthRunsText } from "@/features/seasonal/model";
import type { DataManifest } from "@/types/generated/manifest";
import type { RiskPortEntry } from "@/types/generated/risk-port-entry";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import type { UkProduction } from "@/types/generated/uk-production";
import type { Indicator } from "@/types/indicator";
import { serviceById } from "./content";
import { publishedProductionShare } from "./indicators";
import {
  datasetRefs,
  EXPLORATORY_NOTE,
  finding,
  IndicatorSet,
  REPORT_TITLES,
  snapshotsOf,
  type AssessmentReport,
  type ReportChart,
  type ReportFinding,
  type ReportKpi,
  type ReportSection,
  type RuleCheck,
  type WorkPackage,
} from "./report";

export interface CommodityInputs {
  basket: {
    id: string;
    label: string;
    definition: string;
    hsScope: string;
    group: { id: string; label: string } | null;
  };
  snapshot: TradeSnapshot;
  /** The Risk Explorer's supply model for the selected period and measure (fill "share"). */
  supply: SupplyModel;
  production: UkProduction["commodities"][number] | null;
  portEntry: RiskPortEntry | null;
  manifest: DataManifest | undefined;
  datasetIds: string[];
  link: string;
}

/** Thresholds of the stated rules (CI-03). Shares of recorded imports; no HHI class is used (P10). */
export const COMMODITY_RULES = {
  topShare: 0.5,
  topThreeShare: 0.8,
  dominantMonths: 3,
  dominantShare: 0.5,
  highStressShare: 0.25,
  productionShare: 0.5,
  allocatedShare: 0.95,
} as const;

export interface SeasonalSourcing {
  year: number;
  measure: "mass" | "value";
  totals: (number | null)[];
  /** The largest partner of each month and its share of the month's allocated imports. */
  top: ({ key: string; name: string; share: number } | null)[];
  /** Partners supplying at least half of a month's allocated imports, with those months. */
  dominant: { key: string; name: string; months: number[] }[];
  peakMonth: number | null;
  peakShare: number | null;
  troughMonth: number | null;
  troughShare: number | null;
}

/** The latest complete calendar year in the snapshot, or null when there is none. */
export function latestCompleteYear(annual: readonly YearSummary[]): YearSummary | null {
  const complete = annual.filter((y) => y.complete);
  return complete[complete.length - 1] ?? null;
}

/** Month-by-month sourcing in one calendar year: the largest partner of each month and dominance. */
export function seasonalSourcing(
  snapshot: TradeSnapshot,
  year: number,
  measure: "mass" | "value",
): SeasonalSourcing {
  const matrix = yearMatrix(snapshot, year, measure);
  const shares = monthShares(matrix);
  const top: SeasonalSourcing["top"] = matrix.months.map((_, i) => {
    let best: { key: string; name: string; share: number } | null = null;
    for (const [key, s] of shares) {
      const v = s[i];
      if (v === null || v === undefined || v <= 0) continue;
      if (!best || v > best.share || (v === best.share && key < best.key))
        best = { key, name: matrix.names.get(key) ?? key, share: v };
    }
    return best;
  });
  const dominant = new Map<string, { key: string; name: string; months: number[] }>();
  top.forEach((t, i) => {
    if (!t || t.share < COMMODITY_RULES.dominantShare) return;
    const d = dominant.get(t.key) ?? { key: t.key, name: t.name, months: [] };
    d.months.push(i + 1);
    dominant.set(t.key, d);
  });
  const s = seasonality(matrix.total);
  return {
    year,
    measure,
    totals: matrix.total,
    top,
    dominant: [...dominant.values()].sort(
      (a, b) => b.months.length - a.months.length || a.key.localeCompare(b.key),
    ),
    peakMonth: s.peakMonth,
    peakShare: s.peakShare,
    troughMonth: s.troughMonth,
    troughShare: s.troughShare,
  };
}

function nationalIndicator(
  id: string,
  label: string,
  value: number | null,
  unit: string,
  referencePeriod: string,
  method: string,
  sourceIds: [string, ...string[]] = ["S01"],
): Indicator<number> {
  return {
    id,
    label,
    value,
    unit,
    provenance: "derived",
    sourceIds,
    referencePeriod,
    coverage: "UK recorded imports allocated to partner countries",
    method,
    scope: "national_context",
    ...(value === null ? { missingReason: "not_published" as const } : {}),
  };
}

export function buildCommodityReport(x: CommodityInputs): AssessmentReport {
  const s = x.supply;
  const o = s.origins;
  const m = o.measure;
  const b = x.basket;
  const lower = b.label.toLowerCase();
  const ind = new IndicatorSet();
  const word = m === "mass" ? "net mass" : "value";
  const codeChanges = s.codeChanges ?? [];

  // ------------------------------------------------------------------ key figures
  const imports = ind.add(o.kpis.imports);
  const partners = ind.add(o.kpis.partners);
  const top = ind.add(o.kpis.top);
  const hhi = ind.add(o.kpis.concentration);
  const stress = ind.add(stressShareIndicator(s));
  const allocated = ind.add(allocatedIndicator(s));
  const topShare = o.shares[0] ?? null;
  const cr3 = o.shares.length ? o.shares.slice(0, 3).reduce((t, p) => t + p.share, 0) : null;
  const cr3Ind = ind.add(
    nationalIndicator(
      "insights.commodity.top_three_share",
      "Three largest recorded partners' share",
      o.status.noData ? null : cr3,
      "share",
      o.periodText,
      `Sum of the three largest partners' shares of recorded ${word} allocated to countries.`,
    ),
  );

  // Estimated exposure to the largest partner, month by month (RK-02 definition).
  const exposure =
    topShare && !o.status.noData ? disruptionExposure(x.snapshot, m, topShare.key, o.period.available) : null;
  const halfMonths = exposure
    ? ind.add(
        nationalIndicator(
          "insights.commodity.top_half_months",
          `Months in which ${topShare!.name} supplied at least half of recorded imports`,
          exposure.monthsAtLeastHalf,
          "months",
          o.periodText,
          `Months of the period in which ${topShare!.name}'s share of the month's recorded ${word} allocated to countries was 50 % or more, of ${formatCount(exposure.monthsWithShare)} months with recorded imports. Estimated exposure, not a shortage: other partners, stocks or UK production may substitute.`,
        ),
      )
    : null;

  // Seasonal sourcing: the latest complete calendar year.
  const complete = latestCompleteYear(s.annual);
  const seasonal = complete ? seasonalSourcing(x.snapshot, complete.year, m) : null;
  const peak =
    seasonal && seasonal.peakMonth !== null
      ? ind.add(
          nationalIndicator(
            "insights.commodity.peak_month_share",
            `Peak month's share of ${seasonal.year} recorded imports`,
            seasonal.peakShare,
            "share",
            String(seasonal.year),
            `The largest month's recorded ${word} ÷ the calendar year's (${MONTHS_SHORT_EN[seasonal.peakMonth - 1]} ${seasonal.year}); 1/12 ≈ 8.3 % would be an even year.`,
          ),
        )
      : null;

  // Historical change: earliest and latest complete calendar years.
  const years = s.annual.filter((y) => y.complete);
  const first = years[0] ?? null;
  const last = years[years.length - 1] ?? null;
  const breaks = first && last ? seriesBreaksWithin(monthKey(first.year, 1), monthKey(last.year, 12)) : [];
  const change =
    first && last && first !== last
      ? ind.add(
          nationalIndicator(
            "insights.commodity.annual_change",
            `Change in recorded imports, ${first.year} to ${last.year}`,
            relativeChange(last.total, first.total),
            "relative change",
            `${first.year} and ${last.year} (complete calendar years)`,
            `(${last.year} recorded ${word} − ${first.year}) ÷ ${first.year}, all recorded imports including unallocated and suppressed amounts.${m === "value" ? " Current prices, not adjusted for inflation." : ""}${breaks.length ? ` Crosses HMRC series breaks (${breaks.map((x) => formatMonth(x.month)).join(", ")}): part of the change may reflect how the data was collected.` : ""}`,
          ),
        )
      : null;

  const production = publishedProductionShare(b.label, x.production);
  if (production) ind.add(production);

  const kpis: ReportKpi[] = [
    {
      id: "imports",
      label: `Recorded imports (${word}), ${o.periodText}`,
      short: "Recorded imports",
      indicator: imports,
      detail: o.kpis.importsDetail,
    },
    {
      id: "top",
      label: "Largest recorded import partner's share",
      short: "Largest partner",
      indicator: top,
      detail: o.kpis.topDetail,
    },
    {
      id: "partners",
      label: "Recorded import partners",
      short: "Partners",
      indicator: partners,
      detail: o.kpis.partnersDetail,
    },
    {
      id: "stress",
      label: "Recorded imports from partners in high or critical water stress",
      short: "High water stress",
      indicator: stress,
      detail: "Partner countries' national water stress (FAO)",
    },
  ];

  // ------------------------------------------------------------------ sections
  const sections: ReportSection[] = [];
  const charts: ReportChart[] = [];
  const rows8 = o.rows.slice(0, 8);

  sections.push({
    id: "partners",
    title: "Recorded import partners",
    scopeNote:
      "National: UK recorded imports. Partner = country of dispatch, not necessarily where the food was grown.",
    intro: `${b.definition} HMRC Overseas Trade Statistics by recorded import partner, ${o.periodText}, by ${word}.`,
    findings: o.status.noData
      ? [
          finding(
            o.status.unavailableText ?? "No recorded imports in the period.",
            "national_context",
            imports,
          ),
        ]
      : [
          finding(
            `UK recorded imports of ${lower} were ${formatMeasure(o.kpis.imports.value, m)} in ${o.periodText}, from ${formatCount(o.shares.length)} partner countries.`,
            "national_context",
            imports,
            partners,
          ),
          finding(
            `${topShare?.name ?? "—"} was the largest recorded partner with ${formatShare(topShare?.share)}; the three largest together supplied ${formatShare(cr3)} (HHI ${formatHhi(o.kpis.concentration.value)}).`,
            "national_context",
            top,
            cr3Ind,
            hhi,
          ),
        ],
    tables: [
      {
        id: "partners",
        caption: `Largest recorded import partners, ${o.periodText}`,
        columns: ["Rank", "Partner", m === "mass" ? "Net mass" : "Value", "Share", "Change in share"],
        numeric: [true, false, true, true, true],
        rows: rows8.map((r) => [
          String(r.rank),
          r.name,
          formatMeasure(m === "mass" ? r.tonnes : r.gbp, m),
          formatShare(r.share),
          r.changePp === null
            ? "—"
            : `${r.changePp > 0 ? "+" : r.changePp < 0 ? "−" : ""}${Math.abs(r.changePp).toFixed(1)} pp`,
        ]),
        note: `Shares of recorded imports allocated to countries. Change in share: percentage points against ${o.status.comparisonLabel ?? "no comparison period"}.${o.status.comparisonCaution ? ` ${o.status.comparisonCaution}` : ""}`,
      },
    ],
    chartIds: rows8.length ? ["partners"] : [],
    notes: [
      ...(o.status.provisional
        ? ["The period includes provisional months, which HMRC revises for up to 18 months."]
        : []),
      ...(o.status.currentPricesNote ? [o.status.currentPricesNote] : []),
    ],
  });
  if (rows8.length)
    charts.push({
      id: "partners",
      title: `Largest recorded import partners, ${o.periodText}`,
      kind: "bar",
      format: "share",
      categories: rows8.map((r) => r.name),
      series: [{ name: "Share of recorded imports", role: "observed", values: rows8.map((r) => r.share) }],
      description: `Share of UK recorded ${lower} imports by partner, ${o.periodText}: ${rows8.map((r) => `${r.name} ${formatShare(r.share)}`).join("; ")}.`,
      source: "HMRC Overseas Trade Statistics (S01)",
    });

  // Seasonal sourcing
  const seasonalFindings: ReportFinding[] = [];
  if (seasonal) {
    if (peak && seasonal.peakMonth !== null && seasonal.troughMonth !== null)
      seasonalFindings.push(
        finding(
          `In ${seasonal.year}, recorded imports peaked in ${MONTHS_SHORT_EN[seasonal.peakMonth - 1]} (${formatShare(seasonal.peakShare)} of the year) and were lowest in ${MONTHS_SHORT_EN[seasonal.troughMonth - 1]} (${formatShare(seasonal.troughShare)}).`,
          "national_context",
          peak,
        ),
      );
    for (const d of seasonal.dominant.slice(0, 3))
      seasonalFindings.push(
        finding(
          `${d.name} supplied at least half of recorded imports in ${monthRunsText(d.months, seasonal.year)} (${formatCount(d.months.length)} month${d.months.length === 1 ? "" : "s"}).`,
          "national_context",
        ),
      );
    if (seasonal.dominant.length === 0)
      seasonalFindings.push(
        finding(
          `No single partner supplied half of recorded imports in any month of ${seasonal.year}.`,
          "national_context",
        ),
      );
  }
  sections.push({
    id: "seasonal",
    title: "Seasonal sourcing",
    scopeNote: "National: recorded imports by month.",
    intro: seasonal
      ? `Month by month in ${seasonal.year}, the latest complete calendar year in the snapshot: how much was recorded and which partner was largest.`
      : "The snapshot has no complete calendar year.",
    findings: seasonalFindings,
    tables: seasonal
      ? [
          {
            id: "seasonal",
            caption: `Recorded imports and largest partner by month, ${seasonal.year}`,
            columns: ["Month", m === "mass" ? "Net mass" : "Value", "Largest partner", "Its share"],
            numeric: [false, true, false, true],
            rows: seasonal.totals.map((t, i) => [
              `${MONTHS_SHORT_EN[i]} ${seasonal.year}`,
              formatMeasure(t, m),
              seasonal.top[i]?.name ?? "—",
              formatShare(seasonal.top[i]?.share),
            ]),
            note: "Largest partner's share of the month's recorded imports allocated to countries.",
          },
        ]
      : [],
    chartIds: seasonal ? ["seasonal"] : [],
    notes: [],
  });
  if (seasonal)
    charts.push({
      id: "seasonal",
      title: `Recorded imports by month, ${seasonal.year}`,
      kind: "column",
      format: m === "mass" ? "tonnes" : "gbp",
      categories: [...MONTHS_SHORT_EN],
      series: [{ name: "Recorded imports", role: "observed", values: seasonal.totals }],
      description: `UK recorded ${lower} imports by month in ${seasonal.year}: ${seasonal.totals
        .map((t, i) => `${MONTHS_SHORT_EN[i]} ${formatMeasure(t, m)}`)
        .join("; ")}.`,
      source: "HMRC Overseas Trade Statistics (S01)",
    });

  // Historical change
  const historyFindings: ReportFinding[] = [];
  if (change && first && last)
    historyFindings.push(
      finding(
        `Recorded imports changed by ${formatChange(change.value)} between ${first.year} and ${last.year}; the largest partner's share went from ${formatShare(first.cr1)} to ${formatShare(last.cr1)} and HHI from ${formatHhi(first.hhi)} to ${formatHhi(last.hhi)}.${breaks.length ? ` The comparison crosses HMRC series breaks (${breaks.map((x) => formatMonth(x.month)).join(", ")}), so part of the change may reflect how the data was collected.` : ""}`,
        "national_context",
        change,
      ),
    );
  sections.push({
    id: "history",
    title: "Historical changes",
    scopeNote: "National: complete calendar years only.",
    intro: "Recorded imports and concentration in each calendar year of the snapshot.",
    findings: historyFindings,
    tables: [
      {
        id: "annual",
        caption: "Recorded imports and concentration by calendar year",
        columns: [
          "Year",
          m === "mass" ? "Net mass" : "Value",
          "Partners",
          "Largest partner's share",
          "HHI",
          "Status",
        ],
        numeric: [true, true, true, true, true, false],
        rows: s.annual.map((y) => [
          String(y.year),
          formatMeasure(y.total, m),
          formatCount(y.partners),
          formatShare(y.cr1),
          formatHhi(y.hhi),
          [y.complete ? "Complete" : `${y.months} months`, y.provisional ? "provisional" : null]
            .filter(Boolean)
            .join(", "),
        ]),
        note: `HMRC series breaks: Jan 2021 (end of the EU transition period) and Jan 2022 (GB imports from the EU from customs declarations).${m === "value" ? " Values in current prices." : ""}`,
      },
    ],
    chartIds: years.length > 1 ? ["annual"] : [],
    notes: [],
  });
  if (years.length > 1)
    charts.push({
      id: "annual",
      title: "Recorded imports by complete calendar year",
      kind: "column",
      format: m === "mass" ? "tonnes" : "gbp",
      categories: years.map((y) => String(y.year)),
      series: [{ name: "Recorded imports", role: "observed", values: years.map((y) => y.total) }],
      description: `UK recorded ${lower} imports by year: ${years.map((y) => `${y.year} ${formatMeasure(y.total, m)}`).join("; ")}.`,
      source: "HMRC Overseas Trade Statistics (S01)",
    });

  // Domestic production
  const prodFindings: ReportFinding[] = [];
  const prodDoc = x.production;
  if (production && prodDoc?.status === "published")
    prodFindings.push(
      finding(
        `Defra's UK balance puts UK production at ${formatShare(production.value)} of total supply in ${production.referencePeriod}${prodDoc.scope ? ` (${prodDoc.scope})` : ""}. Annual national figures: not comparable with monthly trade.`,
        "national_context",
        production,
      ),
    );
  else
    prodFindings.push(
      finding(
        prodDoc?.status === "not_published"
          ? `Defra does not publish a UK production balance for ${lower}: ${prodDoc.note}`
          : `No Defra production balance is available for ${lower}.`,
        "national_context",
      ),
    );
  sections.push({
    id: "production",
    title: "Domestic production",
    scopeNote: "National: Defra's annual UK supply balance.",
    intro:
      "UK production as a share of total supply where Defra publishes a comparable balance. Never combined with monthly trade.",
    findings: prodFindings,
    tables: [],
    chartIds: prodDoc?.status === "published" && prodDoc.shareSeries.length > 1 ? ["production"] : [],
    notes: [],
  });
  if (prodDoc?.status === "published" && prodDoc.shareSeries.length > 1)
    charts.push({
      id: "production",
      title: "UK production as a share of supply (Defra)",
      kind: "line",
      format: "percent",
      categories: prodDoc.shareSeries.map((p) => String(p.year)),
      series: [
        {
          name: "Production share of supply",
          role: "observed",
          values: prodDoc.shareSeries.map((p) => p.value),
        },
      ],
      description: `UK production as a percentage of total supply of ${lower}: ${prodDoc.shareSeries.map((p) => `${p.year} ${p.value.toFixed(0)} %`).join("; ")}.`,
      source: `Defra (${prodDoc.sourceId})`,
    });

  // Possible geographic exposure
  const exposureFindings: ReportFinding[] = [];
  if (!o.status.noData) {
    exposureFindings.push(
      finding(
        `${formatShare(s.stress.highOrCritical)} of recorded imports came from partners whose national water stress is high or critical (FAO SDG 6.4.2); ${formatShare(s.stress.byClass.noData)} from partners with no value. A national measure of the partner country, not of how the produce was grown.`,
        "national_context",
        stress,
      ),
    );
    if (exposure && halfMonths && topShare)
      exposureFindings.push(
        finding(
          `Estimated exposure to ${topShare.name}: ${formatShare(exposure.periodShare)} of recorded imports over the period, peaking at ${formatShare(exposure.peak?.share)}${exposure.peak ? ` in ${formatMonth(exposure.peak.month)}` : ""}; at least half in ${formatCount(exposure.monthsAtLeastHalf)} of ${formatCount(exposure.monthsWithShare)} months. Not a shortage: other partners, stocks or UK production may substitute.`,
          "national_context",
          halfMonths,
        ),
      );
  }
  const latestEntry = x.portEntry?.portOfEntry;
  const entryYearIndex = latestEntry ? latestEntry.years.length - 1 : -1;
  const entryTop = latestEntry
    ? [...latestEntry.groups].sort(
        (a, z) => (z.values[entryYearIndex] ?? 0) - (a.values[entryYearIndex] ?? 0),
      )[0]
    : null;
  const entryInd =
    latestEntry && entryTop
      ? ind.add({
          id: "insights.port_entry.top",
          label: `Food, feed and drink imports by volume through ${entryTop.label}`,
          value:
            (entryTop.values[entryYearIndex] ?? null) === null
              ? null
              : entryTop.values[entryYearIndex]! / 100,
          unit: "share",
          provenance: "official_estimate",
          sourceIds: [latestEntry.sourceId],
          referencePeriod: String(latestEntry.years[entryYearIndex]),
          coverage: "All UK food, feed and drink imports (not this commodity alone)",
          method: `${latestEntry.table}, as published. All foods together: the port of entry of this commodity is not published.`,
          scope: "national_context",
        })
      : null;
  if (entryInd && entryTop)
    exposureFindings.push(
      finding(
        `Across all food, feed and drink (not ${lower} alone), ${formatShare(entryInd.value)} of UK imports by volume entered through ${entryTop.label} in ${entryInd.referencePeriod} (UK Food Security Report).`,
        "national_context",
        entryInd,
      ),
    );
  const stressRows = [...STRESS_CLASSES, "noData" as const].map((c) => ({ c, share: s.stress.byClass[c] }));
  sections.push({
    id: "exposure",
    title: "Possible geographic exposure",
    scopeNote: "National context: where recorded partners sit, not where the produce was grown.",
    intro:
      "Water stress of the recorded partner countries and the estimated exposure to the largest partner. Estimated exposure describes recorded supply that would be affected, not a shortage.",
    findings: exposureFindings,
    tables: [
      {
        id: "stress",
        caption: "Recorded imports by the partner's national water stress",
        columns: ["Water stress (FAO)", "Share of recorded imports", "Partners"],
        numeric: [false, true, true],
        rows: stressRows.map((r) => [
          STRESS_LABELS[r.c],
          formatShare(r.share),
          formatCount(s.stress.partners[r.c].length),
        ]),
        note: "World Bank / FAO AQUASTAT (S30), latest year per country (mostly 2022).",
      },
    ],
    chartIds: o.status.noData ? [] : ["stress"],
    notes: [],
  });
  if (!o.status.noData)
    charts.push({
      id: "stress",
      title: "Recorded imports by partner's national water stress",
      kind: "bar",
      format: "share",
      categories: stressRows.map((r) => STRESS_LABELS[r.c]),
      series: [
        { name: "Share of recorded imports", role: "observed", values: stressRows.map((r) => r.share) },
      ],
      description: `Share of UK recorded ${lower} imports by the partner's national water stress class: ${stressRows
        .map((r) => `${STRESS_LABELS[r.c]} ${formatShare(r.share)}`)
        .join("; ")}.`,
      source: "HMRC (S01); World Bank / FAO (S30)",
    });

  // Data gaps
  const gapRows = o.nonCountry.map((r) => [
    r.label,
    formatMeasure(m === "mass" ? r.tonnes : r.gbp, m),
    formatShare(r.shareOfTotal),
    r.note,
  ]);
  sections.push({
    id: "gaps",
    title: "Data gaps",
    intro: "What the recorded figures leave out or may revise.",
    findings: [
      finding(
        `${formatShare(s.allocatedShare)} of recorded imports have a partner country; the rest are HMRC non-country categories or suppressed, and are left out of shares and concentration.`,
        "method",
        allocated,
      ),
      ...(s.provisionalMonths
        ? [
            finding(
              `${formatCount(s.provisionalMonths)} months of the period are provisional and may be revised.`,
              "method",
            ),
          ]
        : []),
      ...(codeChanges.length
        ? [
            finding(
              `The basket's commodity codes changed ${formatCount(codeChanges.length)} time${codeChanges.length === 1 ? "" : "s"} in the snapshot; the basket keeps the series continuous.`,
              "method",
            ),
          ]
        : []),
    ],
    tables: gapRows.length
      ? [
          {
            id: "non-country",
            caption: "Recorded imports without a partner country",
            columns: ["Category", m === "mass" ? "Net mass" : "Value", "Share of all", "Note"],
            numeric: [false, true, true, false],
            rows: gapRows,
          },
        ]
      : [],
    chartIds: [],
    notes: [],
  });

  // ------------------------------------------------------------------ rules (CI-03)
  const dominantMonths = seasonal?.dominant.reduce((n, d) => n + d.months.length, 0) ?? 0;
  const prodShare = production?.value ?? null;
  const rules: RuleCheck[] = [
    {
      id: "concentration",
      rule: `Largest recorded partner at least ${formatShare(COMMODITY_RULES.topShare)} of recorded imports, or the three largest at least ${formatShare(COMMODITY_RULES.topThreeShare)}`,
      fired:
        (topShare?.share ?? 0) >= COMMODITY_RULES.topShare || (cr3 ?? 0) >= COMMODITY_RULES.topThreeShare,
      observed: `largest ${formatShare(topShare?.share)} (${topShare?.name ?? "—"}); three largest ${formatShare(cr3)}`,
      serviceId: "supply-chain-risk",
    },
    {
      id: "seasonal",
      rule: `A single partner supplied at least half of recorded imports in ${COMMODITY_RULES.dominantMonths} or more months of the latest complete year`,
      fired: dominantMonths >= COMMODITY_RULES.dominantMonths,
      observed: seasonal
        ? seasonal.dominant.length
          ? seasonal.dominant.map((d) => `${d.name} ${monthRunsText(d.months)}`).join("; ")
          : `none in ${seasonal.year}`
        : "no complete calendar year",
      serviceId: "scenario-modelling",
    },
    {
      id: "climate",
      rule: `At least ${formatShare(COMMODITY_RULES.highStressShare)} of recorded imports from partners in high or critical water stress`,
      fired: !o.status.noData && s.stress.highOrCritical >= COMMODITY_RULES.highStressShare,
      observed: formatShare(s.stress.highOrCritical),
      serviceId: "climate-agriculture",
    },
    {
      id: "domestic",
      rule: `UK production below ${formatShare(COMMODITY_RULES.productionShare)} of supply in Defra's balance, or no UK production balance published`,
      fired: prodShare === null || prodShare < COMMODITY_RULES.productionShare,
      observed:
        prodShare === null
          ? "no balance published"
          : `${formatShare(prodShare)} (${production!.referencePeriod})`,
      serviceId: "resilience-assessment",
    },
    {
      id: "data",
      rule: `Less than ${formatShare(COMMODITY_RULES.allocatedShare)} of recorded imports have a partner country, or provisional months in the period, or code changes`,
      fired:
        (s.allocatedShare ?? 1) < COMMODITY_RULES.allocatedShare ||
        s.provisionalMonths > 0 ||
        codeChanges.length > 0,
      observed: `${formatShare(s.allocatedShare)} allocated; ${formatCount(s.provisionalMonths)} provisional month${s.provisionalMonths === 1 ? "" : "s"}; ${formatCount(codeChanges.length)} code change${codeChanges.length === 1 ? "" : "s"}`,
      serviceId: "data-integration",
    },
  ];
  const fired = (id: string) => rules.find((r) => r.id === id)!;
  const why = (id: string) => `${fired(id).rule} — ${fired(id).observed}.`;
  const stake = (id: string) => serviceById(id).stakeholders;

  const wp: WorkPackage[] = [
    {
      id: "supply-chain",
      serviceId: "supply-chain-risk",
      title: "Supply chain geographic risk analysis",
      indicated: fired("concentration").fired,
      why: why("concentration"),
      challenge: `Understand how dependent UK ${lower} supply is on a few recorded partners and routes, and what lies behind the recorded country of dispatch.`,
      evidence: [
        `${topShare?.name ?? "—"} supplied ${formatShare(topShare?.share)} of recorded imports in ${o.periodText}; the three largest ${formatShare(cr3)}.`,
        `HHI ${formatHhi(o.kpis.concentration.value)} across ${formatCount(o.shares.length)} partners.`,
      ],
      analysis:
        "Partner, route and transit-country mapping, with production regions behind the main partners where open data allows, and the concentration of each stage.",
      additionalData: [
        "Country-of-origin data (not only country of dispatch)",
        "Shipping and road freight routes",
        "Production statistics of the main partner countries",
      ],
      tasks: [
        "Map recorded partners, routes and entry points",
        "Trace origin behind dispatch where data allows",
        "Identify single points of dependence",
      ],
      deliverables: ["Supply geography atlas", "Dependency summary", "Method note"],
      stakeholders: stake("supply-chain-risk"),
      limitations: ["HMRC records the country of dispatch, which may differ from where the food was grown."],
    },
    {
      id: "seasonal",
      serviceId: "scenario-modelling",
      title: "Seasonal disruption scenario modelling",
      indicated: fired("seasonal").fired,
      why: why("seasonal"),
      challenge: `Explore how a disruption of the dominant partner in its peak months would change recorded ${lower} supply, under stated assumptions.`,
      evidence: seasonal?.dominant.length
        ? seasonal.dominant
            .slice(0, 2)
            .map(
              (d) =>
                `${d.name}: at least half of recorded imports in ${monthRunsText(d.months, seasonal.year)}.`,
            )
        : ["No partner supplied half of recorded imports in any month of the latest complete year."],
      analysis:
        "Scenario Lab A over the dominant months, with substitution assumptions agreed with stakeholders and their sensitivity.",
      additionalData: [
        "Stock levels",
        "Substitution evidence from alternative partners",
        "Shelf-life and storage constraints",
      ],
      tasks: [
        "Agree scenarios and assumptions",
        "Run month-by-month scenarios",
        "Compare substitution assumptions",
      ],
      deliverables: ["Scenario results with stated assumptions", "Sensitivity note"],
      stakeholders: stake("scenario-modelling"),
      limitations: ["Scenarios estimate exposure; they are not forecasts of shortage."],
    },
    {
      id: "climate",
      serviceId: "climate-agriculture",
      title: "Climate and agricultural resilience",
      indicated: fired("climate").fired,
      why: why("climate"),
      challenge: `Assess how climate pressures in the partner countries and in UK growing regions could affect ${lower} supply.`,
      evidence: [
        `${formatShare(s.stress.highOrCritical)} of recorded imports came from partners in high or critical water stress.`,
        "Water stress is national; regional growing conditions are not in this assessment.",
      ],
      analysis:
        "Regional climate, water and yield indicators for the main growing areas behind recorded partners and in the UK.",
      additionalData: [
        "Sub-national water stress and drought indices",
        "Crop calendars and yields",
        "Climate projections",
      ],
      tasks: [
        "Identify growing regions",
        "Combine climate and water indicators",
        "Summarise exposure by season",
      ],
      deliverables: ["Climate exposure maps", "Resilience briefing"],
      stakeholders: stake("climate-agriculture"),
      limitations: ["National indicators hide regional differences."],
    },
    {
      id: "resilience",
      serviceId: "resilience-assessment",
      title: "National and regional resilience assessment",
      indicated: fired("domestic").fired,
      why: why("domestic"),
      challenge: `Bring imports, UK production and seasonal patterns together to describe how resilient ${lower} supply is, nationally and by region.`,
      evidence: [
        prodShare === null
          ? "Defra publishes no UK production balance for this basket."
          : `UK production ${formatShare(prodShare)} of supply (${production!.referencePeriod}).`,
        `Recorded imports ${formatMeasure(o.kpis.imports.value, m)} in ${o.periodText}.`,
      ],
      analysis:
        "A resilience profile combining recorded imports, UK production, seasonality and partner exposure, with comparability rules stated.",
      additionalData: ["Industry production and stock data", "Regional processing and distribution capacity"],
      tasks: [
        "Agree resilience questions",
        "Assemble comparable indicators",
        "Draft findings with stakeholders",
      ],
      deliverables: ["Resilience profile", "Indicator set for monitoring"],
      stakeholders: stake("resilience-assessment"),
      limitations: ["Monthly trade and annual production are not combined into a monthly domestic share."],
    },
    {
      id: "data",
      serviceId: "data-integration",
      title: "Geospatial data integration and automation",
      indicated: fired("data").fired,
      why: why("data"),
      challenge:
        "Keep trade, production and partner indicators current and reconciled as HMRC revises provisional months and codes change.",
      evidence: [fired("data").observed],
      analysis:
        "Automated monthly refresh of recorded trade with reconciliation to published totals and change logs.",
      additionalData: ["Agreed update schedules", "Code concordances"],
      tasks: ["Automate refresh and reconciliation", "Track revisions", "Publish a change log"],
      deliverables: ["Automated pipeline", "Reconciliation reports"],
      stakeholders: stake("data-integration"),
      limitations: ["HMRC revises recent months for up to 18 months."],
    },
    {
      id: "infrastructure",
      serviceId: "critical-infrastructure",
      title: "Critical food infrastructure mapping",
      indicated: false,
      why: "Offered as a supporting capability: the port of entry of individual commodities is not published, so no rule on this commodity triggers it.",
      challenge: "Map the ports, routes and distribution sites that UK food imports depend on.",
      evidence:
        entryInd && entryTop
          ? [
              `${formatShare(entryInd.value)} of all UK food, feed and drink imports by volume entered through ${entryTop.label} (${entryInd.referencePeriod}).`,
            ]
          : ["National port-of-entry shares are published for all foods together."],
      analysis: "Infrastructure mapping with dependencies and alternative routes.",
      additionalData: ["Port-of-entry data by commodity", "Distribution centre locations"],
      tasks: ["Compile infrastructure layers", "Map dependencies", "Identify alternatives"],
      deliverables: ["Infrastructure atlas", "Dependency register"],
      stakeholders: stake("critical-infrastructure"),
      limitations: ["Commodity-level port data is not published in open data."],
    },
  ];
  const workPackages = [...wp.filter((w) => w.indicated), ...wp.filter((w) => !w.indicated)];

  const summary: ReportFinding[] = o.status.noData
    ? [finding(o.status.unavailableText ?? "No recorded imports in the period.", "national_context", imports)]
    : [
        finding(
          `UK recorded imports of ${lower} were ${formatMeasure(o.kpis.imports.value, m)} in ${o.periodText}, from ${formatCount(o.shares.length)} partner countries.`,
          "national_context",
          imports,
          partners,
        ),
        finding(
          `${topShare?.name ?? "—"} was the largest recorded partner (${formatShare(topShare?.share)}); the three largest supplied ${formatShare(cr3)}.`,
          "national_context",
          top,
          cr3Ind,
        ),
        ...(seasonal?.dominant.length
          ? [
              finding(
                `Sourcing is seasonal: ${seasonal.dominant
                  .slice(0, 2)
                  .map((d) => `${d.name} supplied at least half in ${monthRunsText(d.months)}`)
                  .join("; ")} (${seasonal.year}).`,
                "national_context",
              ),
            ]
          : []),
        finding(
          `${formatShare(s.stress.highOrCritical)} of recorded imports came from partners in high or critical national water stress.`,
          "national_context",
          stress,
        ),
        finding(
          production
            ? `UK production was ${formatShare(production.value)} of supply in Defra's latest balance (${production.referencePeriod}).`
            : "Defra publishes no UK production balance for this basket.",
          "national_context",
          ...(production ? [production] : []),
        ),
        finding(
          `${workPackages.filter((w) => w.indicated).length} of ${workPackages.length} potential work packages are indicated by stated rules on these figures.`,
          "method",
        ),
      ];

  const { datasets, sources } = datasetRefs(x.manifest, x.datasetIds);
  return {
    schema: "foodscope.insights.report.v1",
    kind: "commodity",
    title: REPORT_TITLES.commodity,
    subject: b.label,
    subjectCode: b.hsScope,
    subtitle: `${b.label} · ${b.hsScope} · ${o.periodText}`,
    context: `An exploratory assessment of UK ${lower} supply from published open data: HMRC recorded imports by partner (country of dispatch), Defra's UK supply balance, FAO water stress of partner countries and the UK Food Security Report. ${b.definition} National figures only: they do not describe any region's or retailer's supply chain.`,
    executiveSummary: summary,
    kpis,
    sections,
    charts,
    workPackages,
    rules,
    methodology: [
      `Recorded imports: HMRC Overseas Trade Statistics for the ${b.hsScope} CN8 codes, EU and non-EU flows, by ${word}; ${o.periodText}.`,
      "Shares and concentration use imports allocated to a partner country; HMRC's non-country categories and suppressed amounts are shown separately.",
      "Concentration: largest partner's share, three largest partners' share and the Herfindahl–Hirschman Index of partner shares (0–10,000).",
      "Seasonal sourcing: the latest complete calendar year; a partner dominates a month when it supplies at least half of that month's allocated imports.",
      "Water stress: FAO SDG 6.4.2 (World Bank), whole-country values; partners without a value are counted as no data.",
      "UK production: Defra's annual balance as published, never combined with monthly trade.",
      "Work packages: deterministic rules on the figures above, listed with their thresholds and observed values.",
    ],
    limitations: [
      "HMRC's partner is the country of dispatch, not necessarily where the food was grown.",
      "Recent months are provisional and may be revised for up to 18 months.",
      "Comparisons across January 2021 and January 2022 cross HMRC series breaks.",
      ...(m === "value" ? ["Values are in current prices, not adjusted for inflation."] : []),
      "Water stress is a national measure of the partner country, not of the farms supplying the UK.",
      "Estimated exposure is not a shortage: substitution, stocks and UK production are not modelled here.",
    ],
    indicators: ind.list(),
    sources,
    datasets,
    snapshots: snapshotsOf(datasets),
    disclaimer: EXPLORATORY_NOTE,
    link: x.link,
  };
}
