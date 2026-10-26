import { DEFAULT_MODULE, isModuleId, type ModuleId } from "@/app/modules";
import {
  DEFAULT_STORE_LAYERS,
  STORE_LAYERS,
  type ProvisionMeasure,
  type StoreLayer,
} from "@/analysis/retail";

/** Overlays that can be deep-linked (SH-06 Evidence page, Help, LP-07 council comparison). */
export const OVERLAYS = ["none", "evidence", "help", "compare"] as const;
export type Overlay = (typeof OVERLAYS)[number];

export const PERIOD_MODES = ["rolling12", "month", "year"] as const;
export type PeriodMode = (typeof PERIOD_MODES)[number];
export type Measure = "mass" | "value";
export const DEFAULT_COMMODITY = "tomatoes";
/** Seasonal heatmap colour (SS-04/SS-05): share of the month, amount, or change vs the comparison year. */
export const HEATMAP_MODES = ["share", "amount", "change"] as const;
export type HeatmapMode = (typeof HEATMAP_MODES)[number];
/** Council layer in UK Food Access (SM-06): a provision measure, or off. */
export type CouncilLayer = ProvisionMeasure | "off";
/** Curated basemaps (SH-08). */
export const BASEMAP_IDS = ["dark", "light", "imagery"] as const;
export type BasemapId = (typeof BASEMAP_IDS)[number];
/**
 * Small-area map measure in a deep profile (LP-04, LP-06): the Priority Places for Food Index
 * (combined, or one domain), deprivation within the nation, households without a car or van, or
 * straight-line distance to the nearest supermarket.
 */
export const AREA_MEASURES = [
  "ppfi",
  "ppfi-supermarket-proximity",
  "ppfi-supermarket-accessibility",
  "ppfi-online",
  "ppfi-nonsupermarket-proximity",
  "ppfi-socio-economic",
  "ppfi-family-food",
  "ppfi-fuel-poverty",
  "deprivation",
  "no-car",
  "distance",
] as const;
export type AreaMeasure = (typeof AREA_MEASURES)[number];
/** Councils compared with the selected one (LP-07: 2–4 councils in all). */
export const MAX_COMPARE = 3;

/** Risk Explorer views (RK-01): international supply, logistics and infrastructure, community access. */
export const RISK_VIEWS = ["supply", "logistics", "access"] as const;
export type RiskView = (typeof RISK_VIEWS)[number];
/** Supply view map fill (RK-02): share of recorded imports, or partners' national water stress (S30). */
export const RISK_FILLS = ["share", "stress"] as const;
export type RiskFill = (typeof RISK_FILLS)[number];
/** Port symbol size (RK-03, DfT tonnage): from abroad, agricultural products, roll-on/roll-off. */
export const PORT_MEASURES = ["international", "agricultural", "roro"] as const;
export type PortMeasureId = (typeof PORT_MEASURES)[number];
/** Farming regions layer (RK-03, Defra June survey 2025): a density, or off. */
export const FARM_LAYERS = ["off", "wheat", "cattle", "sheep", "pigs", "poultry"] as const;
export type FarmLayer = (typeof FARM_LAYERS)[number];
/** Community access measure (RK-04): the Priority Places index, combined or one domain. */
export const PPFI_MEASURES = [
  "combined",
  "supermarket_proximity",
  "supermarket_accessibility",
  "ecommerce_access",
  "socio_demographic",
  "nonsupermarket_proximity",
  "food_for_families",
  "fuel_poverty",
] as const;
export type PpfiMeasure = (typeof PPFI_MEASURES)[number];
/** Nations, for within-nation rankings (P11). */
export const NATIONS = ["England", "Wales", "Scotland", "Northern Ireland"] as const;
export type Nation = (typeof NATIONS)[number];
/**
 * Scenario Lab (Stage 7, SC-01 – SC-05): A international supply disruption, B supermarket closure,
 * C domestic production shock, D port disruption. Each run is reproducible from the URL (SC-05).
 */
export const SCENARIO_KINDS = ["import", "closure", "production", "port"] as const;
export type ScenarioKind = (typeof SCENARIO_KINDS)[number];
/**
 * ConsultingWhere Insights (Stage 8, CI-02): the assessment shown. Each draws on an earlier module:
 * a local authority (Local Authority Profiles, Risk Explorer access), a commodity (Food Origins,
 * Seasonal Supply, Risk Explorer supply) or a Scenario Lab scenario.
 */
export const INSIGHTS_KINDS = ["authority", "commodity", "scenario"] as const;
export type InsightsKind = (typeof INSIGHTS_KINDS)[number];
/** What the scenario map shows: the observed baseline or the scenario (SC-03). */
export const SCENARIO_VIEWS = ["scenario", "baseline"] as const;
export type ScenarioView = (typeof SCENARIO_VIEWS)[number];
/** Slider limits (SC-02): percentages are whole numbers; durations and recovery in months. */
export const SCENARIO_LIMITS = {
  reduction: { min: 0, max: 100 },
  duration: { min: 1, max: 12 },
  recovery: { min: 0, max: 6 },
  substitution: { min: 0, max: 100 },
  portMonths: { min: 1, max: 12 },
} as const;
const NATION_PARAM: Record<Nation, string> = {
  England: "E",
  Wales: "W",
  Scotland: "S",
  "Northern Ireland": "N",
};

/** State mirrored in the query string (ADR-13, SH-04). */
export interface UrlState {
  module: ModuleId;
  /** Calendar month 1–12 on the timeline; null = latest published month (Food Origins). */
  month: number | null;
  lad: string | null;
  overlay: Overlay;
  /** Food Origins (FO-01, FO-02, FO-07): commodity basket id, period, year, measure, partner. */
  commodity: string;
  period: PeriodMode;
  year: number | null;
  measure: Measure;
  /** Selected recorded import partner key (ISO alpha-2, or hmrc-<id> for non-country categories). */
  partner: string | null;
  /** Seasonal Supply (SS-01, SS-05): comparison year (null = the year before), comparison month (null = off), heatmap colour. */
  compareYear: number | null;
  compareMonth: number | null;
  heatmap: HeatmapMode;
  /** UK Food Access (SM-03): store layers shown, retailers shown (null = all), council layer, selected store. */
  storeLayers: StoreLayer[];
  retailers: string[] | null;
  councilLayer: CouncilLayer;
  store: number | null;
  /** Basemap style (SH-08). */
  basemap: BasemapId;
  /** Local Authority Profiles (LP-04, LP-06, LP-07): small-area measure, selected small area, comparison councils. */
  areaMeasure: AreaMeasure;
  area: string | null;
  compare: string[];
  /** Northern Ireland grocers from the FSA register that GEOLYTIX does not map (supplementary layer, S29). */
  niGrocers: boolean;
  /** Risk Explorer (RK-01 – RK-04): view, supply map fill, selected port (UN/LOCODE), port measure, road corridors, railway lines, farming layer, access measure, ranking nation (null = the selected council's, else England). */
  riskView: RiskView;
  riskFill: RiskFill;
  port: string | null;
  portMeasure: PortMeasureId;
  roads: boolean;
  rail: boolean;
  farmLayer: FarmLayer;
  ppfiMeasure: PpfiMeasure;
  rankNation: Nation | null;
  /**
   * Scenario Lab (SC-05). The commodity (c), partner (p), measure (ms), store (st) and port (pt) are
   * shared with the other modules; these hold the scenario's own settings: the kind; for A the
   * baseline start (year, month; null = January of the latest complete year), reduction, duration,
   * linear recovery and substitution assumption (%); for C the production reduction; for D the
   * capacity reduction and its duration; and whether the map shows the baseline or the scenario.
   */
  scenarioKind: ScenarioKind;
  scenarioYear: number | null;
  scenarioMonth: number | null;
  scenarioReduction: number;
  scenarioDuration: number;
  scenarioRecovery: number;
  scenarioSubstitution: number;
  productionReduction: number;
  portReduction: number;
  portMonths: number;
  scenarioView: ScenarioView;
  /** ConsultingWhere Insights (CI-02): the assessment type (`ia`). */
  insightsKind: InsightsKind;
}

export const DEFAULT_URL_STATE: UrlState = {
  module: DEFAULT_MODULE,
  month: null,
  lad: null,
  overlay: "none",
  commodity: DEFAULT_COMMODITY,
  period: "rolling12",
  year: null,
  measure: "mass",
  partner: null,
  compareYear: null,
  compareMonth: null,
  heatmap: "share",
  storeLayers: [...DEFAULT_STORE_LAYERS],
  retailers: null,
  councilLayer: "supermarkets",
  store: null,
  basemap: "dark",
  areaMeasure: "ppfi",
  area: null,
  compare: [],
  niGrocers: false,
  riskView: "supply",
  riskFill: "share",
  port: null,
  portMeasure: "international",
  roads: true,
  rail: true,
  farmLayer: "off",
  ppfiMeasure: "combined",
  rankNation: null,
  scenarioKind: "import",
  scenarioYear: null,
  scenarioMonth: null,
  scenarioReduction: 30,
  scenarioDuration: 1,
  scenarioRecovery: 0,
  scenarioSubstitution: 0,
  productionReduction: 20,
  portReduction: 50,
  portMonths: 1,
  scenarioView: "scenario",
  insightsKind: "authority",
};

const LAYER_PARAM: Record<StoreLayer, string> = { supermarket: "s", convenience: "c", other: "o" };
const COUNCIL_PARAM: Record<CouncilLayer, string> = {
  supermarkets: "s",
  convenience: "c",
  all: "a",
  off: "off",
};
const RETAILER_NAME = /^[\p{L}\p{N} &'.()-]{1,60}$/u;
const MAX_RETAILERS = 60;

function parseStoreLayers(v: string | null): StoreLayer[] {
  if (v === null) return [...DEFAULT_STORE_LAYERS];
  if (v === "none") return [];
  const codes = v.split(",");
  return STORE_LAYERS.filter((l) => codes.includes(LAYER_PARAM[l]));
}

function serialiseStoreLayers(layers: readonly StoreLayer[]): string | null {
  const sorted = STORE_LAYERS.filter((l) => layers.includes(l));
  if (sorted.join() === [...DEFAULT_STORE_LAYERS].join()) return null;
  return sorted.length ? sorted.map((l) => LAYER_PARAM[l]).join(",") : "none";
}

function parseRetailers(v: string | null): string[] | null {
  if (v === null) return null;
  if (v === "") return [];
  const names = [...new Set(v.split(",").map((s) => s.trim()))].filter((s) => RETAILER_NAME.test(s));
  return names.slice(0, MAX_RETAILERS).sort();
}

const PERIOD_PARAM: Record<PeriodMode, string> = { rolling12: "r12", month: "m", year: "y" };
const COMMODITY_ID = /^[a-z][a-z0-9-]{0,39}$/;
const PARTNER_KEY = /^([A-Z]{2}|hmrc-\d{1,5})$/;
/** DfT port codes: UN/LOCODEs (GBDVR) and DfT's own statistical codes (GB221). */
const PORT_CODE = /^GB[A-Z0-9]{3}$/;

/** GSS codes for UK local authority districts: E/N/S/W followed by eight digits. */
const GSS_CODE = /^[ENSW]\d{8}$/;

export function isGssCode(value: string): boolean {
  return GSS_CODE.test(value);
}

/** Small-area codes: LSOA 2021 (E01/W01), NI Data Zone 2021 (N20), NI SOA 2011 (e.g. 95GG01S1). */
/** LSOA 2021, NI Data Zone 2021, NI SOA (2011: ending S, W or C and a digit, e.g. 95GG01S1, 95II07W1). */
const SMALL_AREA_CODE = /^([EW]01\d{6}|N20\d{6}|95[A-Z]{2}\d{2}[SWC]\d)$/;

export function isSmallAreaCode(value: string): boolean {
  return SMALL_AREA_CODE.test(value);
}

/** A whole number within [min, max] from a query value, or the fallback. */
function intParam(v: string | null, limits: { min: number; max: number }, fallback: number): number {
  if (v === null || !/^\d{1,3}$/.test(v)) return fallback;
  const n = Number(v);
  return n >= limits.min && n <= limits.max ? n : fallback;
}

/** Comparison councils: valid, distinct, not the selected council, at most MAX_COMPARE. */
export function cleanCompare(codes: readonly string[], lad: string | null): string[] {
  const out: string[] = [];
  for (const c of codes) {
    const code = c.trim().toUpperCase();
    if (isGssCode(code) && code !== lad && !out.includes(code)) out.push(code);
    if (out.length === MAX_COMPARE) break;
  }
  return out;
}

/** Parse a query string. Invalid values fall back to defaults rather than throwing. */
export function parseUrlState(search: string): UrlState {
  const params = new URLSearchParams(search);
  const m = params.get("m");
  const mo = params.get("mo");
  const lad = params.get("lad");
  const view = params.get("view");
  const c = params.get("c");
  const pm = params.get("pm");
  const y = params.get("y");
  const ms = params.get("ms");
  const p = params.get("p");
  const cy = params.get("cy");
  const cm = params.get("cm");
  const hm = params.get("hm");
  const sl = params.get("sl");
  const rt = params.get("rt");
  const cl = params.get("cl");
  const st = params.get("st");
  const bm = params.get("bm");
  const am = params.get("am");
  const sa = params.get("sa");
  const cmp = params.get("cmp");
  const ng = params.get("ng");
  const rv = params.get("rv");
  const rf = params.get("rf");
  const pt = params.get("pt");
  const pms = params.get("pms");
  const rd = params.get("rd");
  const rl = params.get("rl");
  const fm = params.get("fm");
  const pf = params.get("pf");
  const rn = params.get("rn");
  const sk = params.get("sk");
  const sy = params.get("sy");
  const smo = params.get("smo");
  const sv = params.get("sv");
  const ia = params.get("ia");
  const scenarioYearNum = sy !== null && /^\d{4}$/.test(sy) ? Number(sy) : NaN;
  const scenarioMonthNum = smo !== null && /^\d{1,2}$/.test(smo) ? Number(smo) : NaN;
  const L = SCENARIO_LIMITS;
  const D = DEFAULT_URL_STATE;

  const monthNum = mo !== null && /^\d{1,2}$/.test(mo) ? Number(mo) : NaN;
  const yearNum = y !== null && /^\d{4}$/.test(y) ? Number(y) : NaN;
  const compareYearNum = cy !== null && /^\d{4}$/.test(cy) ? Number(cy) : NaN;
  const compareMonthNum = cm !== null && /^\d{1,2}$/.test(cm) ? Number(cm) : NaN;
  const period = (Object.keys(PERIOD_PARAM) as PeriodMode[]).find((k) => PERIOD_PARAM[k] === pm);

  const ladCode = lad && isGssCode(lad.toUpperCase()) ? lad.toUpperCase() : null;
  return {
    module: isModuleId(m) ? m : DEFAULT_URL_STATE.module,
    month: Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : null,
    lad: ladCode,
    overlay: (OVERLAYS as readonly string[]).includes(view ?? "") ? (view as Overlay) : "none",
    commodity: c && COMMODITY_ID.test(c) ? c : DEFAULT_URL_STATE.commodity,
    period: period ?? DEFAULT_URL_STATE.period,
    year: Number.isInteger(yearNum) && yearNum >= 1990 && yearNum <= 2100 ? yearNum : null,
    measure: ms === "value" ? "value" : "mass",
    partner: p && PARTNER_KEY.test(p) ? p : null,
    compareYear:
      Number.isInteger(compareYearNum) && compareYearNum >= 1990 && compareYearNum <= 2100
        ? compareYearNum
        : null,
    compareMonth:
      Number.isInteger(compareMonthNum) && compareMonthNum >= 1 && compareMonthNum <= 12
        ? compareMonthNum
        : null,
    heatmap: (HEATMAP_MODES as readonly string[]).includes(hm ?? "") ? (hm as HeatmapMode) : "share",
    storeLayers: parseStoreLayers(sl),
    retailers: parseRetailers(rt),
    councilLayer:
      (Object.keys(COUNCIL_PARAM) as CouncilLayer[]).find((k) => COUNCIL_PARAM[k] === cl) ??
      DEFAULT_URL_STATE.councilLayer,
    store: st !== null && /^\d{1,12}$/.test(st) ? Number(st) : null,
    basemap: (BASEMAP_IDS as readonly string[]).includes(bm ?? "") ? (bm as BasemapId) : "dark",
    areaMeasure: (AREA_MEASURES as readonly string[]).includes(am ?? "") ? (am as AreaMeasure) : "ppfi",
    area: sa && isSmallAreaCode(sa) ? sa : null,
    compare: cmp ? cleanCompare(cmp.split(","), ladCode) : [],
    niGrocers: ng === "1",
    riskView: (RISK_VIEWS as readonly string[]).includes(rv ?? "") ? (rv as RiskView) : "supply",
    riskFill: rf === "stress" ? "stress" : "share",
    port: pt && PORT_CODE.test(pt.toUpperCase()) ? pt.toUpperCase() : null,
    portMeasure: (PORT_MEASURES as readonly string[]).includes(pms ?? "")
      ? (pms as PortMeasureId)
      : "international",
    roads: rd !== "0",
    rail: rl !== "0",
    farmLayer: (FARM_LAYERS as readonly string[]).includes(fm ?? "") ? (fm as FarmLayer) : "off",
    ppfiMeasure: (PPFI_MEASURES as readonly string[]).includes(pf ?? "") ? (pf as PpfiMeasure) : "combined",
    rankNation: (Object.keys(NATION_PARAM) as Nation[]).find((n) => NATION_PARAM[n] === rn) ?? null,
    scenarioKind: (SCENARIO_KINDS as readonly string[]).includes(sk ?? "") ? (sk as ScenarioKind) : "import",
    scenarioYear:
      Number.isInteger(scenarioYearNum) && scenarioYearNum >= 1990 && scenarioYearNum <= 2100
        ? scenarioYearNum
        : null,
    scenarioMonth:
      Number.isInteger(scenarioMonthNum) && scenarioMonthNum >= 1 && scenarioMonthNum <= 12
        ? scenarioMonthNum
        : null,
    scenarioReduction: intParam(params.get("sr"), L.reduction, D.scenarioReduction),
    scenarioDuration: intParam(params.get("sd"), L.duration, D.scenarioDuration),
    scenarioRecovery: intParam(params.get("srk"), L.recovery, D.scenarioRecovery),
    scenarioSubstitution: intParam(params.get("ss"), L.substitution, D.scenarioSubstitution),
    productionReduction: intParam(params.get("spr"), L.reduction, D.productionReduction),
    portReduction: intParam(params.get("sdr"), L.reduction, D.portReduction),
    portMonths: intParam(params.get("sdm"), L.portMonths, D.portMonths),
    scenarioView: sv === "baseline" ? "baseline" : "scenario",
    insightsKind: (INSIGHTS_KINDS as readonly string[]).includes(ia ?? "")
      ? (ia as InsightsKind)
      : D.insightsKind,
  };
}

/** Serialise state to a query string ("" when everything is default). Order is stable. */
export function serializeUrlState(state: UrlState): string {
  const params = new URLSearchParams();
  if (state.module !== DEFAULT_URL_STATE.module) params.set("m", state.module);
  if (state.commodity !== DEFAULT_URL_STATE.commodity) params.set("c", state.commodity);
  if (state.period !== DEFAULT_URL_STATE.period) params.set("pm", PERIOD_PARAM[state.period]);
  if (state.year !== null) params.set("y", String(state.year));
  if (state.month !== null) params.set("mo", String(state.month));
  if (state.measure !== DEFAULT_URL_STATE.measure) params.set("ms", state.measure);
  if (state.partner !== null) params.set("p", state.partner);
  if (state.compareYear !== null) params.set("cy", String(state.compareYear));
  if (state.compareMonth !== null) params.set("cm", String(state.compareMonth));
  if (state.heatmap !== DEFAULT_URL_STATE.heatmap) params.set("hm", state.heatmap);
  const sl = serialiseStoreLayers(state.storeLayers);
  if (sl !== null) params.set("sl", sl);
  if (state.retailers !== null) params.set("rt", [...state.retailers].sort().join(","));
  if (state.councilLayer !== DEFAULT_URL_STATE.councilLayer)
    params.set("cl", COUNCIL_PARAM[state.councilLayer]);
  if (state.store !== null) params.set("st", String(state.store));
  if (state.basemap !== DEFAULT_URL_STATE.basemap) params.set("bm", state.basemap);
  if (state.areaMeasure !== DEFAULT_URL_STATE.areaMeasure) params.set("am", state.areaMeasure);
  if (state.niGrocers) params.set("ng", "1");
  if (state.riskView !== DEFAULT_URL_STATE.riskView) params.set("rv", state.riskView);
  if (state.riskFill !== DEFAULT_URL_STATE.riskFill) params.set("rf", state.riskFill);
  if (state.port !== null) params.set("pt", state.port);
  if (state.portMeasure !== DEFAULT_URL_STATE.portMeasure) params.set("pms", state.portMeasure);
  if (!state.roads) params.set("rd", "0");
  if (!state.rail) params.set("rl", "0");
  if (state.farmLayer !== DEFAULT_URL_STATE.farmLayer) params.set("fm", state.farmLayer);
  if (state.ppfiMeasure !== DEFAULT_URL_STATE.ppfiMeasure) params.set("pf", state.ppfiMeasure);
  if (state.rankNation !== null) params.set("rn", NATION_PARAM[state.rankNation]);
  if (state.scenarioKind !== DEFAULT_URL_STATE.scenarioKind) params.set("sk", state.scenarioKind);
  if (state.scenarioYear !== null) params.set("sy", String(state.scenarioYear));
  if (state.scenarioMonth !== null) params.set("smo", String(state.scenarioMonth));
  const scenarioNumbers: [keyof UrlState, string][] = [
    ["scenarioReduction", "sr"],
    ["scenarioDuration", "sd"],
    ["scenarioRecovery", "srk"],
    ["scenarioSubstitution", "ss"],
    ["productionReduction", "spr"],
    ["portReduction", "sdr"],
    ["portMonths", "sdm"],
  ];
  for (const [key, param] of scenarioNumbers)
    if (state[key] !== DEFAULT_URL_STATE[key]) params.set(param, String(state[key]));
  if (state.scenarioView !== DEFAULT_URL_STATE.scenarioView) params.set("sv", state.scenarioView);
  if (state.insightsKind !== DEFAULT_URL_STATE.insightsKind) params.set("ia", state.insightsKind);
  if (state.lad !== null) params.set("lad", state.lad);
  if (state.area !== null) params.set("sa", state.area);
  if (state.compare.length) params.set("cmp", state.compare.join(","));
  if (state.overlay !== "none") params.set("view", state.overlay);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** Navigation-worthy changes create a history entry; fine adjustments replace it. */
export function historyModeFor(prev: UrlState, next: UrlState): "push" | "replace" {
  return prev.module !== next.module ||
    prev.overlay !== next.overlay ||
    prev.lad !== next.lad ||
    prev.commodity !== next.commodity ||
    prev.riskView !== next.riskView ||
    prev.scenarioKind !== next.scenarioKind ||
    prev.insightsKind !== next.insightsKind
    ? "push"
    : "replace";
}
