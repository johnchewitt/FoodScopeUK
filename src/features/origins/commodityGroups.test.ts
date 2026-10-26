import { describe, expect, it } from "vitest";
import type { TradeIndex } from "@/types/generated/trade-index";
import {
  codeInScope,
  commoditySections,
  filterSections,
  hsRanges,
  matchesCommodity,
  normaliseQuery,
} from "./commodityGroups";

// Synthetic index: names and scopes are made up except where a scope's format is the point.
function entry(
  id: string,
  label: string,
  hsScope: string,
  group?: string,
  definition = `Definition of ${label}`,
) {
  return {
    id,
    datasetId: `trade.${id}`,
    ...(group ? { group } : {}),
    label,
    definition,
    hsScope,
    path: `x/${id}.json`,
    months: { first: "2019-01", last: "2026-08", provisionalFrom: null },
  };
}

const GROUPED: TradeIndex = {
  schemaVersion: 1,
  snapshotId: "2026-10-26",
  groups: [
    { id: "g1", label: "Group one" },
    { id: "g2", label: "Dairy" },
    { id: "empty", label: "No members" },
  ],
  commodities: [
    entry("a", "Item A", "HS 0702", "g1"),
    entry(
      "milk",
      "Milk products (not cheese)",
      "HS 0401–0405",
      "g2",
      "Milk, cream and butter. Excludes cheese.",
    ),
    entry("cocoa", "Cocoa", "HS 1801, 1803–1805", "g1", "Cocoa beans. Excludes chocolate (1806)."),
    entry("apples", "Apples", "HS 0808 10", "g1"),
    entry("stray", "Stray", "HS 9901"),
  ],
};

describe("commoditySections", () => {
  it("follows the index's group order, drops empty groups and gathers ungrouped items last", () => {
    const s = commoditySections(GROUPED);
    expect(s.map((x) => x.id)).toEqual(["g1", "g2", "other"]);
    expect(s[0]!.items.map((c) => c.id)).toEqual(["a", "cocoa", "apples"]);
    expect(s[2]).toMatchObject({ label: "Other", items: [expect.objectContaining({ id: "stray" })] });
  });

  it("gives one unnamed section for an index without groups (snapshots before 26 Oct 2026)", () => {
    const old: TradeIndex = { schemaVersion: 1, snapshotId: "2026-10-23", commodities: GROUPED.commodities };
    expect(commoditySections(old)).toEqual([{ id: null, label: null, items: GROUPED.commodities }]);
  });
});

describe("HS scope search", () => {
  it("parses single headings, sub-headings, lists and ranges", () => {
    expect(hsRanges("HS 0702")).toEqual([["0702", "0702"]]);
    expect(hsRanges("HS 0808 10")).toEqual([["080810", "080810"]]);
    expect(hsRanges("HS 1801, 1803–1805")).toEqual([
      ["1801", "1801"],
      ["1803", "1805"],
    ]);
    expect(hsRanges("HS 0201, 0202")).toEqual([
      ["0201", "0201"],
      ["0202", "0202"],
    ]);
  });

  it("matches CN8 codes, headings inside ranges and chapters, not neighbours", () => {
    expect(codeInScope("0403", "HS 0401–0405")).toBe(true);
    expect(codeInScope("04039099", "HS 0401–0405")).toBe(true);
    expect(codeInScope("0406", "HS 0401–0405")).toBe(false);
    expect(codeInScope("04", "HS 0401–0405")).toBe(true);
    expect(codeInScope("1802", "HS 1801, 1803–1805")).toBe(false);
    expect(codeInScope("1804", "HS 1801, 1803–1805")).toBe(true);
    expect(codeInScope("08081010", "HS 0808 10")).toBe(true);
    expect(codeInScope("0808", "HS 0808 10")).toBe(true);
    expect(codeInScope("080830", "HS 0808 10")).toBe(false);
  });
});

describe("matchesCommodity", () => {
  const milk = GROUPED.commodities[1]!;
  it("matches every word of the name, group or definition, ignoring case and accents", () => {
    expect(matchesCommodity(milk, "Dairy", "")).toBe(true);
    expect(matchesCommodity(milk, "Dairy", "  MILK ")).toBe(true);
    expect(matchesCommodity(milk, "Dairy", "dairy butter")).toBe(true);
    expect(matchesCommodity(milk, "Dairy", "dairy coffee")).toBe(false);
    expect(matchesCommodity(milk, "Dairy", "crème")).toBe(false);
    expect(matchesCommodity({ ...milk, definition: "Crème fraîche" }, "Dairy", "creme")).toBe(true);
  });

  it("treats digits (with spaces or dots) as a commodity code", () => {
    expect(matchesCommodity(milk, "Dairy", "04 03")).toBe(true);
    expect(matchesCommodity(milk, "Dairy", "0406")).toBe(false);
    expect(matchesCommodity(milk, "Dairy", "0402.10")).toBe(true);
  });

  it("normalises queries", () => {
    expect(normaliseQuery("  Sheep  and Goat ")).toBe("sheep and goat");
  });
});

describe("filterSections", () => {
  it("keeps only matching items and drops sections left empty", () => {
    const s = filterSections(commoditySections(GROUPED), "chocolate");
    expect(s.map((x) => x.items.map((c) => c.id))).toEqual([["cocoa"]]);
    expect(filterSections(commoditySections(GROUPED), "zzz")).toEqual([]);
  });
});
