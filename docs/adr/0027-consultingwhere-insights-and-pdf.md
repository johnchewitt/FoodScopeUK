# ADR-0027 — ConsultingWhere Insights: one report model per assessment, rules in the open, PDF written in the browser with pdfmake

- Status: Accepted (Stage 8)
- Date: 2026-10-26
- Supersedes: ADR-0010 (proposed jsPDF from the profile model)

## Context
John's Stage 8 brief (26 Oct 2026) asks for a "ConsultingWhere Insights — From Geographic Evidence to Action" workspace:
- three assessments: a local authority, a commodity and a Scenario Lab run;
- consultancy opportunities with their evidence and the additional data they need;
- a catalogue of nine generic services and an About page;
- executive PDF reports from reusable templates, with the map, charts, sources, data versions, page numbers and an "exploratory, not a commissioned audit" note;
- CSV, shareable links, saved report configurations and map image export "where technically and legally supported", exposing nothing unpublished;
- the final PDF must reflect the exact map extent, selections, scenarios and dataset versions.

The specification had CI-01 – CI-05 (content, opportunity statements, rules, About, no claims) and EX-01 – EX-05 (PDF from the screen's model with a checksum, A4 with selectable text and embedded fonts, map from the screenshot API, charts from ECharts, CSV). ADR-0010 had proposed jsPDF.

## Decision
1. **One report model.** Each assessment is built by a pure function into a plain JSON `AssessmentReport` (`src/features/insights/report.ts`):
   - key figures and findings, every number an `Indicator` (P1, P2);
   - sections with tables and chart data;
   - work packages, the rules that indicate them, methodology, limitations, sources, datasets and snapshot ids, selections, the disclaimer and the link.

   The panel, the full-report dialog, the PDF and the CSV are all rendered from it. Its SHA-256 (canonical JSON without the link) is shown on screen, in the CSV and in every PDF footer (EX-02).
2. **Built once, from the modules' own data.** `InsightsSync` builds the selected assessment with the earlier modules' hooks:
   - profile, national context, PPFI by council and the Scenario Lab's closure inputs for a council;
   - the trade snapshot, water stress, Defra production and UKFSR port of entry for a commodity;
   - `useActiveScenario` for a scenario.

   It publishes the report to the store. Only the selected kind's hooks run: each kind is its own component.
3. **The map is the module's.** `selectMapModule` maps `insights` to the module an assessment draws on (authority → profiles, commodity → origins, scenario → scenarios). The existing controllers, legends and tooltips serve it unchanged. Framing follows that module's rules.
4. **Small areas for every council** come from the Scenario Lab's UK-wide inputs (`scenario` family). They agree with the deep profiles' shares beyond 1 km for Belfast and Manchester (tested), so every council's assessment has straight-line access by small area. England's IoD deciles are used for England only (P11).
5. **Rules in the open (CI-03).** Each work package is indicated or offered as a supporting capability by a deterministic rule. The rule is printed with its threshold and the observed value ("Why am I seeing this?") and listed in a rules table. Thresholds are shares and counts. No HHI class is called high (P10); nations are compared only with themselves (P11).
6. **Content and claims (P14).** The nine services and About text are structured content (`src/content/consulting.json`, schema `consulting-content`). They are generic and marked `draft-for-approval` until John approves them (D7). A claim audit (client names, credentials, track record, budgets, procurement, day rates; sentences that deny a claim are allowed) runs in tests on the content and on every generated report.
7. **PDF with pdfmake 0.3.12, in the browser, lazy-loaded.**
   - pdfmake is already in the tree at the same locked version (through `@arcgis/core` → `@amcharts/amcharts5`). It lays out flowing text, tables, page breaks, headers, footers with page counts, a table of contents and bookmarks declaratively.
   - jsPDF would need manual layout for multi-page tables.
   - The PDF code is its own chunk (about 290 kB gzipped), loaded only when a PDF is asked for.
   - The URL access policy refuses every external URL. Images are data URLs.
   - Fonts are the app's IBM Plex Sans WOFF files (OFL-1.1), embedded as subsets.
   - Characters the Latin subset lacks (≤ ≥ → Σ ≈) are replaced. A test checks every character of the reports against the font's character map.
8. **Map image.** `src/map/capture.ts` is an SDK-free registry; `captureView.ts` (registered by `MapHost`) captures it.
   - `view.takeScreenshot` captures the visible map: padding excluded, so the area under the panels is left out, at up to twice screen resolution.
   - The extent is computed from the same area's corners.
   - The capture also records scale, basemap style, attribution items and "Powered by Esri".
   - The PDF and the PNG export print the extent, credits and, when an Esri basemap is drawn, Esri's recommended map-image notice (ArcGIS Online terms for static maps: reports are a permitted use with attribution on or near the image).
   - A refused capture (tainted canvas, map not ready) is reported in words and the PDF says the map is not included.
9. **Charts** are ECharts options from the report's chart data: dark in the panel, light on white in the PDF (canvas at 2.5× pixel ratio, legend drawn for the PDF), one value axis each.
10. **Exports and saved configurations.** The CSV lists every indicator with its raw value, the value as shown, provenance, sources, period, coverage and method, with formula injection neutralised.
    - Saved report configurations hold only a re-serialised `?m=insights…` query in `localStorage` (`foodscope.reports.v1`), guarded. Results are always recomputed from current data.
    - The URL holds the assessment type (`ia`) and the existing selection fields.

## Consequences
- The PDF's figures are the screen's by construction. The E2E test downloads the PDF, reads it with pdf.js and compares the key figures, checksum and map extent with the page.
- pdfmake 0.3 has no tagged-PDF support. Reading order follows the document flow and bookmarks are added, but EX-03's "accessible reading order where the library allows" stops short of a tagged PDF.
- The PDF's map is whatever the view shows at export: legends are described in words in the PDF, not drawn.
- Adding an assessment kind means: a builder, its inputs assembler, a gate component, a `selectMapModule` mapping and map extras.
- ADR-0010 (jsPDF) is superseded.
