/**
 * Straight-line proximity (SM-07, P7, ADR-12): Euclidean distance in the national grid of each
 * store — British National Grid (EPSG:27700) in Great Britain and the Crown Dependencies, Irish
 * Transverse Mercator (EPSG:2157) in Northern Ireland. Never walking or driving distance.
 * Pure functions: no React, ArcGIS or DOM imports.
 */
import { gridDistance, toGrid, type GridCrs } from "./projection";

export interface GridStore {
  id: number;
  crs: GridCrs;
  x: number;
  y: number;
}

/** The grid used for a store: ITM for Northern Ireland councils (N…), BNG otherwise. */
export function gridFor(lad: string | null): GridCrs {
  return lad?.startsWith("N") ? "EPSG:2157" : "EPSG:27700";
}

export function projectStore(id: number, lon: number, lat: number, lad: string | null): GridStore {
  const crs = gridFor(lad);
  const [x, y] = toGrid(lon, lat, crs);
  return { id, crs, x, y };
}

export interface Distance {
  id: number;
  /** Straight-line distance in metres, in the store's grid. */
  metres: number;
  crs: GridCrs;
}

/** Distances from a WGS84 point to every store, each measured in that store's grid; nearest first. */
export function distancesFrom(lon: number, lat: number, stores: readonly GridStore[]): Distance[] {
  const at: Record<GridCrs, [number, number]> = {
    "EPSG:27700": toGrid(lon, lat, "EPSG:27700"),
    "EPSG:2157": toGrid(lon, lat, "EPSG:2157"),
  };
  return stores
    .map((s) => ({ id: s.id, crs: s.crs, metres: gridDistance(at[s.crs], [s.x, s.y]) }))
    .sort((a, b) => a.metres - b.metres || a.id - b.id);
}

export interface ProximityResult {
  /** The n nearest stores. */
  nearest: Distance[];
  /** Every store within the radius. */
  within: Distance[];
  /** Grid used to draw the radius: the nearest store's grid (BNG if there is none). */
  circleCrs: GridCrs;
}

/** Nearest `n` stores and stores within `radiusM` of a point (straight-line, national grids). */
export function proximity(
  lon: number,
  lat: number,
  stores: readonly GridStore[],
  n: number,
  radiusM: number,
): ProximityResult {
  const all = distancesFrom(lon, lat, stores);
  return {
    nearest: all.slice(0, Math.max(0, n)),
    within: all.filter((d) => d.metres <= radiusM),
    circleCrs: all[0]?.crs ?? "EPSG:27700",
  };
}
