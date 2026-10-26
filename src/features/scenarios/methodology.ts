/**
 * "Explain the model" (Stage 7 brief §8, SC-01): for every scenario, the source data, formula,
 * geographic boundary, user assumptions, known limitations, and what the outputs do and do not
 * mean. Built from the model, so the panel always describes the run on screen.
 */
import type { ScenarioKind } from "@/state/urlState";
import type { ClosureModel, ImportModel, PortModel, ProductionModel } from "./model";

export interface MethodSource {
  id: string;
  text: string;
}

export interface Methodology {
  title: string;
  sources: MethodSource[];
  formula: string[];
  boundary: string;
  assumptions: string[];
  limitations: string[];
  means: string[];
  doesNotMean: string[];
}

export const SCENARIO_TITLES: Record<ScenarioKind, { title: string; short: string; hint: string }> = {
  import: {
    title: "International supply disruption",
    short: "Supply disruption",
    hint: "A recorded import partner supplies less of one commodity for some months",
  },
  closure: {
    title: "Supermarket closure",
    short: "Store closure",
    hint: "One supermarket closes: whose nearest supermarket changes, and by how far",
  },
  production: {
    title: "Domestic production shock",
    short: "Production shock",
    hint: "UK production of a commodity is lower, on Defra's published annual balance",
  },
  port: {
    title: "Port disruption",
    short: "Port disruption",
    hint: "A major port handles less inward freight for some months",
  },
};

const NOT_A_FORECAST =
  "A forecast, a shortage or empty shelves: nothing here models what retailers, suppliers or shoppers would do.";

export function importMethodology(m: ImportModel): Methodology {
  return {
    title: SCENARIO_TITLES.import.title,
    sources: [
      {
        id: "S01",
        text: `HMRC Overseas Trade Statistics, recorded imports of ${m.commodity.label.toLowerCase()} by partner country and month (${m.range.first} to ${m.range.last}${m.range.provisionalFrom ? `; provisional from ${m.range.provisionalFrom}` : ""}).`,
      },
    ],
    formula: [
      "effective_r(t) = r for the disrupted months; r × (1 − (t − d + 1) ÷ (k + 1)) during a k-month linear recovery; 0 after",
      "affected(m) = effective_r(m) × recorded imports from the partner in month m",
      "residual = recorded imports from partner countries − affected",
      "affected share = affected ÷ recorded imports from partner countries",
      "unreplaced = (1 − substitution) × affected",
      "HHI after = Σ (100 × share)² with the partner's total reduced by the affected amount, other partners unchanged",
    ],
    boundary: "The United Kingdom as a whole (HMRC records UK imports, not imports by nation or region).",
    assumptions: m.assumptions,
    limitations: [
      "HMRC's partner is the country of dispatch: goods grown elsewhere and shipped through it count as its exports.",
      "Months outside the trade snapshot are left out, not estimated; provisional months may be revised by HMRC.",
      "Suppressed and non-country amounts are excluded from shares and listed separately; they are never redistributed.",
      "A static calculation on the recorded baseline: it does not model prices, contracts, stocks or the order in which supply would adjust.",
    ],
    means: [
      "How much of the recorded import volume (or value) in those months came from the partner, and how much of it the stated reduction would touch.",
      "How concentrated recorded supply would be if nothing replaced the reduction.",
    ],
    doesNotMean: [NOT_A_FORECAST, "That other partners could or could not make up the difference."],
  };
}

export function closureMethodology(m: ClosureModel | null): Methodology {
  const gb = m?.part !== "ni";
  return {
    title: SCENARIO_TITLES.closure.title,
    sources: [
      {
        id: "S11",
        text: "GEOLYTIX Grocery Retail Points v46 (June 2026): supermarkets of 280 m² and over (class D5).",
      },
      ...(gb
        ? [
            {
              id: "S15",
              text: "ONS population-weighted centroids of every LSOA (December 2021), England and Wales.",
            },
            { id: "S17", text: "Scottish Government Data Zone Centroids 2022, with Census 2022 population." },
          ]
        : []),
      ...(!gb || m === null
        ? [
            {
              id: "S16",
              text: "NISRA Data Zones 2021 and their population-weighted centroids, Northern Ireland.",
            },
          ]
        : []),
      { id: "S18", text: "Census usual residents by small area (Census 2021; Scotland's Census 2022)." },
      ...(gb ? [{ id: "S19", text: "English Indices of Deprivation 2025 (decile within England)." }] : []),
    ],
    formula: [
      "d_i = straight-line distance from area i's population-weighted centroid to its nearest supermarket (national grid, metres)",
      "after closing store s: d_i' = distance to i's next nearest supermarket if s was its nearest; otherwise d_i",
      "residents beyond T = Σ P_i × [d_i > T], before and after, for T = 1, 2 and 5 km",
      "average = population-weighted mean of d_i; median = population-weighted median",
      "retailer HHI = Σ (100 × retailer's share of the council's supermarkets)²",
    ],
    boundary: m
      ? `Every small area of ${m.part === "gb" ? "Great Britain" : "Northern Ireland"} is considered, so areas and supermarkets beyond ${m.store.council.name}'s boundary count; council figures are for ${m.store.council.name} (May 2025 boundaries).`
      : "Every small area of Great Britain, or of Northern Ireland, is considered; distances never cross the Irish Sea.",
    assumptions: m?.assumptions ?? [],
    limitations: [
      "Straight-line distance is not walking or driving time: rivers, estuaries, sea crossings, roads and public transport are ignored.",
      "A population-weighted centroid stands for every resident of the area.",
      "Only supermarkets of 280 m² and over are counted: convenience stores, markets and online delivery are not.",
      "Supermarkets in the Republic of Ireland and the Crown Dependencies are not in the data.",
      "Scotland's residents are from Census 2022, those of England, Wales and Northern Ireland from Census 2021.",
      "Deprivation deciles exist for England only on these areas (Wales, Scotland and Northern Ireland: not available).",
    ],
    means: [
      "Which neighbourhoods would have a different nearest supermarket, and how much further away it would be in a straight line.",
      "How many supermarkets remain close to the closed one, and how the council's retailer mix would change by count.",
    ],
    doesNotMean: [
      NOT_A_FORECAST,
      "Travel time, cost or difficulty: a short straight line can be a long journey.",
      "That residents would shop at the new nearest supermarket.",
    ],
  };
}

export function productionMethodology(m: ProductionModel): Methodology {
  const e = m.entry;
  return {
    title: SCENARIO_TITLES.production.title,
    sources: e
      ? [{ id: e.sourceId, text: `Defra, ${e.table} (${e.year}${e.provisional ? ", provisional" : ""}).` }]
      : [
          {
            id: "S10",
            text: "Defra Agriculture in the UK and Horticulture statistics: no balance published for this basket.",
          },
        ],
    formula: [
      "production after = published production × (1 − reduction)",
      "total supply after = published total supply − production removed (imports and exports held)",
      "production share = production ÷ total supply, before and after",
    ],
    boundary: "The United Kingdom (Defra's balances are UK-wide).",
    assumptions: m.assumptions,
    limitations: [
      "Annual totals: the timing of a harvest shock within the year is not represented.",
      "Defra's definitions (e.g. home production marketed; dressed carcase weight) differ from the HMRC baskets of Food Origins; the two are never combined.",
      "Consumption and stocks are not in the published balances used here and are not estimated.",
      "Imports and exports are held at their published values: in reality trade would respond.",
    ],
    means: [
      "How large the stated production shock is relative to the UK's published supply of the commodity.",
      "How much the UK's published production share of supply would fall if nothing else changed.",
    ],
    doesNotMean: [NOT_A_FORECAST, "Lower consumption: nothing here models demand, prices or stocks."],
  };
}

export function portMethodology(m: PortModel): Methodology {
  return {
    title: SCENARIO_TITLES.port.title,
    sources: [
      {
        id: "S23",
        text: `DfT port freight statistics (PORT0499): inward tonnage loaded abroad by port and region, and by cargo group (any origin), ${m.year}; cargo category 23 agricultural products, a dry-bulk category.`,
      },
      {
        id: "S03",
        text: "UK Food Security Report 2024, theme 3: food, feed and drink imports by port of entry (2022, 2023).",
      },
    ],
    formula: [
      "affected tonnage = port's inward tonnage from abroad × reduction × months ÷ 12",
      "share of UK major-port inwards affected = port's inward tonnage × reduction ÷ all major ports' inward tonnage",
      "agricultural dry bulk affected = port's category 23 tonnage × reduction × months ÷ 12 (only where DfT records it)",
      "cargo groups and Ro-Ro and container freight over the disruption = annual tonnage × months ÷ 12, × (1 − reduction) in the scenario",
      "food, feed and drink share affected = UKFSR share entering at the port × reduction (only where UKFSR's port of entry is the port)",
    ],
    boundary:
      "The selected DfT statistical port (which may include several terminals) and all UK major ports for the totals.",
    assumptions: m.assumptions,
    limitations: [
      "DfT publishes annual tonnage: monthly effects assume an even spread over the year.",
      "Containers and roll-on/roll-off units carry no commodity in DfT's statistics: food in them is not identified, so a Ro-Ro port such as Dover records no agricultural dry bulk although food passes through it.",
      "UKFSR's Dover figure includes the Channel Tunnel and is not attributed to the port.",
      "No diversion to other ports, no queueing and no recovery are modelled.",
      "Imports from a partner country are never assumed to pass through any particular port.",
    ],
    means: [
      "How much inward freight the stated capacity reduction would touch at this port, overall and where the data records agricultural or food flows.",
    ],
    doesNotMean: [
      NOT_A_FORECAST,
      "Which commodities would be delayed: DfT records no commodity for most unitised freight.",
    ],
  };
}
