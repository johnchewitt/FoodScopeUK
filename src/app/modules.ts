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
      "Recorded import partners for 16 commodities, with symbolic connections to the UK, partner shares and concentration indicators.",
    release: 1,
    buildStage: 3,
    requirementIds: "FO-01 – FO-11",
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
      "Month-by-month recorded import patterns, a partner-by-month heatmap and year-on-year comparison with fixed colour scales.",
    release: 1,
    buildStage: 3,
    requirementIds: "SS-01 – SS-08",
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
    label: "Supply Chain Risks",
    railLabel: "Risks",
    icon: ShieldAlert,
    question: "How vulnerable is our food supply?",
    summary:
      "Separate national supply, logistics and local access indicators with user-set weights and sensitivity analysis — never one composite score.",
    release: 2,
    buildStage: 9,
    requirementIds: "RK-01 – RK-06",
    plannedKpis: ["Import concentration", "Short Straits dependence", "Local access flags"],
    plannedControls: ["Risk component tabs", "Indicator weights", "Sensitivity runs"],
    principles: ["P8", "P10", "P11"],
    usesTimeline: false,
  },
  {
    id: "profiles",
    label: "Local Authority Profiles",
    railLabel: "Profiles",
    icon: Building2,
    question: "What does food security look like in one local authority?",
    summary:
      "A food security profile for any UK local authority, with deep profiles for Belfast and Manchester and side-by-side comparison.",
    release: 1,
    buildStage: 5,
    requirementIds: "LP-01 – LP-10",
    plannedKpis: [
      "Population",
      "Mapped supermarkets",
      "Stores per 10,000 residents",
      "Population beyond 2 km (straight-line)",
    ],
    plannedControls: ["Local authority search", "Comparison authorities", "Profile export to PDF"],
    principles: ["P6", "P7", "P11", "P12"],
    usesTimeline: true,
  },
  {
    id: "scenarios",
    label: "Scenario Lab",
    railLabel: "Scenarios",
    icon: FlaskConical,
    question: "What happens under a plausible disruption?",
    summary:
      "Transparent what-if scenarios — a country and commodity import disruption and a supermarket closure — with assumptions beside every result.",
    release: 1,
    buildStage: 6,
    requirementIds: "SC-01 – SC-05",
    plannedKpis: [
      "Recorded imports affected",
      "Share of recorded imports affected",
      "Population affected (straight-line)",
    ],
    plannedControls: [
      "Scenario preset",
      "Intensity, duration and recovery",
      "Substitution assumption (default 0 %)",
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
    buildStage: 7,
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
