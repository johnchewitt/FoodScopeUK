import { describe, expect, it } from "vitest";
import bananasJson from "../../../public/data/snapshots/2026-10-23/trade/bananas.json";
import potatoesJson from "../../../public/data/snapshots/2026-10-23/trade/potatoes.json";
import tomatoesJson from "../../../public/data/snapshots/2026-10-23/trade/tomatoes.json";
import wheatJson from "../../../public/data/snapshots/2026-10-23/trade/wheat.json";
import { buildOriginsModel } from "@/features/origins/model";
import type { TradeSnapshot } from "@/types/generated/trade-snapshot";
import { buildSeasonalModel, likeForLikeText, monthRunsText, type SeasonalSelection } from "./model";

const tomatoes = tomatoesJson as unknown as TradeSnapshot;
const bananas = bananasJson as unknown as TradeSnapshot;
const potatoes = potatoesJson as unknown as TradeSnapshot;
const wheat = wheatJson as unknown as TradeSnapshot;
const UK: [number, number] = [-2.1, 53.3];

const base: SeasonalSelection = {
  year: 2025,
  month: 7,
  compareYear: null,
  compareMonth: null,
  measure: "mass",
  partner: null,
  flowCount: 12,
  heatmap: "share",
};
const build = (sel: Partial<SeasonalSelection> = {}, snap = tomatoes) =>
  buildSeasonalModel(snap, { ...base, ...sel }, UK);

// Expected values computed independently from the committed snapshot in Python.
describe("Seasonal model: real HMRC snapshot 2026-10-23", () => {
  it("SS-08: tomatoes January vs July 2025", () => {
    const m = build({ month: 1, compareMonth: 7 });
    const c = m.monthComparison!;
    expect(c.title).toBe("Jan vs Jul 2025");
    expect(c.a.total).toBeCloseTo(33_060.038, 6);
    expect(c.b.total).toBeCloseTo(33_168.836, 6);
    expect(c.a.top).toMatchObject({ key: "MA" });
    expect(c.a.top!.share).toBeCloseTo(0.4252, 4);
    expect(c.b.top).toMatchObject({ key: "NL" });
    expect(c.b.top!.share).toBeCloseTo(0.6381, 4);
    expect(c.a.partners).toBe(16);
    expect(c.b.partners).toBe(14);
    expect(c.a.hhi).toBeCloseTo(2736.08, 1);
    expect(c.b.hhi).toBeCloseTo(4684.38, 1);
    expect(c.partners[0]).toMatchObject({ key: "NL" });
    expect(c.partners.find((p) => p.key === "MA")!.a).toBeCloseTo(0.4252, 4);
  });

  it("P11: the change card is marked when the same-month comparison crosses a series break", () => {
    const jan22 = build({ year: 2022, month: 1 });
    expect(jan22.kpis.changeLabel).toBe("Change vs Jan 2021");
    expect(jan22.kpis.changeCaution).toContain("series break in Jan 2022");
    expect(jan22.kpis.changeDetail).toMatch(/ · series break$/);
    const jul25 = build();
    expect(jul25.kpis.changeCaution).toBeNull();
    expect(jul25.kpis.changeDetail).not.toMatch(/series break/);
    // 2023 compared with 2020 crosses both breaks.
    const mar23 = build({ year: 2023, month: 3, compareYear: 2020 });
    expect(mar23.kpis.changeCaution).toContain("series breaks in Jan 2021");
  });

  it("value comparisons carry the current-prices note; net mass does not", () => {
    expect(build({ measure: "value" }).notices.map((n) => n.id)).toContain("current-prices");
    expect(build({ measure: "value" }).kpis.change.method).toMatch(/not adjusted for inflation/);
    expect(build().notices.map((n) => n.id)).not.toContain("current-prices");
  });

  it("KPIs for July 2025 are provenance-complete and match the month", () => {
    const m = build();
    expect(m.available).toBe(true);
    expect(m.kpis.imports).toMatchObject({ provenance: "measured", referencePeriod: "Jul 2025", unit: "t" });
    expect(m.kpis.imports.value).toBeCloseTo(33_168.836, 6);
    expect(m.kpis.importsDetail).toContain("8.5 % of the 2025 total");
    expect(m.kpis.change.value).toBeCloseTo(0.02153, 5);
    expect(m.kpis.changeLabel).toBe("Change vs Jul 2024");
    expect(m.kpis.top.value).toBeCloseTo(0.6381, 4);
    expect(m.kpis.topDetail).toMatch(/^Netherlands · top 3: /);
    expect(m.kpis.hhi.value).toBeCloseTo(4684.38, 1);
    for (const k of [m.kpis.imports, m.kpis.change, m.kpis.top, m.kpis.hhi])
      expect(k.sourceIds).toEqual(["S01"]);
  });

  it("the month is exactly the Food Origins single month (same records, same shares)", () => {
    const m = build();
    const origins = buildOriginsModel(
      tomatoes,
      { period: "month", year: 2025, month: 7, measure: "mass", partner: null, flowCount: 12 },
      UK,
    );
    expect(m.current!.shares).toEqual(origins.shares);
    expect(m.current!.current).toEqual(origins.current);
    expect(m.map.partners.map((p) => [p.key, p.share, p.shareClass])).toEqual(
      origins.map.partners.map((p) => [p.key, p.share, p.shareClass]),
    );
  });

  it("connection widths use one fixed scale for every month and year (SS-02)", () => {
    const jul = build();
    expect(jul.flowScale).toMatchObject({ key: "NL", month: "2026-07" });
    const nl = jul.map.partners.find((p) => p.key === "NL")!;
    expect(nl.flowWidth).toBeCloseTo(10.4583, 3); // 1.5 + 10.5 × 21,163.862 t ÷ 24,806.216 t
    // Same partner, another month: the width follows its tonnage on the same scale.
    const jan = build({ month: 1 });
    const ma = jan.map.partners.find((p) => p.key === "MA")!;
    expect(ma.flowWidth).toBeCloseTo(1.5 + (10.5 * 14_056.585) / 24_806.216, 3);
  });

  it("heatmap: top 10 partners of the year plus everyone else, shares and change vs the comparison year", () => {
    const m = build({ month: 1 });
    expect(m.heatmap.rows.map((r) => r.key)).toEqual([
      "NL",
      "MA",
      "ES",
      "BE",
      "DE",
      "FR",
      "IT",
      "PL",
      "TR",
      "IE",
      "__others",
    ]);
    expect(m.heatmap.othersCount).toBe(10);
    expect(m.heatmap.rankedOn).toBe("ranked by 2025 total");
    const ma = m.heatmap.rows.find((r) => r.key === "MA")!;
    expect(ma.values[0]).toBeCloseTo(14_056.585, 6);
    expect(ma.shares[0]).toBeCloseTo(0.42518, 5);
    expect(ma.changePp[0]).toBeCloseTo(-2.2672, 4);
    expect(m.heatmap.rows.at(-1)!.values[0]).toBeCloseTo(103.552, 6);
  });

  it("a selected partner outside the top 10 gets its own row; a non-partner gets none", () => {
    // Egypt is the 11th tomato partner of 2025 (351.9 t).
    const withEgypt = build({ partner: "EG" }).heatmap;
    const eg = withEgypt.rows.find((r) => r.key === "EG")!;
    expect(eg.kind).toBe("selected");
    expect(eg.annual).toBeCloseTo(351.906, 6);
    // Egypt then leaves "All other partners", so nothing is counted twice.
    expect(withEgypt.othersCount).toBe(9);
    expect(withEgypt.rows.at(-1)!.annual + eg.annual).toBeCloseTo(build().heatmap.rows.at(-1)!.annual, 6);
    // Austria recorded no tomato imports in 2025: no row is invented.
    expect(build({ partner: "AT" }).heatmap.rows.some((r) => r.key === "AT")).toBe(false);
  });

  it("timeline bars share one scale across years (largest monthly total, Apr 2019)", () => {
    expect(build().barScaleMax).toBeCloseTo(43_528.283, 3);
    expect(build({ year: 2020 }).barScaleMax).toBe(build().barScaleMax);
  });

  it("commodity-code change in Jan 2025 is explained, with totals continuous", () => {
    const m = build();
    const n = m.notices.find((x) => x.id === "codes-2025-01")!;
    expect(n.text).toContain("07020000 has no records after Dec 2024");
    expect(n.text).toContain("07020010, 07020091, 07020099 are recorded from Jan 2025");
    expect(n.text).toContain("totals are continuous");
  });
});

describe("Seasonal model: missing, partial and comparison handling", () => {
  it("an unpublished month (Sep 2026) has no figures, an empty map and says why", () => {
    const m = build({ year: 2026, month: 9 });
    expect(m.available).toBe(false);
    expect(m.monthInfo.state).toBe("not_yet_published");
    expect(m.monthUnavailableText).toBe("Sep 2026 is not yet published by HMRC (latest: Aug 2026)");
    expect(m.current).toBeNull();
    expect(m.map.partners).toEqual([]);
    for (const k of [m.kpis.imports, m.kpis.change, m.kpis.top, m.kpis.hhi]) {
      expect(k.value).toBeNull();
      expect(k.missingReason).toBe("not_published");
    }
    expect(m.totals.slice(8)).toEqual([null, null, null, null]);
  });

  it("a partial year compares like-for-like months and withholds annual figures", () => {
    const m = build({ year: 2026, month: 3 });
    expect(m.seasonality.complete).toBe(false);
    expect(m.kpis.importsDetail).toContain("2026 incomplete (Jan–Aug published)");
    const partial = m.notices.find((n) => n.id === "partial-year")!;
    expect(partial.text).toContain("compares Jan–Aug only");
    expect(m.notices.find((n) => n.id === "unpublished")!.text).toContain("Sep–Dec 2026 not yet published");
    expect(likeForLikeText(m)).toBe("Jan–Aug 2026 vs Jan–Aug 2025: +0.5 %");
    expect(m.notices.find((n) => n.id === "provisional")!.text).toMatch(/^Jan–Aug 2026 provisional/);
  });

  it("the first year has no comparison year, and says so", () => {
    const m = build({ year: 2019, month: 1 });
    expect(m.compareYear).toBeNull();
    expect(m.compareYearNote).toBe("No earlier year to compare with: the snapshot starts Jan 2019");
    expect(m.kpis.change.value).toBeNull();
    expect(m.kpis.changeDetail).toBe("No earlier year to compare with: the snapshot starts Jan 2019");
    expect(m.yoy.every((v) => v === null)).toBe(true);
    expect(m.heatmap.rows[0]!.changePp.every((v) => v === null)).toBe(true);
  });

  it("an invalid comparison year falls back to the year before, with a warning", () => {
    const m = build({ compareYear: 2027 });
    expect(m.compareYear).toBe(2024);
    expect(m.notices.find((n) => n.id === "compare-year")).toMatchObject({ tone: "warn" });
  });

  it("a year outside the snapshot falls back to the latest year, with a warning", () => {
    const m = build({ year: 2031, month: 1 });
    expect(m.year).toBe(2026);
    expect(m.yearAdjusted).toBe(true);
    expect(m.notices[0]).toMatchObject({ id: "year-adjusted", tone: "warn" });
  });

  it("warns when the comparison crosses a series break (P11)", () => {
    const m = build({ year: 2022, month: 1 }, wheat);
    const w = m.notices.find((n) => n.id === "break-2022-01")!;
    expect(w.tone).toBe("warn");
    expect(w.text).toContain("differences between 2021 and 2022");
    expect(m.kpis.change.value).toBeCloseTo(116_101.308 / 114_103.626 - 1, 6);
  });

  it("bananas: the Jan 2024 code split is noted for 2024 vs 2023 but not 2025 vs 2024", () => {
    expect(build({ year: 2024 }, bananas).notices.some((n) => n.id === "codes-2024-01")).toBe(true);
    expect(build({ year: 2025 }, bananas).notices.some((n) => n.id.startsWith("codes-"))).toBe(false);
  });

  it("potatoes: the seasonal new-potatoes code is explained", () => {
    const n = build({}, potatoes).notices.find((x) => x.id === "seasonal-code-07019050")!;
    expect(n.text).toContain("99.6 % of its recorded net mass in Jan–Jun");
    expect(n.text).toContain("10.8 % of the basket");
  });

  it("UK production is never shown for these baskets (SS-07)", () => {
    expect(build().domestic).toMatchObject({ status: "annual_only", sourceIds: ["S09"] });
    expect(build({}, wheat).domestic).toMatchObject({ status: "annual_only", sourceIds: ["S10"] });
    expect(build({}, bananas).domestic).toMatchObject({ status: "none_identified", sourceIds: ["S05"] });
  });

  it("measure = value uses pounds throughout", () => {
    const m = build({ measure: "value" });
    expect(m.kpis.imports.unit).toBe("GBP");
    expect(m.kpis.importsDetail).toMatch(/kt/);
    expect(m.flowScale).toMatchObject({ key: "NL", month: "2026-07" });
  });
});

describe("monthRunsText", () => {
  it("joins consecutive months", () => {
    expect(monthRunsText([3, 4, 5, 9])).toBe("Mar–May, Sep");
    expect(monthRunsText([12], 2026)).toBe("Dec 2026");
    expect(monthRunsText([])).toBe("");
  });
});
