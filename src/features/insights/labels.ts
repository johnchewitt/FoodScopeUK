/** Labels of ConsultingWhere Insights shared by the controls, key figures and loading states. */
import { Building2, FlaskConical, Globe2 } from "lucide-react";
import type { InsightsKind } from "@/state/urlState";

export const KIND_LABELS: Record<InsightsKind, { label: string; hint: string; icon: typeof Globe2 }> = {
  authority: {
    label: "Local authority",
    hint: "Food retail access, community vulnerability and the national supply context for one council",
    icon: Building2,
  },
  commodity: {
    label: "Commodity",
    hint: "Recorded partners, seasonal sourcing, concentration, domestic production and exposure for one commodity",
    icon: Globe2,
  },
  scenario: {
    label: "Scenario",
    hint: "A Scenario Lab run: baseline, assumptions, estimated exposure, sensitivity and limitations",
    icon: FlaskConical,
  },
};

/** Key figure labels of each assessment while it loads (same order as the report's KPIs). */
export const INSIGHTS_KPI_LABELS: Record<InsightsKind, { label: string; short: string }[]> = {
  authority: [
    { label: "Residents (mid-2025)", short: "Residents" },
    { label: "Supermarkets per 10,000 residents", short: "Supermarkets / 10k" },
    { label: "Residents more than 1 km from a supermarket (straight-line)", short: "Residents > 1 km" },
    { label: "Small areas in the nation's highest-priority PPFI deciles", short: "PPFI priority areas" },
  ],
  commodity: [
    { label: "Recorded imports", short: "Recorded imports" },
    { label: "Largest recorded import partner's share", short: "Largest partner" },
    { label: "Recorded import partners", short: "Partners" },
    { label: "Recorded imports from partners in high or critical water stress", short: "High water stress" },
  ],
  /** The Scenario Lab's own labels are used for the selected scenario (kpiLabels.ts). */
  scenario: [],
};
