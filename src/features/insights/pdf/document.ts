/**
 * The executive PDF report (Stage 8, brief §6; EX-01 – EX-05, ADR-0027): a pdfmake document
 * definition built from the report model only, so the PDF carries the figures on screen (EX-02).
 * Pure: images (map, charts) arrive as data URLs; nothing is fetched (the URL access policy denies
 * every external URL). A4 portrait, selectable text, embedded IBM Plex Sans (EX-03).
 */
import { formatByUnit } from "@/analysis/format";
import { PROVENANCE_LABELS } from "@/types/indicator";
import { shortChecksum } from "../checksum";
import { serviceById } from "../content";
import type { AssessmentReport, ReportFinding, ReportSection, ReportTable, WorkPackage } from "../report";
import { pdfText } from "./sanitize";

/** A pdfmake content node (the subset used here). */
export type PdfNode = string | PdfNode[] | { [key: string]: unknown };

export interface PdfImage {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
}

export interface PdfAssets {
  /** The map as captured at export, with what it shows and its credits; null when unavailable. */
  map: (PdfImage & { caption: string; credits: string }) | null;
  /** Why there is no map image (shown in its place). */
  mapUnavailable: string | null;
  /** What the map shows (its legend in words). */
  mapNote: string;
  charts: Record<string, PdfImage>;
  checksum: string | null;
  generatedAt: Date;
}

/** A4 portrait in points, with 40 pt side margins. */
export const PAGE = { width: 595.28, height: 841.89, margin: [40, 54, 40, 58] as const };
export const CONTENT_WIDTH = PAGE.width - PAGE.margin[0] - PAGE.margin[2];

const C = {
  navy: "#071923",
  teal: "#0a444a",
  accent: "#00717c",
  ink: "#17262c",
  muted: "#4c5f66",
  line: "#d5dfe2",
  zebra: "#f3f7f8",
  noteFill: "#fff6e5",
  noteLine: "#c98500",
  scenario: "#a94e17",
  cyan: "#49ead8",
};

const SCOPE_TAGS: Partial<Record<ReportFinding["scope"], string>> = {
  national_context: "National context",
  scenario: "Scenario-modelled",
};

function t(s: string): string {
  return pdfText(s);
}

function dateText(d: Date): string {
  return `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function heading(text: string, level: 1 | 2 | 3, opts: { pageBreak?: boolean; toc?: boolean } = {}): PdfNode {
  return {
    text: t(text),
    style: `h${level}`,
    ...(opts.toc ? { tocItem: true, outline: true } : level === 2 ? { outline: true } : {}),
    ...(opts.pageBreak ? { pageBreak: "before" } : {}),
    headlineLevel: level,
  };
}

function bullets(items: string[], style = "body"): PdfNode {
  return { ul: items.map((i) => ({ text: t(i), style })), margin: [0, 2, 0, 6] };
}

function findingNodes(findings: ReportFinding[]): PdfNode {
  return {
    ul: findings.map((f) => {
      const tag = SCOPE_TAGS[f.scope];
      return {
        text: [
          { text: t(f.text) },
          ...(tag
            ? [{ text: `  [${tag}]`, color: f.scope === "scenario" ? C.scenario : C.muted, fontSize: 7.5 }]
            : []),
        ],
        style: "body",
        margin: [0, 0, 0, 3],
      };
    }),
    margin: [0, 2, 0, 8],
  };
}

function note(text: string, opts: { strong?: boolean } = {}): PdfNode {
  return {
    table: {
      widths: ["*"],
      body: [[{ text: t(text), style: "note", bold: opts.strong ?? false }]],
    },
    layout: {
      fillColor: () => C.noteFill,
      hLineWidth: () => 0,
      vLineWidth: (i: number) => (i === 0 ? 2.5 : 0),
      vLineColor: () => C.noteLine,
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 6,
      paddingBottom: () => 6,
    },
    margin: [0, 4, 0, 10],
  };
}

const TABLE_LAYOUT = {
  hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
    i === 0 || i === 1 || i === node.table.body.length ? 0.6 : 0.3,
  vLineWidth: () => 0,
  hLineColor: () => C.line,
  fillColor: (row: number) => (row === 0 ? "#e8f0f1" : row % 2 === 0 ? C.zebra : null),
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

function tableNode(tb: ReportTable, widthsOverride?: (number | string)[]): PdfNode {
  const widths = widthsOverride ?? tb.columns.map((_, i) => (i === 0 ? "*" : "auto"));
  return {
    stack: [
      { text: t(tb.caption), style: "caption" },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths,
          body: [
            tb.columns.map((c, i) => ({
              text: t(c),
              style: "th",
              alignment: tb.numeric[i] ? "right" : "left",
            })),
            ...tb.rows.map((r) =>
              r.map((cell, i) => ({
                text: t(cell),
                style: "td",
                alignment: tb.numeric[i] ? "right" : "left",
              })),
            ),
          ],
        },
        layout: TABLE_LAYOUT,
      },
      ...(tb.note ? [{ text: t(tb.note), style: "small", margin: [0, 3, 0, 0] }] : []),
    ],
    margin: [0, 4, 0, 10],
  };
}

function imageFit(img: PdfImage, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const ratio = img.heightPx / img.widthPx;
  let width = maxWidth;
  let height = width * ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height / ratio;
  }
  return { width, height };
}

function sectionNodes(s: ReportSection, r: AssessmentReport, assets: PdfAssets): PdfNode[] {
  const out: PdfNode[] = [heading(s.title, 2, { toc: true })];
  if (s.scopeNote) out.push({ text: t(s.scopeNote), style: "scope" });
  if (s.intro) out.push({ text: t(s.intro), style: "body", margin: [0, 0, 0, 6] });
  if (s.findings.length) out.push(findingNodes(s.findings));
  for (const id of s.chartIds) {
    const chart = r.charts.find((c) => c.id === id);
    const img = assets.charts[id];
    if (!chart) continue;
    out.push({
      stack: [
        { text: t(chart.title), style: "caption" },
        img
          ? { image: img.dataUrl, ...imageFit(img, CONTENT_WIDTH, 260), margin: [0, 2, 0, 2] }
          : { text: "Chart not available in this export.", style: "small" },
        { text: t(`${chart.description} Source: ${chart.source}.`), style: "small" },
      ],
      unbreakable: true,
      margin: [0, 4, 0, 10],
    });
  }
  for (const tb of s.tables) out.push(tableNode(tb));
  if (s.notes.length) out.push(bullets(s.notes, "small"));
  return out;
}

function workPackageNode(w: WorkPackage): PdfNode {
  const list = (title: string, items: string[]) =>
    items.length ? [{ text: t(title), style: "label" }, bullets(items, "small")] : [];
  return {
    stack: [
      {
        columns: [
          { text: t(w.title), style: "h3", width: "*" },
          {
            text: w.indicated ? "Indicated by the figures" : "Supporting capability",
            width: "auto",
            fontSize: 7.5,
            bold: true,
            color: w.indicated ? C.accent : C.muted,
            margin: [0, 2, 0, 0],
          },
        ],
      },
      { text: t(`Service: ${serviceById(w.serviceId).title}`), style: "small", color: C.accent },
      { text: t(w.challenge), style: "body", margin: [0, 3, 0, 3] },
      { text: [{ text: "Why this appears: ", bold: true }, t(w.why)], style: "small", margin: [0, 0, 0, 4] },
      {
        columns: [
          {
            stack: [
              ...list("Supporting evidence", w.evidence),
              ...list("Additional data required", w.additionalData),
            ],
            width: "*",
          },
          {
            stack: [...list("Deliverables", w.deliverables), ...list("Limitations", w.limitations)],
            width: "*",
          },
        ],
        columnGap: 14,
      },
      { text: [{ text: "Possible tasks: ", bold: true }, t(w.tasks.join("; "))], style: "small" },
      {
        text: [{ text: "Stakeholders: ", bold: true }, t(w.stakeholders.join("; "))],
        style: "small",
        margin: [0, 2, 0, 0],
      },
    ],
    unbreakable: true,
    margin: [0, 6, 0, 10],
  };
}

function kpiTiles(r: AssessmentReport): PdfNode {
  const cells = r.kpis.map((k) => {
    const i = k.indicator;
    const value =
      i.value === null
        ? i.missingReason === "not_covered"
          ? "Not covered"
          : "Not published"
        : formatByUnit(i.value, i.unit);
    return {
      stack: [
        { text: t(k.label), style: "kpiLabel" },
        { text: t(value), style: "kpiValue" },
        { text: t(k.detail), style: "kpiDetail" },
        {
          text: t(`${PROVENANCE_LABELS[i.provenance]} · ${i.referencePeriod} · ${i.sourceIds.join(" ")}`),
          style: "kpiMeta",
        },
      ],
    };
  });
  return {
    table: { widths: cells.map(() => "*"), body: [cells] },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i: number, node: { table: { widths: unknown[] } }) =>
        i === 0 || i === node.table.widths.length ? 0 : 6,
      vLineColor: () => "#ffffff",
      fillColor: () => "#eef4f5",
      paddingLeft: () => 8,
      paddingRight: () => 8,
      paddingTop: () => 8,
      paddingBottom: () => 8,
    },
    margin: [0, 6, 0, 12],
  };
}

function selectionsNode(r: AssessmentReport): PdfNode {
  return {
    table: {
      widths: [130, "*"],
      body: r.selections.map((s) => [
        { text: t(s.label), style: "td", bold: true },
        { text: t(s.value), style: "td" },
      ]),
    },
    layout: { ...TABLE_LAYOUT, fillColor: (row: number) => (row % 2 === 0 ? C.zebra : null) },
    margin: [0, 2, 0, 10],
  };
}

/** The report's mapped extent and selections are printed with the image (brief §6: "exact extent"). */
function mapNodes(r: AssessmentReport, a: PdfAssets): PdfNode[] {
  const out: PdfNode[] = [heading("Map", 2, { toc: true })];
  if (a.map) {
    out.push({ image: a.map.dataUrl, ...imageFit(a.map, CONTENT_WIDTH, 330), margin: [0, 2, 0, 4] });
    out.push({ text: t(a.map.caption), style: "small" });
    out.push({ text: t(`Map credits: ${a.map.credits}`), style: "small", margin: [0, 2, 0, 0] });
  } else {
    out.push(note(a.mapUnavailable ?? "The map image is not available in this export."));
  }
  out.push({ text: t(a.mapNote), style: "body", margin: [0, 6, 0, 4] });
  out.push({
    text: t(
      `Reproduce this view: ${r.link}. The link holds every selection; the camera is framed on the subject when it opens.`,
    ),
    style: "small",
    link: r.link,
    color: C.accent,
  });
  return out;
}

export function buildPdfDocument(r: AssessmentReport, a: PdfAssets): Record<string, unknown> {
  const snapshots = r.snapshots.map((s) => `${s.family} ${s.id}`).join(", ");
  const short = a.checksum ? shortChecksum(a.checksum) : "not computed";
  const generated = dateText(a.generatedAt);
  const indicated = r.workPackages.filter((w) => w.indicated);

  const cover: PdfNode[] = [
    {
      canvas: [{ type: "rect", x: -40, y: -54, w: PAGE.width, h: 128, color: C.navy }],
      absolutePosition: { x: 40, y: 54 },
    },
    {
      columns: [
        {
          stack: [
            { text: "ConsultingWhere", fontSize: 17, bold: true, color: "#ffffff" },
            {
              text: "Insights · From geographic evidence to action",
              fontSize: 8.5,
              color: "#c7d8d8",
              margin: [0, 2, 0, 0],
            },
          ],
        },
        {
          stack: [
            { text: "FOODSCOPE UK", fontSize: 13, bold: true, color: C.cyan, alignment: "right" },
            {
              text: "Food security & supply chain intelligence",
              fontSize: 8,
              color: "#c7d8d8",
              alignment: "right",
            },
          ],
          width: "auto",
        },
      ],
      margin: [0, -24, 0, 54],
    },
    { text: t(r.title), style: "title" },
    { text: t(r.subject), style: "subject" },
    { text: t(r.subtitle), style: "small", margin: [0, 0, 0, 6] },
    {
      text: t(`Generated ${generated} · data snapshots ${snapshots} · report checksum ${short}`),
      style: "small",
    },
    note(r.disclaimer, { strong: true }),
    kpiTiles(r),
    heading("Executive summary", 2, { toc: true }),
    { text: t(r.context), style: "body", margin: [0, 0, 0, 6] },
    findingNodes(r.executiveSummary),
  ];

  const contents: PdfNode[] = [
    {
      toc: {
        title: { text: "Contents", style: "h2" },
        numberStyle: { fontSize: 9 },
        textStyle: { fontSize: 9 },
      },
      pageBreak: "before",
      margin: [0, 0, 0, 8],
    },
    heading("Selections", 2, { toc: true }),
    selectionsNode(r),
    ...mapNodes(r, a),
  ];

  const sections: PdfNode[] = r.sections.flatMap((s, i) => [
    ...(i === 0 ? [{ text: "", pageBreak: "before" }] : []),
    ...sectionNodes(s, r, a),
  ]);

  const opportunities: PdfNode[] = [
    heading(r.kind === "scenario" ? "Interventions and further analysis" : "Consultancy opportunities", 2, {
      toc: true,
      pageBreak: true,
    }),
    note(
      `${indicated.length} of ${r.workPackages.length} work packages are indicated by stated rules on the figures in this report; the others are supporting capabilities. They are possible further work, not a statement that any organisation has a requirement, budget or procurement, and they describe generic capabilities, not past projects.`,
    ),
    ...r.workPackages.map(workPackageNode),
    heading("Rules behind the suggestions", 3),
    tableNode(
      {
        id: "rules",
        caption: "Stated rules, observed values and whether each fired",
        columns: ["Rule", "Observed", "Fired"],
        numeric: [false, false, false],
        rows: r.rules.map((x) => [x.rule, x.observed, x.fired ? "Yes" : "No"]),
      },
      ["*", 170, 30],
    ),
  ];

  const method: PdfNode[] = [
    heading("Methodology", 2, { toc: true, pageBreak: true }),
    bullets(r.methodology),
    heading("Limitations", 2, { toc: true }),
    bullets(r.limitations),
    heading("Sources and data versions", 2, { toc: true }),
    tableNode(
      {
        id: "sources",
        caption: "Data sources",
        columns: ["ID", "Source", "Publisher", "Licence"],
        numeric: [false, false, false, false],
        rows: r.sources.map((s) => [s.id, s.title, s.publisher, s.licence]),
      },
      [26, "*", 130, 120],
    ),
    tableNode(
      {
        id: "datasets",
        caption: "Published datasets used (FOODSCOPE UK data snapshots)",
        columns: ["Dataset", "Snapshot", "Reference period", "Retrieved"],
        numeric: [false, false, false, false],
        rows: r.datasets.map((d) => [
          d.title,
          d.snapshot ?? "—",
          d.referencePeriod,
          d.retrievedAt ? d.retrievedAt.slice(0, 10) : "—",
        ]),
      },
      ["*", 54, 160, 54],
    ),
    { text: "Attribution", style: "label" },
    bullets([...new Set(r.datasets.map((d) => d.attribution))], "small"),
    heading("Report integrity", 3),
    {
      text: t(
        `Report checksum (SHA-256 of the report's figures and text): ${a.checksum ?? "not computed"}. The same value is shown on screen in FOODSCOPE UK and in the CSV export, so the PDF's figures can be matched to the screen. Generated ${generated}.`,
      ),
      style: "small",
    },
    {
      text: t(`Application link: ${r.link}`),
      style: "small",
      link: r.link,
      color: C.accent,
      margin: [0, 4, 0, 0],
    },
    note(r.disclaimer),
  ];

  return {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [...PAGE.margin],
    language: "en-GB",
    info: {
      title: pdfText(`${r.title}: ${r.subject}`),
      author: "FOODSCOPE UK (ConsultingWhere demonstrator)",
      subject: pdfText(r.subtitle),
      keywords: "food security, geospatial, exploratory assessment, FOODSCOPE UK, ConsultingWhere",
      creator: "FOODSCOPE UK",
      producer: "FOODSCOPE UK with pdfmake",
    },
    defaultStyle: { font: "PlexSans", fontSize: 9, color: C.ink, lineHeight: 1.25 },
    styles: {
      title: { fontSize: 22, bold: true, color: C.navy, margin: [0, 0, 0, 4] },
      subject: { fontSize: 15, color: C.teal, margin: [0, 0, 0, 2] },
      h1: { fontSize: 18, bold: true, color: C.navy },
      h2: { fontSize: 13, bold: true, color: C.navy, margin: [0, 10, 0, 4] },
      h3: { fontSize: 10.5, bold: true, color: C.ink, margin: [0, 6, 0, 2] },
      body: { fontSize: 9, color: C.ink },
      small: { fontSize: 7.5, color: C.muted },
      label: { fontSize: 8, bold: true, color: C.ink, margin: [0, 4, 0, 1] },
      caption: { fontSize: 8.5, bold: true, color: C.ink, margin: [0, 0, 0, 3] },
      scope: { fontSize: 8, italics: true, color: C.muted, margin: [0, 0, 0, 6] },
      note: { fontSize: 8.5, color: C.ink },
      th: { fontSize: 7.5, bold: true, color: C.ink },
      td: { fontSize: 7.5, color: C.ink },
      kpiLabel: { fontSize: 7.5, color: C.muted },
      kpiValue: { fontSize: 16, bold: true, color: C.navy, margin: [0, 2, 0, 2] },
      kpiDetail: { fontSize: 7, color: C.ink },
      kpiMeta: { fontSize: 6.5, color: C.muted, margin: [0, 3, 0, 0] },
    },
    header: (currentPage: number) =>
      currentPage === 1
        ? null
        : {
            columns: [
              { text: "FOODSCOPE UK · ConsultingWhere Insights", fontSize: 7, color: C.muted },
              { text: pdfText(`${r.title} · ${r.subject}`), fontSize: 7, color: C.muted, alignment: "right" },
            ],
            margin: [40, 24, 40, 0],
          },
    footer: (currentPage: number, pageCount: number) => ({
      stack: [
        {
          canvas: [
            { type: "line", x1: 0, y1: 0, x2: CONTENT_WIDTH, y2: 0, lineWidth: 0.5, lineColor: C.line },
          ],
        },
        {
          columns: [
            {
              text: "Exploratory geospatial assessment from published open data: not a commissioned food security audit.",
              fontSize: 6.5,
              color: C.muted,
            },
            {
              text: `Page ${currentPage} of ${pageCount}`,
              fontSize: 7,
              color: C.ink,
              alignment: "right",
              width: 70,
            },
          ],
          margin: [0, 4, 0, 0],
        },
        {
          text: pdfText(`Report checksum ${short} · generated ${generated} · data snapshots ${snapshots}`),
          fontSize: 6.5,
          color: C.muted,
          margin: [0, 1, 0, 0],
        },
      ],
      margin: [40, 10, 40, 0],
    }),
    // A heading never ends a page: it moves to the next page with what follows it.
    // pdfmake 0.3 passes node queries (0.2 passed arrays).
    pageBreakBefore: (node: { headlineLevel?: number }, q: { getFollowingNodesOnPage(): unknown[] }) =>
      Boolean(node.headlineLevel) && q.getFollowingNodesOnPage().length === 0,
    content: [...cover, ...contents, ...sections, ...opportunities, ...method],
  };
}
