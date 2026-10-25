/**
 * Local Authority Profiles view model (LP-01 – LP-10): pure functions over the validated datasets.
 * No React or ArcGIS imports; the hooks (useProfile.ts) memoise them. Formulas live in
 * src/analysis/profile.ts; this file joins datasets by stable geography codes and builds the
 * map models.
 */
import {
  beyondThreshold,
  breakClass,
  decileClass,
  decileDistribution,
  DISTANCE_BREAKS_KM,
  DISTANCE_THRESHOLDS_KM,
  gridForCouncil,
  nearestDistances,
  NO_CAR_BREAKS,
  noCarShare,
  populationBeyond,
  type Beyond,
  type DecileRow,
  type GridPoint,
} from "@/analysis/profile";
import type { StoreLayer } from "@/analysis/retail";
import type { AccessMapModel, ProfileMapArea, ProfileMapModel } from "@/state/store";
import type { AreaMeasure } from "@/state/urlState";
import type { CouncilContext } from "@/types/generated/council-context";
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import type {
  Area,
  DeprivationArea,
  Ppfi,
  Profile,
  SmallAreaIndicators,
} from "@/types/generated/small-area-indicators";
import type { SmallAreaBoundaries, SmallAreaFeature } from "@/types/generated/small-areas";

export type Nation = CouncilIndicators["councils"][number]["nation"];
export type CouncilContextRow = CouncilContext["councils"][number];

/** One council in the selector and the profile header (LP-01, LP-02). */
export interface CouncilRow {
  code: string;
  name: string;
  nation: Nation;
  population: number | null;
  landAreaKm2: number | null;
  note: string | null;
  bbox: [number, number, number, number] | null;
  /** A deep profile (small areas) is published for this council (LP-10). */
  deep: boolean;
  context: CouncilContextRow | null;
}

/** Councils from the store indicators (population, land area) joined to the context file by code. */
export function councilRows(
  indicators: CouncilIndicators,
  context: CouncilContext | null,
  deepCodes: ReadonlySet<string>,
): CouncilRow[] {
  const ctx = new Map(context?.councils.map((c) => [c.code, c]) ?? []);
  return indicators.councils
    .map((c) => {
      const x = ctx.get(c.code) ?? null;
      return {
        code: c.code,
        name: c.name,
        nation: c.nation,
        population: c.population,
        landAreaKm2: c.landAreaKm2,
        note: c.note,
        bbox: x ? (x.bbox as [number, number, number, number]) : null,
        deep: deepCodes.has(c.code),
        context: x,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------------------
// PPFI (S13): official domain names from the HASP data dictionary (v2.1)

export type PpfiDomain = keyof Ppfi["domains"];

export const PPFI_DOMAINS: readonly {
  key: PpfiDomain;
  measure: AreaMeasure;
  label: string;
  group: "access" | "barriers";
}[] = [
  {
    key: "supermarket_proximity",
    measure: "ppfi-supermarket-proximity",
    label: "Proximity to supermarket retail facilities",
    group: "access",
  },
  {
    key: "supermarket_accessibility",
    measure: "ppfi-supermarket-accessibility",
    label: "Accessibility to supermarket retail facilities",
    group: "access",
  },
  { key: "ecommerce_access", measure: "ppfi-online", label: "Access to online deliveries", group: "access" },
  {
    key: "nonsupermarket_proximity",
    measure: "ppfi-nonsupermarket-proximity",
    label: "Proximity to non-supermarket food provision",
    group: "access",
  },
  {
    key: "socio_demographic",
    measure: "ppfi-socio-economic",
    label: "Socio-economic barriers",
    group: "barriers",
  },
  { key: "food_for_families", measure: "ppfi-family-food", label: "Family food support", group: "barriers" },
  { key: "fuel_poverty", measure: "ppfi-fuel-poverty", label: "Fuel poverty", group: "barriers" },
];

export const AREA_MEASURE_LABELS: Record<AreaMeasure, string> = {
  ppfi: "Priority Places for Food Index (combined)",
  ...Object.fromEntries(PPFI_DOMAINS.map((d) => [d.measure, `PPFI: ${d.label.toLowerCase()}`])),
  deprivation: "Deprivation (within the nation)",
  "no-car": "Households with no car or van",
  distance: "Straight-line distance to the nearest supermarket",
} as Record<AreaMeasure, string>;

export function ppfiDomainOf(measure: AreaMeasure): PpfiDomain | "combined" | null {
  if (measure === "ppfi") return "combined";
  return PPFI_DOMAINS.find((d) => d.measure === measure)?.key ?? null;
}

/** The PPFI decile of an area for a measure (combined or one domain); null when not published there. */
export function ppfiDecile(p: Ppfi | null, domain: PpfiDomain | "combined"): number | null {
  if (!p) return null;
  return domain === "combined" ? p.decile : (p.domains[domain]?.decile ?? null);
}

// ---------------------------------------------------------------------------------------------
// Deep profile (LP-04, LP-06): small areas joined to stores

export interface PpfiItem {
  code: string;
  name: string;
  ppfi: Ppfi;
  population: number | null;
}

export interface DeprivationItem {
  code: string;
  name: string;
  rank: number;
  decile: number;
  population: number | null;
  urbanRural2015?: string;
}

export interface DeepProfile {
  lad: string;
  profile: Profile;
  census: SmallAreaIndicators["census"];
  boundaries: SmallAreaBoundaries;
  /** The indicator geography (LSOAs or Data Zones), with straight-line distances. */
  areas: (Area & { toSupermarket: number | null; toAnyStore: number | null })[];
  /** PPFI and deprivation, each on the geography it is published on. */
  ppfi: PpfiItem[];
  deprivation: DeprivationItem[];
  ppfiGeography: Profile["ppfi"]["geography"];
  deprivationGeography: Profile["deprivation"]["geography"];
  beyondSupermarket: Beyond[];
  beyondAnyStore: Beyond[];
  population: number;
  households: number;
  noCarHouseholds: number;
}

export interface GridStoreLike {
  layer: StoreLayer;
  grid: GridPoint;
}

/** Joins a deep profile's indicators, boundaries and the stores (straight-line distances in the national grid). */
export function deepProfile(
  indicators: SmallAreaIndicators,
  boundaries: SmallAreaBoundaries,
  stores: readonly GridStoreLike[],
): DeepProfile {
  const profile = indicators.profiles[0];
  const crs = gridForCouncil(profile.lad);
  const supermarkets = stores.filter((s) => s.layer === "supermarket").map((s) => s.grid);
  const all = stores.map((s) => s.grid);
  const points = profile.areas.map((a) => ({ code: a.code, centroid: a.centroid }));
  const toSupermarket = nearestDistances(points, supermarkets, crs);
  const toAny = nearestDistances(points, all, crs);
  const areas = profile.areas.map((a) => ({
    ...a,
    toSupermarket: toSupermarket.get(a.code) ?? null,
    toAnyStore: toAny.get(a.code) ?? null,
  }));
  const popOf = new Map(profile.areas.map((a) => [a.code, a.population]));
  const dep: DeprivationArea[] = profile.deprivationAreas ?? [];
  const ppfi: PpfiItem[] =
    profile.ppfi.geography === profile.geography.kind
      ? profile.areas
          .filter((a) => a.ppfi)
          .map((a) => ({ code: a.code, name: a.name, ppfi: a.ppfi!, population: a.population }))
      : dep.map((a) => ({ code: a.code, name: a.name, ppfi: a.ppfi, population: popOf.get(a.code) ?? null }));
  const deprivation: DeprivationItem[] =
    profile.deprivation.geography === profile.geography.kind
      ? profile.areas
          .filter((a) => a.deprivation)
          .map((a) => ({
            code: a.code,
            name: a.name,
            rank: a.deprivation!.rank,
            decile: a.deprivation!.decile,
            population: a.population,
          }))
      : dep.map((a) => ({
          code: a.code,
          name: a.name,
          rank: a.rank,
          decile: a.decile,
          population: null,
          urbanRural2015: a.urbanRural2015,
        }));
  const hh = profile.areas.reduce((s, a) => s + (a.households ?? 0), 0);
  const noCar = profile.areas.reduce((s, a) => s + (a.noCarHouseholds ?? 0), 0);
  return {
    lad: profile.lad,
    profile,
    census: indicators.census,
    boundaries,
    areas,
    ppfi,
    deprivation,
    ppfiGeography: profile.ppfi.geography,
    deprivationGeography: profile.deprivation.geography,
    beyondSupermarket: DISTANCE_THRESHOLDS_KM.map((km) => populationBeyond(areas, toSupermarket, km)),
    beyondAnyStore: DISTANCE_THRESHOLDS_KM.map((km) => populationBeyond(areas, toAny, km)),
    population: profile.areas.reduce((s, a) => s + a.population, 0),
    households: hh,
    noCarHouseholds: noCar,
  };
}

/** Areas and population by PPFI decile (combined or a domain), on the geography PPFI is published on. */
export function ppfiDistribution(
  deep: DeepProfile,
  domain: PpfiDomain | "combined",
): { rows: DecileRow[]; missing: number } {
  return decileDistribution(
    deep.ppfi.map((p) => ({ decile: ppfiDecile(p.ppfi, domain), population: p.population })),
  );
}

export function deprivationDistribution(deep: DeepProfile): { rows: DecileRow[]; missing: number } {
  return decileDistribution(deep.deprivation.map((d) => ({ decile: d.decile, population: d.population })));
}

/** Codes of the areas in a decile pair (map class), for chart → map links. */
export function codesInDecileClass(
  items: readonly { code: string; decile: number | null }[],
  classIndex: number,
): string[] {
  return items.filter((i) => decileClass(i.decile) === classIndex).map((i) => i.code);
}

/** Areas beyond a straight-line threshold from a supermarket, with car availability beside them (P10). */
export function underserved(deep: DeepProfile, thresholdKm: number) {
  return beyondThreshold(
    deep.areas.map((a) => ({
      code: a.code,
      name: a.name,
      population: a.population,
      noCar: noCarShare(a.households, a.noCarHouseholds),
    })),
    new Map(deep.areas.map((a) => [a.code, a.toSupermarket])),
    thresholdKm,
  );
}

// ---------------------------------------------------------------------------------------------
// Map models (LP-06): the council map (stores, councils) and the small-area layer

export const PROFILE_UK_FRAME_KEY = "profile:uk";

/** The profile's council map: the Food Access map in profile mode, framed on the selected council. */
export function profileCouncilMap(
  base: AccessMapModel,
  lad: string | null,
  bbox: [number, number, number, number] | null,
  compare: readonly string[],
): AccessMapModel {
  return {
    ...base,
    mode: "profile",
    compareCouncils: [...compare],
    choropleth: null,
    proximity: null,
    selectedCouncil: lad,
    frame:
      lad && bbox
        ? { key: `profile:${lad}`, bbox }
        : base.frame
          ? { key: PROFILE_UK_FRAME_KEY, bbox: base.frame.bbox }
          : null,
  };
}

function rings(f: SmallAreaFeature): number[][][] {
  return f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat();
}

export const MAP_CLASS_COUNT = 5;

/** Geography the map draws for a measure: PPFI and deprivation on their own areas; the rest on the census areas. */
export function measureGeography(
  deep: DeepProfile,
  measure: AreaMeasure,
): SmallAreaFeature["properties"]["kind"] {
  if (ppfiDomainOf(measure)) return deep.ppfiGeography;
  if (measure === "deprivation") return deep.deprivationGeography;
  return deep.profile.geography.kind;
}

/** Fixed class per area for the measure (5 classes; null = no data, drawn hatched). */
export function areaClasses(deep: DeepProfile, measure: AreaMeasure): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const domain = ppfiDomainOf(measure);
  if (domain) {
    for (const p of deep.ppfi) out[p.code] = decileClass(ppfiDecile(p.ppfi, domain));
  } else if (measure === "deprivation") {
    for (const d of deep.deprivation) out[d.code] = decileClass(d.decile);
  } else if (measure === "no-car") {
    for (const a of deep.areas)
      out[a.code] = breakClass(noCarShare(a.households, a.noCarHouseholds), NO_CAR_BREAKS);
  } else {
    for (const a of deep.areas)
      out[a.code] = breakClass(a.toSupermarket === null ? null : a.toSupermarket / 1000, DISTANCE_BREAKS_KM);
  }
  return out;
}

export function profileAreaMap(
  deep: DeepProfile,
  measure: AreaMeasure,
  selected: string | null,
  highlighted: readonly string[],
  copyright: string,
): ProfileMapModel {
  const kind = measureGeography(deep, measure);
  const features = deep.boundaries.features.filter((f) => f.properties.kind === kind);
  const areas: ProfileMapArea[] = features.map((f) => ({ code: f.properties.code, rings: rings(f) }));
  const codes = new Set(areas.map((a) => a.code));
  return {
    lad: deep.lad,
    key: `${deep.lad}:${kind}`,
    areas,
    measure,
    classOf: areaClasses(deep, measure),
    classCount: MAP_CLASS_COUNT,
    firstColour: 1,
    selected: selected && codes.has(selected) ? selected : null,
    highlighted: highlighted.filter((c) => codes.has(c)),
    copyright,
  };
}
