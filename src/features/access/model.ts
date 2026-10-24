/**
 * UK Food Access view model (SM-01 – SM-09): pure functions over the validated store and council
 * datasets. No React or ArcGIS imports; the hook (useAccess.ts) memoises these.
 */
import { pointsBBox } from "@/analysis/frame";
import { gridCircle } from "@/analysis/projection";
import { projectStore, proximity, type GridStore } from "@/analysis/proximity";
import {
  areaTotal,
  councilProvision,
  countInLayers,
  filterWhereClause,
  groupLayers,
  per10k,
  perKm2,
  PROVISION,
  PROVISION_MEASURES,
  storeLayer,
  storeMatches,
  STORE_LAYERS,
  type AreaTotal,
  type Provision,
  type ProvisionMeasure,
  type StoreFilter,
  type StoreLayer,
} from "@/analysis/retail";
import type { AccessMapModel, AccessPoint } from "@/state/store";
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import type { StoreCollection, StoreProperties } from "@/types/generated/stores";

/** Canonical store fields (stores.schema.json), read by the hosted-layer adapter (SM-01). */
export const STORE_FIELDS = [
  "id",
  "retailer",
  "fascia",
  "name",
  "address",
  "town",
  "postcode",
  "sizeBand",
  "storeClass",
  "format",
  "lad",
  "councilMatch",
  "crownDependency",
  "coordinateSource",
] as const satisfies readonly (keyof StoreProperties)[];

export interface AccessStore extends StoreProperties {
  layer: StoreLayer;
  lon: number;
  lat: number;
  grid: GridStore;
}

/** Every store with its map layer (D5) and national-grid position (BNG, or ITM in Northern Ireland). */
export function indexStores(doc: StoreCollection): AccessStore[] {
  return doc.features.map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates as [number, number];
    return {
      ...p,
      layer: storeLayer(p.storeClass, p.format),
      lon,
      lat,
      grid: projectStore(p.id, lon, lat, p.lad),
    };
  });
}

/**
 * Compact GeoJSON for the map layer: only what it draws and filters on (id, layer, retailer), so
 * the browser parses a fraction of the full file a second time. Served to the layer as a blob URL.
 */
export function storesGeoJson(stores: readonly AccessStore[]): string {
  return JSON.stringify({
    type: "FeatureCollection",
    features: stores.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lon, s.lat] },
      properties: { id: s.id, layer: s.layer, retailer: s.retailer },
    })),
  });
}

export interface LayerCount {
  /** Every store in the layer on the map. */
  total: number;
  /** Stores in a UK council (the rates' numerator). */
  inCouncils: number;
  /** Stores in Guernsey, Jersey and the Isle of Man (no UK council). */
  crownDependencies: number;
}

export function layerCounts(stores: readonly AccessStore[]): Record<StoreLayer, LayerCount> {
  const out = Object.fromEntries(
    STORE_LAYERS.map((l) => [l, { total: 0, inCouncils: 0, crownDependencies: 0 }]),
  ) as Record<StoreLayer, LayerCount>;
  for (const s of stores) {
    const c = out[s.layer];
    c.total += 1;
    if (s.lad) c.inCouncils += 1;
    else c.crownDependencies += 1;
  }
  return out;
}

/** Stores per council and layer recounted from the store file, for reconciliation with the indicator file. */
export function reconcile(
  stores: readonly AccessStore[],
  doc: CouncilIndicators,
): { layer: StoreLayer; fromStores: number; fromIndicators: number }[] {
  const layers = groupLayers(doc);
  return STORE_LAYERS.map((layer) => ({
    layer,
    fromStores: stores.filter((s) => s.layer === layer && s.lad).length,
    fromIndicators: doc.councils.reduce((a, c) => a + countInLayers(c.stores, layers, [layer]), 0),
  }));
}

/** Choropleth classes for the map (council codes per fixed class, and the no-data class). */
export function choroplethFor(
  rows: readonly Provision[],
  measure: ProvisionMeasure,
): NonNullable<AccessMapModel["choropleth"]> {
  const classes: string[][] = Array.from({ length: PROVISION[measure].breaks.length + 1 }, () => []);
  const noData: string[] = [];
  for (const r of rows) {
    if (r.classIndex === null) noData.push(r.code);
    else classes[r.classIndex]!.push(r.code);
  }
  return { measure, classes, noData };
}

/** Labels for the six fixed classes of a measure (spec §7.4), e.g. "under 0.70", "0.70 to 0.85", "1.30 and over". */
export function classLabels(measure: ProvisionMeasure): string[] {
  const b = PROVISION[measure].breaks.map((v) => v.toFixed(2));
  return [
    `under ${b[0]}`,
    ...b.slice(0, -1).map((v, i) => `${v} to under ${b[i + 1]}`),
    `${b[b.length - 1]} and over`,
  ];
}

export type Nation = CouncilIndicators["councils"][number]["nation"];
export const NATIONS: readonly Nation[] = ["England", "Wales", "Scotland", "Northern Ireland"];

/** UK and nation totals for a measure (councils without population are counted, not guessed). */
export function areaTotals(
  doc: CouncilIndicators,
  measure: ProvisionMeasure,
): {
  uk: AreaTotal & { withoutPopulation: number };
  nations: (AreaTotal & { withoutPopulation: number; nation: Nation })[];
} {
  const rows = councilProvision(doc, measure);
  return {
    uk: areaTotal("United Kingdom", rows),
    nations: NATIONS.map((nation) => ({
      ...areaTotal(
        nation,
        rows.filter((r) => r.nation === nation),
      ),
      nation,
    })),
  };
}

export interface CouncilDetail {
  code: string;
  name: string;
  nation: Nation;
  population: number | null;
  landAreaKm2: number | null;
  note: string | null;
  byLayer: Record<StoreLayer, number>;
  provision: Record<
    ProvisionMeasure,
    { stores: number; per10k: number | null; perKm2: number | null; classIndex: number | null }
  >;
}

export function councilDetail(doc: CouncilIndicators, code: string | null): CouncilDetail | null {
  if (!code) return null;
  const c = doc.councils.find((x) => x.code === code);
  if (!c) return null;
  const layers = groupLayers(doc);
  const provision = Object.fromEntries(
    PROVISION_MEASURES.map((m) => {
      const p = councilProvision({ ...doc, councils: [c] }, m)[0]!;
      return [m, { stores: p.stores, per10k: p.per10k, perKm2: p.perKm2, classIndex: p.classIndex }];
    }),
  ) as CouncilDetail["provision"];
  return {
    code: c.code,
    name: c.name,
    nation: c.nation,
    population: c.population,
    landAreaKm2: c.landAreaKm2,
    note: c.note,
    byLayer: Object.fromEntries(STORE_LAYERS.map((l) => [l, countInLayers(c.stores, layers, [l])])) as Record<
      StoreLayer,
      number
    >,
    provision,
  };
}

export interface ProximityStore {
  store: AccessStore;
  /** Straight-line distance in metres, in the store's national grid. */
  metres: number;
}

export interface ProximityView {
  point: [number, number];
  radiusM: number;
  nearest: ProximityStore[];
  /** Number of shown stores within the radius (straight-line). */
  withinCount: number;
  ring: [number, number][];
  crs: GridStore["crs"];
}

/** Nearest stores and stores within a radius of a point, among the stores shown (SM-07, P7). */
export function proximityView(
  shown: readonly AccessStore[],
  point: [number, number] | null,
  n: number,
  radiusKm: number,
): ProximityView | null {
  if (!point) return null;
  const radiusM = radiusKm * 1000;
  const byId = new Map(shown.map((s) => [s.id, s]));
  const r = proximity(
    point[0],
    point[1],
    shown.map((s) => s.grid),
    n,
    radiusM,
  );
  return {
    point,
    radiusM,
    nearest: r.nearest.map((d) => ({ store: byId.get(d.id)!, metres: d.metres })),
    withinCount: r.within.length,
    ring: gridCircle(point[0], point[1], radiusM, r.circleCrs),
    crs: r.circleCrs,
  };
}

/** Frame key for UK Food Access (one frame: it never changes with filters or selections). */
export const ACCESS_FRAME_KEY = "access:all-stores";

/**
 * The map frame for UK Food Access: the box around every mapped store, so the camera opens on the
 * UK with the Crown Dependencies and Shetland in view. Null when there are no stores.
 */
export function storesFrame(
  stores: readonly AccessStore[],
): { key: string; bbox: [number, number, number, number] } | null {
  const bbox = pointsBBox(stores);
  return bbox ? { key: ACCESS_FRAME_KEY, bbox } : null;
}

export function accessPoint(s: AccessStore): AccessPoint {
  return { id: s.id, lon: s.lon, lat: s.lat };
}

/** The stores shown on the map (store layers and retailers), for counts and proximity. */
export function shownStores(stores: readonly AccessStore[], filter: StoreFilter): AccessStore[] {
  return stores.filter((s) => storeMatches(s, filter));
}

export { filterWhereClause, per10k, perKm2 };
