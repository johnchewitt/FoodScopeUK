// @vitest-environment node
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatByUnit } from "@/analysis/format";
import { authority, commodity, scenario, SPAIN_TOMATOES } from "@/test/insightsFixtures";
import { reportChecksum, shortChecksum } from "../checksum";
import type { AssessmentReport } from "../report";
import { buildPdfDocument, type PdfAssets } from "./document";
import { pdfText } from "./sanitize";

/*
 * The PDF is written with pdfmake's Node build from the same document definition the browser uses,
 * then read back with pdf.js: the text in the PDF must be the report's text (EX-02), page numbers on
 * every page, the checksum and data snapshots printed, and every character in the embedded font.
 */
const require = createRequire(import.meta.url);
const FONT_DIR = resolve(process.cwd(), "node_modules/@fontsource/ibm-plex-sans/files");
const FONTS = {
  PlexSans: {
    normal: `${FONT_DIR}/ibm-plex-sans-latin-400-normal.woff`,
    bold: `${FONT_DIR}/ibm-plex-sans-latin-600-normal.woff`,
    italics: `${FONT_DIR}/ibm-plex-sans-latin-400-italic.woff`,
    bolditalics: `${FONT_DIR}/ibm-plex-sans-latin-600-italic.woff`,
  },
};

// A 1 × 1 white PNG: obviously synthetic chart and map stand-ins (the real ones are drawn in the browser).
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC";

async function writePdf(r: AssessmentReport, checksum: string, map = false): Promise<Uint8Array> {
  const pdfmake = require("pdfmake") as PdfMakeInstance & {
    setLocalAccessPolicy(cb: (p: string) => boolean): void;
  };
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy((p: string) => p.startsWith(FONT_DIR));
  pdfmake.setFonts(FONTS);
  const assets: PdfAssets = {
    map: map
      ? {
          dataUrl: PIXEL,
          widthPx: 1600,
          heightPx: 1000,
          caption:
            "Map extent 53.40° N, 2.32° W to 53.55° N, 2.15° W; scale about 1:150,000 at the centre (Web Mercator).",
          credits: "Esri, TomTom | Contains GEOLYTIX Grocery Retail Points data | Powered by Esri",
        }
      : null,
    mapUnavailable: map ? null : "Map not included: the map is not ready yet.",
    mapNote: "What the map shows: test.",
    charts: Object.fromEntries(r.charts.map((c) => [c.id, { dataUrl: PIXEL, widthPx: 1900, heightPx: 600 }])),
    checksum,
    generatedAt: new Date("2026-10-26T12:00:00Z"),
  };
  return pdfmake.createPdf(buildPdfDocument(r, assets)).getBuffer();
}

async function readPdf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : ""))
        .join("")
        .replace(/[ \u00a0]+/g, " "),
    );
  }
  const meta = await doc.getMetadata();
  return { pages, text: pages.join("\n"), info: meta.info as Record<string, unknown> };
}

/** Normalises spaces so a phrase can be found however pdf.js splits the runs. */
const squash = (s: string) =>
  pdfText(s)
    .replace(/[\s\u00a0]+/g, " ")
    .trim();

describe("executive PDF (EX-01 – EX-05)", () => {
  it("prints the report's figures, page numbers, checksum and data versions (Manchester)", async () => {
    const r = authority("E08000003");
    const checksum = await reportChecksum(r);
    const { pages, text, info } = await readPdf(await writePdf(r, checksum, true));
    const all = squash(text);
    expect(pages.length).toBeGreaterThanOrEqual(5);
    pages.forEach((p, i) => expect(squash(p)).toContain(`Page ${i + 1} of ${pages.length}`));
    // Cover: title, subject, the exploratory note and every key figure exactly as formatted on screen.
    expect(squash(pages[0]!)).toContain("Local Authority Food Security Assessment");
    expect(squash(pages[0]!)).toContain("Manchester");
    expect(all).toContain("not a commissioned food security audit");
    for (const k of r.kpis)
      expect(squash(pages[0]!)).toContain(squash(formatByUnit(k.indicator.value, k.indicator.unit)));
    // Every finding and work package title, verbatim.
    for (const f of r.executiveSummary) expect(all).toContain(squash(f.text));
    for (const w of r.workPackages) expect(all).toContain(squash(w.title));
    // Integrity: the full and short checksum, data snapshots and the map's extent and credits.
    expect(all).toContain(checksum);
    expect(all).toContain(`Report checksum ${shortChecksum(checksum)}`);
    for (const s of r.snapshots) expect(all).toContain(`${s.family} ${s.id}`);
    expect(all).toContain("Map extent 53.40° N, 2.32° W to 53.55° N, 2.15° W");
    expect(all).toContain("Powered by Esri");
    expect(info.Title).toBe("Local Authority Food Security Assessment: Manchester");
  }, 60_000);

  it("states when the map could not be included", async () => {
    const r = authority("N09000003");
    const { text } = await readPdf(await writePdf(r, await reportChecksum(r), false));
    expect(squash(text)).toContain("Map not included: the map is not ready yet.");
    expect(squash(text)).toContain("Belfast");
  }, 60_000);

  it("writes the commodity and scenario reports", async () => {
    for (const r of [commodity("tomatoes"), scenario(SPAIN_TOMATOES)]) {
      const { pages, text } = await readPdf(await writePdf(r, await reportChecksum(r), true));
      expect(pages.length).toBeGreaterThanOrEqual(4);
      expect(squash(text)).toContain(squash(r.title));
      for (const k of r.kpis)
        expect(squash(text)).toContain(squash(formatByUnit(k.indicator.value, k.indicator.unit)));
    }
  }, 90_000);
});

describe("PDF text and font", () => {
  it("every character of the reports is in the embedded font after sanitising", () => {
    const fontkit = require("fontkit") as {
      openSync(path: string): { hasGlyphForCodePoint(cp: number): boolean };
    };
    const fonts = Object.values(FONTS.PlexSans).map((p) => fontkit.openSync(p));
    const reports = [
      authority("E08000003"),
      authority("N09000003"),
      authority("S12000049"),
      commodity("coffee", "value"),
      commodity("tomatoes"),
      scenario(SPAIN_TOMATOES),
      scenario({ kind: "port", port: "GBDVR", reduction: 50, months: 3 }),
      scenario({ kind: "production", commodity: "wheat", reduction: 20 }),
    ];
    const missing = new Set<string>();
    for (const r of reports) {
      const text = pdfText(JSON.stringify({ ...r, link: "" }));
      for (const ch of text) {
        const cp = ch.codePointAt(0)!;
        if (cp < 0x20) continue;
        if (!fonts.every((f) => f.hasGlyphForCodePoint(cp)))
          missing.add(`${ch} U+${cp.toString(16).toUpperCase()}`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("replaces the characters the font lacks", () => {
    expect(pdfText("≤ 2 km → ≥ 5 % Σ ≈")).toBe("<= 2 km -> >= 5 % sum of  ~");
  });

  it("gives the same checksum for the same report and a different one for a changed figure", async () => {
    const a = authority("E08000003");
    const b = structuredClone(a);
    expect(await reportChecksum(a)).toBe(await reportChecksum(b));
    expect(await reportChecksum({ ...b, link: "https://elsewhere.test/" })).toBe(await reportChecksum(a));
    b.kpis[0]!.indicator.value = 1;
    expect(await reportChecksum(b)).not.toBe(await reportChecksum(a));
  });
});
