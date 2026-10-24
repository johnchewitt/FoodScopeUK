/**
 * National grids for straight-line distances (spec glossary: "Euclidean distance in a projected
 * CRS"; CLAUDE.md: EPSG:27700 for Great Britain, EPSG:2157 for Northern Ireland).
 *
 * - **British National Grid (EPSG:27700):** WGS84 → OSGB36 by the 7-parameter Helmert
 *   transformation EPSG:1314 ("OSGB36 to WGS 84 (6)", inverted), then Transverse Mercator on the
 *   Airy 1830 ellipsoid. This is the transformation PROJ uses when the OSTN15 grid is not
 *   installed. It is the one the pipeline (pyproj) and GEOLYTIX used: delivered grid references
 *   match it to 0.00 m (data-step report). Accuracy against OSTN15 is a few metres.
 * - **Irish Transverse Mercator (EPSG:2157):** Transverse Mercator on GRS80, with WGS84 taken as
 *   ETRS89/IRENET95 (no shift), as PROJ does.
 *
 * Transverse Mercator uses Krüger's series to the sixth order in n (Karney 2011), accurate to well
 * under a millimetre within a few thousand kilometres of the central meridian.
 * Pure functions: no React, ArcGIS or DOM imports. Tested against pyproj 3.8 / PROJ 9.8 values.
 */

export type GridCrs = "EPSG:27700" | "EPSG:2157";

interface Ellipsoid {
  a: number;
  f: number;
}

interface TmParams {
  ellipsoid: Ellipsoid;
  lat0: number;
  lon0: number;
  k0: number;
  falseEasting: number;
  falseNorthing: number;
}

const WGS84: Ellipsoid = { a: 6378137, f: 1 / 298.257223563 };
const AIRY_1830: Ellipsoid = { a: 6377563.396, f: 1 / 299.3249646 };
const GRS80: Ellipsoid = { a: 6378137, f: 1 / 298.257222101 };

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;

/** EPSG:1314 parameters (OSGB36 → WGS84, position-vector convention): metres, arc-seconds, ppm. */
const OSGB36_TO_WGS84 = {
  tx: 446.448,
  ty: -125.157,
  tz: 542.06,
  rx: 0.15 * ARCSEC,
  ry: 0.247 * ARCSEC,
  rz: 0.842 * ARCSEC,
  s: -20.489e-6,
};

const BNG: TmParams = {
  ellipsoid: AIRY_1830,
  lat0: 49 * DEG,
  lon0: -2 * DEG,
  k0: 0.9996012717,
  falseEasting: 400000,
  falseNorthing: -100000,
};

const ITM: TmParams = {
  ellipsoid: GRS80,
  lat0: 53.5 * DEG,
  lon0: -8 * DEG,
  k0: 0.99982,
  falseEasting: 600000,
  falseNorthing: 750000,
};

// ---------------------------------------------------------------------------------------------
// Transverse Mercator (Krüger series)

interface TmSeries {
  n: number;
  e: number;
  A: number;
  alpha: number[];
  beta: number[];
}

function series(ell: Ellipsoid): TmSeries {
  const n = ell.f / (2 - ell.f);
  const n2 = n * n;
  const n3 = n2 * n;
  const n4 = n3 * n;
  const n5 = n4 * n;
  const n6 = n5 * n;
  const A = (ell.a / (1 + n)) * (1 + n2 / 4 + n4 / 64 + n6 / 256);
  const alpha = [
    n / 2 - (2 / 3) * n2 + (5 / 16) * n3 + (41 / 180) * n4 - (127 / 288) * n5 + (7891 / 37800) * n6,
    (13 / 48) * n2 - (3 / 5) * n3 + (557 / 1440) * n4 + (281 / 630) * n5 - (1983433 / 1935360) * n6,
    (61 / 240) * n3 - (103 / 140) * n4 + (15061 / 26880) * n5 + (167603 / 181440) * n6,
    (49561 / 161280) * n4 - (179 / 168) * n5 + (6601661 / 7257600) * n6,
    (34729 / 80640) * n5 - (3418889 / 1995840) * n6,
    (212378941 / 319334400) * n6,
  ];
  const beta = [
    n / 2 - (2 / 3) * n2 + (37 / 96) * n3 - (1 / 360) * n4 - (81 / 512) * n5 + (96199 / 604800) * n6,
    (1 / 48) * n2 + (1 / 15) * n3 - (437 / 1440) * n4 + (46 / 105) * n5 - (1118711 / 3870720) * n6,
    (17 / 480) * n3 - (37 / 840) * n4 - (209 / 4480) * n5 + (5569 / 90720) * n6,
    (4397 / 161280) * n4 - (11 / 504) * n5 - (830251 / 7257600) * n6,
    (4583 / 161280) * n5 - (108847 / 3991680) * n6,
    (20648693 / 638668800) * n6,
  ];
  const e = Math.sqrt(ell.f * (2 - ell.f));
  return { n, e, A, alpha, beta };
}

const SERIES = new Map<Ellipsoid, TmSeries>();
function seriesFor(ell: Ellipsoid): TmSeries {
  let s = SERIES.get(ell);
  if (!s) {
    s = series(ell);
    SERIES.set(ell, s);
  }
  return s;
}

/** ξ, η (dimensionless) for a latitude and a longitude difference from the central meridian. */
function tmXiEta(s: TmSeries, lat: number, dLon: number): [number, number] {
  const t = Math.sinh(Math.atanh(Math.sin(lat)) - s.e * Math.atanh(s.e * Math.sin(lat)));
  const xiP = Math.atan2(t, Math.cos(dLon));
  const etaP = Math.atanh(Math.sin(dLon) / Math.sqrt(1 + t * t));
  let xi = xiP;
  let eta = etaP;
  for (let j = 1; j <= 6; j++) {
    const a = s.alpha[j - 1]!;
    xi += a * Math.sin(2 * j * xiP) * Math.cosh(2 * j * etaP);
    eta += a * Math.cos(2 * j * xiP) * Math.sinh(2 * j * etaP);
  }
  return [xi, eta];
}

function tmForward(p: TmParams, lat: number, lon: number): [number, number] {
  const s = seriesFor(p.ellipsoid);
  const [xi, eta] = tmXiEta(s, lat, lon - p.lon0);
  const [xi0] = tmXiEta(s, p.lat0, 0);
  return [p.falseEasting + p.k0 * s.A * eta, p.falseNorthing + p.k0 * s.A * (xi - xi0)];
}

function tmInverse(p: TmParams, x: number, y: number): [number, number] {
  const s = seriesFor(p.ellipsoid);
  const [xi0] = tmXiEta(s, p.lat0, 0);
  const xi = (y - p.falseNorthing) / (p.k0 * s.A) + xi0;
  const eta = (x - p.falseEasting) / (p.k0 * s.A);
  let xiP = xi;
  let etaP = eta;
  for (let j = 1; j <= 6; j++) {
    const b = s.beta[j - 1]!;
    xiP -= b * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaP -= b * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP)); // conformal latitude
  const lon = p.lon0 + Math.atan2(Math.sinh(etaP), Math.cos(xiP));
  // Geodetic latitude from conformal latitude (fixed-point iteration; converges in a few steps).
  let lat = chi;
  for (let i = 0; i < 12; i++) {
    const es = s.e * Math.sin(lat);
    const next =
      2 * Math.atan(Math.tan(Math.PI / 4 + chi / 2) * Math.pow((1 + es) / (1 - es), s.e / 2)) - Math.PI / 2;
    if (Math.abs(next - lat) < 1e-14) {
      lat = next;
      break;
    }
    lat = next;
  }
  return [lat, lon];
}

// ---------------------------------------------------------------------------------------------
// Datum shift (Helmert, position vector)

function toCartesian(ell: Ellipsoid, lat: number, lon: number): [number, number, number] {
  const e2 = ell.f * (2 - ell.f);
  const nu = ell.a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  return [
    nu * Math.cos(lat) * Math.cos(lon),
    nu * Math.cos(lat) * Math.sin(lon),
    nu * (1 - e2) * Math.sin(lat),
  ];
}

function toGeodetic(ell: Ellipsoid, x: number, y: number, z: number): [number, number] {
  const e2 = ell.f * (2 - ell.f);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - e2));
  for (let i = 0; i < 10; i++) {
    const nu = ell.a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    const next = Math.atan2(z + e2 * nu * Math.sin(lat), p);
    if (Math.abs(next - lat) < 1e-14) {
      lat = next;
      break;
    }
    lat = next;
  }
  return [lat, Math.atan2(y, x)];
}

/** OSGB36 cartesian → WGS84 cartesian (forward Helmert, small-angle rotation matrix). */
function helmertForward(x: number, y: number, z: number): [number, number, number] {
  const { tx, ty, tz, rx, ry, rz, s } = OSGB36_TO_WGS84;
  const k = 1 + s;
  return [tx + k * (x - rz * y + ry * z), ty + k * (rz * x + y - rx * z), tz + k * (-ry * x + rx * y + z)];
}

/** WGS84 cartesian → OSGB36 cartesian (inverse Helmert: transposed rotation, inverse scale). */
function helmertInverse(x: number, y: number, z: number): [number, number, number] {
  const { tx, ty, tz, rx, ry, rz, s } = OSGB36_TO_WGS84;
  const k = 1 / (1 + s);
  const dx = x - tx;
  const dy = y - ty;
  const dz = z - tz;
  return [k * (dx + rz * dy - ry * dz), k * (-rz * dx + dy + rx * dz), k * (ry * dx - rx * dy + dz)];
}

// ---------------------------------------------------------------------------------------------
// Public API

/** Projects a WGS84 longitude/latitude (degrees) to grid easting/northing in metres. */
export function toGrid(lon: number, lat: number, crs: GridCrs): [number, number] {
  if (crs === "EPSG:2157") return tmForward(ITM, lat * DEG, lon * DEG);
  const [x, y, z] = helmertInverse(...toCartesian(WGS84, lat * DEG, lon * DEG));
  const [phi, lam] = toGeodetic(AIRY_1830, x, y, z);
  return tmForward(BNG, phi, lam);
}

/** Grid easting/northing in metres back to WGS84 longitude/latitude (degrees). */
export function fromGrid(easting: number, northing: number, crs: GridCrs): [number, number] {
  if (crs === "EPSG:2157") {
    const [lat, lon] = tmInverse(ITM, easting, northing);
    return [lon / DEG, lat / DEG];
  }
  const [phi, lam] = tmInverse(BNG, easting, northing);
  const [x, y, z] = helmertForward(...toCartesian(AIRY_1830, phi, lam));
  const [lat, lon] = toGeodetic(WGS84, x, y, z);
  return [lon / DEG, lat / DEG];
}

/** Straight-line (grid) distance in metres between two grid points in the same CRS. */
export function gridDistance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * A polygon ring (WGS84) approximating a circle of `radiusM` metres drawn in the grid, so the
 * outline on the map matches the straight-line distances used for counts.
 */
export function gridCircle(
  centreLon: number,
  centreLat: number,
  radiusM: number,
  crs: GridCrs,
  segments = 96,
): [number, number][] {
  const [cx, cy] = toGrid(centreLon, centreLat, crs);
  const ring: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (2 * Math.PI * (i % segments)) / segments;
    ring.push(fromGrid(cx + radiusM * Math.cos(a), cy + radiusM * Math.sin(a), crs));
  }
  return ring;
}
