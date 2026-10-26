import type { TradeIndex } from "@/types/generated/trade-index";

/**
 * Grouping and search for the commodity picker (FO-01, B11). Pure functions over the trade index:
 * the groups and their order come from the snapshot (SITC divisions as Defra uses them); a snapshot
 * without groups (before 26 Oct 2026) shows one unnamed list.
 */
export type CommodityEntry = TradeIndex["commodities"][number];

export interface CommoditySection {
  /** Group id, or null for an index without groups. */
  id: string | null;
  label: string | null;
  items: CommodityEntry[];
}

export function commoditySections(index: TradeIndex): CommoditySection[] {
  const groups = index.groups ?? [];
  if (groups.length === 0) return [{ id: null, label: null, items: index.commodities }];
  const known = new Set(groups.map((g) => g.id));
  const sections: CommoditySection[] = groups.map((g) => ({
    id: g.id,
    label: g.label,
    items: index.commodities.filter((c) => c.group === g.id),
  }));
  const rest = index.commodities.filter((c) => !c.group || !known.has(c.group));
  if (rest.length > 0) sections.push({ id: "other", label: "Other", items: rest });
  return sections.filter((s) => s.items.length > 0);
}

export function normaliseQuery(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** "HS 1801, 1803–1805" → [["1801","1801"], ["1803","1805"]]; "HS 0808 10" → [["080810","080810"]]. */
export function hsRanges(hsScope: string): Array<[string, string]> {
  return hsScope
    .replace(/^HS\s*/i, "")
    .split(",")
    .map((part) => part.replace(/\s+/g, ""))
    .filter((part) => part.length > 0)
    .map((part) => {
      const [a, b] = part.split(/[–-]/);
      return [a!, b ?? a!] as [string, string];
    });
}

/** Does a code typed by the user (2 to 10 digits) fall under one of the scope's headings? */
export function codeInScope(code: string, hsScope: string): boolean {
  return hsRanges(hsScope).some(([lo, hi]) => {
    const n = lo.length;
    if (code.length >= n) {
      const head = code.slice(0, n);
      return head >= lo && head <= hi; // same length, digits only: string order is numeric order
    }
    // A shorter code (e.g. a chapter, "04") matches headings that start with it.
    return lo.slice(0, code.length) <= code && code <= hi.slice(0, code.length);
  });
}

/** What a basket includes: its definition up to "Excludes …", so a search never finds what it leaves out. */
export function includedText(definition: string): string {
  const i = definition.search(/\bExcludes\b/);
  return i < 0 ? definition : definition.slice(0, i);
}

/** A label without its "(not …)" qualifier: "Milk products (not cheese)" → "Milk products". */
function labelText(label: string): string {
  return label.replace(/\(\s*not\b[^)]*\)/gi, " ");
}

/** The digits of a code search ("0403", "HS 0403", "0402.10"), or null when the query is not a code. */
function codeQuery(q: string): string | null {
  const digits = q.replace(/^hs\s*/, "").replace(/[\s.]/g, "");
  return /^\d{2,10}$/.test(digits) ? digits : null;
}

/**
 * How well a commodity matches the search: 0 its name starts with the query, 1 every word is in its
 * name, 2 every word is in its name, group or what it includes, 3 a code under its HS scope; null
 * when it does not match. Words after "Excludes" in a definition and "(not …)" in a name never match.
 */
export function matchRank(c: CommodityEntry, groupLabel: string | null, query: string): number | null {
  const q = normaliseQuery(query);
  if (q === "") return 2;
  const code = codeQuery(q);
  if (code) return codeInScope(code, c.hsScope) ? 3 : null;
  const words = q.split(" ");
  const name = normaliseQuery(labelText(c.label));
  if (name.startsWith(q)) return 0;
  if (words.every((w) => name.includes(w))) return 1;
  const haystack = normaliseQuery(
    [labelText(c.label), groupLabel ?? "", includedText(c.definition)].join(" "),
  );
  return words.every((w) => haystack.includes(w)) ? 2 : null;
}

/** Whether a commodity matches the search (by name, group, what it includes or commodity code). */
export function matchesCommodity(c: CommodityEntry, groupLabel: string | null, query: string): boolean {
  return matchRank(c, groupLabel, query) !== null;
}

/** The best match for Enter: the lowest rank, then the order shown; null for an empty query or no match. */
export function bestMatch(sections: CommoditySection[], query: string): string | null {
  if (normaliseQuery(query) === "") return null;
  let best: { id: string; rank: number } | null = null;
  for (const s of sections)
    for (const c of s.items) {
      const rank = matchRank(c, s.label, query);
      if (rank !== null && (best === null || rank < best.rank)) best = { id: c.id, rank };
    }
  return best?.id ?? null;
}

/** The sections with only the matching commodities, empty sections dropped. */
export function filterSections(sections: CommoditySection[], query: string): CommoditySection[] {
  return sections
    .map((s) => ({ ...s, items: s.items.filter((c) => matchesCommodity(c, s.label, query)) }))
    .filter((s) => s.items.length > 0);
}
