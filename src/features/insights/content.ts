/**
 * ConsultingWhere Insights content (CI-01, CI-04): the nine services of John's Stage 8 brief and
 * the generic "About ConsultingWhere" text, held as structured content (`src/content/consulting.json`,
 * schema `consulting-content`). Generic capability descriptions only (P14, CI-05).
 */
import raw from "@/content/consulting.json";
import type { ConsultingContent } from "@/types/generated/consulting-content";

export const CONSULTING = raw as ConsultingContent;
export type Service = ConsultingContent["services"][number];

export const SERVICES: readonly Service[] = CONSULTING.services;

export function serviceById(id: string): Service {
  const s = SERVICES.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown service: ${id}`);
  return s;
}

/**
 * Words that would turn a capability description into a claim (P14, CI-05): client names,
 * credentials, track record, budgets or procurement by an organisation. Checked by tests on the
 * content, the rules and every generated report.
 */
export const CLAIM_PATTERNS: readonly RegExp[] = [
  /\bour clients?\b/i,
  /\bclients? (include|such as)\b/i,
  /\bfor (?:a|the) client\b/i,
  /\baccredit/i,
  /\bcertified\b/i,
  /\baward[- ]winning\b/i,
  /\btrack record\b/i,
  /\byears of experience\b/i,
  /\bwe (?:have )?delivered\b/i,
  /\btrusted by\b/i,
  /\bhas (?:a|an) (?:requirement|budget)\b/i,
  /\b(?:requirement|budget|tender|procurement) (?:for|to) (?:this|these)\b/i,
  /\bwill procure\b/i,
  /\bday rates?\b|\bour fees?\b/i,
];

/** A sentence that denies a claim ("not a statement that X has a budget") is not a claim. */
const NEGATION = /\b(?:not|no|never|nor|without)\b/i;

/** Returns the claim-like phrases found in a text, sentence by sentence (empty: none). */
export function claimProblems(text: string): string[] {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  const out: string[] = [];
  for (const s of sentences) {
    if (NEGATION.test(s)) continue;
    for (const p of CLAIM_PATTERNS) if (p.test(s)) out.push(`${p} in "${s.slice(0, 120)}"`);
  }
  return out;
}
