/**
 * The components that build the selected assessment (Stage 8). Each kind is its own component, so
 * only the selected assessment's hooks run; the result is published to the store once.
 */
import { useEffect, useState, type ReactNode } from "react";
import { describeDataError } from "@/services/data/errors";
import { useAppStore } from "@/state/store";
import { reportChecksum } from "./checksum";
import type { AssessmentReport } from "./report";
import {
  useAuthorityAssessment,
  useCommodityAssessment,
  useScenarioAssessment,
  type AssessmentData,
} from "./useInsights";

/**
 * Renders with the selected assessment's data. Each kind is its own component, so only the
 * selected assessment's hooks run and only its files load (a commodity assessment never loads the
 * 8 MB store file, a council assessment never loads the port data).
 */
export function WithAssessment({ render }: { render: (a: AssessmentData) => ReactNode }) {
  const kind = useAppStore((s) => s.insightsKind);
  if (kind === "authority") return <AuthorityGate render={render} />;
  if (kind === "commodity") return <CommodityGate render={render} />;
  return <ScenarioGate render={render} />;
}

function AuthorityGate({ render }: { render: (a: AssessmentData) => ReactNode }) {
  return <>{render(useAuthorityAssessment(true))}</>;
}

function CommodityGate({ render }: { render: (a: AssessmentData) => ReactNode }) {
  return <>{render(useCommodityAssessment(true))}</>;
}

function ScenarioGate({ render }: { render: (a: AssessmentData) => ReactNode }) {
  return <>{render(useScenarioAssessment(true))}</>;
}

/**
 * Builds the selected assessment once and publishes it to the store (no UI), with its SHA-256
 * checksum (EX-02). Mounted while ConsultingWhere Insights is open; the controls, key figures,
 * panel, full report and exports read the store, so they show one computation.
 */
export function InsightsSync() {
  return <WithAssessment render={(a) => <Publish a={a} />} />;
}

function Publish({ a }: { a: AssessmentData }) {
  const setAssessment = useAppStore((s) => s.setInsightsAssessment);
  const [checksum, setChecksum] = useState<{ report: AssessmentReport; value: string } | null>(null);
  useEffect(() => {
    if (!a.report) return;
    let live = true;
    const report = a.report;
    void reportChecksum(report).then((value) => {
      if (live) setChecksum({ report, value });
    });
    return () => {
      live = false;
    };
  }, [a.report]);
  const sum = checksum && checksum.report === a.report ? checksum.value : null;
  useEffect(() => {
    setAssessment({
      kind: a.kind,
      status: a.status,
      error: a.error ? describeDataError(a.error) : null,
      emptyText: a.emptyText,
      report: a.report,
      checksum: sum,
    });
  }, [a.kind, a.status, a.error, a.emptyText, a.report, sum, setAssessment]);
  useEffect(() => () => setAssessment(null), [setAssessment]);
  return null;
}
