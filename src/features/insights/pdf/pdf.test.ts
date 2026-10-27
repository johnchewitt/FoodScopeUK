// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatByUnit } from "@/analysis/format";
import { CONSULTINGWHERE_LOGO } from "@/content/brand";
import { authority, commodity, scenario, SPAIN_TOMATOES } from "@/test/insightsFixtures";
import { reportChecksum, shortChecksum } from "../checksum";
import type { AssessmentReport } from "../report";
import { buildPdfDocument, headingWouldEndPage, PAGE, type PdfAssets } from "./document";
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

// ConsultingWhere's logo as the app ships it (D3).
const LOGO_FILE = resolve(process.cwd(), "src/assets/brand/consultingwhere-logo.png");
const LOGO = {
  dataUrl: `data:image/png;base64,${readFileSync(LOGO_FILE).toString("base64")}`,
  widthPx: CONSULTINGWHERE_LOGO.widthPx,
  heightPx: CONSULTINGWHERE_LOGO.heightPx,
};

async function writePdf(
  r: AssessmentReport,
  checksum: string,
  map: boolean | { widthPx: number; heightPx: number } = false,
  logo = true,
): Promise<Uint8Array> {
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
          ...(typeof map === "object" ? map : { widthPx: 1600, heightPx: 1000 }),
          caption:
            "Map extent 53.40° N, 2.32° W to 53.55° N, 2.15° W; scale about 1:150,000 at the centre (Web Mercator).",
          credits: "Esri, TomTom | Contains GEOLYTIX Grocery Retail Points data | Powered by Esri",
        }
      : null,
    mapUnavailable: map ? null : "Map not included: the map is not ready yet.",
    mapNote: "What the map shows: test.",
    charts: Object.fromEntries(r.charts.map((c) => [c.id, { dataUrl: PIXEL, widthPx: 1900, heightPx: 600 }])),
    logo: logo ? LOGO : null,
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

/**
 * What each page draws: text runs (baseline y, font size) and images (lower-left corner and size,
 * following the transformation matrix). PDF y runs up from the bottom edge.
 */
async function pageMarks(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { OPS, Util } = pdfjs;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false }).promise;
  const pages: {
    texts: { str: string; x: number; y: number; size: number }[];
    images: { x: number; y: number; width: number; height: number }[];
  }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const texts = (await page.getTextContent()).items.flatMap((it) =>
      "str" in it && it.str.trim()
        ? [
            {
              str: it.str,
              x: it.transform[4] as number,
              y: it.transform[5] as number,
              size: Math.hypot(it.transform[0], it.transform[1]),
            },
          ]
        : [],
    );
    const images: { x: number; y: number; width: number; height: number }[] = [];
    const ops = await page.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0];
    const saved: number[][] = [];
    ops.fnArray.forEach((fn, k) => {
      if (fn === OPS.save) saved.push(ctm);
      else if (fn === OPS.restore) ctm = saved.pop() ?? [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.transform) ctm = Util.transform(ctm, ops.argsArray[k] as number[]);
      else if (fn === OPS.paintImageXObject)
        images.push({
          x: Math.min(ctm[4]!, ctm[4]! + ctm[0]!),
          y: Math.min(ctm[5]!, ctm[5]! + ctm[3]!),
          width: Math.abs(ctm[0]!),
          height: Math.abs(ctm[3]!),
        });
    });
    pages.push({ texts, images });
  }
  return pages;
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

describe("PDF page layout", () => {
  // Obviously synthetic node infos: content, and the running header or footer.
  const content = { text: "A" };
  const runningNode = { text: "Page 1 of 1", style: "running" };
  const following = (...n: object[]) => ({ getFollowingNodesOnPage: () => n });

  it("moves a heading to the next page when only the running header or footer follows it", () => {
    expect(headingWouldEndPage({ headlineLevel: 2 }, following())).toBe(true);
    expect(headingWouldEndPage({ headlineLevel: 2 }, following(runningNode, runningNode))).toBe(true);
    expect(headingWouldEndPage({ headlineLevel: 2 }, following(content, runningNode))).toBe(false);
    expect(headingWouldEndPage({ headlineLevel: 3 }, following(content))).toBe(false);
    expect(headingWouldEndPage({}, following())).toBe(false);
  });

  /**
   * The lowest thing in the body area of each page: a text run with its font size, or an image.
   * PDF y runs up from the bottom edge, so the body lies between the bottom and top margins.
   */
  async function lastOnEachPage(bytes: Uint8Array): Promise<{ page: number; what: string; size: number }[]> {
    const inBody = (y: number) => y > PAGE.margin[3] && y < PAGE.height - PAGE.margin[1];
    const out: { page: number; what: string; size: number }[] = [];
    for (const [i, p] of (await pageMarks(bytes)).entries()) {
      const marks = [
        ...p.texts.map((m) => ({ what: m.str, y: m.y, size: m.size })),
        ...p.images.map((m) => ({ what: "image", y: m.y, size: 0 })),
      ];
      const body = marks.filter((m) => inBody(m.y));
      const last = body.reduce((a, b) => (b.y < a.y ? b : a), body[0]!);
      if (last) out.push({ page: i + 1, what: last.what, size: last.size });
    }
    return out;
  }

  /** Table titles and the attribution label: each must stay with what it introduces. */
  const titles = (r: AssessmentReport) => [
    ...r.sections.flatMap((s) => s.tables.map((tb) => tb.caption)),
    "Stated rules, observed values and whether each fired",
    "Data sources",
    "Published datasets used (FOODSCOPE UK data snapshots)",
    "Attribution",
  ];

  it("never ends a page with a heading or a table title, whatever the map's shape", async () => {
    const reports = [authority("E08000003"), commodity("tomatoes"), scenario(SPAIN_TOMATOES)];
    // A tall map (a narrow visible map beside both panels) was pushed alone onto the next page,
    // leaving its heading at the foot of the page before.
    for (const r of reports)
      for (const map of [
        { widthPx: 1600, heightPx: 1000 },
        { widthPx: 600, heightPx: 900 },
      ]) {
        const ends = await lastOnEachPage(await writePdf(r, "a".repeat(64), map));
        for (const e of ends) {
          const where = `${r.subject} p${e.page}: ${e.what}`;
          // Headings are 13 pt (h2) and 10.5 pt (h3); body text is at most 9 pt.
          expect(e.size, where).toBeLessThan(10);
          // Nor a table's title without its table.
          expect(
            titles(r).some((c) => squash(c).endsWith(squash(e.what))),
            where,
          ).toBe(false);
        }
      }
  }, 120_000);
});

describe("ConsultingWhere's logo (D3)", () => {
  it("is the file the app ships, at its stated size, without the image editor's metadata", () => {
    const png = readFileSync(LOGO_FILE);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([
      CONSULTINGWHERE_LOGO.widthPx,
      CONSULTINGWHERE_LOGO.heightPx,
    ]);
    // No text or XMP chunks: nothing from the supplier's editor travels with the app.
    const chunks: string[] = [];
    for (let at = 8; at < png.length; at += 12 + png.readUInt32BE(at))
      chunks.push(png.subarray(at + 4, at + 8).toString("latin1"));
    expect(chunks.filter((c) => ["tEXt", "zTXt", "iTXt", "eXIf"].includes(c))).toEqual([]);
  });

  it("sits at the top of the cover, unstretched, and a wordmark stands in without it", async () => {
    const r = authority("E08000003");
    const [withLogo] = await pageMarks(await writePdf(r, "a".repeat(64), true, true));
    const top = withLogo!.images.filter((m) => m.y > PAGE.height - 90);
    expect(top).toHaveLength(1);
    const logo = top[0]!;
    expect(logo.x).toBeCloseTo(PAGE.margin[0], 0);
    expect(logo.width / logo.height).toBeCloseTo(
      CONSULTINGWHERE_LOGO.widthPx / CONSULTINGWHERE_LOGO.heightPx,
      2,
    );
    expect(withLogo!.texts.some((m) => m.str === "ConsultingWhere")).toBe(false);

    const [without] = await pageMarks(await writePdf(r, "a".repeat(64), true, false));
    expect(without!.images.filter((m) => m.y > PAGE.height - 90)).toEqual([]);
    expect(without!.texts.some((m) => m.str === "ConsultingWhere" && m.y > PAGE.height - 90)).toBe(true);
    // The band names the workspace either way.
    expect(without!.texts.map((m) => m.str).join(" ")).toContain("ConsultingWhere Insights");
  }, 60_000);
});
