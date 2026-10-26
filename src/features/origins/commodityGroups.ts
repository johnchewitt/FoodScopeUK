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

/**
 * Whether a commodity matches the search: a commodity code (digits, spaces and dots ignored) by
 * its HS scope, otherwise every word in its name, group or definition.
 */
export function matchesCommodity(c: CommodityEntry, groupLabel: string | null, query: string): boolean {
  const q = normaliseQuery(query);
  if (q === "") return true;
  const digits = q.replace(/[\s.]/g, "");
  if (/^\d{2,10}$/.test(digits)) return codeInScope(digits, c.hsScope);
  const haystack = normaliseQuery([c.label, groupLabel ?? "", c.definition, c.hsScope].join(" "));
  return q.split(" ").every((word) => haystack.includes(word));
}

/** The sections with only the matching commodities, empty sections dropped. */
export function filterSections(sections: CommoditySection[], query: string): CommoditySection[] {
  return sections
    .map((s) => ({ ...s, items: s.items.filter((c) => matchesCommodity(c, s.label, query)) }))
    .filter((s) => s.items.length > 0);
}
