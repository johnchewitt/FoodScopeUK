/**
 * A council's small areas from the Scenario Lab's UK-wide inputs (`scenario` family, S11, S15–S18,
 * S19): every LSOA (England, Wales), Data Zone 2022 (Scotland) and Data Zone 2021 (Northern
 * Ireland) with its Census population, England's IoD 2025 decile and its nearest supermarkets by
 * straight line in the national grid. The same definitions as the deep profiles (their shares of
 * residents beyond 1 km agree for Belfast and Manchester), but for every council.
 */
import { closureImpact, type ClosureResult } from "@/analysis/scenario";
import { DISTANCE_THRESHOLDS_KM, populationBeyond, type Beyond } from "@/analysis/profile";
import { mostReliedOn } from "@/features/scenarios/model";
import type { ScenarioClosure } from "@/types/generated/scenario-closure";

export interface SmallArea {
  code: string;
  name: string;
  population: number;
  /** Straight-line metres from the population-weighted centroid to the nearest supermarket. */
  nearestM: number;
  nearestStore: string;
  nearestRetailer: string;
  /** IoD 2025 decile within England (1 = most deprived); null outside England. */
  decile: number | null;
}

export interface CouncilSmallAreas {
  council: string;
  part: "gb" | "ni";
  grid: string;
  /** Census year of each nation's populations (Scotland 2022, others 2021). */
  censusYear: number;
  areas: SmallArea[];
  population: number;
  beyond: Beyond[];
  /** Residents in IoD deciles 1–2 (England only; null elsewhere). */
  deprived: { population: number; share: number } | null;
  /** Areas in deciles 1–2 more than 1 km straight-line from a supermarket (England only). */
  deprivedAndFar: SmallArea[];
}

/** The part of the UK holding the council's small areas, or null when the council is in neither. */
export function partFor(parts: { gb: ScenarioClosure; ni: ScenarioClosure }, council: string) {
  if (parts.gb.councils.includes(council)) return parts.gb;
  if (parts.ni.councils.includes(council)) return parts.ni;
  return null;
}

export function councilSmallAreas(d: ScenarioClosure, council: string): CouncilSmallAreas | null {
  const ci = d.councils.indexOf(council);
  if (ci < 0) return null;
  const A = d.areas;
  const S = d.stores;
  const areas: SmallArea[] = [];
  for (let i = 0; i < A.code.length; i++) {
    if (A.council[i] !== ci) continue;
    const s = A.nearest[i]![0]!;
    areas.push({
      code: A.code[i]!,
      name: A.name[i]!,
      population: A.population[i]!,
      nearestM: A.distance[i]![0]!,
      nearestStore: s >= 0 ? S.name[s]! : "",
      nearestRetailer: s >= 0 ? S.retailer[s]! : "",
      decile: A.decile[i] ?? null,
    });
  }
  if (areas.length === 0) return null;
  // Straight-line metres to the nearest supermarket (populationBeyond compares with km × 1,000).
  const metres = new Map(areas.map((a) => [a.code, a.nearestM]));
  const beyond = DISTANCE_THRESHOLDS_KM.map((km) => populationBeyond(areas, metres, km));
  const population = areas.reduce((s, a) => s + a.population, 0);
  const english = council.startsWith("E");
  const deprivedPop = areas
    .filter((a) => a.decile !== null && a.decile <= 2)
    .reduce((s, a) => s + a.population, 0);
  const censusYear = d.census[council[0]!] ?? 2021;
  return {
    council,
    part: d.part as "gb" | "ni",
    grid: d.grid,
    censusYear,
    areas,
    population,
    beyond,
    deprived: english && population > 0 ? { population: deprivedPop, share: deprivedPop / population } : null,
    deprivedAndFar: english
      ? areas
          .filter((a) => a.decile !== null && a.decile <= 2 && a.nearestM > 1000)
          .sort((a, b) => b.nearestM - a.nearestM || b.population - a.population)
      : [],
  };
}

/** Areas furthest from a supermarket (straight-line), most first: candidates for further investigation. */
export function furthestAreas(s: CouncilSmallAreas, limit = 6): SmallArea[] {
  return [...s.areas].sort((a, b) => b.nearestM - a.nearestM || b.population - a.population).slice(0, limit);
}

/** The council's most relied-on supermarket and what closing it would change (Scenario B, Stage 7). */
export interface ClosurePreview {
  storeIndex: number;
  storeId: number;
  name: string;
  retailer: string;
  /** Residents of the council whose nearest supermarket it is (the "most relied-on" criterion, Stage 7). */
  reliedOn: number;
  result: ClosureResult;
}

export function closurePreview(d: ScenarioClosure, council: string): ClosurePreview | null {
  const id = mostReliedOn(d, council);
  if (id === null) return null;
  const index = d.stores.id.indexOf(id);
  const ci = d.councils.indexOf(council);
  let reliedOn = 0;
  d.areas.nearest.forEach((n, i) => {
    if (n[0] === index && d.areas.council[i] === ci) reliedOn += d.areas.population[i]!;
  });
  return {
    storeIndex: index,
    storeId: id,
    name: d.stores.name[index]!,
    retailer: d.stores.retailer[index]!,
    reliedOn,
    result: closureImpact(d, index),
  };
}
