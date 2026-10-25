/**
 * Indicators for the Risk Explorer (ADR-09, P1): every displayed value with its sources, reference
 * period, unit, coverage, method and provenance class. National figures carry scope
 * "national_context" (P6); nothing here is a score.
 */
import { formatShare } from "@/analysis/format";
import { FARM_UNITS, type FarmMeasure, type StressInfo } from "@/analysis/risk";
import type { Indicator } from "@/types/indicator";
import {
  PORT_MEASURE_LABELS,
  type CouncilRiskRow,
  type FarmingRegionRow,
  type LogisticsModel,
  type PortRow,
  type SupplyModel,
} from "./model";

const UK = "United Kingdom";

function missing(value: number | string | null, reason: Indicator["missingReason"] = "not_published") {
  return value === null ? { missingReason: reason } : {};
}

// ---------------------------------------------------------------------------------------------
// Supply (S01, S30, S09/S10)

export function stressShareIndicator(m: SupplyModel): Indicator<number> {
  const value = m.origins.status.noData ? null : m.stress.highOrCritical;
  return {
    id: "risk.supply.high_stress_share",
    label: "Recorded imports from partners in high or critical water stress",
    value,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S01", "S30"],
    referencePeriod: `${m.origins.periodText}; water stress latest year (mostly 2022)`,
    coverage: "Recorded import partner countries (HMRC country of dispatch)",
    method:
      "Sum of the shares of recorded imports from partners whose national level of water stress (FAO SDG 6.4.2, freshwater withdrawal ÷ available resources) is high (75–100 %) or critical (above 100 %). Partners without a value count as no data, never as low stress. A national figure: it does not describe where the produce was grown or how it was irrigated.",
    scope: "national_context",
    ...missing(value),
  };
}

export function allocatedIndicator(m: SupplyModel): Indicator<number> {
  return {
    id: "risk.supply.allocated",
    label: "Recorded imports with a partner country",
    value: m.allocatedShare,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S01"],
    referencePeriod: m.origins.periodText,
    coverage: "UK recorded imports of the basket",
    method:
      "Recorded imports allocated to a partner country ÷ all recorded imports, including HMRC's non-country categories and any suppressed amounts. Shares, HHI and exposure use the allocated part only.",
    scope: "national_context",
    ...missing(m.allocatedShare),
  };
}

export function waterStressIndicator(name: string, info: StressInfo | null): Indicator<number> {
  return {
    id: "risk.supply.water_stress",
    label: `Level of water stress: ${name}`,
    value: info ? info.value / 100 : null,
    unit: "share",
    provenance: "official_estimate",
    sourceIds: ["S30"],
    referencePeriod: info ? String(info.year) : "Latest year available",
    coverage: `${name}, whole country`,
    method:
      "FAO AQUASTAT (SDG 6.4.2), via the World Bank: total freshwater withdrawal as a percentage of available freshwater resources, for the whole country. Above 100 % means withdrawals exceed renewable resources.",
    scope: "national_context",
    ...missing(info ? info.value : null, "not_covered"),
  };
}

export function exposureIndicator(m: SupplyModel): Indicator<number> | null {
  const d = m.disruption;
  if (!d || !m.origins.selected) return null;
  return {
    id: "risk.supply.exposure",
    label: `Estimated exposure: ${m.origins.selected.name}`,
    value: d.periodShare,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S01"],
    referencePeriod: m.origins.periodText,
    coverage: "UK recorded imports allocated to partner countries",
    method:
      "The partner's share of recorded imports over the period: the part of recorded supply that would be exposed if its exports to the UK stopped. Not a shortage: other partners, stocks or UK production may substitute (the Scenario Lab models that).",
    scope: "national_context",
    ...missing(d.periodShare),
  };
}

export function peakExposureIndicator(m: SupplyModel): Indicator<number> | null {
  const d = m.disruption;
  if (!d || !m.origins.selected) return null;
  const value = d.peak?.share ?? null;
  return {
    id: "risk.supply.exposure_peak",
    label: `Highest monthly share: ${m.origins.selected.name}`,
    value,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S01"],
    referencePeriod: d.peak ? d.peak.month : m.origins.periodText,
    coverage: "UK recorded imports allocated to partner countries",
    method: "The partner's largest share of a single month's recorded imports in the period.",
    scope: "national_context",
    ...missing(value),
  };
}

// ---------------------------------------------------------------------------------------------
// Logistics (S23, S03, S31)

export function portIndicator(p: PortRow, l: LogisticsModel): Indicator<number> {
  const value = p.latest === null ? null : p.latest * 1000;
  return {
    id: `risk.port.${l.measure}`,
    label: `${p.name}: ${PORT_MEASURE_LABELS[l.measure].short.toLowerCase()}`,
    value,
    unit: "t",
    provenance: "measured",
    sourceIds: ["S23"],
    referencePeriod: String(l.latestYear),
    coverage: `${p.name} (DfT statistical port)`,
    method: `DfT PORT0499: ${PORT_MEASURE_LABELS[l.measure].long}. Tonnage of all cargo unless stated; not food.`,
    scope: "national_context",
    ...missing(value),
  };
}

export function portsTotalIndicator(l: LogisticsModel): Indicator<number> {
  const v = l.totals[l.totals.length - 1] ?? null;
  return {
    id: `risk.ports.total.${l.measure}`,
    label: `All major ports: ${PORT_MEASURE_LABELS[l.measure].short.toLowerCase()}`,
    value: v === null ? null : v * 1000,
    unit: "t",
    provenance: "measured",
    sourceIds: ["S23"],
    referencePeriod: String(l.latestYear),
    coverage: `${l.ports.length} DfT major ports with ${l.latestYear} data`,
    method: `Sum over the major ports of DfT PORT0499: ${PORT_MEASURE_LABELS[l.measure].long}.`,
    scope: "national_context",
    ...missing(v),
  };
}

export function topPortShareIndicator(l: LogisticsModel): Indicator<number> {
  const top = l.ports[0];
  const value = top?.shareOfTotal ?? null;
  return {
    id: `risk.ports.top_share.${l.measure}`,
    label: top ? `Largest port: ${top.name}` : "Largest port",
    value,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S23"],
    referencePeriod: String(l.latestYear),
    coverage: "DfT major ports",
    method: "The largest port's tonnage for the measure ÷ the total over all major ports.",
    scope: "national_context",
    ...missing(value),
  };
}

export function entryShareIndicator(
  l: LogisticsModel,
  label = "Dover/Folkestone/Eurotunnel",
): Indicator<number> {
  const e = l.entry.portOfEntry;
  const g = e.groups.find((x) => x.label === label);
  const value = g ? g.values[g.values.length - 1]! / 100 : null;
  return {
    id: "risk.ports.short_straits",
    label: "Food, feed and drink imports entering via the Short Straits",
    value,
    unit: "share",
    provenance: "official_estimate",
    sourceIds: ["S03"],
    referencePeriod: String(e.years[e.years.length - 1]),
    coverage: UK,
    method:
      "UK Food Security Report 2024, theme 3 (chart 3_2_2a): share of the volume of UK food, feed and drink imports recorded as entering at Dover, Folkestone or the Channel Tunnel. As published.",
    scope: "national_context",
    ...missing(value),
  };
}

export function srnDelayIndicator(l: LogisticsModel): Indicator<number> {
  const s = l.entry.srnDelay;
  let i = s.yearEnding.length - 1;
  while (i >= 0 && s.yearEnding[i] === null) i--;
  const value = i >= 0 ? s.yearEnding[i]! : null;
  return {
    id: "risk.roads.srn_delay",
    label: "Average delay on England's Strategic Road Network",
    value,
    unit: "seconds per vehicle per mile",
    provenance: "official_estimate",
    sourceIds: ["S03"],
    referencePeriod: i >= 0 ? `Year to ${s.months[i]}` : "Not available",
    coverage: s.coverage,
    method:
      "UK Food Security Report 2024, theme 3 (chart 3_2_1a): average delay, 12 months ending in the month shown, as published. All traffic, not food freight.",
    scope: "national_context",
    ...missing(value),
  };
}

export function farmingIndicator(r: FarmingRegionRow, measure: FarmMeasure, year: number): Indicator<number> {
  const wheat = measure === "wheat";
  return {
    id: `risk.farming.${measure}`,
    label: `${r.name}: ${FARM_UNITS[measure]}`,
    value: r.density === null ? null : wheat ? r.density / 100 : r.density,
    unit: wheat ? "share" : FARM_UNITS[measure],
    provenance: "derived",
    sourceIds: ["S31", "S33"],
    referencePeriod: `June ${year}`,
    coverage: `${r.name}${r.nation === "England" ? " (commercial holdings)" : ""}`,
    method: wheat
      ? `Wheat area (hectares, Defra June survey) ÷ the region's area (${Math.round(r.areaKm2).toLocaleString("en-GB")} km², ONS ITL1) — the percentage of the region under wheat.`
      : `Number on holdings at 1 June (Defra June survey; cattle from the Cattle Tracing System) ÷ the region's area (${Math.round(r.areaKm2).toLocaleString("en-GB")} km², ONS ITL1).`,
    scope: "local",
    ...missing(r.density),
  };
}

// ---------------------------------------------------------------------------------------------
// Community access (S13)

export function councilShareIndicator(r: CouncilRiskRow, measureLabel: string): Indicator<number> {
  return {
    id: "risk.access.priority_share",
    label: `${r.name}: small areas in ${r.nation}'s highest-priority deciles`,
    value: r.share,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S13"],
    referencePeriod: "Priority Places for Food Index v2.1",
    coverage: `${r.name} (${r.areas} small areas)`,
    method: `${measureLabel}: the council's small areas in deciles 1–2 of ${r.nation} ÷ all its small areas${r.share === null ? "" : ` (${r.priority} of ${r.areas})`}. Deciles are set within each nation, so about 20 % of a nation's areas are in them; compare councils within the same nation only.`,
    scope: "local",
    comparabilityGroup: r.nation,
    ...missing(r.share, "not_covered"),
  };
}

export function councilRankIndicator(r: CouncilRiskRow): Indicator<string> {
  const value = r.rank ? `${r.rank.rank}${r.rank.tied ? "=" : ""} of ${r.rank.of}` : null;
  return {
    id: "risk.access.rank",
    label: `Rank within ${r.nation}`,
    value,
    unit: "rank",
    provenance: "derived",
    sourceIds: ["S13"],
    referencePeriod: "Priority Places for Food Index v2.1",
    coverage: `Councils in ${r.nation}`,
    method:
      "Councils of the same nation ordered by the share above, highest first; equal shares share a rank (=). Never ranked across nations (P11).",
    scope: "local",
    comparabilityGroup: r.nation,
    ...missing(value, "not_covered"),
  };
}

export function nationShareIndicator(
  nation: string,
  value: number | null,
  measureLabel: string,
): Indicator<number> {
  return {
    id: "risk.access.nation_share",
    label: `${nation}: small areas in deciles 1–2`,
    value,
    unit: "share",
    provenance: "derived",
    sourceIds: ["S13"],
    referencePeriod: "Priority Places for Food Index v2.1",
    coverage: nation,
    method: `${measureLabel}: all of the nation's small areas in its deciles 1–2 ÷ all its small areas. About 20 % by construction (deciles); the baseline for its councils.`,
    scope: "local",
    comparabilityGroup: nation,
    ...missing(value, "not_covered"),
  };
}

/** "17.9 % of the nation's" style short text (charts, tooltips). */
export function pct(v: number | null): string {
  return formatShare(v);
}
