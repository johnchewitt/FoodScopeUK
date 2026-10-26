import type { ScenarioKind } from "@/state/urlState";

/** Key figure labels of each scenario (also shown while the chunk or the data loads). */
export const KPI_LABELS: Record<ScenarioKind, string[]> = {
  import: [
    "Recorded imports affected",
    "Share of recorded imports affected",
    "Recorded imports remaining",
    "Partner concentration (HHI)",
  ],
  closure: [
    "Residents whose nearest supermarket changes",
    "Average extra distance (straight-line)",
    "Supermarkets within 2 km",
    "Residents > 2 km",
  ],
  production: [
    "UK production removed",
    "Equivalent share of total supply",
    "Production share of supply",
    "Total supply in the scenario",
  ],
  port: [
    "Inward freight affected",
    "Share of UK major-port inwards",
    "Agricultural products affected",
    "Food, feed and drink entry share",
  ],
};
