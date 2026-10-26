import type { ScenarioKind } from "@/state/urlState";

/**
 * Key figure labels of each scenario, in headline order (also shown while the chunk or the data
 * loads). `label` is the card's accessible name and tooltip; `short` is what the card shows, so
 * the label is not cut off on 1366 px laptops and tablets (review of Stage 7). Words follow P3, P7
 * and P9: "recorded", "straight-line" and "affected" stay in the full label and the detail line.
 */
export interface KpiLabel {
  label: string;
  short: string;
}

export const KPI_LABELS: Record<ScenarioKind, KpiLabel[]> = {
  import: [
    { label: "Recorded imports affected", short: "Imports affected" },
    { label: "Share of recorded imports affected", short: "Share affected" },
    { label: "Recorded imports remaining", short: "Imports remaining" },
    { label: "Partner concentration (HHI)", short: "Concentration (HHI)" },
  ],
  closure: [
    { label: "Residents whose nearest supermarket changes", short: "Residents affected" },
    { label: "Average extra distance (straight-line)", short: "Straight-line increase" },
    { label: "Supermarkets within 2 km", short: "Supermarkets ≤ 2 km" },
    { label: "Residents > 2 km", short: "Residents > 2 km" },
  ],
  production: [
    { label: "UK production removed", short: "Production removed" },
    { label: "Equivalent share of total supply", short: "Share of supply" },
    { label: "Production share of supply", short: "UK production share" },
    { label: "Total supply in the scenario", short: "Total supply" },
  ],
  port: [
    { label: "Inward freight affected", short: "Freight affected" },
    { label: "Share of UK major-port inwards", short: "Share of UK ports" },
    { label: "Agricultural dry bulk affected", short: "Agricultural dry bulk" },
    { label: "Food, feed and drink entry share", short: "Food entry share" },
  ],
};

/** The visible short label of the headline at `index` of a scenario (undefined: show the full one). */
export function shortLabelOf(kind: ScenarioKind, index: number): string | undefined {
  return KPI_LABELS[kind][index]?.short;
}
