/**
 * The report checksum (EX-02): SHA-256 of the report's canonical JSON (keys sorted), without the
 * link, which depends on the address the app is served from. The PDF footer and the screen show
 * the same value, so an exported report can be matched to the figures on screen.
 */
import type { AssessmentReport } from "./report";

/** JSON with object keys sorted at every level (arrays keep their order). */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function reportChecksum(report: AssessmentReport): Promise<string> {
  const content: Partial<AssessmentReport> = { ...report };
  delete content.link;
  return sha256Hex(canonicalJson(content));
}

/** The short form shown on screen and in the footer (the full value is in the PDF's appendix). */
export function shortChecksum(hex: string): string {
  return hex.slice(0, 12);
}
