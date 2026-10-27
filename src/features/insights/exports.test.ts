import { describe, expect, it } from "vitest";
import { captureCaption, esriImageNotice, formatLatLon } from "@/map/capture";
import { authority, commodity } from "@/test/insightsFixtures";
import { chartHeight, formatChartValue, reportChartOption } from "./charts";
import { canonicalJson } from "./checksum";
import { reportCsv, reportFileName } from "./csv";
import { wrapLines } from "./mapImage";
import {
  addReport,
  loadReports,
  normaliseQuery,
  persistReports,
  REPORTS_KEY,
  removeReport,
} from "./savedReports";

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

describe("saved report configurations (brief §7)", () => {
  const now = new Date("2026-10-26T12:00:00Z");

  it("keeps only the insights URL state, re-serialised", () => {
    expect(normaliseQuery("?m=insights&lad=E08000003&evil=1")).toBe("?m=insights&lad=E08000003");
    expect(normaliseQuery("m=insights&ia=commodity&c=rice")).toBe("?m=insights&c=rice&ia=commodity");
    expect(normaliseQuery("?m=origins")).toBeNull();
    expect(normaliseQuery("?m=insights&" + "x".repeat(3000))).toBeNull();
  });

  it("adds, replaces by name, removes and survives a round trip through storage", () => {
    let list = addReport(
      [],
      { name: "Manchester", kind: "authority", query: "?m=insights&lad=E08000003" },
      now,
      "a",
    );
    list = addReport(
      list,
      { name: "Rice", kind: "commodity", query: "?m=insights&ia=commodity&c=rice" },
      now,
      "b",
    );
    list = addReport(
      list,
      { name: "Manchester", kind: "authority", query: "?m=insights&lad=E08000003&cmp=E08000007" },
      now,
      "c",
    );
    expect(list.map((r) => r.id)).toEqual(["c", "b"]);
    const store = memoryStorage();
    expect(persistReports(list, store)).toBe(true);
    expect(loadReports(store)).toEqual(list);
    expect(removeReport(list, "c").map((r) => r.id)).toEqual(["b"]);
  });

  it("drops invalid stored entries and tolerates missing storage", () => {
    const store = memoryStorage();
    store.setItem(
      REPORTS_KEY,
      JSON.stringify([
        { id: "x", name: "ok", savedAt: "2026", kind: "authority", query: "?m=insights" },
        { id: "y", name: "bad kind", savedAt: "2026", kind: "nope", query: "?m=insights" },
        { id: "z", name: "other module", savedAt: "2026", kind: "authority", query: "?m=access" },
        "junk",
      ]),
    );
    expect(loadReports(store).map((r) => r.id)).toEqual(["x"]);
    store.setItem(REPORTS_KEY, "{not json");
    expect(loadReports(store)).toEqual([]);
    expect(loadReports(null)).toEqual([]);
    expect(persistReports([], null)).toBe(false);
  });
});

describe("CSV export (EX-05)", () => {
  it("lists every indicator once with its raw and shown value, provenance and sources", () => {
    const r = authority("E08000003");
    const csv = reportCsv(r, "a".repeat(64), new Date("2026-10-26T12:00:00Z"));
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe(
      "assessment,subject,indicator_id,label,value,unit,shown,provenance,scope,sources,reference_period,coverage,method,missing_reason",
    );
    for (const i of r.indicators) expect(csv).toContain(`,${i.id},`);
    expect(csv).toContain("588,300");
    expect(csv).toContain(`Report checksum (SHA-256): ${"a".repeat(64)}`);
    expect(csv).toContain("not a commissioned food security audit");
    for (const d of r.datasets) expect(csv).toContain(d.attribution.slice(0, 40));
  });

  it("names files with ASCII only", () => {
    const r = commodity("milk-products");
    expect(reportFileName(r, "pdf", new Date("2026-10-26T12:00:00Z"))).toMatch(
      /^foodscope-commodity-[a-z0-9-]+-2026-10-26\.pdf$/,
    );
  });
});

describe("report charts", () => {
  it("draws every chart on one value axis with as many values as categories", () => {
    for (const r of [authority("E08000003"), commodity("tomatoes")]) {
      for (const c of r.charts) {
        for (const theme of ["dark", "light"] as const) {
          const o = reportChartOption(c, theme, { legend: theme === "light" }) as Record<string, unknown>;
          const axes = [o.xAxis, o.yAxis] as { type: string }[];
          expect(axes.filter((a) => a.type === "value")).toHaveLength(1);
          const series = o.series as { data: unknown[] }[];
          for (const s of series) expect(s.data.length).toBe(c.categories.length);
        }
        expect(chartHeight(c)).toBeGreaterThan(80);
      }
    }
  });

  it("formats values by the chart's unit and shows missing values as such", () => {
    expect(formatChartValue(0.1234, "share")).toBe("12.3 %");
    expect(formatChartValue(null, "tonnes")).toBe("no data");
    expect(formatChartValue(82.9, "percent")).toBe("82.9 %");
  });
});

describe("map image and checksum helpers", () => {
  it("describes the captured extent, scale and basemap", () => {
    expect(formatLatLon(53.48, -2.24)).toBe("53.48° N, 2.24° W");
    const text = captureCaption({
      extent: [-2.32, 53.4, -2.15, 53.55],
      scale: 150_400,
      basemap: "Esri Human Geography",
      capturedAt: "2026-10-26T12:34:56.000Z",
    });
    expect(text).toBe(
      "Map extent 53.40° N, 2.32° W to 53.55° N, 2.15° W; scale about 1:150,000 at the centre (Web Mercator); basemap Esri Human Geography; captured 2026-10-26 12:34 UTC.",
    );
    expect(
      captureCaption({ extent: [0, 0, 1, 1], scale: 1, basemap: null, capturedAt: "2026-10-26T00:00" }),
    ).toContain("offline outline map (no basemap)");
  });

  it("adds Esri's map image notice only when an Esri basemap is drawn", () => {
    expect(
      esriImageNotice({ basemap: "Esri National Geographic Style", capturedAt: "2026-10-26T12:00:00Z" }),
    ).toBe(
      "Map image is the intellectual property of Esri and is used herein under license. Copyright © 2026 Esri and its licensors. All rights reserved.",
    );
    expect(esriImageNotice({ basemap: null, capturedAt: "2026-10-26T12:00:00Z" })).toBeNull();
  });

  it("wraps credits to the image width", () => {
    const lines = wrapLines((s) => s.length, "Esri, TomTom, Garmin | GEOLYTIX | ONS", 12);
    expect(lines.every((l) => l.length <= 12 || !l.includes(" "))).toBe(true);
    expect(lines.join(" ")).toBe("Esri, TomTom, Garmin | GEOLYTIX | ONS");
  });

  it("serialises with sorted keys, so key order never changes the checksum", () => {
    expect(canonicalJson({ b: 1, a: [2, { d: null, c: "x" }] })).toBe('{"a":[2,{"c":"x","d":null}],"b":1}');
    expect(canonicalJson({ a: 1, u: undefined })).toBe('{"a":1}');
  });
});
