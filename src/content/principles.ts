/** Integrity principles P1–P14 (spec §2), condensed for display. */
export type PrincipleId =
  "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8" | "P9" | "P10" | "P11" | "P12" | "P13" | "P14";

export interface Principle {
  id: PrincipleId;
  title: string;
  detail: string;
}

export const PRINCIPLES: readonly Principle[] = [
  {
    id: "P1",
    title: "Every number has a source",
    detail: "Each value shows its source, reference period, unit, coverage and method.",
  },
  {
    id: "P2",
    title: "Five provenance classes",
    detail: "Measured, official estimate, derived, scenario-modelled or illustrative — always labelled.",
  },
  {
    id: "P3",
    title: "Recorded import partner, not origin",
    detail: "HMRC records the country goods were dispatched from, which may not be where food was grown.",
  },
  {
    id: "P4",
    title: "Lines are not routes",
    detail: "Connections on the map are symbolic links between partners and the UK, not shipping lanes.",
  },
  {
    id: "P5",
    title: "No retailer supply claims",
    detail: "Trade data is never linked to supermarkets or stores.",
  },
  {
    id: "P6",
    title: "National context is labelled",
    detail: "National figures inside a local profile are marked as national context, not local measurements.",
  },
  {
    id: "P7",
    title: "Proximity is not access",
    detail: "Straight-line distance is labelled as such; it says nothing about cost, choice or travel time.",
  },
  {
    id: "P8",
    title: "Imports are not insecurity",
    detail: "Depending on imports is not the same as being food insecure.",
  },
  {
    id: "P9",
    title: "Scenarios show exposure",
    detail: "Scenario results estimate exposure under stated assumptions. They do not predict shortages.",
  },
  {
    id: "P10",
    title: "No single risk score",
    detail: "National, logistics and local access risks stay separate and explainable.",
  },
  {
    id: "P11",
    title: "Comparability warnings",
    detail: "Comparisons across UK nations, years, index versions or series breaks are flagged.",
  },
  {
    id: "P12",
    title: "Gaps stay visible",
    detail: "Missing and suppressed data is shown as such, never filled in quietly.",
  },
  {
    id: "P13",
    title: "Honest precision",
    detail: "Rounding follows the precision of the source; small bases are flagged.",
  },
  {
    id: "P14",
    title: "No invented claims",
    detail: "No fabricated data, credentials, clients, procurement needs or budgets.",
  },
];

export function principlesById(ids: readonly PrincipleId[]): Principle[] {
  return PRINCIPLES.filter((p) => ids.includes(p.id));
}
