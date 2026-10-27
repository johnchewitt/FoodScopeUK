/**
 * CSV export of an assessment (brief §7): every indicator the report shows, with its raw value,
 * the value as shown, provenance, sources, period, coverage and method, so the export can be
 * checked against the screen and the PDF (EX-02). Only figures computed from the published open
 * datasets listed in the report are exported; nothing unpublished or restricted is included.
 */
import { formatByUnit } from "@/analysis/format";
import { csvField } from "@/features/scenarios/saved";
import { PROVENANCE_LABELS } from "@/types/indicator";
import type { AssessmentReport } from "./report";

export function reportCsv(r: AssessmentReport, checksum: string | null, generated: Date): string {
  const header = [
    "assessment",
    "subject",
    "indicator_id",
    "label",
    "value",
    "unit",
    "shown",
    "provenance",
    "scope",
    "sources",
    "reference_period",
    "coverage",
    "method",
    "missing_reason",
  ];
  const lines = [header.join(",")];
  for (const i of r.indicators)
    lines.push(
      [
        r.title,
        r.subject,
        i.id,
        i.label,
        typeof i.value === "number" ? i.value : i.value,
        i.unit,
        formatByUnit(i.value, i.unit),
        PROVENANCE_LABELS[i.provenance],
        i.scope ?? "",
        i.sourceIds.join(" "),
        i.referencePeriod,
        i.coverage,
        i.method,
        i.missingReason ?? "",
      ]
        .map(csvField)
        .join(","),
    );
  lines.push("");
  lines.push(csvField(r.disclaimer));
  lines.push(
    csvField(
      `Generated ${generated.toISOString()} by FOODSCOPE UK. Data snapshots: ${r.snapshots.map((s) => `${s.family} ${s.id}`).join(", ")}.${checksum ? ` Report checksum (SHA-256): ${checksum}.` : ""} Link: ${r.link}`,
    ),
  );
  return `${lines.join("\r\n")}\r\n`;
}

/** File names: kind, subject and date, ASCII only. */
export function reportFileName(r: AssessmentReport, ext: string, date: Date): string {
  const slug = `${r.kind}-${r.subject}`
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .toLowerCase()
    .slice(0, 60);
  return `foodscope-${slug}-${date.toISOString().slice(0, 10)}.${ext}`;
}

/** Saves text or bytes as a file in the browser. */
export function downloadBlob(filename: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
