/**
 * "Explain this risk" (Stage 6 brief): for a commodity, a port, the road corridors, a farming
 * region or a council — what is measured, why it matters, how it is calculated, the source data,
 * its limitations, what further evidence would help and the options organisations commonly
 * consider. Observed evidence (Indicators, rendered through <Metric>) is kept apart from the
 * interpretation, which is labelled as such and never states a probability of disruption.
 *
 * Pure: built from the view models, so tests can check every statement against the data.
 */
import { formatHhi, formatShare } from "@/analysis/format";
import { FARM_UNITS, STRESS_LABELS, type FarmMeasure } from "@/analysis/risk";
import { formatMonth } from "@/analysis/trade";
import type { Indicator } from "@/types/indicator";
import {
  allocatedIndicator,
  councilRankIndicator,
  councilShareIndicator,
  entryShareIndicator,
  exposureIndicator,
  farmingIndicator,
  nationShareIndicator,
  peakExposureIndicator,
  portIndicator,
  portsTotalIndicator,
  srnDelayIndicator,
  stressShareIndicator,
  topPortShareIndicator,
  waterStressIndicator,
} from "./indicators";
import {
  PORT_MEASURE_LABELS,
  type AccessRiskModel,
  type CouncilRiskRow,
  type FarmingRegionRow,
  type LogisticsModel,
  type PortRow,
  type SupplyModel,
} from "./model";

export interface SourceRef {
  id: string;
  label: string;
}

export interface Explanation {
  /** What is being explained, e.g. "Tomatoes: recorded import partners". */
  subject: string;
  kind: "commodity" | "ports" | "port" | "roads" | "region" | "council";
  measured: string;
  why: string;
  calculation: string;
  /** Observed evidence: values with provenance. */
  observed: Indicator<number | string>[];
  sources: SourceRef[];
  limitations: string[];
  moreEvidence: string[];
  /** Options organisations commonly consider; not recommendations, and nothing about any organisation's needs. */
  options: string[];
  /** Interpretation of the evidence, labelled separately; never a forecast. */
  interpretation: string[];
}

const S = {
  S01: { id: "S01", label: "HMRC Overseas Trade Statistics" },
  S03: { id: "S03", label: "UK Food Security Report 2024 (Defra)" },
  S13: { id: "S13", label: "Priority Places for Food Index v2.1 (CDRC / Leeds HASP)" },
  S21: { id: "S21", label: "ONS 2021 Rural Urban Classification" },
  S23: { id: "S23", label: "DfT port freight statistics 2025" },
  S30: { id: "S30", label: "FAO AQUASTAT water stress (World Bank)" },
  S31: { id: "S31", label: "Defra June survey of agriculture 2025" },
  S33: { id: "S33", label: "ONS ITL1 regions" },
  S35: { id: "S35", label: "OS Open Roads" },
  S36: { id: "S36", label: "EMODnet port locations" },
  S37: { id: "S37", label: "Translink NIR railway network" },
} as const;

const NOT_A_FORECAST =
  "This describes the recorded pattern; it is not a prediction that supply will fail, nor an estimate of its likelihood.";

// ---------------------------------------------------------------------------------------------

/** A commodity's international supply exposure (and the selected partner, when there is one). */
export function explainCommodity(m: SupplyModel): Explanation {
  const o = m.origins;
  const label = o.commodity.label;
  const h = o.kpis.concentration.value;
  const top = o.rows[0];
  const cr3 = o.rows.slice(0, 3).reduce((s, r) => s + r.share, 0);
  const observed: Indicator<number | string>[] = [
    o.kpis.imports,
    o.kpis.partners,
    o.kpis.top,
    o.kpis.concentration,
    stressShareIndicator(m),
    allocatedIndicator(m),
  ];
  const exposure = exposureIndicator(m);
  const peak = peakExposureIndicator(m);
  if (exposure) observed.push(exposure);
  if (peak) observed.push(peak);
  if (o.selected)
    observed.push(waterStressIndicator(o.selected.name, m.stressOf.get(o.selected.key) ?? null));

  const interpretation: string[] = [];
  if (h !== null && top) {
    interpretation.push(
      `${top.name} supplied ${formatShare(top.share)} of recorded ${label.toLowerCase()} imports and the top three ${formatShare(cr3)} in ${o.periodText} (HHI ${formatHhi(h)}). The higher the HHI, the more recorded supply depends on few partners, so a problem in one of them affects a larger part of it.`,
    );
  }
  const worst = m.monthly
    .filter((x) => o.period.available.includes(x.month) && x.hhi !== null)
    .sort((a, b) => b.hhi! - a.hhi!)[0];
  if (worst && worst.top)
    interpretation.push(
      `Concentration varies through the year: the most concentrated month in the period was ${formatMonth(worst.month)} (HHI ${formatHhi(worst.hhi)}, ${worst.top.name} ${formatShare(worst.top.share)}).`,
    );
  if (m.stress.highOrCritical > 0)
    interpretation.push(
      `${formatShare(m.stress.highOrCritical)} of recorded imports came from partners whose national water stress is high or critical; that says where the partners are, not how this produce was grown.`,
    );
  if (m.disruption && o.selected && m.disruption.periodShare !== null)
    interpretation.push(
      `If recorded imports from ${o.selected.name} stopped, ${formatShare(m.disruption.periodShare)} of recorded supply over the period would be exposed${m.disruption.peak ? `, up to ${formatShare(m.disruption.peak.share)} in ${formatMonth(m.disruption.peak.month)}` : ""}. Whether that becomes a shortage depends on substitution, stocks and UK production, which this view does not model.`,
    );
  interpretation.push(NOT_A_FORECAST);

  return {
    subject: `${label}: recorded import partners`,
    kind: "commodity",
    measured:
      "How recorded UK imports of the basket are spread across partner countries (HMRC's country of dispatch): the number of partners, the largest partner's and the top three's shares, the Herfindahl–Hirschman Index (HHI), month-by-month concentration, and partners' national water stress.",
    why: "Supply that depends on few partners is more exposed to a disruption in one of them — weather, water shortages, disease, trade or transport problems. Seasonal concentration matters for fresh produce, where a few months can rely on one partner.",
    calculation:
      "Shares: each partner's recorded net mass (or value) ÷ the total allocated to partner countries; suppressed and non-country trade are excluded and shown apart. HHI = Σ(100 × share)², from near 0 (many small partners) to 10,000 (one partner). Water stress: FAO SDG 6.4.2 classes of each partner's national value.",
    observed,
    sources: [S.S01, S.S30],
    limitations: [
      "HMRC records the country of dispatch, not where the food was grown: the Netherlands, for example, re-exports produce grown elsewhere.",
      "Water stress is a single national figure, mostly for 2022; it does not describe the growing region, the season, or whether this produce is irrigated.",
      "Recent months are provisional and may be revised; GB–EU figures have series breaks in 2021 and 2022.",
      "Commodity codes change over time (e.g. fresh tomatoes split into three codes in January 2025); the basket follows every code, so totals stay continuous.",
      "Defra's annual UK production is national context only; it is never combined with monthly imports.",
    ],
    moreEvidence: [
      "Country-of-origin trade data (HMRC publishes an annual comparison) to see where produce is grown.",
      "Sub-national water stress or drought data for the main growing regions of the largest partners.",
      "Stocks, processing and retail substitution data, which public statistics do not cover.",
    ],
    options: [
      "Check whether contingency plans cover the largest partner's peak months, not only the annual picture.",
      "Monitor partner diversity over time, by month as well as by year.",
      "Compare with UK production and seasonality before drawing conclusions about dependence.",
    ],
    interpretation,
  };
}

/** One port (RK-03). */
export function explainPort(p: PortRow, l: LogisticsModel): Explanation {
  const measureText = PORT_MEASURE_LABELS[l.measure].long;
  const observed: Indicator<number | string>[] = [portIndicator(p, l), portsTotalIndicator(l)];
  if (p.foodEntry.includes("Dover/Folkestone/Eurotunnel")) observed.push(entryShareIndicator(l));
  const interpretation: string[] = [];
  if (p.shareOfTotal !== null)
    interpretation.push(
      `${p.name} handled ${formatShare(p.shareOfTotal)} of the major ports' ${PORT_MEASURE_LABELS[l.measure].short.toLowerCase()} in ${l.latestYear}.`,
    );
  if (p.foodEntry.length)
    interpretation.push(
      `The UK Food Security Report names it (as ${p.foodEntry.join(" and ")}) among the main entry points for food, feed and drink imports — the only food-specific port evidence published.`,
    );
  else
    interpretation.push(
      "The UK Food Security Report does not name it separately among the main entry points for food, feed and drink imports.",
    );
  interpretation.push(
    "Tonnage shows the scale of a port's freight, not how much food passes through it: containers and roll-on/roll-off lorries are not recorded by commodity.",
  );
  return {
    subject: `${p.name}: port freight`,
    kind: "port",
    measured: `DfT major-port freight: ${measureText}, ${l.years[0]}–${l.latestYear}.`,
    why: "Ports where large volumes arrive are points where disruption (weather, industrial action, border checks, cyber incidents) can affect many supply chains at once.",
    calculation:
      "DfT PORT0499 tonnage summed by port and year; 'from abroad' excludes UK coastwise traffic and unspecified origins. The map symbol's area is proportional to the value.",
    observed,
    sources: [S.S23, S.S03, ...(p.location.source === "emodnet" ? [S.S36] : [])],
    limitations: [
      "All cargo, not food: only 'agricultural products' (grain, soya, tapioca…) is food or feed, and it is mostly feed and milling grain.",
      "Unitised traffic (containers, roll-on/roll-off) — the way most fresh food arrives — has no commodity in DfT's statistics.",
      p.location.source === "dft"
        ? "The map point is DfT's 'rough location for mapping purposes'."
        : "DfT gives no map location for this port; the point is EMODnet's for the same UN/LOCODE (mostly Eurostat GISCO, 2013).",
      "Statistical ports can group several terminals (e.g. London includes Tilbury and London Gateway).",
    ],
    moreEvidence: [
      "HMRC port-level trade by commodity (not yet verified for this purpose).",
      "Port operators' published capacity and resilience information.",
    ],
    options: [
      "Identify which supply chains rely on the port, using trade and operator data.",
      "Review alternative routings and their capacity for the busiest periods.",
    ],
    interpretation,
  };
}

/** The major-port network as a whole (RK-03): how concentrated port freight is. */
export function explainPorts(l: LogisticsModel): Explanation {
  const top = l.ports[0];
  const short = PORT_MEASURE_LABELS[l.measure].short.toLowerCase();
  const interpretation: string[] = [];
  if (top && top.shareOfTotal !== null)
    interpretation.push(
      `The largest port, ${top.name}, handled ${formatShare(top.shareOfTotal)} of the major ports' ${short} in ${l.latestYear}; the chart and table list every port.`,
    );
  interpretation.push(
    "The Short Straits figure is the only published measure of how food, feed and drink imports are spread across entry points; DfT tonnage is all cargo.",
    "Tonnage shows where freight capacity is concentrated, not which supply chains depend on it or what share of the UK's food passes through.",
    NOT_A_FORECAST,
  );
  return {
    subject: "Major ports",
    kind: "ports",
    measured: `DfT major-port freight (${PORT_MEASURE_LABELS[l.measure].long}), ${l.years[0]}–${l.latestYear}, and the UK Food Security Report's published shares of food, feed and drink imports by entry point.`,
    why: "When freight is concentrated in a few ports or crossings, a disruption at one of them (weather, industrial action, border checks, cyber incidents) affects many supply chains at once.",
    calculation:
      "DfT PORT0499 tonnage summed by port and year, and each port's share of the total over the major ports. The food entry shares are as published by Defra (UKFSR 2024, theme 3).",
    observed: [portsTotalIndicator(l), topPortShareIndicator(l), entryShareIndicator(l)],
    sources: [S.S23, S.S03],
    limitations: [
      "All cargo, not food: only 'agricultural products' (grain, soya, tapioca…) is food or feed, and it is mostly feed and milling grain.",
      "Unitised traffic (containers, roll-on/roll-off) — the way most fresh food arrives — has no commodity in DfT's statistics.",
      "The UKFSR groups ports differently from DfT (e.g. Dover with Folkestone and the Channel Tunnel), so the two are shown side by side, never combined.",
      "Minor ports are not included: DfT publishes port-level detail for major ports only.",
    ],
    moreEvidence: [
      "HMRC port-level trade by commodity (not yet verified for this purpose).",
      "Port operators' published capacity and resilience information.",
    ],
    options: [
      "Identify which supply chains rely on the busiest ports and crossings.",
      "Review alternative routings and their capacity for the busiest periods.",
    ],
    interpretation,
  };
}

/** The road corridors layer. */
export function explainRoads(l: LogisticsModel): Explanation {
  return {
    subject: "Road and rail corridors",
    kind: "roads",
    measured:
      "Where Great Britain's motorways and trunk roads (the national highway authorities' networks) and other primary A roads run, from OS Open Roads, and where Northern Ireland's railway lines run (Translink's NIR network).",
    why: "Most food moves by road between ports, distribution centres and stores; disruption on a corridor with few alternatives affects deliveries over a wide area.",
    calculation:
      "OS Open Roads links classed as motorway or trunk road ('strategic') or primary route ('primary'), merged by road number and simplified for display. NIR route lines as published (sidings left out), simplified for display.",
    observed: [srnDelayIndicator(l)],
    sources: [S.S35, S.S37, S.S03],
    limitations: [
      "Northern Ireland's roads are not shown: DfI's open files have no line work, and OSNI's open transport service could not be reached by the data pipeline.",
      "Railway lines are shown for Northern Ireland only (Translink, 2015); Great Britain's are not in this build. They show where track runs, not services or freight.",
      "Lines show where roads are, not freight volumes, congestion or resilience on each road.",
      "The delay figure covers England's Strategic Road Network as a whole, all traffic, and ends in December 2023.",
      "Rail freight routes and distribution centres are not shown: no open, official mapped dataset was found.",
    ],
    moreEvidence: [
      "DfT road traffic counts on the corridors that link the main ports to distribution areas.",
      "Locations of food distribution centres (not publicly registered).",
    ],
    options: [
      "Map critical deliveries against the corridors and their diversion routes.",
      "Coordinate with highway authorities on resilience of key junctions.",
    ],
    interpretation: [
      "The corridor map is context for the ports and farming regions; it does not by itself show where a disruption would matter most.",
      NOT_A_FORECAST,
    ],
  };
}

/** A farming region (Defra region of England or a devolved country). */
export function explainRegion(r: FarmingRegionRow, measure: FarmMeasure, year: number): Explanation {
  return {
    subject: `${r.name}: ${FARM_UNITS[measure]}`,
    kind: "region",
    measured: `Defra June survey ${year}: ${measure === "wheat" ? "wheat area as a share of the region's area" : `${measure} on holdings per km² of the region`}.`,
    why: "Domestic production is spread unevenly; where production is concentrated, local disruption (flooding, drought, animal disease) can affect a large part of UK output.",
    calculation:
      "The survey value for the region ÷ the region's area (ONS ITL1 boundaries, clipped to the coastline), in five fixed classes.",
    observed: [farmingIndicator(r, measure, year)],
    sources: [S.S31, S.S33],
    limitations: [
      "England's figures cover commercial holdings only; each devolved country's come from its own survey.",
      "A density describes the whole region, not where the farms are within it.",
      "Survey estimates are subject to sampling error; livestock numbers are a June snapshot.",
    ],
    moreEvidence: [
      "Production (tonnes) by region, and the location of processing plants and markets.",
      "Flood and drought risk for the main producing areas.",
    ],
    options: ["Compare local resilience planning with the region's role in UK production."],
    interpretation: [
      "A high density shows where production of this kind is concentrated, not that it is at risk.",
      NOT_A_FORECAST,
    ],
  };
}

/** A council's community food access (RK-04). */
export function explainCouncil(c: CouncilRiskRow, a: AccessRiskModel): Explanation {
  const measure = a.measures.find((m) => m.id === a.measure)?.label ?? a.measure;
  const observed: Indicator<number | string>[] = [
    councilShareIndicator(c, measure),
    councilRankIndicator(c),
    nationShareIndicator(c.nation, a.nationShares.get(c.nation) ?? null, measure),
  ];
  const interpretation: string[] = [];
  if (c.share !== null) {
    const base = a.nationShares.get(c.nation) ?? null;
    const ratio = base ? c.share / base : null;
    interpretation.push(
      `${formatShare(c.share)} of ${c.name}'s small areas are in ${c.nation}'s highest-priority fifth for ${measure.toLowerCase()}${ratio !== null ? ` — ${ratio.toFixed(1)} times the nation's share` : ""}.`,
    );
  } else interpretation.push(`The index has no data for ${measure.toLowerCase()} in ${c.nation}.`);
  if (c.fewAreas)
    interpretation.push(
      `It has only ${c.areas} small areas, so one area changes the share by ${formatShare(1 / c.areas)}.`,
    );
  interpretation.push(
    "Priority places point to where food insecurity is more likely to occur; the index does not measure food insecurity itself.",
  );
  return {
    subject: `${c.name}: priority places for food`,
    kind: "council",
    measured: `The share of the council's small areas in ${c.nation}'s two highest-priority deciles of the Priority Places for Food Index (${measure}).`,
    why: "Areas with poor access to affordable food and higher need are more vulnerable when supply is disrupted or prices rise; councils plan support, such as food access schemes, around them.",
    calculation:
      "Small areas (LSOAs in England and Wales, 2011 Data Zones in Scotland, 2011 SOAs in Northern Ireland) assigned to councils with official lookups; count in deciles 1–2 ÷ all the council's areas. Ranked within the nation only.",
    observed,
    sources: [S.S13],
    limitations: [
      "Deciles are set within each nation; shares and ranks are not comparable across nations.",
      "A share of small areas, not of people (areas have broadly similar populations within a nation).",
      ...(c.nation === "Northern Ireland"
        ? [
            "In Northern Ireland three domains have no data (supermarket accessibility, online deliveries, fuel poverty), so its combined index rests on four domains.",
          ]
        : []),
      ...(c.nation === "Scotland"
        ? [
            "Scotland's index uses the 2011 Data Zones, assigned to councils with the Scottish Government's 2011 lookup.",
          ]
        : []),
      "The index (v2.1, 2024) predates some store openings and closures; store counts in UK Food Access are newer.",
    ],
    moreEvidence: [
      "Local food bank, holiday activity and free school meal data held by the council.",
      "The council's deep profile (where published) for small-area detail and straight-line distances to supermarkets.",
    ],
    options: [
      "Use the priority areas to target food access and affordability support.",
      "Check store coverage and transport in the priority areas (UK Food Access, profiles).",
    ],
    interpretation,
  };
}

/** Plain-language class label for a water-stress class or no data (re-exported for the UI). */
export { STRESS_LABELS };
