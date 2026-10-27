/**
 * Writes the executive PDF (Stage 8, brief §6; EX-01 – EX-05, ADR-0027) in the browser: captures
 * the visible map with its extent and credits, draws the charts light, builds the document from the
 * report model and lets pdfmake (lazy-loaded with this module) produce the file. No external URL is
 * ever fetched: the URL access policy refuses all of them (pdfmake 0.3.6+, CVE-2026-26801 note).
 */
import pdfMake from "pdfmake/build/pdfmake";
import { AREA_MEASURE_LABELS } from "@/features/profiles/model";
import { SCENARIO_TITLES } from "@/features/scenarios/methodology";
import { captureCaption, captureMap, MapCaptureError } from "@/map/capture";
import { useAppStore } from "@/state/store";
import type { AssessmentReport } from "../report";
import { renderChartImages } from "./chartImages";
import { buildPdfDocument, type PdfAssets } from "./document";
import { loadPdfFonts, PDF_FONT_FILES } from "./fonts";

let configured = false;

async function configure(): Promise<void> {
  const vfs = await loadPdfFonts();
  if (configured) return;
  pdfMake.setUrlAccessPolicy(() => false);
  pdfMake.addVirtualFileSystem(vfs);
  pdfMake.setFonts({ PlexSans: { ...PDF_FONT_FILES } });
  configured = true;
}

/** What the map in the PDF shows: its legend in words, for the selection at export. */
export function mapLegendText(r: AssessmentReport): string {
  const s = useAppStore.getState();
  switch (r.kind) {
    case "authority":
      return `What the map shows: ${r.subject} outlined (May 2025 boundaries); grocery stores as points (GEOLYTIX v46, June 2026: supermarkets, convenience and other formats)${
        s.profileMap
          ? `; small areas shaded by ${AREA_MEASURE_LABELS[s.areaMeasure].toLowerCase()} in fixed classes`
          : ""
      }. Distances in this report are straight-line.`;
    case "commodity":
      return "What the map shows: recorded import partners shaded by their share of recorded imports in the period (fixed classes), with symbolic connections to the UK whose width follows the amount. Connections are not routes and do not end at ports; the partner is the country of dispatch.";
    case "scenario":
      return `What the map shows: the Scenario Lab's map of ${SCENARIO_TITLES[s.scenarioKind].title.toLowerCase()} (${
        s.scenarioView === "baseline" ? "baseline" : "scenario"
      } view). ${
        s.scenarioKind === "import"
          ? "The disrupted partner's baseline connection is a dashed outline."
          : s.scenarioKind === "closure"
            ? "The closed supermarket is marked; affected small areas are circles sized by residents."
            : s.scenarioKind === "port"
              ? "The port's baseline is a dashed ring."
              : "Defra's balance is UK-wide, so nothing regional is drawn."
      }`;
  }
}

export interface PdfResult {
  bytes: Blob;
  pages: number;
  /** Set when the map could not be included (the reason, shown to the user). */
  mapNote: string | null;
}

export async function exportReportPdf(report: AssessmentReport, checksum: string | null): Promise<PdfResult> {
  const fonts = configure();
  let map: PdfAssets["map"] = null;
  let mapUnavailable: string | null = null;
  try {
    const c = await captureMap({ width: 2000, height: 1250 });
    map = {
      dataUrl: c.dataUrl,
      widthPx: c.width,
      heightPx: c.height,
      caption: captureCaption(c),
      credits: c.attribution,
    };
  } catch (e) {
    mapUnavailable =
      e instanceof MapCaptureError
        ? `Map not included: ${e.message}`
        : "Map not included: the image could not be made.";
  }
  const charts = await renderChartImages(report.charts);
  await fonts;
  const doc = buildPdfDocument(report, {
    map,
    mapUnavailable,
    mapNote: mapLegendText(report),
    charts,
    checksum,
    generatedAt: new Date(),
  });
  let pages = 0;
  const footer = doc.footer as (current: number, count: number) => unknown;
  doc.footer = (current: number, count: number) => {
    pages = Math.max(pages, count);
    return footer(current, count);
  };
  const bytes = await pdfMake.createPdf(doc).getBlob();
  return { bytes, pages, mapNote: mapUnavailable };
}
