/**
 * Local Authority Food Security Assessment (Stage 8, brief §2; CI-02, CI-03).
 *
 * Built only from figures the earlier modules publish and test: the council's profile (stores,
 * rates, retailer concentration, context), the Priority Places for Food Index by council (Risk
 * Explorer), small areas from the Scenario Lab's UK-wide inputs (straight-line distances,
 * England's deprivation), the deep profile where one exists, and the national trade context.
 * National figures are labelled national context, never the council's own supply chain (P6).
 */
import {
  formatCount,
  formatHhi,
  formatKm,
  formatPer10k,
  formatPopulation,
  formatShare,
  formatTonnes,
} from "@/analysis/format";
import type { CouncilNetwork } from "@/analysis/profile";
import type { AreaTotal, Provision } from "@/analysis/retail";
import { rateIndicator } from "@/features/access/indicators";
import type { CouncilRow, DeepProfile } from "@/features/profiles/model";
import {
  concentrationIndicator,
  hhiIndicator,
  nationalTopShareIndicator,
  noCarIndicator,
  NI_STORE_COVERAGE,
  populationIndicator,
  retailersIndicator,
  storesIndicator,
  urbanRuralIndicator,
} from "@/features/profiles/indicators";
import type { NationalRow } from "@/features/profiles/useProfile";
import {
  councilRankIndicator,
  councilShareIndicator,
  nationShareIndicator,
} from "@/features/risks/indicators";
import type { CouncilRiskRow } from "@/features/risks/model";
import type { DataManifest } from "@/types/generated/manifest";
import { serviceById } from "./content";
import {
  closurePreviewIndicator,
  deprivedShareIndicator,
  publishedProductionShare,
  smallAreaBeyondIndicator,
} from "./indicators";
import {
  datasetRefs,
  EXPLORATORY_NOTE,
  finding,
  IndicatorSet,
  REPORT_TITLES,
  snapshotsOf,
  type AssessmentReport,
  type ReportChart,
  type ReportKpi,
  type ReportSection,
  type RuleCheck,
  type WorkPackage,
} from "./report";
import { furthestAreas, type ClosurePreview, type CouncilSmallAreas } from "./smallAreas";

export interface PpfiInput {
  /** The council's row for the combined index (share of small areas in its nation's deciles 1–2). */
  combined: CouncilRiskRow | null;
  /** The pooled share for the council's nation (about 20 % by construction). */
  nationShare: number | null;
  domains: { measure: string; label: string; share: number | null; priority: number | null; areas: number }[];
}

export interface AuthorityInputs {
  council: CouncilRow;
  network: CouncilNetwork;
  supermarkets: Provision | null;
  /** The council's nation and the UK (supermarkets per 10,000 residents). */
  nationRate: AreaTotal | null;
  ukRate: AreaTotal | null;
  smallAreas: CouncilSmallAreas | null;
  /** The nation's share of residents more than 1 km from a supermarket, from the same small-area file. */
  nationBeyond1km: number | null;
  closure: ClosurePreview | null;
  ppfi: PpfiInput | null;
  deep: DeepProfile | null;
  /** Households with no car or van across the council's nation (Census 2021), for context. */
  nationNoCarShare: number | null;
  national: NationalRow[] | null;
  manifest: DataManifest | undefined;
  datasetIds: string[];
  link: string;
}

/** Thresholds of the stated rules (shown under "Why am I seeing this?", CI-03). */
export const AUTHORITY_RULES = {
  topRetailerShare: 0.4,
  closureShareOfPopulation: 0.02,
  deprivedShare: 0.3,
} as const;

const PPFI_LABEL = "Priority Places for Food Index (combined)";

function serviceStakeholders(id: string): string[] {
  return serviceById(id).stakeholders;
}

export function buildAuthorityReport(x: AuthorityInputs): AssessmentReport {
  const c = x.council;
  const ind = new IndicatorSet();
  const where = `${c.name} (${c.nation})`;
  const ni = c.code.startsWith("N");
  const sup = x.supermarkets;
  const k = x.network.supermarketConcentration;
  const beyond1 = x.smallAreas?.beyond.find((b) => b.thresholdKm === 1) ?? null;
  const beyond2 = x.smallAreas?.beyond.find((b) => b.thresholdKm === 2) ?? null;

  // ------------------------------------------------------------------ key figures
  const pop = ind.add(populationIndicator(c));
  const rate = sup
    ? ind.add(rateIndicator("supermarkets", sup.per10k, sup.stores, sup.population, where))
    : null;
  const nationRate = x.nationRate
    ? ind.add({
        ...rateIndicator(
          "supermarkets",
          x.nationRate.per10k,
          x.nationRate.stores,
          x.nationRate.population,
          `${c.nation} (all councils)`,
        ),
        id: "access.per10k.supermarkets.nation",
      })
    : null;
  const ukRate = x.ukRate
    ? ind.add({
        ...rateIndicator(
          "supermarkets",
          x.ukRate.per10k,
          x.ukRate.stores,
          x.ukRate.population,
          "United Kingdom (all councils)",
        ),
        id: "access.per10k.supermarkets.uk",
      })
    : null;
  const stores = ind.add(storesIndicator(c, x.network.total));
  const retailers = ind.add(retailersIndicator(c, x.network.retailers.length));
  const top = ind.add(concentrationIndicator(c, k));
  const hhi = ind.add(hhiIndicator(c, k));
  const far1 =
    x.smallAreas && beyond1 ? ind.add(smallAreaBeyondIndicator(c.name, x.smallAreas, beyond1)) : null;
  const far2 =
    x.smallAreas && beyond2 ? ind.add(smallAreaBeyondIndicator(c.name, x.smallAreas, beyond2)) : null;
  const noCar = ind.add(noCarIndicator(c));
  const urban = ind.add(urbanRuralIndicator(c));
  const deprived = x.smallAreas ? ind.add(deprivedShareIndicator(c.name, x.smallAreas)) : null;
  const ppfiRow = x.ppfi?.combined ?? null;
  const ppfiShare = ppfiRow ? ind.add(councilShareIndicator(ppfiRow, PPFI_LABEL)) : null;
  const ppfiRank = ppfiRow ? ind.add(councilRankIndicator(ppfiRow)) : null;
  const ppfiNation = x.ppfi ? ind.add(nationShareIndicator(c.nation, x.ppfi.nationShare, PPFI_LABEL)) : null;
  const closure =
    x.closure && x.smallAreas ? ind.add(closurePreviewIndicator(c.name, x.closure, x.smallAreas)) : null;

  const kpis: ReportKpi[] = [
    {
      id: "population",
      label: "Residents (mid-2025)",
      short: "Residents",
      indicator: pop,
      detail: `${c.name} · ONS mid-2025`,
    },
    ...(rate
      ? [
          {
            id: "rate",
            label: "Supermarkets per 10,000 residents",
            short: "Supermarkets / 10k",
            indicator: rate,
            detail: `${c.nation} ${formatPer10k(x.nationRate?.per10k)} · UK ${formatPer10k(x.ukRate?.per10k)}`,
          },
        ]
      : []),
    ...(far1
      ? [
          {
            id: "beyond",
            label: "Residents more than 1 km from a supermarket (straight-line)",
            short: "Residents > 1 km",
            indicator: far1,
            detail: `${c.nation} ${formatShare(x.nationBeyond1km)} · straight-line, not travel time`,
          },
        ]
      : []),
    ...(ppfiShare
      ? [
          {
            id: "ppfi",
            label: `Small areas in ${c.nation}'s highest-priority PPFI deciles`,
            short: "PPFI priority areas",
            indicator: ppfiShare,
            detail: `${c.nation} ${formatShare(x.ppfi?.nationShare)} · ${ppfiRank?.value ? `rank ${ppfiRank.value}` : "within nation"}`,
          },
        ]
      : []),
  ];

  // ------------------------------------------------------------------ sections
  const sections: ReportSection[] = [];
  const charts: ReportChart[] = [];

  // Food retail network
  const retailFindings = [
    finding(
      `${c.name} has ${formatCount(x.network.total)} mapped grocery stores, ${formatCount(x.network.byLayer.supermarket)} of them supermarkets (280 m² and over), from ${formatCount(x.network.retailers.length)} retailers (GEOLYTIX, June 2026).`,
      "local",
      stores,
      retailers,
    ),
  ];
  if (rate && sup)
    retailFindings.push(
      finding(
        `Supermarket coverage is ${formatPer10k(sup.per10k)} per 10,000 residents, against ${formatPer10k(x.nationRate?.per10k)} across ${c.nation} and ${formatPer10k(x.ukRate?.per10k)} across the UK.`,
        "local",
        ...[rate, nationRate, ukRate].filter((i): i is NonNullable<typeof i> => i !== null),
      ),
    );
  if (k.topRetailer && k.topShare !== null)
    retailFindings.push(
      finding(
        `${k.topRetailer} operates ${formatShare(k.topShare)} of the council's ${formatCount(k.stores)} supermarkets (by store count, not floorspace or sales); retailer concentration (HHI) is ${formatHhi(k.hhi)}.`,
        "local",
        top,
        hhi,
      ),
    );
  if (far1 && beyond1 && x.smallAreas)
    retailFindings.push(
      finding(
        `${formatShare(beyond1.share)} of residents (${formatPopulation(beyond1.population, "small_area")}) live in small areas more than 1 km straight-line from the nearest supermarket${beyond2 && beyond2.population > 0 ? `, and ${formatShare(beyond2.share)} more than 2 km` : ""}; across ${c.nation} the share beyond 1 km is ${formatShare(x.nationBeyond1km)}.`,
        "local",
        ...[far1, far2].filter((i): i is NonNullable<typeof i> => i !== null),
      ),
    );
  const retailerRows = x.network.retailers
    .filter((r) => r.byLayer.supermarket > 0)
    .slice(0, 8)
    .map((r) => [
      r.retailer,
      formatCount(r.byLayer.supermarket),
      formatShare(k.stores > 0 ? r.byLayer.supermarket / k.stores : null),
    ]);
  sections.push({
    id: "retail",
    title: "Food retail network",
    intro:
      "Mapped grocery stores and supermarkets, their coverage per resident and their retailer composition. Store counts describe the network, not market share, opening hours or prices.",
    findings: retailFindings,
    tables: [
      {
        id: "retailers",
        caption: `Supermarkets by retailer, ${c.name}`,
        columns: ["Retailer", "Supermarkets", "Share of supermarkets"],
        numeric: [false, true, true],
        rows: retailerRows,
        note: "GEOLYTIX Grocery Retail Points v46 (June 2026); store counts, not floorspace or sales.",
      },
    ],
    chartIds: ["retailers", ...(x.smallAreas ? ["beyond"] : [])],
    notes: ni ? [NI_STORE_COVERAGE] : [],
  });
  if (retailerRows.length)
    charts.push({
      id: "retailers",
      title: `Supermarkets by retailer, ${c.name}`,
      kind: "bar",
      format: "count",
      categories: retailerRows.map((r) => r[0]!),
      series: [
        {
          name: "Supermarkets",
          role: "observed",
          values: x.network.retailers
            .filter((r) => r.byLayer.supermarket > 0)
            .slice(0, 8)
            .map((r) => r.byLayer.supermarket),
        },
      ],
      description: `Supermarkets by retailer in ${c.name}: ${retailerRows.map((r) => `${r[0]} ${r[1]}`).join("; ")}.`,
      source: "GEOLYTIX Grocery Retail Points v46 (S11)",
    });
  if (x.smallAreas)
    charts.push({
      id: "beyond",
      title: `Residents beyond each straight-line distance from a supermarket`,
      kind: "pairedBar",
      format: "share",
      categories: x.smallAreas.beyond.map((b) => `More than ${formatKm(b.thresholdKm)}`),
      series: [{ name: c.name, role: "observed", values: x.smallAreas.beyond.map((b) => b.share) }],
      description: `Share of ${c.name}'s residents living in small areas more than 1, 2 and 5 km straight-line from the nearest supermarket: ${x.smallAreas.beyond
        .map((b) => `${formatKm(b.thresholdKm)} ${formatShare(b.share)}`)
        .join("; ")}.`,
      source: "Scenario Lab small-area inputs (S11, S15–S18), Census population",
    });

  // Community vulnerability
  const vulnFindings = [];
  if (ppfiShare && ppfiRow)
    vulnFindings.push(
      finding(
        `${formatShare(ppfiRow.share)} of ${c.name}'s small areas are in ${c.nation}'s two highest-priority deciles of the ${PPFI_LABEL} (${c.nation}: ${formatShare(x.ppfi?.nationShare)}; ${ppfiRank?.value ? `rank ${ppfiRank.value} within ${c.nation}` : "not ranked"}). Deciles are set within each nation, so councils are compared only with their own nation.`,
        "local",
        ...[ppfiShare, ppfiNation, ppfiRank].filter((i): i is NonNullable<typeof i> => i !== null),
      ),
    );
  if (x.ppfi) {
    const ranked = x.ppfi.domains
      .filter((d) => d.measure !== "combined" && d.share !== null)
      .sort((a, b) => (b.share ?? 0) - (a.share ?? 0));
    const lead = ranked.slice(0, 2);
    if (lead.length)
      vulnFindings.push(
        finding(
          `Among the index's domains, the highest shares of priority areas are for ${lead.map((d) => `${d.label.toLowerCase()} (${formatShare(d.share)})`).join(" and ")}.`,
          "local",
          ...(ppfiShare ? [ppfiShare] : []),
        ),
      );
  }
  if (noCar.value !== null)
    vulnFindings.push(
      finding(
        `${formatShare(noCar.value)} of households have no car or van (Census 2021), against ${formatShare(x.nationNoCarShare)} across ${c.nation}.`,
        "local",
        noCar,
      ),
    );
  if (deprived?.value !== null && deprived)
    vulnFindings.push(
      finding(
        `${formatShare(deprived.value)} of residents live in England's 20 % most deprived small areas (IoD 2025).`,
        "local",
        deprived,
      ),
    );
  const investigate = x.smallAreas ? furthestAreas(x.smallAreas, 6) : [];
  const deprivedFar = x.smallAreas?.deprivedAndFar ?? [];
  if (deprivedFar.length)
    vulnFindings.push(
      finding(
        `${formatCount(deprivedFar.length)} small area${deprivedFar.length === 1 ? " is" : "s are"} both among England's 20 % most deprived and more than 1 km straight-line from a supermarket: ${deprivedFar
          .slice(0, 4)
          .map((a) => a.name)
          .join(", ")}${deprivedFar.length > 4 ? " and others" : ""}.`,
        "local",
        ...(far1 ? [far1] : []),
        ...(deprived ? [deprived] : []),
      ),
    );
  const deepPpfi =
    x.deep?.ppfi
      .filter((p) => p.ppfi.decile !== null && p.ppfi.decile <= 2)
      .sort(
        (a, b) => (a.ppfi.decile ?? 99) - (b.ppfi.decile ?? 99) || (b.population ?? 0) - (a.population ?? 0),
      )
      .slice(0, 6) ?? [];
  sections.push({
    id: "vulnerability",
    title: "Community vulnerability",
    intro:
      "Food-access, deprivation and transport indicators at council and small-area level. Indices are ranked within each nation and are never compared across nations (P11).",
    findings: vulnFindings,
    tables: [
      ...(investigate.length
        ? [
            {
              id: "investigate",
              caption: "Small areas furthest from a supermarket (straight-line), for further investigation",
              columns: [
                "Small area",
                "Residents",
                "Nearest supermarket",
                "Straight-line",
                ...(c.code.startsWith("E") ? ["IoD decile"] : []),
              ],
              numeric: [false, true, false, true, ...(c.code.startsWith("E") ? [true] : [])],
              rows: investigate.map((a) => [
                `${a.name} (${a.code})`,
                formatPopulation(a.population, "small_area"),
                a.nearestStore,
                formatKm(a.nearestM / 1000),
                ...(c.code.startsWith("E") ? [a.decile === null ? "—" : String(a.decile)] : []),
              ]),
              note: `Census ${x.smallAreas?.censusYear ?? 2021} residents; distance from the population-weighted centroid. Candidates for local investigation, not findings of need.`,
            },
          ]
        : []),
      ...(deepPpfi.length
        ? [
            {
              id: "ppfi-areas",
              caption: `Small areas in ${c.nation}'s highest-priority PPFI deciles (deep profile)`,
              columns: ["Small area", "Residents", "PPFI decile (within nation)"],
              numeric: [false, true, true],
              rows: deepPpfi.map((p) => [
                `${p.name} (${p.code})`,
                formatPopulation(p.population, "small_area"),
                String(p.ppfi.decile),
              ]),
              note: "Priority Places for Food Index v2.1; 1 = highest priority within the nation.",
            },
          ]
        : []),
    ],
    chartIds: [],
    notes: [
      ...(c.code.startsWith("E")
        ? []
        : [
            "Small-area deprivation deciles are attached to England's areas only in this build; Wales, Scotland and Northern Ireland publish their own indices (backlog B53).",
          ]),
      ...(noCar.value === null
        ? ["Car availability is not included for Scotland's councils (Census 2022)."]
        : []),
    ],
  });

  // National supply context (P6)
  const national = (x.national ?? []).filter((r) => r.imports);
  const concentrated = [...national]
    .sort((a, b) => (b.imports!.topShare ?? 0) - (a.imports!.topShare ?? 0))
    .slice(0, 4);
  const nationalFindings = concentrated.map((r) => {
    const i = ind.add(
      nationalTopShareIndicator(r.label, r.imports!.topShare, r.imports!.topPartner, r.imports!.periodLabel),
    );
    return finding(
      `${r.label}: ${formatShare(r.imports!.topShare)} of UK recorded imports by net mass came from ${r.imports!.topPartner} (${r.imports!.periodLabel}); ${formatTonnes(r.imports!.tonnes)} in all.`,
      "national_context",
      i,
    );
  });
  const production = new Map(
    national.map((r) => {
      const i = publishedProductionShare(r.label, r.production);
      return [r.basket, i ? ind.add(i) : null] as const;
    }),
  );
  const lowProduction = national
    .filter((r) => production.get(r.basket)?.value != null)
    .sort((a, b) => production.get(a.basket)!.value! - production.get(b.basket)!.value!)
    .slice(0, 2);
  if (lowProduction.length)
    nationalFindings.push(
      finding(
        `Defra's UK supply balances put UK production at ${lowProduction
          .map(
            (r) =>
              `${formatShare(production.get(r.basket)!.value)} of supply for ${r.label.toLowerCase()} (${production.get(r.basket)!.referencePeriod})`,
          )
          .join(" and ")}: annual national figures, not comparable with monthly trade.`,
        "national_context",
        ...lowProduction.map((r) => production.get(r.basket)!),
      ),
    );
  sections.push({
    id: "national",
    title: "National supply context",
    scopeNote:
      "National context: UK recorded imports and Defra production, the same for every council. Not the council's own retail supply chain, which is not published.",
    intro:
      "Where the UK's recorded imports of the FOODSCOPE baskets come from (HMRC, partner = country of dispatch), and how concentrated they are. These figures describe national trade, not where this council's shops source their food.",
    findings: nationalFindings,
    tables: national.length
      ? [
          {
            id: "national",
            caption: "UK recorded imports, latest 12 months (national context)",
            columns: [
              "Commodity",
              "Recorded imports",
              "Largest partner",
              "Its share",
              "HHI",
              "UK production share of supply",
            ],
            numeric: [false, true, false, true, true, true],
            rows: national.map((r) => {
              const p = production.get(r.basket);
              return [
                r.label,
                formatTonnes(r.imports!.tonnes),
                r.imports!.topPartner ?? "—",
                formatShare(r.imports!.topShare),
                formatHhi(r.imports!.hhi),
                p ? `${formatShare(p.value)} (${p.referencePeriod})` : "Not published",
              ];
            }),
            note: "HMRC Overseas Trade Statistics (S01), net mass, latest 12 months; recent months provisional. Partner = country of dispatch, not necessarily where food was grown. Production: Defra's latest annual UK balance (S09, S10), not comparable month by month.",
          },
        ]
      : [],
    chartIds: [],
    notes: [],
  });

  // ------------------------------------------------------------------ rules (CI-03)
  const topShare = k.topShare;
  const rate10k = sup?.per10k ?? null;
  const rules: RuleCheck[] = [
    {
      id: "access",
      rule: `Residents more than 1 km straight-line from a supermarket: share at or above the nation's (${c.nation})`,
      fired: beyond1?.share != null && x.nationBeyond1km != null && beyond1.share >= x.nationBeyond1km,
      observed: `${formatShare(beyond1?.share)} against ${formatShare(x.nationBeyond1km)}`,
      serviceId: "retail-accessibility",
    },
    {
      id: "network",
      rule: `Largest retailer at least ${formatShare(AUTHORITY_RULES.topRetailerShare)} of supermarkets, or fewer supermarkets per 10,000 residents than the nation`,
      fired:
        (topShare !== null && topShare >= AUTHORITY_RULES.topRetailerShare) ||
        (rate10k !== null && x.nationRate?.per10k != null && rate10k < x.nationRate.per10k),
      observed: `largest retailer ${formatShare(topShare)}; ${formatPer10k(rate10k)} per 10,000 against ${formatPer10k(x.nationRate?.per10k)}`,
      serviceId: "retail-accessibility",
    },
    {
      id: "vulnerability",
      rule: `Share of small areas in the nation's highest-priority PPFI deciles at or above the nation's pooled share`,
      fired: ppfiRow?.share != null && x.ppfi?.nationShare != null && ppfiRow.share >= x.ppfi.nationShare,
      observed: `${formatShare(ppfiRow?.share)} against ${formatShare(x.ppfi?.nationShare)}`,
      serviceId: "resilience-assessment",
    },
    {
      id: "policy",
      rule: `Small areas both in England's 20 % most deprived and more than 1 km from a supermarket, or at least ${formatShare(AUTHORITY_RULES.deprivedShare)} of residents in the 20 % most deprived`,
      fired:
        deprivedFar.length > 0 ||
        (deprived?.value != null && (deprived.value as number) >= AUTHORITY_RULES.deprivedShare),
      observed:
        deprived?.value != null
          ? `${formatCount(deprivedFar.length)} such areas; ${formatShare(deprived.value as number)} of residents in deciles 1–2`
          : "England only: no small-area deprivation deciles for this nation in this build",
      serviceId: "scenario-modelling",
    },
    {
      id: "scenario",
      rule: `Closing the council's most relied-on supermarket would change the nearest supermarket of at least ${formatShare(AUTHORITY_RULES.closureShareOfPopulation)} of its residents`,
      fired:
        x.closure !== null &&
        c.population !== null &&
        c.population > 0 &&
        x.closure.result.populationAffected / c.population >= AUTHORITY_RULES.closureShareOfPopulation,
      observed: x.closure
        ? `${formatPopulation(x.closure.result.populationAffected, "small_area")} residents (${x.closure.name})`
        : "no supermarket in the council",
      serviceId: "scenario-modelling",
    },
    {
      id: "data",
      rule: "One or more of this assessment's indicators is not published or not comparable for the council's nation",
      fired: noCar.value === null || deprived?.value == null || ni,
      observed:
        [
          noCar.value === null ? "no car-availability figure" : null,
          deprived?.value == null ? "no small-area deprivation deciles" : null,
          ni ? "partial store coverage in Northern Ireland" : null,
        ]
          .filter(Boolean)
          .join("; ") || "no gaps among these indicators",
      serviceId: "data-integration",
    },
  ];
  const fired = (id: string) => rules.find((r) => r.id === id)?.fired ?? false;

  // ------------------------------------------------------------------ work packages (CI-02)
  const nDatasets = x.datasetIds.length;
  const wp: WorkPackage[] = [
    {
      id: "accessibility",
      serviceId: "retail-accessibility",
      title: "Geographic accessibility assessment",
      indicated: fired("access"),
      why:
        rules.find((r) => r.id === "access")!.rule + ` — ${rules.find((r) => r.id === "access")!.observed}.`,
      challenge: `Understand how easily residents of ${c.name} can reach food retail on foot, by public transport and by car, beyond straight-line proximity.`,
      evidence: [
        far1
          ? `${formatShare(beyond1?.share)} of residents live more than 1 km straight-line from a supermarket.`
          : "Straight-line distances by small area are available.",
        noCar.value !== null
          ? `${formatShare(noCar.value)} of households have no car or van.`
          : "Car availability is not published for this nation in this build.",
      ],
      analysis:
        "Walking, cycling and public transport times to supermarkets and other food retail along the street network, by time of day, for the neighbourhoods furthest from a store.",
      additionalData: [
        "Street network and footpaths",
        "Public transport timetables (GTFS)",
        "Store opening hours and size",
        "Small-area population by age",
      ],
      tasks: [
        "Build network travel-time catchments for each store",
        "Compare access by mode and population group",
        "Identify neighbourhoods with the longest travel times",
      ],
      deliverables: ["Travel-time accessibility maps", "Neighbourhood access summaries", "Method note"],
      stakeholders: serviceStakeholders("retail-accessibility"),
      limitations: [
        "Opening hours and prices are not in open data at this scale.",
        "Results depend on the quality of local transport data.",
      ],
    },
    {
      id: "network",
      serviceId: "retail-accessibility",
      title: "Retail network analysis",
      indicated: fired("network"),
      why:
        rules.find((r) => r.id === "network")!.rule +
        ` — ${rules.find((r) => r.id === "network")!.observed}.`,
      challenge: `Assess how resilient ${c.name}'s food retail network is to change: concentration among retailers, gaps in coverage and dependence on individual stores.`,
      evidence: [
        k.topRetailer
          ? `${k.topRetailer} operates ${formatShare(k.topShare)} of the council's supermarkets; HHI ${formatHhi(k.hhi)}.`
          : "No supermarkets are mapped in the council.",
        rate10k !== null
          ? `${formatPer10k(rate10k)} supermarkets per 10,000 residents (${c.nation} ${formatPer10k(x.nationRate?.per10k)}).`
          : "No supermarket rate is available.",
      ],
      analysis:
        "Which neighbourhoods depend on a single store or retailer, how far they would be from the next option, and how the network compares with similar councils.",
      additionalData: [
        "Store floorspace and formats",
        "Recent openings and closures",
        "Planning applications for retail",
      ],
      tasks: [
        "Profile the network by retailer, format and size",
        "Map single-store dependencies",
        "Benchmark against councils of the same nation and urban/rural class",
      ],
      deliverables: ["Retail network atlas", "Dependency register", "Benchmarking note"],
      stakeholders: serviceStakeholders("retail-accessibility"),
      limitations: ["Store counts are not market share; sales and floorspace are not in open data."],
    },
    {
      id: "strategy",
      serviceId: "resilience-assessment",
      title: "Regional food resilience strategy",
      indicated: fired("vulnerability"),
      why:
        rules.find((r) => r.id === "vulnerability")!.rule +
        ` — ${rules.find((r) => r.id === "vulnerability")!.observed}.`,
      challenge: `Bring food access, community vulnerability and national supply context together into a shared evidence base for ${c.name} and its neighbours.`,
      evidence: [
        ppfiRow
          ? `${formatShare(ppfiRow.share)} of small areas are in ${c.nation}'s highest-priority PPFI deciles (${c.nation}: ${formatShare(x.ppfi?.nationShare)}).`
          : "Priority Places for Food Index figures are not available for this council.",
        `National context: ${concentrated[0] ? `${concentrated[0].label} has the most concentrated recorded sourcing (${formatShare(concentrated[0].imports!.topShare)} from ${concentrated[0].imports!.topPartner})` : "recorded import concentration by commodity"}.`,
      ],
      analysis:
        "Where local vulnerability, access and wider supply risks coincide, and which partners and services could act on each.",
      additionalData: [
        "Local food bank and community food provision locations",
        "Free school meal and benefit take-up by area",
        "Local resilience forum risk assessments",
      ],
      tasks: [
        "Agree the strategy's questions with local partners",
        "Combine local and national indicators with their comparability rules",
        "Draft priorities and a monitoring framework",
      ],
      deliverables: ["Evidence base and maps", "Strategy priorities paper", "Monitoring indicator set"],
      stakeholders: serviceStakeholders("resilience-assessment"),
      limitations: [
        "National trade figures are context only; local supply chains are not published.",
        "Indices are ranked within each nation and cannot be compared across nations.",
      ],
    },
    {
      id: "policy",
      serviceId: "scenario-modelling",
      title: "Policy intervention evaluation",
      indicated: fired("policy"),
      why:
        rules.find((r) => r.id === "policy")!.rule + ` — ${rules.find((r) => r.id === "policy")!.observed}.`,
      challenge:
        "Estimate where interventions such as transport links, delivery schemes or community food provision would reach the most residents, and how to monitor their effect.",
      evidence: [
        deprivedFar.length
          ? `${formatCount(deprivedFar.length)} small areas are both among England's 20 % most deprived and more than 1 km from a supermarket.`
          : "Small areas furthest from a supermarket are listed for further investigation.",
        ppfiRow
          ? `PPFI priority share ${formatShare(ppfiRow.share)}.`
          : "Small-area access and population figures are available.",
      ],
      analysis:
        "Before-and-after comparisons of access for intervention options, with the populations each would reach and the indicators to track.",
      additionalData: [
        "Locations and timings of existing interventions",
        "Service usage data shared by partners",
        "Population by age and household type",
      ],
      tasks: [
        "Define intervention options with partners",
        "Model reach and access change",
        "Set out a monitoring and evaluation plan",
      ],
      deliverables: ["Option appraisal maps", "Evaluation framework", "Briefing for decision makers"],
      stakeholders: serviceStakeholders("scenario-modelling"),
      limitations: ["Effects on behaviour and diet are outside spatial analysis alone."],
    },
    {
      id: "scenario",
      serviceId: "scenario-modelling",
      title: "Scenario modelling",
      indicated: fired("scenario"),
      why:
        rules.find((r) => r.id === "scenario")!.rule +
        ` — ${rules.find((r) => r.id === "scenario")!.observed}.`,
      challenge: `Explore how ${c.name}'s food access would change under plausible disruptions to stores or supply, before they happen.`,
      evidence: x.closure
        ? [
            `If ${x.closure.name} closed, ${formatPopulation(x.closure.result.populationAffected, "small_area")} residents would have a different nearest supermarket, on average ${formatKm((x.closure.result.meanIncrease ?? 0) / 1000)} further away in a straight line (Scenario B, hypothetical).`,
          ]
        : ["No supermarket is mapped in the council, so no closure scenario is computed."],
      analysis:
        "Store closure, opening and transport disruption scenarios, measured by network travel time and population reached, compared side by side.",
      additionalData: ["Network travel times", "Store size and opening hours", "Planned developments"],
      tasks: [
        "Agree scenarios and assumptions",
        "Model each scenario and its sensitivity",
        "Compare scenarios on maps and charts",
      ],
      deliverables: [
        "Scenario results with stated assumptions",
        "Interactive scenario view",
        "Sensitivity note",
      ],
      stakeholders: serviceStakeholders("scenario-modelling"),
      limitations: ["Scenarios estimate exposure under stated assumptions; they are not forecasts."],
    },
    {
      id: "data",
      serviceId: "data-integration",
      title: "Data integration and monitoring",
      indicated: fired("data"),
      why: rules.find((r) => r.id === "data")!.rule + ` — ${rules.find((r) => r.id === "data")!.observed}.`,
      challenge: `Keep ${c.name}'s food-access evidence current as stores, populations and indices change, with the gaps closed where possible.`,
      evidence: [
        `This assessment combines ${formatCount(nDatasets)} published datasets with different reference periods.`,
        rules.find((r) => r.id === "data")!.observed,
      ],
      analysis:
        "Automated refreshes of store, population and index data with validation, and indicators tracked over time.",
      additionalData: [
        "Local datasets held by the council and partners",
        "Update schedules of national sources",
      ],
      tasks: [
        "Map data flows and owners",
        "Automate refresh and validation",
        "Publish monitoring indicators",
      ],
      deliverables: ["Automated data pipeline", "Data catalogue", "Monitoring dashboard specification"],
      stakeholders: serviceStakeholders("data-integration"),
      limitations: ["Some sources are annual or released with a lag."],
    },
    {
      id: "governance",
      serviceId: "digital-twins-dashboards",
      title: "Geospatial data governance and digital twin services",
      indicated: false,
      why: "Offered as a supporting capability for any council: no single figure triggers it.",
      challenge:
        "Give officers and partners a shared, governed view of food-access evidence that stays current and trusted.",
      evidence: [
        `Every figure here carries its source, period and method (${formatCount(ind.list().length)} indicators).`,
        "Store, population and index data are refreshed on different cycles.",
      ],
      analysis:
        "A map-centred operational view combining the council's own data with national open data, with provenance and access controls.",
      additionalData: ["Council asset and service locations", "Partner data under sharing agreements"],
      tasks: ["Define users and decisions", "Design governance and access", "Prototype the operational view"],
      deliverables: ["Governance framework", "Digital twin or dashboard prototype", "Handover guide"],
      stakeholders: serviceStakeholders("digital-twins-dashboards"),
      limitations: ["Requires data-sharing agreements for non-public data."],
    },
  ];
  const workPackages = [...wp.filter((w) => w.indicated), ...wp.filter((w) => !w.indicated)];

  // ------------------------------------------------------------------ summary
  const summary = [
    finding(
      `${c.name} is a council in ${c.nation} with ${formatPopulation(c.population, "authority")} residents (mid-2025)${urban.value ? `; ONS classifies it as "${String(urban.value)}"` : ""}.`,
      "local",
      pop,
      urban,
    ),
    ...(rate
      ? [
          finding(
            `It has ${formatCount(sup!.stores)} supermarkets, ${formatPer10k(sup!.per10k)} per 10,000 residents (${c.nation} ${formatPer10k(x.nationRate?.per10k)})${k.topRetailer ? `; ${k.topRetailer} operates ${formatShare(k.topShare)} of them` : ""}.`,
            "local",
            rate,
            top,
          ),
        ]
      : []),
    ...(far1
      ? [
          finding(
            `${formatShare(beyond1?.share)} of residents live more than 1 km straight-line from a supermarket (${c.nation} ${formatShare(x.nationBeyond1km)}).`,
            "local",
            far1,
          ),
        ]
      : []),
    ...(ppfiShare
      ? [
          finding(
            `${formatShare(ppfiRow?.share)} of its small areas are in ${c.nation}'s highest-priority Priority Places for Food deciles (${c.nation} ${formatShare(x.ppfi?.nationShare)}).`,
            "local",
            ppfiShare,
          ),
        ]
      : []),
    ...(closure && x.closure
      ? [
          finding(
            `In a hypothetical closure of its most relied-on supermarket, ${x.closure.name}, ${formatPopulation(x.closure.result.populationAffected, "small_area")} residents would have a different nearest supermarket.`,
            "scenario",
            closure,
          ),
        ]
      : []),
    finding(
      `${workPackages.filter((w) => w.indicated).length} of 7 potential work packages are indicated by stated rules on these figures; the rest are supporting capabilities.`,
      "method",
    ),
  ];

  const { datasets, sources } = datasetRefs(x.manifest, x.datasetIds);
  return {
    schema: "foodscope.insights.report.v1",
    kind: "authority",
    title: REPORT_TITLES.authority,
    subject: c.name,
    subjectCode: c.code,
    subtitle: `${c.name}, ${c.nation} · ${c.code}`,
    context: `An exploratory assessment of food retail access, community vulnerability and the national supply context for ${c.name} (${c.nation}), built from published open data: GEOLYTIX supermarket locations (June 2026), ONS and NISRA population, Census small areas, the Priority Places for Food Index and HMRC trade statistics. Distances are straight-line; indices are compared only within ${c.nation}.`,
    executiveSummary: summary,
    kpis,
    sections,
    charts,
    workPackages,
    rules,
    methodology: [
      "Stores: GEOLYTIX Grocery Retail Points v46 (June 2026), assigned to councils by their full-extent boundaries (May 2025); supermarkets are stores of 280 m² and over.",
      "Coverage: stores per 10,000 residents use ONS mid-2025 population for every nation.",
      "Concentration: largest retailer's share and the Herfindahl–Hirschman Index of retailer shares of supermarkets, by store count.",
      `Access: each small area's population-weighted centroid to the nearest supermarket by straight line in the ${ni ? "Irish Transverse Mercator" : "British National Grid"}, over every supermarket of ${ni ? "Northern Ireland" : "Great Britain"} (stores beyond the council boundary count).`,
      "Vulnerability: Priority Places for Food Index v2.1, share of small areas in the nation's deciles 1–2; IoD 2025 deciles for England's small areas.",
      "Scenario: Scenario B of the Scenario Lab for the council's most relied-on supermarket (the nearest for the most residents).",
      "Work packages: deterministic rules on the figures above, listed with their thresholds and observed values.",
    ],
    limitations: [
      "Straight-line distance is a proxy for proximity, not travel time, cost or opening hours, and not affordability.",
      "Store counts are not market share; floorspace, sales and prices are not in open data.",
      "Indices are ranked within each nation and are not comparable across nations.",
      ...(ni ? [NI_STORE_COVERAGE, "Supermarkets in the Republic of Ireland are not in the data."] : []),
      "National trade figures are context only and do not describe this council's supply chain.",
      "Figures come from different reference periods (population mid-2025, Census 2021/2022, stores June 2026).",
    ],
    indicators: ind.list(),
    sources,
    datasets,
    snapshots: snapshotsOf(datasets),
    disclaimer: EXPLORATORY_NOTE,
    link: x.link,
  };
}
