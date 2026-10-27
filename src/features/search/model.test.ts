import { describe, expect, it } from "vitest";
import { readRepoJson } from "@/test/files";
import type { CouncilIndicators } from "@/types/generated/lad-indicators";
import type { TradeIndex } from "@/types/generated/trade-index";
import { searchAll } from "./model";

const councils = readRepoJson<CouncilIndicators>(
  "public/data/snapshots/2026-10-24/local/lad-indicators.json",
).councils;
const index = readRepoJson<TradeIndex>("public/data/snapshots/2026-10-26/trade/index.json");
const groups = new Map((index.groups ?? []).map((g) => [g.id, g.label]));
const run = (q: string) =>
  searchAll(q, councils, index.commodities, (id) => (id ? (groups.get(id) ?? null) : null));

describe("global search (Stage 8 UX review)", () => {
  it("finds councils by name and code, commodities by name and HS code, and modules", () => {
    expect(run("belf").councils.map((c) => c.code)).toEqual(["N09000003"]);
    expect(run("E08000003").councils[0]?.name).toBe("Manchester");
    expect(run("coffee").commodities[0]?.id).toBe("coffee");
    expect(run("0702").commodities[0]?.id).toBe("tomatoes");
    expect(run("scenario").modules.map((m) => m.id)).toContain("scenarios");
    expect(run("evidence to action").modules.map((m) => m.id)).toEqual(["insights"]);
  });

  it("returns nothing for an empty query and copes with accents", () => {
    expect(run("  ")).toEqual({ councils: [], commodities: [], modules: [] });
    expect(run("Mánchester").councils[0]?.code).toBe("E08000003");
  });
});
