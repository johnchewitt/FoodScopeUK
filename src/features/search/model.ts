/**
 * Global search (Stage 8 UX review): councils, commodities and modules from one box in the top
 * bar. Pure: ranks what the data index already lists; nothing is fetched beyond the council list
 * and the trade index the modules use.
 */
import { MODULES, type ModuleId } from "@/app/modules";
import { searchCouncils } from "@/analysis/profile";
import { matchRank, type CommodityEntry } from "@/features/origins/commodityGroups";

export interface CouncilHit {
  kind: "council";
  code: string;
  name: string;
  nation: string;
}
export interface CommodityHit {
  kind: "commodity";
  id: string;
  label: string;
  hsScope: string;
  group: string | null;
}
export interface ModuleHit {
  kind: "module";
  id: ModuleId;
  label: string;
  question: string;
}
export type SearchHit = CouncilHit | CommodityHit | ModuleHit;

function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function searchAll(
  query: string,
  councils: readonly { code: string; name: string; nation: string }[],
  commodities: readonly CommodityEntry[],
  groupLabel: (id: string | undefined) => string | null,
): { councils: CouncilHit[]; commodities: CommodityHit[]; modules: ModuleHit[] } {
  const q = fold(query);
  if (q.length === 0) return { councils: [], commodities: [], modules: [] };
  const councilHits = searchCouncils(councils, query, 8).map((c) => ({
    kind: "council" as const,
    code: c.code,
    name: c.name,
    nation: c.nation,
  }));
  const commodityHits = commodities
    .map((c) => ({ c, rank: matchRank(c, groupLabel(c.group), query) }))
    .filter((x): x is { c: CommodityEntry; rank: number } => x.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.c.label.localeCompare(b.c.label))
    .slice(0, 6)
    .map(({ c }) => ({
      kind: "commodity" as const,
      id: c.id,
      label: c.label,
      hsScope: c.hsScope,
      group: groupLabel(c.group),
    }));
  const moduleHits = MODULES.filter((m) => fold(`${m.label} ${m.railLabel} ${m.question}`).includes(q)).map(
    (m) => ({ kind: "module" as const, id: m.id, label: m.label, question: m.question }),
  );
  return { councils: councilHits, commodities: commodityHits, modules: moduleHits };
}
