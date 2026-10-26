/**
 * The explanatory results text (brief §1, §6): one paragraph per scenario, built from the same
 * figures as the cards and table, plus the signed change format of the results table.
 */
import {
  formatByUnit,
  formatHhi,
  formatKm,
  formatPercentagePoints,
  formatPopulation,
  formatShare,
  formatTonnes,
} from "@/analysis/format";
import type { ClosureModel, ImportModel, PortModel, ProductionModel } from "./model";

/** A signed difference in the row's unit. */
export function formatDelta(value: number | null, unit: string): string {
  if (value === null) return "—";
  if (unit === "share") return formatPercentagePoints(value * 100);
  const abs = Math.abs(value);
  const sign = abs < 1e-9 ? "±" : value < 0 ? "−" : "+";
  switch (unit) {
    case "t":
      return `${sign}${formatTonnes(abs)}`;
    case "HHI":
      return `${sign}${formatHhi(abs)}`;
    case "km (straight-line)":
      // P13: a real change below the 0.1 km display step is "< 0.1 km", never "+0.0 km" beside a
      // non-zero relative change (e.g. 0.70 km to 0.74 km, +6.1 %).
      return sign !== "±" && abs < 0.05 ? `${sign}< 0.1 km` : `${sign}${formatKm(abs)}`;
    case "residents (small areas)":
      return `${sign}${formatPopulation(abs, "small_area")}`;
    default:
      return `${sign}${formatByUnit(abs, unit)}`;
  }
}

export function importNarrative(m: ImportModel): string {
  const r = m.result;
  if (!r || r.used.length === 0) return "No month of the scenario is in the trade snapshot.";
  const fmt = (v: number) => (m.measure === "mass" ? formatTonnes(v) : formatByUnit(v, "GBP"));
  return `If recorded ${m.measure === "mass" ? "imports" : "import value"} of ${m.commodity.label.toLowerCase()} from ${m.partnerName} fell by ${r.months[0] ? Math.round(r.months[0].effective * 100) : 0} % (${m.windowLabel}), ${fmt(r.affected)} would be affected: ${formatShare(r.shareAffected)} of the ${fmt(r.total)} recorded from partner countries in those months, leaving ${fmt(r.residual)}. ${m.partnerName}'s share would go from ${formatShare(r.partnerShareBefore)} to ${formatShare(r.partnerShareAfter)} and partner concentration (HHI) from ${formatHhi(r.hhiBefore)} to ${formatHhi(r.hhiAfter)}, if no other partner changed.`;
}

export function closureNarrative(m: ClosureModel): string {
  const r = m.result;
  if (r.affected.length === 0)
    return `${m.store.name} is not the nearest supermarket of any small area, so closing it would change no one's nearest supermarket (straight-line). ${r.nearby[1]!.after} other supermarkets lie within 2 km of it.`;
  return `If ${m.store.name} closed, ${formatPopulation(r.populationAffected, "small_area")} residents in ${r.affected.length} small area${r.affected.length === 1 ? "" : "s"} would have a different nearest supermarket, on average ${formatKm((r.meanIncrease ?? 0) / 1000)} further away in a straight line (up to ${formatKm((r.maxIncrease ?? 0) / 1000)}). ${r.nearby[1]!.after} other supermarket${r.nearby[1]!.after === 1 ? "" : "s"} would remain within 2 km of it${m.nearestOther ? `; the nearest, ${m.nearestOther.name}, is ${formatKm(m.nearestOther.km)} away` : ""}.`;
}

export function productionNarrative(m: ProductionModel): string {
  if (!m.result || !m.entry) return m.note ?? "No published balance.";
  const r = m.result;
  return `A ${Math.round((r.removed / (r.removed + r.productionAfter || 1)) * 100)} % lower UK ${m.label.toLowerCase()} production in ${m.entry.year} would remove ${formatTonnes(r.removed * 1000)}, equivalent to ${formatShare(r.removedShareOfSupply)} of total supply. With imports and exports held at their published values, UK production would be ${formatShare(r.shareAfter)} of total supply instead of ${formatShare(r.shareBefore)}.`;
}

export function portNarrative(m: PortModel, reduction: number, months: number): string {
  if (!m.selected || !m.result) return "Choose a port.";
  const i = m.result.international;
  const food =
    m.food?.percent === null || !m.food
      ? "No food, feed and drink share is attributable to this port."
      : `UKFSR records ${m.food.percent.toFixed(1)} % of UK food, feed and drink import volume entering here (${m.food.year}): about ${formatPercentagePoints(m.result.foodEntryAffected)} of it would be affected during the disruption.`;
  return `A ${reduction} % capacity reduction at ${m.selected.name} for ${months} month${months === 1 ? "" : "s"} would affect about ${formatTonnes(i.affected === null ? null : i.affected * 1000)} of inward freight from abroad, ${formatShare(i.shareOfUkAffected)} of the UK major ports' inward tonnage while it lasts. ${food}`;
}
