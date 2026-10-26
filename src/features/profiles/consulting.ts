/**
 * Provisional Consulting Opportunities for a council profile (LP-08, first cut; Stage 8 builds the
 * Consulting Insights module, CI-01 – CI-03). Deterministic rules map what the profile shows to
 * the ConsultingWhere workstreams named in the brief (§12). Each suggestion says why it appears
 * (the evidence), what further spatial analysis could show, and what data it would need.
 *
 * Integrity (P14): no claim that a council has a requirement, budget or procurement; no client
 * names, credentials or project references. The wording is a possible line of enquiry only.
 */
import { formatCount, formatKm, formatShare } from "@/analysis/format";
import type { CouncilNetwork } from "@/analysis/profile";
import type { NationalRow } from "./useProfile";
import type { CouncilRow, DeepProfile } from "./model";

export interface Opportunity {
  id: string;
  workstream: string;
  /** Why this appears: the figures that triggered it. */
  evidence: string;
  /** What further spatial analysis could show. */
  analysis: string;
  /** Data the analysis would need beyond what the profile uses. */
  data: string;
  scope: "local" | "national_context";
}

export interface ConsultingInputs {
  council: CouncilRow;
  network: CouncilNetwork | null;
  deep: DeepProfile | null;
  /** Share of households with no car or van in the council's nation (Census 2021), for context. */
  nationNoCarShare: number | null;
  national: NationalRow[] | null;
}

/** Thresholds of the rules (shown on the page under "Why am I seeing this?"). */
export const RULES = {
  beyondKm: 1,
  topRetailerShare: 0.4,
  ppfiTopTwoDecilesShare: 0.3,
  nationalTopPartnerShare: 0.5,
} as const;

export function opportunities(x: ConsultingInputs): Opportunity[] {
  const out: Opportunity[] = [];
  const { council, network, deep } = x;
  const car = council.context?.carAvailability ?? null;
  const noCar = car && car.households > 0 ? car.noCar / car.households : null;

  const beyond = deep?.beyondSupermarket.find((b) => b.thresholdKm === RULES.beyondKm) ?? null;
  if (beyond && beyond.population > 0) {
    out.push({
      id: "access-review",
      workstream: "Local Authority Food Accessibility Reviews",
      evidence: `${formatShare(beyond.share)} of ${council.name}'s residents live in small areas more than ${formatKm(
        RULES.beyondKm,
      )} straight-line from the nearest supermarket${noCar !== null ? `, and ${formatShare(noCar)} of its households have no car or van` : ""}.`,
      analysis:
        "Walking and public transport times to food retail along the street network, and how they vary for households without a car.",
      data: "Street network and public transport timetables (GTFS); store opening hours; small-area population by age.",
      scope: "local",
    });
  } else if (noCar !== null && x.nationNoCarShare !== null && noCar > x.nationNoCarShare) {
    out.push({
      id: "access-car",
      workstream: "Local Authority Food Accessibility Reviews",
      evidence: `${formatShare(noCar)} of ${council.name}'s households have no car or van, against ${formatShare(
        x.nationNoCarShare,
      )} across ${council.nation} (Census 2021).`,
      analysis:
        "Which neighbourhoods depend on walking or public transport to reach food retail, and how far they are.",
      data: "Small-area population and car availability; street network and public transport timetables.",
      scope: "local",
    });
  }

  if (deep) {
    const top2 = deep.ppfi.filter((p) => p.ppfi.decile <= 2).length;
    const share = deep.ppfi.length ? top2 / deep.ppfi.length : null;
    if (share !== null && share >= RULES.ppfiTopTwoDecilesShare)
      out.push({
        id: "ppfi-monitoring",
        workstream: "Food Security Monitoring Dashboards",
        evidence: `${formatShare(share)} of ${council.name}'s small areas are in the highest-priority 20 % of ${deep.profile.ppfi.within} on the Priority Places for Food Index (v2.1).`,
        analysis:
          "Tracking the PPFI domains, local food support and store changes over time for the priority neighbourhoods.",
        data: "Later PPFI editions; local food support locations (food banks, pantries); store openings and closures.",
        scope: "local",
      });
  }

  const k = network?.supermarketConcentration;
  if (k && k.topShare !== null && k.topShare >= RULES.topRetailerShare)
    out.push({
      id: "catchment",
      workstream: "Supermarket Catchment and Network Analysis",
      evidence: `${k.topRetailer} has ${formatShare(k.topShare)} of the council's ${formatCount(k.stores)} mapped supermarkets (store counts, not market share).`,
      analysis:
        "Catchments of each store and how the population each one serves would change if a store closed.",
      data: "Store floorspace and opening hours; street network travel times; small-area population.",
      scope: "local",
    });

  const concentrated = (x.national ?? []).filter(
    (r) =>
      r.imports?.topShare !== null &&
      r.imports !== null &&
      r.imports.topShare! >= RULES.nationalTopPartnerShare,
  );
  if (concentrated.length)
    out.push({
      id: "supply-risk",
      workstream: "Supply Chain Geographic Risk Assessment",
      evidence: `National context: ${concentrated
        .map((r) => `${r.label.toLowerCase()} (${r.imports!.topPartner} ${formatShare(r.imports!.topShare)})`)
        .join(
          ", ",
        )} — the largest recorded import partner has half or more of UK imports over 12 months. The same for every council.`,
      analysis:
        "Which recorded import partners and ports of entry the UK relies on for these foods, and what a disruption would mean nationally (Scenario Lab, Stage 7).",
      data: "Port-level trade data; Defra food security indicators.",
      scope: "national_context",
    });
  return out;
}
