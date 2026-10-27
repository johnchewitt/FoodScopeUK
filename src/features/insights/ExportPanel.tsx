import { FileDown, FileSpreadsheet, ImageDown, Link2, Maximize2 } from "lucide-react";
import { useState } from "react";
import { captureMap, MapCaptureError } from "@/map/capture";
import { useAppStore } from "@/state/store";
import { shortChecksum } from "./checksum";
import { downloadBlob, reportCsv, reportFileName } from "./csv";
import { composeMapImage } from "./mapImage";
import type { AssessmentReport } from "./report";
import { useInsightsAssessment } from "./useInsights";

/** Map image size for exports (about A4 landscape at 150 dpi). */
const MAP_IMAGE = { width: 1600, height: 1000 } as const;

function ExportActions() {
  const a = useInsightsAssessment();
  const report: AssessmentReport | null = a?.report ?? null;
  const checksum = a?.checksum ?? null;
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<null | "pdf" | "map">(null);
  const openReport = useAppStore((s) => s.setReportOpen);
  const disabled = !report;

  const pdf = async () => {
    if (!report) return;
    setBusy("pdf");
    setStatus("Preparing the PDF: capturing the map and drawing the charts…");
    try {
      const { exportReportPdf } = await import("./pdf/exportPdf");
      const result = await exportReportPdf(report, checksum);
      downloadBlob(reportFileName(report, "pdf", new Date()), result.bytes, "application/pdf");
      setStatus(
        `PDF ready (${result.pages} pages)${result.mapNote ? `. ${result.mapNote}` : ""}. Checksum ${checksum ? shortChecksum(checksum) : "—"}.`,
      );
    } catch (e) {
      setStatus(`The PDF could not be made: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const csv = () => {
    if (!report) return;
    downloadBlob(
      reportFileName(report, "csv", new Date()),
      reportCsv(report, checksum, new Date()),
      "text/csv;charset=utf-8",
    );
    setStatus(`CSV downloaded: ${report.indicators.length} indicators with their sources.`);
  };

  const link = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report.link);
      setStatus("Link copied: it reopens this assessment with the same selections.");
    } catch {
      setStatus(`Copy this link: ${report.link}`);
    }
  };

  const mapImage = async () => {
    if (!report) return;
    setBusy("map");
    setStatus("Capturing the map…");
    try {
      const capture = await captureMap(MAP_IMAGE);
      const png = await composeMapImage(capture, `${report.title}: ${report.subject}`);
      downloadBlob(reportFileName(report, "png", new Date()), png, "image/png");
      setStatus("Map image downloaded with its extent and credits drawn on it.");
    } catch (e) {
      setStatus(e instanceof MapCaptureError ? e.message : `The map image could not be made: ${String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="panel-section" aria-labelledby="insights-export-heading">
      <h3 id="insights-export-heading" className="panel-section__title">
        Report and export
      </h3>
      <div className="export-grid">
        <button
          type="button"
          className="export-btn export-btn--primary"
          disabled={disabled}
          onClick={() => openReport(true)}
        >
          <Maximize2 size={15} aria-hidden="true" /> Open full report
        </button>
        <button
          type="button"
          className="export-btn"
          disabled={disabled || busy !== null}
          onClick={() => void pdf()}
        >
          <FileDown size={15} aria-hidden="true" /> {busy === "pdf" ? "Preparing PDF…" : "PDF report"}
        </button>
        <button type="button" className="export-btn" disabled={disabled} onClick={csv}>
          <FileSpreadsheet size={15} aria-hidden="true" /> CSV data
        </button>
        <button
          type="button"
          className="export-btn"
          disabled={disabled || busy !== null}
          onClick={() => void mapImage()}
        >
          <ImageDown size={15} aria-hidden="true" /> {busy === "map" ? "Capturing…" : "Map image"}
        </button>
        <button type="button" className="export-btn" disabled={disabled} onClick={() => void link()}>
          <Link2 size={15} aria-hidden="true" /> Copy link
        </button>
      </div>
      <p className="control-hint" role="status" aria-live="polite">
        {status}
      </p>
      <p className="control-hint">
        Exports carry the figures on screen, their sources and data snapshots
        {checksum ? (
          <>
            {" "}
            (report checksum <code>{shortChecksum(checksum)}</code>)
          </>
        ) : null}
        . Only published open data is exported.
      </p>
    </section>
  );
}

export function ExportPanel() {
  return <ExportActions />;
}
