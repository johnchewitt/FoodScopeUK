# Stage 8 — ConsultingWhere Insights: from geographic evidence to action

| | |
|---|---|
| **Date** | 26–27 October 2026 |
| **Branch** | `stage/8-consulting-insights` (from `main` after PR #23) |
| **Brief** | John's Stage 8 brief (26 Oct 2026): Insights workspace, three assessments, services catalogue, executive PDF, share and export, app-wide UX review, data integrity and security audit, final testing and deliverables |
| **Requirements** | CI-01 – CI-05, EX-01 – EX-05; brief §8 UX refinements (B60–B62 and two new); brief §9 audit |
| **ADR** | ADR-0027 (supersedes the proposed ADR-0010) |

## What was built

### 1. ConsultingWhere Insights workspace

"ConsultingWhere Insights — From geographic evidence to action" is in the left rail (Insights), lazy-loaded like the other modules (`src/features/insights/`).

- **Assessment picker.** Three cards in one radio group, kept in the URL as `ia`:
  - Local authority;
  - Commodity;
  - Scenario.
- **Subject.**
  - Local authority: council search by name or code, with Belfast and Manchester one click away.
  - Commodity: the commodity picker, latest 12 months or a calendar year, net mass or value.
  - Scenario: the Scenario Lab's four scenarios. The current run is used. Saved scenarios open with one click; the closure preset uses Belfast's or Manchester's most relied-on supermarket. The run can be adjusted in the Scenario Lab.
- **Map.** The map is the module each assessment draws on (`selectMapModule`):
  - a council's profile map (council outlined, stores, deep-profile small areas);
  - the trade map;
  - the Scenario Lab's map.
- **Key figures.** Four cards from the report, every value an `Indicator`.
- **Panel.** Three tabs:
  - **Assessment:** the report, each finding with its evidence (indicators with provenance) behind a disclosure;
  - **Services:** the nine services;
  - **About ConsultingWhere.**
- **Full report.** "Open full report" shows the same report as a document, in a wide dialog, with the services.

### 2. The three assessments

They are built from published data by pure, tested functions (`authority.ts`, `commodity.ts`, `scenario.ts`). The report sections, figures, sources and rules are in `docs/insights-methodology.md`.

- **Local authority** (brief §2). It covers:
  - executive summary;
  - food retail network: coverage, retailer composition, concentration, straight-line access;
  - community vulnerability: PPFI within the nation, households without a car, England's deprivation, small areas for further investigation;
  - national supply context, labelled as such;
  - seven work packages: John's seven opportunities, each with its rule, evidence and the data it needs.

  Every council has small-area access figures. They come from the Scenario Lab's UK-wide inputs and agree with the deep profiles for Belfast and Manchester.
- **Commodity** (brief §3). It covers:
  - recorded partners;
  - seasonal sourcing (month by month, dominant partners);
  - import concentration;
  - historical change across complete years, with series breaks;
  - Defra's UK production where it publishes a balance;
  - possible geographic exposure: partners' water stress, estimated exposure to the largest partner, and UKFSR's port of entry for all foods;
  - data gaps;
  - six work packages.
- **Scenario** (brief §4). The Scenario Lab run's:
  - parameters, with user assumptions marked;
  - baseline, assumptions, results and confidence;
  - geographic consequences;
  - sensitivity (the same run at other intensities);
  - limitations and what the results do not mean;
  - possible interventions.

  "Estimated exposure", never a shortage or a confirmed operational impact (a test audits the wording).

### 3. Services catalogue

The nine services of the brief are structured content (`src/content/consulting.json`, schema `consulting-content`). Each has challenges, approach, deliverables, value and stakeholders by role. With the About text, they are **generic drafts marked "draft for approval"** (D7). The review copy is `docs/consulting-services.md`.

No clients, projects, accreditations, contracts or prices appear. A claim audit runs in tests on the content and on every generated report.

### 4. Executive PDF

The PDF is written in the browser with pdfmake 0.3.12 (lazy chunk, about 290 kB gzipped), from the same report model as the screen (ADR-0027). It has:
- A4 portrait, selectable text, embedded IBM Plex Sans, bookmarks;
- a cover with the ConsultingWhere text wordmark (D3: no approved logo yet), the FOODSCOPE UK identity, title, subject, key figures with provenance, executive summary and the exploratory note;
- contents and selections;
- **the map as shown**: the visible area (padding excluded), its extent corners, scale, basemap, credits and, with an Esri basemap, Esri's map-image notice;
- the sections, with charts (light, 2.5×) and tables;
- work packages with their rules;
- methodology, limitations, sources, dataset snapshots with retrieval dates, attributions, the full SHA-256 checksum and the link;
- on every page, a footer with the exploratory note, "Page n of N", the short checksum, generation time and data snapshots.

Belfast's report is 13 pages and Manchester's 14. Each takes about 9–12 s in the sandbox's software-rendered browser.

### 5. Share and export

- **CSV:** every indicator, with raw value, value as shown, provenance, sources, period, coverage and method; then the disclaimer, data attributions, snapshots, checksum and link.
- **Map image (PNG):** the visible map with a strip for title, extent, scale, basemap, credits and Esri's notice.
- **Copy link:** the URL holds the assessment and every selection.
- **Saved report configurations** (`localStorage foodscope.reports.v1`): only the re-serialised query is kept, and figures are rebuilt from current data.

Nothing unpublished or restricted is held or exported.

### 6. App-wide UX review: five refinements

1. **Search** in the top bar and on the `/` key. It finds councils (profile or assessment), commodities (Food Origins or assessment) and modules. The button had been a placeholder since Stage 1.
2. **Export** in the top bar opens the matching ConsultingWhere Insights assessment (council, commodity on screen, or the Scenario Lab run) with its PDF, CSV and map image. It was also a placeholder.
3. **Laptop key figures (B62).** With both panels open, the four cards share the free map width. At 1366 px all four are visible (149 px each) instead of the fourth sliding under the panel.
4. **Phone sheet (B61).** A button lowers the open panel to a short strip so the map shows, and raises it again.
5. **Evidence dialog (B60).** Long URLs, codes and attributions wrap at tablet width (overflow measured 0 px at 820 px).

### 7. Security, integrity and licensing audit

The full results are in `docs/security-and-licensing.md`. In short:
- **Fixed:**
  - chart tooltip HTML is sanitised;
  - Esri's map-image notice and data attributions are on exports;
  - pytest 9.0.3 in the pipeline (PYSEC-2026-1845);
  - third-party notices for the 185 redistributed packages, linked from Help and kept current by a test.
- **Checked:**
  - no secrets in files or history;
  - only the basemap key reaches the client bundle (public by design);
  - `npm audit` reports 0;
  - CI permissions are least-privilege;
  - every figure has provenance.
- **Open before publication:**
  - confirm the key's privileges and referrers;
  - GEOLYTIX terms for client-facing PDFs (B68);
  - ConsultingWhere's approval of copy and branding (D3, D7);
  - certifi after 3 Nov (B65);
  - Actions pinned to SHAs (B66);
  - a tested CSP (B67).

## Tests and checks run

RESULTS_PLACEHOLDER

## What was not verified, and why

- **With the Esri basemap and a real GPU.** The sandbox cannot reach the Esri CDN or basemap service. Maps and PDFs here use the offline outline map in software WebGL. Not yet seen live:
  - a PDF with the dark or light grey basemap;
  - Esri's notice beside it;
  - its credits.

  These are part of the live checks (B48, B64), with the PDF on the live site.
- **ArcGIS key restrictions.** These are only visible in John's ArcGIS Location Platform account.
- **Accessibility of the PDF itself.** It is not a tagged PDF (pdfmake 0.3), so screen-reader structure was not tested. Bookmarks and reading order follow the document.
- **The printed result.** Fonts, sizes and colours were checked on rasterised pages at 50–90 dpi, not on paper.
- **Real phones.** Phone layouts were checked at 390 × 844 in headless Chromium, not on a device.
- **Approval of the copy.** The services and About text, the work package wording and the rule thresholds are a draft for John and ConsultingWhere to review. The thresholds are simple screening rules, not policy thresholds.

## Open questions for John

1. **D7.** Approve, or edit, the nine services and the About text (`docs/consulting-services.md`). Once approved, `status.approval` becomes `approved` and the "draft" note disappears.
2. **D3.** Supply ConsultingWhere logo files and confirm the PDF may say "ConsultingWhere Insights". The cover and footer currently use a text wordmark.
3. **B68.** Are you content to print GEOLYTIX store names and counts in client-facing PDFs under GEOLYTIX's "free and open to use" statement, or should we ask GEOLYTIX?
4. **Thresholds.** Keep the screening thresholds as drafted (`docs/insights-methodology.md` §5), or set your own?
5. **The live checks.** Make a PDF on the live site with the basemap on (B48, B64).
