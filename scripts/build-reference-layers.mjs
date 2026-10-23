// Builds the static reference geometry used by the map (S24, docs/03-DATA-SOURCES.md).
//
// Source: Natural Earth v5.1.2 Admin 0 countries (public domain), GeoJSON editions published in
// the Natural Earth repository (github.com/nvkelso/natural-earth-vector, tag v5.1.2), pinned by
// URL and SHA-256 below.
//
// Outputs (deterministic, committed):
//   public/data/reference/world-countries-110m.geojson   1:110m outlines; name, iso_a2, iso_n3
//   public/data/reference/world-country-points.json      1:50m Natural Earth label points per ISO
//                                                        alpha-2 code (also covers small states
//                                                        missing from 1:110m, e.g. Malta, Singapore)
//   *.provenance.json sidecars (read by the pipeline's publish step)
//
// The ISO codes are Natural Earth's `ISO_A2_EH` / `ISO_N3_EH` fields (the "EH" variants fill
// codes that `ISO_A2` leaves as -99, e.g. France and Norway). They are the join key for the HMRC
// country crosswalk (gate G4).
//
// Usage: npm run build:reference   (downloads once into scripts/.cache/)
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "data", "reference");
const cacheDir = path.join(root, "scripts", ".cache");
const COORD_DECIMALS = 3; // ~110 m at the equator; ample for 1:110m geometry.
const POINT_DECIMALS = 4;
const NE_VERSION = "v5.1.2";
const NE_BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_VERSION}/geojson`;
export const SOURCES = {
  outlines: {
    file: "ne_110m_admin_0_countries.geojson",
    sha256: "6866c877d39cba9c357620878839b336d569f8c662d3cfab4cb1dbe2d39c977f",
  },
  points: {
    file: "ne_50m_admin_0_countries.geojson",
    sha256: "3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb",
  },
};
const RETRIEVED_AT = "2026-10-23T00:00:00Z";

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
 * Rings that jump between +180 and -180 render as lines across the whole map. Unwrap each
 * outer ring and split it at the antimeridian. (Natural Earth GeoJSON is already split; this
 * is a guard.) Returns an array of polygons (arrays of rings).
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

/** Natural Earth uses "-99" for "no code". */
export function isoOrNull(code) {
  return typeof code === "string" && /^[A-Z]{2}$|^\d{3}$/.test(code) ? code : null;
}

/**
 * Natural Earth 1:110m countries → sorted, rounded outlines with the crosswalk keys.
 * Antarctica is omitted: it is never displayed (Web Mercator) and its ring closes along the
 * ±180° edge, which would draw a line across the map.
 */
export function toCountryOutlines(ne) {
  const features = ne.features
    .filter((f) => f.geometry !== null && f.properties.ISO_A2_EH !== "AQ")
    .map((f) => {
      const p = f.properties;
      const geometry = fixAntimeridian(f.geometry);
      return {
        type: "Feature",
        properties: {
          name: p.NAME,
          name_long: p.NAME_LONG,
          iso_a2: isoOrNull(p.ISO_A2_EH),
          iso_n3: isoOrNull(p.ISO_N3_EH),
        },
        geometry: { type: geometry.type, coordinates: roundCoords(geometry.coordinates) },
      };
    })
    .sort((a, b) => a.properties.name.localeCompare(b.properties.name, "en"));
  return { type: "FeatureCollection", features };
}

/**
 * Natural Earth 1:50m label points, one per ISO alpha-2 code. Where two features share a code
 * (e.g. Australia and its external territories), the feature whose ADM0_A3 equals ISO_A3_EH wins,
 * then the most populous. `in110m` says whether the 1:110m outlines contain the code.
 */
export function toCountryPoints(ne50, outlineCodes) {
  const byCode = new Map();
  for (const f of ne50.features) {
    const p = f.properties;
    const iso = isoOrNull(p.ISO_A2_EH);
    if (!iso || typeof p.LABEL_X !== "number" || typeof p.LABEL_Y !== "number") continue;
    const candidate = {
      iso_a2: iso,
      name: p.NAME,
      name_long: p.NAME_LONG,
      lon: Number(p.LABEL_X.toFixed(POINT_DECIMALS)),
      lat: Number(p.LABEL_Y.toFixed(POINT_DECIMALS)),
      in110m: outlineCodes.has(iso),
      _primary: p.ADM0_A3 === p.ISO_A3_EH,
      _pop: typeof p.POP_EST === "number" ? p.POP_EST : 0,
    };
    const current = byCode.get(iso);
    const better =
      !current ||
      (candidate._primary && !current._primary) ||
      (candidate._primary === current._primary && candidate._pop > current._pop);
    if (better) byCode.set(iso, candidate);
  }
  return [...byCode.values()]
    .map(({ _primary, _pop, ...rest }) => rest)
    .sort((a, b) => a.iso_a2.localeCompare(b.iso_a2, "en"));
}

async function fetchPinned({ file, sha256 }) {
  const cached = path.join(cacheDir, `${NE_VERSION}-${file}`);
  let body;
  try {
    body = await readFile(cached);
  } catch {
    const res = await fetch(`${NE_BASE}/${file}`);
    if (!res.ok) throw new Error(`download failed (${res.status}) for ${file}`);
    body = Buffer.from(await res.arrayBuffer());
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cached, body);
  }
  const actual = createHash("sha256").update(body).digest("hex");
  if (actual !== sha256) throw new Error(`${file}: sha256 ${actual} does not match pinned ${sha256}`);
  return JSON.parse(body.toString("utf8"));
}

function provenanceFor({ id, title, relPath, body, featureCount, source, notes }) {
  return {
    id,
    title,
    role: "reference",
    path: relPath,
    format: relPath.endsWith(".geojson") ? "geojson" : "json",
    schemaId: null,
    sha256: createHash("sha256").update(body).digest("hex"),
    bytes: Buffer.byteLength(body),
    featureCount,
    sourceIds: ["S24"],
    referencePeriod: `Natural Earth ${NE_VERSION}`,
    coverage: "World",
    provenance: "measured",
    licence: "Public domain (Natural Earth)",
    attribution: "Made with Natural Earth",
    expectedCadence: "static",
    retrieval: {
      method: "download (pinned URL and SHA-256)",
      source: `${NE_BASE}/${source.file} (sha256 ${source.sha256})`,
      retrievedAt: RETRIEVED_AT,
      notes,
    },
  };
}

async function main() {
  const ne110 = await fetchPinned(SOURCES.outlines);
  const ne50 = await fetchPinned(SOURCES.points);

  const outlines = toCountryOutlines(ne110);
  const outlineCodes = new Set(outlines.features.map((f) => f.properties.iso_a2).filter(Boolean));
  const points = toCountryPoints(ne50, outlineCodes);

  const outlinesBody = JSON.stringify(outlines);
  const pointsBody = JSON.stringify({
    source: `Natural Earth ${NE_VERSION} Admin 0 countries 1:50m (LABEL_X, LABEL_Y)`,
    points,
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, "world-countries-110m.geojson"), outlinesBody, "utf8");
  await writeFile(path.join(outDir, "world-country-points.json"), pointsBody, "utf8");

  const sidecars = [
    [
      "world-countries-110m.provenance.json",
      provenanceFor({
        id: "reference.world_countries_110m",
        title: "World country outlines (Natural Earth 1:110m)",
        relPath: "reference/world-countries-110m.geojson",
        body: outlinesBody,
        featureCount: outlines.features.length,
        source: SOURCES.outlines,
        notes: `Properties NAME, NAME_LONG, ISO_A2_EH, ISO_N3_EH kept (-99 → null); Antarctica omitted; rings crossing the antimeridian split at ±180°; coordinates rounded to ${COORD_DECIMALS} dp; features sorted by name.`,
      }),
    ],
    [
      "world-country-points.provenance.json",
      provenanceFor({
        id: "reference.world_country_points",
        title: "Country label points (Natural Earth 1:50m)",
        relPath: "reference/world-country-points.json",
        body: pointsBody,
        featureCount: points.length,
        source: SOURCES.points,
        notes: `Natural Earth's own label point (LABEL_X, LABEL_Y) per ISO_A2_EH code, rounded to ${POINT_DECIMALS} dp. Used as the symbolic start of import connections and for partners too small for 1:110m. Not a port or production location.`,
      }),
    ],
  ];
  for (const [name, record] of sidecars) {
    await writeFile(path.join(outDir, name), JSON.stringify(record, null, 2) + "\n", "utf8");
  }
  console.log(
    `world-countries-110m.geojson: ${outlines.features.length} features (${outlineCodes.size} with ISO codes); ` +
      `world-country-points.json: ${points.length} points (${points.filter((p) => !p.in110m).length} not in 1:110m)`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
