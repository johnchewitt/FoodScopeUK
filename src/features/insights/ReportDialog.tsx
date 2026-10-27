import { useAppStore } from "@/state/store";
import { REPORT_TITLES } from "./report";
import { ReportBody } from "./ReportBody";
import { ServicesCatalogue } from "./InsightsInsights";
import { useInsightsAssessment } from "./useInsights";

/**
 * The full report (brief §1–4): the same report model as the panel, PDF and CSV, laid out as a
 * document for reading and presenting. A modal Calcite dialog (focus trap, Escape closes).
 */
export function ReportDialog() {
  const open = useAppStore((s) => s.reportOpen);
  const close = useAppStore((s) => s.setReportOpen);
  const kind = useAppStore((s) => s.insightsKind);
  const a = useInsightsAssessment();
  const report = a && a.kind === kind ? a.report : null;
  return (
    <calcite-dialog
      open={open && Boolean(report)}
      modal
      className="report-dialog"
      heading={report ? report.title : REPORT_TITLES[kind]}
      description={report ? report.subtitle : "ConsultingWhere Insights"}
      widthScale="l"
      oncalciteDialogClose={() => close(false)}
    >
      {open && report && (
        <div className="report-dialog__body">
          <ReportBody report={report} checksum={a?.checksum ?? null} layout="full" />
          <section className="report-block" aria-labelledby="full-services-heading">
            <header className="report-block__head">
              <h3 id="full-services-heading" className="report-block__title">
                ConsultingWhere services
              </h3>
            </header>
            <ServicesCatalogue layout="full" />
          </section>
        </div>
      )}
    </calcite-dialog>
  );
}
