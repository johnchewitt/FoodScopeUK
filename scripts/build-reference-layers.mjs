// Builds the static reference geometry used by the map when no basemap key is configured
// (and as a subtle outline layer at world scale).
//
// Source: Natural Earth 4.1.0 Admin 0 countries, 1:110m, redistributed as TopoJSON by the
// `world-atlas` npm package (v2.0.2, ISC licence; Natural Earth data is public domain).
// Catalogue entry: S24 in docs/03-DATA-SOURCES.md.
//
// Output (deterministic, committed):
//   public/data/reference/world-countries-110m.geojson
//   public/data/reference/world-countries-110m.provenance.json   (read by the pipeline's publish step)
//
// Usage: npm run build:reference
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { feature } from "topojson-client";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "data", "reference");
const COORD_DECIMALS = 3; // ~110 m at the equator; ample for 1:110m geometry.

export function roundCoords(value, decimals = COORD_DECIMALS) {
  if (typeof value === "number") return Number(value.toFixed(decimals));
  return value.map((v) => roundCoords(v, decimals));
}

/** Re-expresses a ring with continuous longitudes (no step larger than 180°). */
export function unwrapRing(ring) {
  const out = [ring[0].slice()];
  for (let i = 1; i < ring.length; i++) {
    let [x, y] = ring[i];
    const prev = out[i - 1][0];
    while (x - prev > 180) x -= 360;
    while (x - prev < -180) x += 360;
    out.push([x, y]);
  }
  return out;
}

/** Sutherland–Hodgman clip of a ring against the half-plane x <= bx (side = 1) or x >= bx (side = -1). */
function clipRing(ring, bx, side) {
  const inside = (p) => (side === 1 ? p[0] <= bx : p[0] >= bx);
  const cross = (a, b) => {
    const t = (bx - a[0]) / (b[0] - a[0]);
    return [bx, a[1] + t * (b[1] - a[1])];
  };
  const pts = ring.slice(0, -1);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const cur = pts[i];
    const prev = pts[(i + pts.length - 1) % pts.length];
    if (inside(cur)) {
      if (!inside(prev)) out.push(cross(prev, cur));
      out.push(cur);
    } else if (inside(prev)) {
      out.push(cross(prev, cur));
    }
  }
  if (out.length < 3) return null;
  out.push(out[0].slice());
  return out;
}

/**
 * Some world-atlas rings (Russia, Fiji, Antarctica) jump between +180 and -180, which renders as
 * lines across the whole map. Unwrap each outer ring and split it at the antimeridian.
 * Returns an array of polygons (arrays of rings).
 */
export function splitPolygonAtAntimeridian(polygon) {
  const [outer, ...holes] = polygon;
  const crosses = outer.some((p, i) => i > 0 && Math.abs(p[0] - outer[i - 1][0]) > 180);
  if (!crosses) return [polygon];
  const u = unwrapRing(outer);
  const xs = u.map((p) => p[0]);
  const maxX = Math.max(...xs);
  const minX = Math.min(...xs);
  const bx = maxX > 180 ? 180 : minX < -180 ? -180 : null;
  if (bx === null) return [[u, ...holes]];
  const shift = bx === 180 ? -360 : 360;
  const a = clipRing(u, bx, bx === 180 ? 1 : -1);
  const b = clipRing(u, bx, bx === 180 ? -1 : 1);
  const parts = [];
  if (a) parts.push([a]);
  if (b) parts.push([b.map(([x, y]) => [x + shift, y])]);
  return parts;
}

function fixAntimeridian(geometry) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const fixed = polys.flatMap(splitPolygonAtAntimeridian);
  return fixed.length === 1
    ? { type: "Polygon", coordinates: fixed[0] }
    : { type: "MultiPolygon", coordinates: fixed };
}

/** Convert the world-atlas topology to a sorted, rounded GeoJSON FeatureCollection. */
export function toFeatureCollection(topology) {
  const fc = feature(topology, topology.objects.countries);
  const features = fc.features
    .filter((f) => f.geometry !== null)
    .map((f) => {
      const geometry = fixAntimeridian(f.geometry);
      return {
        type: "Feature",
        properties: { name: f.properties.name, iso_n3: f.id ?? null },
        geometry: { type: geometry.type, coordinates: roundCoords(geometry.coordinates) },
      };
    })
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, "en"));
  return { type: "FeatureCollection", features };
}

async function main() {
  const pkgPath = require.resolve("world-atlas/package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  const topoPath = path.join(path.dirname(pkgPath), "countries-110m.json");
  const topology = JSON.parse(await readFile(topoPath, "utf8"));

  const fc = toFeatureCollection(topology);
  const body = JSON.stringify(fc);
  const sha256 = createHash("sha256").update(body).digest("hex");

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "world-countries-110m.geojson"), body, "utf8");

  const provenance = {
    id: "reference.world_countries_110m",
    title: "World country outlines (Natural Earth 1:110m)",
    role: "reference",
    path: "reference/world-countries-110m.geojson",
    format: "geojson",
    schemaId: null,
    sha256,
    bytes: Buffer.byteLength(body),
    featureCount: fc.features.length,
    sourceIds: ["S24"],
    referencePeriod: "Natural Earth v4.1.0",
    coverage: "World",
    provenance: "measured",
    licence: "Public domain (Natural Earth); world-atlas packaging ISC",
    attribution: "Made with Natural Earth",
    expectedCadence: "static",
    retrieval: {
      method: "npm package",
      source: `world-atlas@${pkg.version} countries-110m.json`,
      retrievedAt: "2026-10-23T00:00:00Z",
      notes: `Converted with topojson-client; rings crossing the antimeridian split at ±180°; coordinates rounded to ${COORD_DECIMALS} dp; features sorted by name.`,
    },
  };
  await writeFile(
    path.join(outDir, "world-countries-110m.provenance.json"),
    JSON.stringify(provenance, null, 2) + "\n",
    "utf8",
  );
  console.log(
    `world-countries-110m.geojson: ${fc.features.length} features (in: ${topology.objects.countries.geometries.length}), ${provenance.bytes} bytes, sha256 ${sha256.slice(0, 12)}…`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
