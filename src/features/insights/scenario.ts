/**
 * Food Supply Disruption Scenario Assessment (Stage 8, brief §4; CI-02, CI-03).
 *
 * Reports one Scenario Lab run (Stage 7): the selected scenario, its baseline, the stated
 * assumptions, the results, the geographic consequences, sensitivity to the intensity the user set,
 * limitations, possible interventions and further analysis. Every scenario figure keeps the
 * Scenario Lab's provenance ("scenario"); the words are "estimated exposure" and "affected", never
 * a shortage, a forecast or a confirmed operational impact (P9).
 */
import { formatByUnit, formatCount, formatKm, formatPopulation, formatShare } from "@/analysis/format";
import type { Methodology } from "@/features/scenarios/methodology";
import { SCENARIO_TITLES } from "@/features/scenarios/methodology";
import {
  CONFIDENCE_LABELS,
  type ClosureModel,
  type ImportModel,
  type PortModel,
  type ProductionModel,
  type ResultRow,
} from "@/features/scenarios/model";
import { KPI_LABELS } from "@/features/scenarios/kpiLabels";
import { SCENARIO_LETTERS, type ScenarioParams } from "@/state/scenarioParams";
import type { DataManifest } from "@/types/generated/manifest";
import { serviceById } from "./content";
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
  type ReportTable,
  type RuleCheck,
  type WorkPackage,
} from "./report";

export type ScenarioModel = ImportModel | ClosureModel | ProductionModel | PortModel;

export interface ScenarioInputs {
  params: ScenarioParams;
  model: ScenarioModel;
  methodology: Methodology;
  /** Rebuilds the model with other parameters of the same kind (sensitivity); pure. */
  rebuild: (p: ScenarioParams) => ScenarioModel | null;
  /** The saved scenario's name when the run was loaded from one. */
  savedName: string | null;
  manifest: DataManifest | undefined;
  datasetIds: string[];
  link: string;
}

/** Thresholds of the stated rules (CI-03). */
export const SCENARIO_RULES = {
  importShareAffected: 0.1,
  closureResidents: 1000,
  closureFarKm: 2,
  productionShareOfSupply: 0.05,
  productionDependence: 0.5,
  portShareOfUk: 0.05,
  portUnitised: 0.5,
} as const;

/** Intensity multipliers of the sensitivity table (the user's setting is 1×). */
export const SENSITIVITY_FACTORS = [0.5, 1, 1.5] as const;

const pct = (v: number) => `${Math.round(v)} %`;
const clampPct = (v: number) => Math.min(100, Math.max(0, Math.round(v)));

function value(i: { value: number | string | null; unit: string }): string {
  return formatByUnit(i.value, i.unit);
}

function changeText(r: ResultRow): string {
  if (r.change === null) return "—";
  if (r.change === 0) return "No change";
  const unit = r.baseline.unit;
  // Shares change in percentage points (signed by the formatter); other units sign their magnitude.
  if (unit === "share") return formatByUnit(r.change * 100, "pp");
  return `${r.change < 0 ? "−" : "+"}${formatByUnit(Math.abs(r.change), unit)}`;
}

function relativeText(r: ResultRow): string {
  if (r.relative === null) return "—";
  return `${r.relative < 0 ? "−" : r.relative > 0 ? "+" : ""}${formatShare(Math.abs(r.relative))}`;
}

/** The scenario's parameters, labelled; user assumptions are marked as such (P9). */
function parameterRows(model: ScenarioModel, params: ScenarioParams): string[][] {
  const assumption = "User assumption";
  switch (model.kind) {
    case "import": {
      const p = params as Extract<ScenarioParams, { kind: "import" }>;
      return [
        ["Commodity", model.commodity.label, "Selected"],
        [
          "Recorded import partner",
          model.partnerName,
          model.partnerIsDefault ? "Default: largest in the baseline window" : "Selected",
        ],
        [
          "Baseline window",
          model.windowLabel,
          model.startIsDefault ? "Default: January of the latest complete year" : "Selected",
        ],
        ["Reduction in recorded imports from the partner", pct(p.reduction), assumption],
        ["Disrupted months", formatCount(p.duration), assumption],
        ["Recovery months (linear)", formatCount(p.recovery), assumption],
        [
          "Substitution by other partners",
          pct(p.substitution),
          `${assumption}${p.substitution === 0 ? " (default 0 %)" : ""}`,
        ],
        ["Measure", model.measure === "mass" ? "Net mass (tonnes)" : "Value (£, current prices)", "Selected"],
      ];
    }
    case "closure":
      return [
        ["Supermarket closed", `${model.store.name} (${model.store.retailer})`, "Selected"],
        ["Format and size band", `${model.store.format}; ${model.store.sizeBand}`, "GEOLYTIX v46"],
        ["Council", `${model.store.council.name}, ${model.store.council.nation}`, "May 2025 boundaries"],
        ["Distance", "Straight-line, national grid", "Fixed"],
      ];
    case "production": {
      const p = params as Extract<ScenarioParams, { kind: "production" }>;
      return [
        ["Commodity", model.label, "Selected"],
        ["Reduction in UK production", pct(p.reduction), assumption],
        [
          "Defra balance year",
          model.entry
            ? `${model.entry.year}${model.entry.provisional ? " (provisional)" : ""}`
            : "Not published",
          "Defra",
        ],
        ["Imports, exports and stocks", "Held at published values", "Fixed (static balance)"],
      ];
    }
    case "port": {
      const p = params as Extract<ScenarioParams, { kind: "port" }>;
      return [
        [
          "Port",
          model.selected ? `${model.selected.name} (${model.selected.nation})` : "None selected",
          "Selected",
        ],
        ["Reduction in inward freight", pct(p.reduction), assumption],
        ["Months disrupted", formatCount(p.months), `${assumption}; annual tonnage spread evenly`],
        ["DfT tonnage year", String(model.year), "DfT"],
      ];
    }
  }
}

/** Variants of the same scenario at other intensities (the sensitivity table). */
function variants(params: ScenarioParams): { label: string; params: ScenarioParams }[] {
  switch (params.kind) {
    case "import":
      return [
        ...SENSITIVITY_FACTORS.map((f) => ({
          label: `Reduction ${pct(clampPct(params.reduction * f))}${f === 1 ? " (as set)" : ""}`,
          params: { ...params, reduction: clampPct(params.reduction * f) },
        })),
        {
          label: `Substitution ${params.substitution === 0 ? "50 %" : "0 %"} (alternative assumption)`,
          params: { ...params, substitution: params.substitution === 0 ? 50 : 0 },
        },
      ];
    case "production":
      return SENSITIVITY_FACTORS.map((f) => ({
        label: `Reduction ${pct(clampPct(params.reduction * f))}${f === 1 ? " (as set)" : ""}`,
        params: { ...params, reduction: clampPct(params.reduction * f) },
      }));
    case "port":
      return [
        ...SENSITIVITY_FACTORS.map((f) => ({
          label: `Reduction ${pct(clampPct(params.reduction * f))} for ${formatCount(params.months)} months${f === 1 ? " (as set)" : ""}`,
          params: { ...params, reduction: clampPct(params.reduction * f) },
        })),
        {
          label: `Reduction ${pct(params.reduction)} for ${params.months >= 12 ? 6 : 12} months (alternative duration)`,
          params: { ...params, months: params.months >= 12 ? 6 : 12 },
        },
      ];
    case "closure":
      return [];
  }
}

function sensitivityTable(x: ScenarioInputs): ReportTable | null {
  const m = x.model;
  const labels = KPI_LABELS[m.kind];
  if (m.kind === "closure") {
    const t = m.result.councilDistances.thresholds;
    return {
      id: "sensitivity",
      caption: `Residents of ${m.store.council.name} beyond each straight-line distance, before and after the closure`,
      columns: ["Threshold", "Baseline", "Scenario", "Change"],
      numeric: [false, true, true, true],
      rows: t.map((r) => [
        `More than ${formatKm(r.metres / 1000)}`,
        formatPopulation(r.before, "small_area"),
        formatPopulation(r.after, "small_area"),
        `${r.after - r.before >= 0 ? "+" : "−"}${formatPopulation(Math.abs(r.after - r.before), "small_area")}`,
      ]),
      note: "A closure has no intensity to vary: the result is shown against the three distance thresholds instead.",
    };
  }
  const rows = variants(x.params).map((v) => {
    const out = x.rebuild(v.params);
    return [v.label, ...[0, 1].map((i) => (out ? value(out.headlines[i]!.indicator) : "—"))];
  });
  return {
    id: "sensitivity",
    caption: "Sensitivity of the key results to the intensity set",
    columns: ["Variant", labels[0]!.label, labels[1]!.label],
    numeric: [false, true, true],
    rows,
    note: "Each row recomputes the same scenario with one parameter changed; other parameters as set. Scenario-modelled figures under stated assumptions.",
  };
}

function geography(m: ScenarioModel): { section: ReportSection; charts: ReportChart[] } {
  const charts: ReportChart[] = [];
  switch (m.kind) {
    case "import": {
      const r = m.result;
      const before = r?.sharesBefore.slice(0, 8) ?? [];
      const after = new Map((r?.sharesAfter ?? []).map((s) => [s.key, s.share]));
      if (before.length)
        charts.push({
          id: "shares",
          title: "Recorded partner shares over the window, baseline and scenario",
          kind: "pairedBar",
          format: "share",
          categories: before.map((s) => s.name),
          series: [
            { name: "Baseline", role: "baseline", values: before.map((s) => s.share) },
            { name: "Scenario", role: "scenario", values: before.map((s) => after.get(s.key) ?? 0) },
          ],
          description: `Partner shares of recorded ${m.commodity.label.toLowerCase()} imports over ${m.windowLabel}, baseline and scenario (other partners unchanged): ${before
            .map((s) => `${s.name} ${formatShare(s.share)} to ${formatShare(after.get(s.key) ?? 0)}`)
            .join("; ")}.`,
          source: "HMRC Overseas Trade Statistics (S01); Scenario Lab A",
        });
      return {
        charts,
        section: {
          id: "geography",
          title: "Geographic consequences",
          scopeNote: "National: UK recorded imports by partner country; flows are symbolic, not routes.",
          intro:
            "How recorded supply would be spread across partner countries if the partner's recorded imports fell as set and nothing replaced them. The map shows the partner's baseline flow as a dashed outline.",
          findings: r
            ? [
                finding(
                  `${m.partnerName}'s share of recorded imports over the window would go from ${formatShare(r.partnerShareBefore)} to ${formatShare(r.partnerShareAfter)}, with other partners' recorded imports unchanged.`,
                  "scenario",
                ),
              ]
            : [],
          tables: [],
          chartIds: charts.map((c) => c.id),
          notes: ["HMRC's partner is the country of dispatch, not necessarily where the food was grown."],
        },
      };
    }
    case "closure": {
      const top = [...m.affected]
        .sort((a, b) => (b.increaseKm ?? 0) - (a.increaseKm ?? 0) || b.population - a.population)
        .slice(0, 10);
      const t = m.result.councilDistances.thresholds;
      charts.push({
        id: "thresholds",
        title: `Residents of ${m.store.council.name} beyond each straight-line distance from a supermarket`,
        kind: "pairedBar",
        format: "population",
        categories: t.map((r) => `More than ${formatKm(r.metres / 1000)}`),
        series: [
          { name: "Baseline", role: "baseline", values: t.map((r) => r.before) },
          { name: "Scenario", role: "scenario", values: t.map((r) => r.after) },
        ],
        description: `Residents of ${m.store.council.name} more than 1, 2 and 5 km straight-line from a supermarket, baseline and scenario: ${t
          .map(
            (r) =>
              `${formatKm(r.metres / 1000)} ${formatPopulation(r.before, "small_area")} to ${formatPopulation(r.after, "small_area")}`,
          )
          .join("; ")}.`,
        source: "GEOLYTIX (S11); Census small areas (S15–S18); Scenario Lab B",
      });
      return {
        charts,
        section: {
          id: "geography",
          title: "Geographic consequences",
          scopeNote: "Local: small areas whose nearest supermarket would change (straight-line).",
          intro: `Small areas whose nearest supermarket is ${m.store.name}, and where their next nearest would be. Areas beyond ${m.store.council.name}'s boundary count.`,
          findings: [
            finding(
              `${formatCount(m.affected.length)} small areas in ${formatCount(m.councilsReached.length)} council${m.councilsReached.length === 1 ? "" : "s"} would have a different nearest supermarket; ${m.takeover[0] ? `${m.takeover[0].name} would become the nearest for the most residents (${formatPopulation(m.takeover[0].population, "small_area")})` : "no other supermarket is in the data"}.`,
              "scenario",
            ),
            ...(m.nearestOther
              ? [
                  finding(
                    `The nearest other supermarket to ${m.store.name} is ${m.nearestOther.name}, ${formatKm(m.nearestOther.km)} away in a straight line.`,
                    "local",
                  ),
                ]
              : []),
          ],
          tables: [
            {
              id: "councils",
              caption: "Councils reached by the closure",
              columns: ["Council", "Small areas affected", "Residents affected"],
              numeric: [false, true, true],
              rows: m.councilsReached.map((c) => [
                `${c.council.name} (${c.council.nation})`,
                formatCount(c.areas),
                formatPopulation(c.population, "small_area"),
              ]),
            },
            {
              id: "areas",
              caption: "Affected small areas with the largest straight-line increase",
              columns: ["Small area", "Council", "Residents", "Before", "After", "New nearest"],
              numeric: [false, false, true, true, true, false],
              rows: top.map((a) => [
                `${a.name} (${a.code})`,
                a.council,
                formatPopulation(a.population, "small_area"),
                formatKm(a.beforeKm),
                a.afterKm === null ? "None in the data" : formatKm(a.afterKm),
                a.newStore ?? "—",
              ]),
              note: `Census ${m.censusYears.join(" and ")} residents; straight-line distance from the population-weighted centroid.`,
            },
          ],
          chartIds: charts.map((c) => c.id),
          notes: [],
        },
      };
    }
    case "production":
      return {
        charts,
        section: {
          id: "geography",
          title: "Geographic consequences",
          scopeNote: "National: Defra's balance is for the United Kingdom as a whole.",
          intro:
            "Defra publishes the supply balance for the UK only, so this scenario has no geography: where production would fall, and which regions or retailers would be affected, is not in the data.",
          findings: [
            finding(
              "No regional breakdown is computed: Defra's annual balance has none, and it is never apportioned to regions or councils.",
              "method",
            ),
          ],
          tables: [],
          chartIds: [],
          notes: [],
        },
      };
    case "port": {
      const sel = m.selected;
      return {
        charts,
        section: {
          id: "geography",
          title: "Geographic consequences",
          scopeNote: "National context: inward freight at one DfT statistical port, any origin.",
          intro: sel
            ? `${sel.name} (${sel.nation}): what DfT records as arriving there by cargo group, and what UKFSR records for food, feed and drink entering there.`
            : "No port is selected.",
          findings: sel
            ? [
                finding(
                  m.food?.percent != null
                    ? `UKFSR records ${formatShare(m.food.percent / 100)} of UK food, feed and drink imports by volume entering through ${m.food.groups.join(" and ")} (${m.food.year}).`
                    : (m.food?.note ?? "No food, feed and drink share is attributed to this port."),
                  "national_context",
                ),
                ...(sel.unitisedShare !== null
                  ? [
                      finding(
                        `${formatShare(sel.unitisedShare)} of the port's inward tonnage arrives in Ro-Ro units or containers, whose contents DfT does not record.`,
                        "national_context",
                      ),
                    ]
                  : []),
              ]
            : [],
          tables: sel
            ? [
                {
                  id: "groups",
                  caption: `${sel.name}: inward tonnage by DfT cargo group, ${m.year}`,
                  columns: ["Cargo group", "Thousand tonnes"],
                  numeric: [false, true],
                  rows: sel.byGroup.map((g) => [
                    g.group,
                    g.value === null ? "—" : formatCount(Math.round(g.value)),
                  ]),
                  note: "DfT PORT0499, any origin; contents of Ro-Ro and container freight not recorded.",
                },
              ]
            : [],
          chartIds: [],
          notes: [],
        },
      };
    }
  }
}

interface KindRules {
  rules: RuleCheck[];
  packages: (fired: (id: string) => RuleCheck | undefined) => WorkPackage[];
}

function pkg(
  serviceId: string,
  id: string,
  title: string,
  rule: RuleCheck | undefined,
  rest: Omit<WorkPackage, "id" | "serviceId" | "title" | "indicated" | "why" | "stakeholders">,
): WorkPackage {
  return {
    id,
    serviceId,
    title,
    indicated: rule?.fired ?? false,
    why: rule
      ? `${rule.rule} — ${rule.observed}.`
      : "Offered as a supporting capability: no single figure triggers it.",
    stakeholders: serviceById(serviceId).stakeholders,
    ...rest,
  };
}

function kindRules(m: ScenarioModel, params: ScenarioParams): KindRules {
  switch (m.kind) {
    case "import": {
      const r = m.result;
      const p = params as Extract<ScenarioParams, { kind: "import" }>;
      return {
        rules: [
          {
            id: "share",
            rule: `At least ${formatShare(SCENARIO_RULES.importShareAffected)} of recorded imports over the window affected`,
            fired: (r?.shareAffected ?? 0) >= SCENARIO_RULES.importShareAffected,
            observed: formatShare(r?.shareAffected),
            serviceId: "supply-chain-risk",
          },
          {
            id: "substitution",
            rule: "Substitution by other partners left at the default 0 % (an untested assumption)",
            fired: p.substitution === 0,
            observed: pct(p.substitution),
            serviceId: "scenario-modelling",
          },
        ],
        packages: (f) => [
          pkg("supply-chain-risk", "supply-chain", "Supply chain geographic risk analysis", f("share"), {
            challenge: `Understand which partners and routes could replace recorded ${m.commodity.label.toLowerCase()} imports from ${m.partnerName}, and how quickly.`,
            evidence: [
              `${formatShare(r?.shareAffected)} of recorded imports over ${m.windowLabel} affected in the scenario.`,
            ],
            analysis:
              "Alternative partners' seasonal capacity, routes and transit times, mapped against the disrupted months.",
            additionalData: [
              "Partner production and export capacity by month",
              "Shipping and road routes",
              "Contract and sourcing data shared by industry",
            ],
            tasks: [
              "Map alternative partners by month",
              "Assess routes and transit",
              "Summarise substitution options",
            ],
            deliverables: ["Substitution options atlas", "Briefing note"],
            limitations: ["Sourcing decisions by retailers and suppliers are not public."],
          }),
          pkg(
            "scenario-modelling",
            "assumptions",
            "Scenario modelling: test the substitution assumption",
            f("substitution"),
            {
              challenge:
                "Replace the default 0 % substitution with evidence-based ranges and test how results change.",
              evidence: [
                `Substitution set to ${pct(p.substitution)}; unreplaced supply follows directly from it.`,
              ],
              analysis:
                "Sensitivity analysis across substitution, duration and recovery, with ranges agreed with stakeholders.",
              additionalData: ["Historic substitution after past disruptions", "Stock and shelf-life data"],
              tasks: [
                "Agree assumption ranges",
                "Run the scenario set",
                "Present ranges, not single figures",
              ],
              deliverables: ["Scenario set with ranges", "Assumptions register"],
              limitations: ["Results remain estimated exposure under assumptions, not forecasts."],
            },
          ),
          pkg("climate-agriculture", "climate", "Climate and agricultural resilience", undefined, {
            challenge: `Assess climate pressures behind disruptions of ${m.partnerName}'s supply.`,
            evidence: ["The Risk Explorer shows the partner's national water stress."],
            analysis:
              "Regional climate and growing-condition indicators for the partner's main producing areas.",
            additionalData: ["Sub-national climate and yield data"],
            tasks: ["Identify producing regions", "Combine climate indicators"],
            deliverables: ["Climate exposure briefing"],
            limitations: ["National indicators hide regional differences."],
          }),
        ],
      };
    }
    case "closure": {
      const r = m.result;
      const far = m.affected.filter((a) => a.afterKm === null || a.afterKm > SCENARIO_RULES.closureFarKm);
      const farPop = far.reduce((s, a) => s + a.population, 0);
      const deprived = r.deciles.filter((d) => d.decile <= 2).reduce((s, d) => s + d.population, 0);
      return {
        rules: [
          {
            id: "residents",
            rule: `At least ${formatCount(SCENARIO_RULES.closureResidents)} residents would have a different nearest supermarket`,
            fired: r.populationAffected >= SCENARIO_RULES.closureResidents,
            observed: formatPopulation(r.populationAffected, "small_area"),
            serviceId: "retail-accessibility",
          },
          {
            id: "far",
            rule: `Affected residents whose new nearest supermarket would be more than ${formatKm(SCENARIO_RULES.closureFarKm)} away (straight-line)`,
            fired: farPop > 0,
            observed: `${formatPopulation(farPop, "small_area")} residents in ${formatCount(far.length)} small areas`,
            serviceId: "scenario-modelling",
          },
          {
            id: "deprived",
            rule: "Affected residents living in England's 20 % most deprived small areas",
            fired: deprived > 0,
            observed: r.deciles.length
              ? `${formatPopulation(deprived, "small_area")} residents`
              : "England only: no deciles for this nation",
            serviceId: "resilience-assessment",
          },
        ],
        packages: (f) => [
          pkg(
            "retail-accessibility",
            "accessibility",
            "Geographic accessibility assessment",
            f("residents"),
            {
              challenge: `Understand how a change at ${m.store.name} would affect how residents reach food retail, beyond straight-line distance.`,
              evidence: [
                `${formatPopulation(r.populationAffected, "small_area")} residents would have a different nearest supermarket (straight-line).`,
              ],
              analysis:
                "Network travel times by walking, public transport and car, before and after, for the affected areas.",
              additionalData: [
                "Street network and footpaths",
                "Public transport timetables (GTFS)",
                "Car availability by small area",
              ],
              tasks: [
                "Model travel times before and after",
                "Compare by mode and group",
                "Map the areas most affected",
              ],
              deliverables: ["Travel-time maps", "Affected-area summary"],
              limitations: ["Opening hours and prices are not in open data."],
            },
          ),
          pkg(
            "scenario-modelling",
            "spatial-decision",
            "Scenario modelling and spatial decision support",
            f("far"),
            {
              challenge:
                "Compare closure, relocation and mitigation options for the affected neighbourhoods.",
              evidence: [
                `${formatCount(far.length)} affected small areas would be more than ${formatKm(SCENARIO_RULES.closureFarKm)} straight-line from their new nearest supermarket.`,
              ],
              analysis:
                "Option appraisal across sites and services (transport links, delivery, community provision), on network travel times.",
              additionalData: ["Candidate sites", "Service locations and timetables"],
              tasks: ["Define options", "Model each option", "Compare on maps and tables"],
              deliverables: ["Option appraisal", "Decision-support view"],
              limitations: ["Behaviour of shoppers and retailers is not modelled."],
            },
          ),
          pkg("resilience-assessment", "community", "Community food resilience assessment", f("deprived"), {
            challenge:
              "Understand how affected communities would be supported, focusing on the most deprived areas.",
            evidence: [
              r.deciles.length
                ? `${formatPopulation(deprived, "small_area")} affected residents live in England's 20 % most deprived small areas.`
                : "Deprivation deciles are attached to England's small areas only.",
            ],
            analysis:
              "Combine access change with deprivation, car availability and community food provision.",
            additionalData: [
              "Community food provision locations",
              "Benefit and free school meal data by area",
            ],
            tasks: ["Profile affected communities", "Map support services", "Identify gaps"],
            deliverables: ["Community profile", "Support gap map"],
            limitations: ["Indices are ranked within each nation and are not compared across nations."],
          }),
        ],
      };
    }
    case "production": {
      const r = m.result;
      return {
        rules: [
          {
            id: "removed",
            rule: `Production removed at least ${formatShare(SCENARIO_RULES.productionShareOfSupply)} of UK total supply`,
            fired: (r?.removedShareOfSupply ?? 0) >= SCENARIO_RULES.productionShareOfSupply,
            observed: formatShare(r?.removedShareOfSupply),
            serviceId: "resilience-assessment",
          },
          {
            id: "dependence",
            rule: `UK production at least ${formatShare(SCENARIO_RULES.productionDependence)} of total supply in the baseline`,
            fired: (r?.shareBefore ?? 0) >= SCENARIO_RULES.productionDependence,
            observed: formatShare(r?.shareBefore),
            serviceId: "climate-agriculture",
          },
        ],
        packages: (f) => [
          pkg(
            "resilience-assessment",
            "resilience",
            "National and regional resilience assessment",
            f("removed"),
            {
              challenge: `Understand how a fall in UK ${m.label.toLowerCase()} production would be absorbed, and where.`,
              evidence: [
                `${formatShare(r?.removedShareOfSupply)} of total supply removed in the scenario (Defra balance).`,
              ],
              analysis:
                "Regional production, processing and distribution capacity, and the import options that could respond.",
              additionalData: [
                "Regional production statistics",
                "Processing and storage capacity",
                "Stock levels",
              ],
              tasks: [
                "Map production and processing",
                "Assess import options",
                "Summarise resilience by region",
              ],
              deliverables: ["Resilience assessment", "Regional maps"],
              limitations: ["Defra's balance is annual and UK-wide."],
            },
          ),
          pkg("climate-agriculture", "climate", "Climate and agricultural resilience", f("dependence"), {
            challenge: `Assess climate and agricultural risks to UK ${m.label.toLowerCase()} production.`,
            evidence: [
              `UK production was ${formatShare(r?.shareBefore)} of total supply in Defra's balance.`,
            ],
            analysis: "Climate, soil and water indicators for UK growing regions, with past yield variation.",
            additionalData: ["Agricultural census by region", "Climate projections", "Yield series"],
            tasks: ["Map growing regions", "Combine climate indicators", "Identify vulnerable regions"],
            deliverables: ["Regional climate exposure maps", "Briefing"],
            limitations: ["Farm-level data is not public."],
          }),
        ],
      };
    }
    case "port": {
      const r = m.result;
      const sel = m.selected;
      return {
        rules: [
          {
            id: "share",
            rule: `Port handles at least ${formatShare(SCENARIO_RULES.portShareOfUk)} of UK major-port inward freight from abroad`,
            fired: (r?.international.shareOfUk ?? 0) >= SCENARIO_RULES.portShareOfUk,
            observed: formatShare(r?.international.shareOfUk),
            serviceId: "critical-infrastructure",
          },
          {
            id: "unitised",
            rule: `At least ${formatShare(SCENARIO_RULES.portUnitised)} of the port's inward tonnage in Ro-Ro units or containers (contents not recorded)`,
            fired: (sel?.unitisedShare ?? 0) >= SCENARIO_RULES.portUnitised,
            observed: formatShare(sel?.unitisedShare),
            serviceId: "data-integration",
          },
        ],
        packages: (f) => [
          pkg(
            "critical-infrastructure",
            "infrastructure",
            "Critical food infrastructure mapping",
            f("share"),
            {
              challenge: `Map the food flows, routes and distribution sites that depend on ${sel?.name ?? "the port"}.`,
              evidence: [
                `${formatShare(r?.international.shareOfUk)} of UK major-port inward freight from abroad (DfT ${m.year}).`,
              ],
              analysis: "Port hinterland mapping, alternative ports and routes, and their capacity.",
              additionalData: [
                "Commodity-level port data",
                "Distribution centre locations",
                "Road and rail capacity",
              ],
              tasks: ["Map hinterland and routes", "Assess alternative ports", "Identify critical links"],
              deliverables: ["Infrastructure dependency atlas", "Alternative routes note"],
              limitations: ["DfT does not record the contents of Ro-Ro and container freight."],
            },
          ),
          pkg("data-integration", "data", "Geospatial data integration and automation", f("unitised"), {
            challenge:
              "Combine port, trade and freight data so food flows through each port can be estimated with stated uncertainty.",
            evidence: [
              `${formatShare(sel?.unitisedShare)} of inward tonnage at the port has no recorded contents.`,
            ],
            analysis:
              "Integration of HMRC port-of-entry, DfT tonnage and freight data, refreshed automatically.",
            additionalData: ["HMRC trade by port of entry", "Operator data under agreement"],
            tasks: ["Map data sources", "Build the integration", "Validate against published totals"],
            deliverables: ["Integrated data model", "Refresh pipeline"],
            limitations: ["Some data is commercially confidential."],
          }),
          pkg("supply-chain-risk", "supply-chain", "Supply chain geographic risk analysis", undefined, {
            challenge: "Trace which commodities and partners depend on the port's routes.",
            evidence: ["Port-level food flows are not published by commodity."],
            analysis: "Route and partner mapping for food imports through the port.",
            additionalData: ["Ferry and shipping routes", "Trade by port of entry"],
            tasks: ["Map routes", "Link partners to routes"],
            deliverables: ["Route dependency map"],
            limitations: ["Commodity-level port data is limited."],
          }),
        ],
      };
    }
  }
}

export function buildScenarioReport(x: ScenarioInputs): AssessmentReport {
  const m = x.model;
  const title = SCENARIO_TITLES[m.kind];
  const letter = SCENARIO_LETTERS[m.kind];
  const ind = new IndicatorSet();
  const labels = KPI_LABELS[m.kind];

  const kpis: ReportKpi[] = m.headlines.slice(0, 4).map((h, i) => {
    ind.add(h.indicator);
    return {
      id: h.id,
      label: h.label,
      short: labels[i]?.short ?? h.label,
      indicator: h.indicator,
      detail: h.detail,
    };
  });
  for (const r of m.rows) {
    ind.add(r.baseline);
    ind.add(r.scenario);
  }

  const subject =
    m.kind === "import"
      ? `${m.commodity.label}: ${m.partnerName}`
      : m.kind === "closure"
        ? `${m.store.name}, ${m.store.council.name}`
        : m.kind === "production"
          ? m.label
          : (m.selected?.name ?? "No port selected");

  const sections: ReportSection[] = [];
  const charts: ReportChart[] = [];

  sections.push({
    id: "scenario",
    title: "Selected scenario",
    intro: `${letter}: ${title.title}. ${title.hint}.${x.savedName ? ` Loaded from the saved scenario "${x.savedName}".` : ""}`,
    findings: [],
    tables: [
      {
        id: "parameters",
        caption: "Scenario parameters",
        columns: ["Parameter", "Value", "Basis"],
        numeric: [false, false, false],
        rows: parameterRows(m, x.params),
      },
    ],
    chartIds: [],
    notes: ["User assumptions are choices for exploration, not estimates of what is likely."],
  });

  sections.push({
    id: "baseline",
    title: "Baseline",
    intro: "The published figures the scenario starts from, with their own provenance.",
    findings: m.rows.map((r) =>
      finding(
        `${r.label}: ${value(r.baseline)} (${r.baseline.referencePeriod}).`,
        r.baseline.scope === "local" ? "local" : "national_context",
        r.baseline,
      ),
    ),
    tables: [],
    chartIds: [],
    notes: [],
  });

  sections.push({
    id: "assumptions",
    title: "Assumptions",
    findings: m.assumptions.map((a) => finding(a, "method")),
    tables: [],
    chartIds: [],
    notes: [],
  });

  sections.push({
    id: "results",
    title: "Results: estimated exposure",
    scopeNote:
      "Scenario-modelled under the stated assumptions: estimated exposure, not a forecast or a confirmed impact.",
    findings: m.headlines.map((h) =>
      finding(
        `${h.label}: ${value(h.indicator)}${h.detail ? ` (${h.detail})` : ""}.`,
        "scenario",
        h.indicator,
      ),
    ),
    tables: [
      {
        id: "results",
        caption: "Baseline and scenario",
        columns: ["Measure", "Baseline", "Scenario", "Change", "Relative"],
        numeric: [false, true, true, true, true],
        rows: m.rows.map((r) => [
          r.label,
          value(r.baseline),
          value(r.scenario),
          changeText(r),
          relativeText(r),
        ]),
        note: `Confidence: ${CONFIDENCE_LABELS[m.confidence.level]} — ${m.confidence.reasons.join(" ")}`,
      },
    ],
    chartIds: [],
    notes: [],
  });

  const geo = geography(m);
  sections.push(geo.section);
  charts.push(...geo.charts);

  const sens = sensitivityTable(x);
  sections.push({
    id: "sensitivity",
    title: "Sensitivity and limitations",
    intro: "How the key results move when the intensity changes, and what the calculation leaves out.",
    findings: [],
    tables: sens ? [sens] : [],
    chartIds: [],
    notes: [...x.methodology.limitations, ...x.methodology.doesNotMean.map((d) => `Does not mean: ${d}`)],
  });

  const { rules, packages } = kindRules(m, x.params);
  const fired = (id: string) => rules.find((r) => r.id === id);
  const supporting = pkg(
    "digital-twins-dashboards",
    "monitoring",
    "Digital twins and operational dashboards",
    undefined,
    {
      challenge:
        "Turn scenarios like this into a maintained operational view that partners can use in planning and response.",
      evidence: ["This scenario recomputes from published data and parameters held in a link."],
      analysis: "An operational dashboard with live data feeds, scenario presets and agreed thresholds.",
      additionalData: ["Operational data from partners under agreement", "Agreed alert thresholds"],
      tasks: ["Define users and decisions", "Design the operational view", "Prototype with live data"],
      deliverables: ["Dashboard prototype", "Governance and data-sharing outline"],
      limitations: ["Operational data is often restricted and needs agreements."],
    },
  );
  const all = [...packages(fired), supporting];
  const workPackages = [...all.filter((w) => w.indicated), ...all.filter((w) => !w.indicated)];

  sections.push({
    id: "interventions",
    title: "Possible interventions to explore",
    intro:
      "Options a responsible organisation might investigate. They follow from the scenario's figures and are not recommendations or confirmed needs.",
    findings: workPackages
      .filter((w) => w.indicated)
      .map((w) => finding(`${w.title}: ${w.challenge}`, "method")),
    tables: [],
    chartIds: [],
    notes: [],
  });

  const summary: ReportFinding[] = [
    finding(
      `Scenario ${letter}, ${title.title.toLowerCase()}: ${subject}. A hypothetical run under stated assumptions, not a forecast and not a confirmed operational impact.`,
      "scenario",
    ),
    ...m.headlines
      .slice(0, 3)
      .map((h) => finding(`${h.label}: ${value(h.indicator)}.`, "scenario", h.indicator)),
    finding(
      `Confidence in the inputs: ${CONFIDENCE_LABELS[m.confidence.level].toLowerCase()} (${m.confidence.reasons[0] ?? "see the results"}).`,
      "method",
    ),
    finding(
      `${workPackages.filter((w) => w.indicated).length} of ${workPackages.length} potential work packages are indicated by stated rules on these results.`,
      "method",
    ),
  ];

  const { datasets, sources } = datasetRefs(x.manifest, x.datasetIds);
  return {
    schema: "foodscope.insights.report.v1",
    kind: "scenario",
    title: REPORT_TITLES.scenario,
    subject,
    subjectCode: `${letter}`,
    subtitle: `Scenario ${letter} · ${title.title} · ${subject}`,
    context: `An exploratory assessment of a hypothetical disruption built with the FOODSCOPE UK Scenario Lab. ${x.methodology.boundary} Results are estimated exposure under the stated assumptions: they are not forecasts and do not describe confirmed operational impacts.`,
    executiveSummary: summary,
    kpis,
    sections,
    charts,
    workPackages,
    rules,
    methodology: [
      ...x.methodology.formula,
      `Boundary: ${x.methodology.boundary}`,
      ...x.methodology.sources.map((s) => `${s.id}: ${s.text}`),
    ],
    limitations: x.methodology.limitations,
    indicators: ind.list(),
    sources,
    datasets,
    snapshots: snapshotsOf(datasets),
    disclaimer: EXPLORATORY_NOTE,
    link: x.link,
  };
}
