import type { LucideIcon } from "lucide-react";
import { Building2, CalendarRange, FlaskConical, Globe2, Lightbulb, ShieldAlert, Store } from "lucide-react";
import type { PrincipleId } from "@/content/principles";

export const MODULE_IDS = [
  "origins",
  "seasonal",
  "access",
  "risks",
  "profiles",
  "scenarios",
  "insights",
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];
export const DEFAULT_MODULE: ModuleId = "origins";

export interface ModuleDef {
  id: ModuleId;
  label: string;
  railLabel: string;
  icon: LucideIcon;
  /** The question from the brief (§1) this module answers. */
  question: string;
  summary: string;
  release: 1 | 2;
  /** Roadmap build stage in which the module's first data features land. */
  buildStage: number;
  requirementIds: string;
  plannedKpis: string[];
  plannedControls: string[];
  principles: PrincipleId[];
  usesTimeline: boolean;
}

export const MODULES: readonly ModuleDef[] = [
  {
    id: "origins",
    label: "Food Origins",
    railLabel: "Origins",
    icon: Globe2,
    question: "Where does our food come from?",
    summary:
      "Recorded import partners for sixteen commodities in five groups: fruit and vegetables, cereals, meat, dairy, and sugar, coffee and cocoa (HMRC, monthly from January 2019), with symbolic connections to the UK, partner shares and concentration indicators.",
    release: 1,
    buildStage: 2,
    requirementIds: "FO-01 – FO-07, FO-10, FO-11",
    plannedKpis: [
      "Recorded imports",
      "Recorded import value",
      "Recorded import partners",
      "Partner concentration (HHI)",
    ],
    plannedControls: [
      "Commodity selector with search",
      "Period: month, rolling 12 months or year",
      "Measure: net mass or value",
    ],
    principles: ["P3", "P4", "P5", "P8", "P12"],
    usesTimeline: true,
  },
  {
    id: "seasonal",
    label: "Seasonal Supply",
    railLabel: "Seasonal",
    icon: CalendarRange,
    question: "How does this change throughout the year?",
    summary:
      "Month-by-month recorded imports for the same sixteen commodities: a January–December timeline you can play, a partner-by-month heatmap with fixed classes, monthly trend, year-on-year change and concentration. UK seasonal production is not shown: Defra publishes most of it annually, and its monthly meat and milk series are not verified yet.",
    release: 1,
    buildStage: 3,
    requirementIds: "SS-01 – SS-08 (SS-07: imports only)",
    plannedKpis: [
      "Recorded imports this month",
      "Peak-month share",
      "Monthly concentration (HHI)",
      "Change vs previous year",
    ],
    plannedControls: [
      "Year and comparison year",
      "Imports | Domestic production | Combined context",
      "Play through 12 months",
    ],
    principles: ["P3", "P11", "P12"],
    usesTimeline: true,
  },
  {
    id: "access",
    label: "UK Food Access",
    railLabel: "Access",
    icon: Store,
    question: "Where are our supermarkets and food-access vulnerabilities?",
    summary:
      "GEOLYTIX supermarket locations with retailer and store-type filters, provision per 10,000 residents and straight-line proximity.",
    release: 1,
    buildStage: 4,
    requirementIds: "SM-01 – SM-10, FA-01 – FA-06",
    plannedKpis: [
      "Mapped stores",
      "Stores per 10,000 residents",
      "Population beyond threshold (straight-line)",
    ],
    plannedControls: ["Retailer filter", "Store type filter", "Straight-line distance thresholds"],
    principles: ["P7", "P11", "P12"],
    usesTimeline: false,
  },
  {
    id: "risks",
    label: "UK Food Resilience — Risk Explorer",
    railLabel: "Risks",
    icon: ShieldAlert,
    question: "How vulnerable is our food supply?",
    summary:
      'Three separate views, never one score: international supply exposure (partner concentration, estimated exposure to one supplier, partners\' water stress), logistics and infrastructure (ports, food entry points, road corridors, farming regions) and community food access (priority places by council, within each nation), each with "Explain this risk".',
    release: 1,
    buildStage: 6,
    requirementIds: "RK-01 – RK-04, RK-06 (RK-05 weights: Release 2)",
    plannedKpis: ["Partner concentration (HHI)", "Short Straits share of food imports", "Priority share"],
    plannedControls: [
      "View: supply, logistics, community access",
      "Commodity, period, partner",
      "Port measure, layers, index measure",
    ],
    principles: ["P3", "P8", "P10", "P11", "P12"],
    usesTimeline: false,
  },
  {
    id: "profiles",
    label: "Local Authority Profiles",
    railLabel: "Profiles",
    icon: Building2,
    question: "What does food security look like in one local authority?",
    summary:
      "A food security profile for any of the 361 UK councils: area overview, supermarket network, car availability and national supply context; deep profiles for Belfast and Manchester add small-area accessibility, the Priority Places for Food Index and deprivation within each nation; side-by-side comparison with comparability warnings.",
    release: 1,
    buildStage: 5,
    requirementIds: "LP-01 – LP-08, LP-10 (LP-09 PDF in stage 8)",
    plannedKpis: [
      "Residents",
      "Mapped grocery stores",
      "Supermarkets per 10,000 residents",
      "Residents > 1 km from a supermarket (straight-line)",
      "Households with no car or van",
    ],
    plannedControls: [
      "Council search, list and nation filter",
      "Small-area map measure",
      "Comparison councils",
    ],
    principles: ["P6", "P7", "P10", "P11", "P12"],
    usesTimeline: false,
  },
  {
    id: "scenarios",
    label: "Scenario Lab",
    railLabel: "Scenarios",
    icon: FlaskConical,
    question: "What happens under a plausible disruption?",
    summary:
      "Transparent what-if scenarios on published baselines — a recorded import partner's disruption, a supermarket closure anywhere in the UK, a domestic production shock and a port disruption — each Scenario-modelled, with its assumptions, method and limitations beside the results; named scenarios saved, compared, shared and exported.",
    release: 1,
    buildStage: 7,
    requirementIds: "SC-01 – SC-05 (A, B, C, D)",
    plannedKpis: [
      "Recorded imports affected",
      "Share of recorded imports affected",
      "Residents whose nearest supermarket changes",
    ],
    plannedControls: [
      "Scenario: supply disruption, store closure, production shock, port disruption",
      "Reduction, duration, recovery and substitution (default 0 %)",
      "Save, compare, share and export",
    ],
    principles: ["P9", "P12", "P13"],
    usesTimeline: false,
  },
  {
    id: "insights",
    label: "Consulting Insights",
    railLabel: "Insights",
    icon: Lightbulb,
    question: "What can be done to improve resilience?",
    summary:
      "Evidence-based opportunity statements linking what the data shows to possible ConsultingWhere workstreams, with limitations stated.",
    release: 1,
    buildStage: 8,
    requirementIds: "CI-01 – CI-05",
    plannedKpis: ["Evidence items", "Suggested workstreams"],
    plannedControls: ["Context: authority, commodity or scenario", "Workstream filter"],
    principles: ["P14", "P8", "P6"],
    usesTimeline: false,
  },
];

export function getModule(id: ModuleId): ModuleDef {
  const mod = MODULES.find((m) => m.id === id);
  if (!mod) throw new Error(`Unknown module: ${id}`);
  return mod;
}

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === "string" && (MODULE_IDS as readonly string[]).includes(value);
}
