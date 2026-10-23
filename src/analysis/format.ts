/**
 * Display formatting rules from spec §6.4 (P13 — honest precision).
 * Pure functions: no React, ArcGIS or DOM imports.
 */

const LOCALE = "en-GB";

function nf(maximumFractionDigits: number, minimumFractionDigits = 0): Intl.NumberFormat {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits, minimumFractionDigits });
}

function isFiniteNumber(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Tonnes: ≥ 1,000 t shown as kt to one decimal (nearest 100 t); below that, nearest tonne. */
export function formatTonnes(t: number | null | undefined): string {
  if (!isFiniteNumber(t)) return "—";
  const abs = Math.abs(t);
  if (abs >= 1_000_000) return `${nf(1, 1).format(t / 1_000_000)} Mt`;
  if (abs >= 1_000) return `${nf(1, 1).format(t / 1_000)} kt`;
  return `${nf(0).format(Math.round(t))} t`;
}

/** Pounds sterling: ≥ £1m to one decimal in millions (or billions); otherwise nearest £1,000. */
export function formatGbp(v: number | null | undefined): string {
  if (!isFiniteNumber(v)) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "−" : "";
  if (abs >= 1e9) return `${sign}£${nf(1, 1).format(abs / 1e9)}bn`;
  if (abs >= 1e6) return `${sign}£${nf(1, 1).format(abs / 1e6)}m`;
  if (abs === 0) return "£0";
  return `${sign}£${nf(0).format(Math.round(abs / 1000) * 1000)}`;
}

/**
 * Shares given as a fraction (0–1): one decimal place; positive values below 0.1 % show "< 0.1 %".
 */
export function formatShare(fraction: number | null | undefined): string {
  if (!isFiniteNumber(fraction)) return "—";
  const pct = fraction * 100;
  if (pct > 0 && pct < 0.05) return "< 0.1 %";
  return `${nf(1, 1).format(pct)} %`;
}

/** Percentage-point change, signed. */
export function formatPercentagePoints(pp: number | null | undefined): string {
  if (!isFiniteNumber(pp)) return "—";
  const rounded = Math.round(pp * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
  return `${sign}${nf(1, 1).format(Math.abs(rounded))} pp`;
}

/** Herfindahl–Hirschman Index (0–10,000), nearest 10. */
export function formatHhi(hhi: number | null | undefined): string {
  if (!isFiniteNumber(hhi)) return "—";
  return nf(0).format(Math.round(hhi / 10) * 10);
}

/** Straight-line distance in km to 0.1 km (labelled by callers as straight-line, P7). */
export function formatKm(km: number | null | undefined): string {
  if (!isFiniteNumber(km)) return "—";
  return `${nf(1, 1).format(km)} km`;
}

/** Population: nearest 10 for small areas, nearest 100 for local authorities. */
export function formatPopulation(n: number | null | undefined, scale: "small_area" | "authority"): string {
  if (!isFiniteNumber(n)) return "—";
  const step = scale === "authority" ? 100 : 10;
  return nf(0).format(Math.round(n / step) * step);
}

/** Plain integer counts. */
export function formatCount(n: number | null | undefined): string {
  if (!isFiniteNumber(n)) return "—";
  return nf(0).format(Math.round(n));
}

/** Formats a value according to its unit string (used by <Metric>). */
export function formatByUnit(value: number | string | null, unit: string): string {
  if (value === null) return "—";
  if (typeof value === "string") return value;
  switch (unit) {
    case "t":
      return formatTonnes(value);
    case "GBP":
      return formatGbp(value);
    case "share":
      return formatShare(value);
    case "pp":
      return formatPercentagePoints(value);
    case "HHI":
      return formatHhi(value);
    case "km (straight-line)":
      return formatKm(value);
    default:
      return formatCount(value);
  }
}

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;
export const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
