# FOODSCOPE UK — Product Specification

| | |
|---|---|
| **Document** | 01 — Product specification |
| **Version** | 0.1 — planning baseline |
| **Date** | 23 October 2026 |
| **Status** | Draft for review by ConsultingWhere |
| **Source brief** | [`00-ORIGINAL-BRIEF.md`](00-ORIGINAL-BRIEF.md) (unchanged copy of the commissioning prompt) |
| **Companion documents** | [`02-ARCHITECTURE.md`](02-ARCHITECTURE.md) · [`03-DATA-SOURCES.md`](03-DATA-SOURCES.md) · [`04-ROADMAP.md`](04-ROADMAP.md) · [`../CLAUDE.md`](../CLAUDE.md) |

This document turns the brief into testable requirements. Where the brief and this specification differ, this specification records the reason (usually a verified data constraint found during Stage 0 research). Requirement IDs (e.g. `FO-03`) are stable and are referenced by the roadmap, tests and commit messages.

---

## 1. Purpose and positioning

FOODSCOPE UK is a browser-based geographic intelligence application that shows how the United Kingdom's food supply is sourced, how that sourcing changes through the year, where food retail provision and food-access vulnerability sit on the map, and how exposed the system is to plausible disruptions. It is a **flagship demonstrator for ConsultingWhere**: it must be visually exceptional, but its first job is to be credible in a room with Defra, devolved administrations, local authorities, retailers and infrastructure operators.

### 1.1 What it is

- An interactive national map-centred application combining official trade, food-security, retail-location, population, deprivation and boundary data.
- A transparent analytical tool: every number carries its source, reference period, unit, coverage and method.
- A structured conversation starter for consulting engagements (local authority food-access reviews, supply-chain geographic risk assessments, digital-twin and dashboard work).

### 1.2 What it is not

- Not an operational food-supply monitoring system and not real-time. Data is refreshed monthly (trade), quarterly (retail points) or annually/irregularly (most other sources), and the interface says so.
- Not a shortage predictor. Scenario outputs are *exposure estimates under stated assumptions*.
- Not a view of any retailer's supply chain. Public trade statistics cannot link imports to stores, and the app never implies that they do.
- Not a single "food security score". Different risk concepts stay separate and explainable.

### 1.3 Audiences

| Persona | Typical question | Primary modules |
|---|---|---|
| National policy analyst (Defra, DAERA, Scottish/Welsh Government) | "How concentrated are our recorded tomato import partners in winter, and how has that changed since 2022?" | Food Origins, Seasonal Supply, Risk Explorer |
| Local authority officer (e.g. Belfast City Council, Manchester City Council) | "Which neighbourhoods combine low car access, high deprivation and distance from a supermarket?" | Food Access, Local Authority Profiles |
| Retail / property analyst | "Where is supermarket provision thin relative to population?" | Supermarket Network, Profiles |
| Infrastructure resilience planner | "What share of perishable food imports relies on the Short Straits?" | Risk Explorer, Scenario Lab |
| ConsultingWhere consultant (demo mode) | "Show the client what spatial analysis could reveal, and what it would take." | Consulting Insights, Profile export |

---

## 2. Integrity principles (non-negotiable)

These principles override visual or feature requirements. They are referenced by ID in `CLAUDE.md`, code review and tests.

| ID | Principle | Practical consequence |
|---|---|---|
| **P1** | **Provenance on every number.** | Every displayed indicator carries source, reference period, unit, coverage, method and provenance class. A UI value without metadata is a defect. |
| **P2** | **Five provenance classes, always visible.** | `Measured` · `Official estimate` · `Derived` · `Scenario-modelled` · `Illustrative`. Shown as a badge on every metric, chart and export. |
| **P3** | **Trade terminology is precise.** | HMRC headline import statistics allocate partner country by *country of dispatch*, which may differ from where food was grown (verified — see `03-DATA-SOURCES.md` §S01). Use "recorded import partner" or "country of dispatch". Never "where our food is grown" for HMRC figures. |
| **P4** | **Arcs are not routes.** | Flow lines are symbolic partner-to-UK connections. Legends and tooltips say so. Lines never terminate at specific ports unless the data is port-level. |
| **P5** | **No retailer supply attribution.** | Trade data is never linked to named supermarkets, fascias or stores. |
| **P6** | **National context ≠ local measurement.** | National indicators shown inside a local profile carry a "National context" label and are visually separated from local measurements. |
| **P7** | **Proximity ≠ access.** | Straight-line distances are always labelled "straight-line distance" and never as walking or driving time. Supermarket proximity is never presented as affordability or nutritional access. Store counts are never presented as a complete access indicator. |
| **P8** | **Import dependency ≠ food insecurity.** | Copy, charts and insights never equate the two. |
| **P9** | **Scenarios estimate exposure, not shortages.** | Scenario outputs are labelled `Scenario-modelled`, show their assumptions alongside the result, and default substitution to an explicit user assumption (not a hidden model). |
| **P10** | **No composite score across incompatible concepts.** | The Risk Explorer keeps national supply, logistics and local access components separate; any weighting is user-controlled, documented and accompanied by sensitivity analysis. |
| **P11** | **Comparability warnings.** | Comparisons across UK nations, different statistical years, index versions (e.g. PPFI v1 vs v2) or series breaks raise a visible warning. |
| **P12** | **Missing data is shown, not hidden.** | No-data renders as a neutral pattern/grey with its own legend entry. Suppressed trade is shown as its own bucket. Gaps are never interpolated silently. |
| **P13** | **Transparency over false precision.** | Rounding rules (§6.4) reflect source precision. Percentages of small totals are flagged. |
| **P14** | **No fabricated claims.** | No invented data, endpoints, fields, staff credentials, project references, client procurement needs or budgets. Consulting outputs describe *possible* work, not stated demand. |

---

## 3. Scope by release

The brief asks for a complete, tested first release over an extensive unfinished one. Scope is therefore cut into three releases.

| Capability | Release 1 (first release) | Release 2 | Release 3 |
|---|---|---|---|
| App shell, design system, 2D map, help, evidence & limitations page | ✅ | | |
| Food Origins (16 commodities, partner choropleth, flows, KPIs, concentration) | ✅ | | |
| Seasonal Supply (timeline, play, heatmap, year comparison) | ✅ imports | + domestic production overlays | |
| Supermarket Network (GEOLYTIX, clustering, filters, search, details) | ✅ | + density surfaces | |
| Local Authority Profiles | ✅ any LAD (basic) · **Belfast & Manchester (deep)** | deep profiles for all LADs | |
| Authority comparison | ✅ 2–4 LADs, basic indicators | full benchmarking by authority type | |
| Food Access & Vulnerability (national small-area layers) | demo LADs only | ✅ national | |
| UK Food Resilience — Risk Explorer (three views, explanations; Stage 6) | ✅ | + user weights and sensitivity (RK-05) | |
| Scenario Lab | ✅ Import disruption (A/E), Store closure (D) | ✅ Short Straits (B), Wheat harvest (C) | |
| Consulting Insights + opportunity statements | ✅ | | |
| PDF export of profiles | ✅ | + scenario & insight exports | |
| Ask FOODSCOPE | | ✅ deterministic command engine | LLM via secure backend |
| 3D globe mode | | ✅ | |
| Network travel-time catchments | | | ✅ pre-computed |
| ArcGIS Online publishing scripts | config-driven consumption only | | ✅ |

"Basic" LAD profile = sections A, B and D (§5.5) from national datasets. "Deep" profile adds C, E, F and G with small-area data.

---

## 4. Application layout and shell (SH)

### 4.1 Layout regions

| Region | Desktop (≥ 1440 px) | Laptop (1280–1439) | Tablet (768–1279) | Mobile (< 768) |
|---|---|---|---|---|
| Top bar | 56 px; brand left, current module and its question centre, utilities right | question hidden | tool labels hidden | brand, menu, help, controls and insights buttons |
| Left navigation rail | 76 px, icon + short label per module | same | same | drawer from the menu button |
| Collapsible controls panel | 312 px | 288 px | overlay (one panel at a time) | bottom sheet |
| Map | full-bleed behind floating panels; **≥ 60 % of the viewport width unobstructed between the side panels at 1920 × 1080 with both open** | | | full screen |
| Right insights panel | 340 px, collapsible | 320 px | overlay | bottom sheet |
| Bottom timeline | 72 px, spans map width | | | compact stepper |
| Floating KPI cards | top of the map area, one row; all cards fit at 1920 px | as many as fit; the row scrolls sideways (fade, snap, keyboard) — **no card is ever hidden** (review 23 Oct 2026) | same | swipeable row |

### 4.2 Requirements

- **SH-01** Top bar shows "FOODSCOPE UK", subtitle "Food Security & Supply Chain Intelligence" and a subtle "Powered by ConsultingWhere" attribution.
- **SH-02** Module navigation in a left-hand rail (changed from top-centre at John's Stage 1 instruction): Food Origins · Seasonal Supply · UK Food Access · Risks (UK Food Resilience — Risk Explorer) · Local Authority Profiles · Scenario Lab · Consulting Insights. Modules not yet built show what they will contain and when ("Added in build stage N" / "Planned for Release N") rather than being hidden, so demos can describe the full vision honestly.
- **SH-03** Utilities: Search (places, authorities, commodities, stores), Help, Export, **Data freshness indicator** (latest reference period per source family, colour-coded by age against expected cadence), 2D/3D toggle (disabled with tooltip until Release 2).
- **SH-04** Application state is reflected in the URL query string (module, commodity, year, month, LAD codes, filters, scenario parameters) so any view can be bookmarked or shared and so demos are reproducible.
- **SH-05** Every panel implements five data states: loading (skeleton), empty, error (with retry and plain-English cause), partial (some sources failed — say which) and stale (data older than expected cadence).
- **SH-06** Evidence & Limitations page reachable from every module and from every provenance badge.
- **SH-07** Map remains interactive while side panels load; panel errors never blank the map.
- **SH-08** Curated basemap choice (added 23 Oct 2026, scheduled for Stage 4), not a full gallery:
  - **Dark grey:** the default.
  - **Light grey:** for presentations, bright rooms and print.
  - **Imagery with labels:** offered only at local scales (supermarkets, food access, authority profiles). Local scale is zoom 12 and closer (about 1:144,000; ADR-0022), the same scale from which stores are drawn individually and councils outlined.

  Rules:
  - Each style has its own colour set for the data layers (share classes, connections, panels), checked with the dataviz validator against that style's land colour measured on the live site. A style without a checked colour set is not offered.
  - The choice is a bespoke map control (ADR-02) and part of the URL state (SH-04).
  - Attribution follows the style and is never hidden.
  - Without an API key the control is hidden and the offline outline map is used.

---

## 5. Functional requirements by module

### 5.1 Food Origins Explorer (FO) — Release 1, flagship

**Data**: HMRC Overseas Trade Statistics (OTS) via pre-built snapshots (§S01), commodity baskets (§6.1), country geometries (§S24).

- **FO-01** Commodity selector with icon, search and keyboard navigation for the 16 initial commodities: tomatoes, strawberries, apples, potatoes, bananas, oranges, wheat, rice, beef, lamb (sheep meat — see §6.1), poultry, cheese, milk products, sugar, coffee, cocoa.
- **FO-02** For the selected commodity and period, shade recorded import partners by share of recorded import net mass (default) or value (toggle). Non-partners render neutral; suppressed/unallocated trade is listed separately (P12).
- **FO-03** Draw symbolic curved connections (smooth curves in map space, deliberately not great-circle or shipping routes — ADR-0005) from each partner's representative point (Natural Earth label point) to a single UK anchor. Width scales linearly with recorded net mass within stated min/max clamps shown in the legend. Top-N partners (default 12, adjustable) plus an "all others" aggregate in the side panel avoid visual clutter.
- **FO-04** Subtle animated flow along arcs and a soft glow on selected partners. Disabled when `prefers-reduced-motion` is set or the user turns motion off. (Stage 2: moving markers on a canvas overlay, ADR-0015.)
- **FO-05** KPI cards: total recorded imports (tonnes, £), number of partners, top partner and share, top-3 share, HHI and effective number of partners (§6.2), change vs same period previous year.
- **FO-06** Partner table: rank, partner, tonnes, £, share, YoY change in share (percentage points). Clicking a row or a country highlights both.
- **FO-07** Period selector: single month, rolling 12 months, or calendar year. Default: latest 12 complete months.
- **FO-08** "Supplier pattern changes" card: partners entering/leaving the top 5, and largest share gains/losses vs the comparison year.
- **FO-09** UK production context card where a comparable annual Defra figure exists (§S06–S10), shown side by side with annual recorded imports for the same year — **no computed "share of supply"** unless Defra publishes that ratio.
- **FO-10** Persistent caveat chip: "Partner = country of dispatch recorded by HMRC; may differ from country of origin. Lines are symbolic, not shipping routes." Links to Evidence page.
- **FO-11** Series-break markers on any trend that spans January 2021 or January 2022 (changes to GB–EU import data collection — §S01).

**Acceptance**: selecting a commodity changes the choropleth, arcs, KPIs and table from real snapshot data; values for one commodity/month reconcile to a direct HMRC API query documented in tests.

### 5.2 Seasonal Supply Explorer (SS) — Release 1 (imports), Release 2 (production overlays)

- **SS-01** Bottom timeline with January–December month steps, year selector and optional comparison year.
- **SS-02** Changing month recalculates partner shares, arcs, KPIs and highlights with restrained transitions (≤ 400 ms; instant under reduced motion).
- **SS-03** Play/pause 12-month animation (default 1.2 s per month; adjustable; keyboard accessible; stops at user interaction).
- **SS-04** Seasonal heatmap: months (x) × top partners (y), colour = net mass or share (toggle), with a fixed scale for year-to-year comparison (P11). Missing months are hatched and labelled.
- **SS-05** Year comparison: side-by-side heatmaps or difference view (percentage points), using identical colour breaks.
- **SS-06** Monthly concentration line (HHI by month) to identify seasonal concentration.
- **SS-07** Toggle **Imports | Domestic production | Combined context**. Domestic production shows only where Defra publishes a monthly series (meat and milk families; see §S06–S08). For commodities without monthly production data the toggle explains why and shows the annual figure instead. Combined context places the two series on separate, labelled axes; it never divides one by the other (brief §6).
- **SS-08** Natural-language example answered by the UI state: "How does the UK's tomato supply change between January and July?" → tomatoes, months 1 and 7, comparison view.

**Stage 3 status (23 Oct 2026):** built for the five Stage 2 baskets (`docs/stage-reports/stage-3.md`; ADR-0017).
- SS-01: year, comparison year (default: the year before) and a comparison month.
- SS-02: widths ease ≤ 320 ms; nothing else is interpolated; fixed width scale across months and years.
- SS-03: ½×, 1× and 2× speed; Space, Page Up and Page Down on the slider.
- SS-04: share or amount view, with fixed classes the same for every year and commodity.
- SS-05: as a difference view in percentage points, with five fixed classes. Side-by-side years come from the year selector (identical classes), not two heatmaps in one panel.
- SS-06: monthly HHI line.
- SS-07: "Imports" only. "UK production" and "Combined" are shown as unavailable, with the reason: Defra publishes production of these baskets annually, not monthly (S09, S10, verified 25 Oct 2026). The annual figures appear as national context in Local Authority Profiles (LP-05), never combined with monthly trade.
- SS-08: an example button sets tomatoes, January and July of the latest complete year.

### 5.3 UK Supermarket Network (SM) — Release 1

**Data**: GEOLYTIX Grocery/Supermarket Retail Points (§S11), configurable to a hosted ArcGIS FeatureLayer.

- **SM-01** Load all retail points from the default static snapshot or from a FeatureLayer URL set in `config.json` (§ADR-08 in architecture).
- **SM-02** Point clustering at national/regional scales; individual symbols at local scales; high-DPI symbols.
- **SM-03** Retailer filter (multi-select with counts) and **store class filter** derived from the dataset's actual size/format fields (e.g. `size_band`) — classes are defined only after inspecting the delivered values (Stage 2 gate). Default view: supermarkets; convenience and other formats are toggleable layers, visually distinct.
- **SM-04** Symbols: brand-neutral by default (shape/colour by store class). Retailer-specific colouring is optional and uses a categorical palette, not retailer logos, unless logo use is approved.
- **SM-05** Store search by name, town or postcode (within the dataset); map-driven selection; store detail card showing only fields present in the data plus source and snapshot date.
- **SM-06** Store counts by LAD and stores per 10,000 residents (§6.3) as a choropleth with fixed, documented class breaks and a no-data class.
- **SM-07** Proximity tool: click a point → nearest N stores with straight-line distance; radius tool with user-set distance. Labels per P7.
- **SM-08** Retail network density: stores per km² and per 10,000 residents by LAD; kernel density surface deferred to Release 2.
- **SM-09** Summary chart comparing provision across selected areas, with denominators stated.
- **SM-10** Always-visible note: "Store counts and distances describe physical provision only; they do not measure affordability, choice or nutritional access."

### 5.4 UK Food Access & Vulnerability (FA) — demo LADs in Release 1, national in Release 2

**Data**: PPFI (§S13), deprivation indices (§S19), car availability (§S20), population (§S18), rurality (§S21), small-area boundaries (§S15–S17).

- **FA-01** Small-area choropleths per nation using that nation's official geography (LSOA 2021 in England & Wales; Data Zones 2022 in Scotland; Data Zones 2021 / SOAs in Northern Ireland — final choice depends on indicator availability).
- **FA-02** Indicators shown separately: PPFI (and its domains where available), deprivation rank/decile **within nation**, % households without a car or van, population density, age structure (share 65+), rurality class.
- **FA-03** Straight-line proximity from small-area population-weighted centroids (or best available representative point, stated) to the nearest qualifying store; user-adjustable thresholds (default 1, 2, 5 km); population beyond threshold.
- **FA-04** Combined "attention flags" are rule-based and transparent (e.g. "beyond 2 km straight-line AND top-20 % deprivation within nation AND ≥ 40 % no-car households"), editable by the user, never a hidden composite.
- **FA-05** Nation comparability banner whenever indicators from different nations or vintages appear together (P11).
- **FA-06** Network travel time (walk/drive/public transport) only when computed from a real network with documented assumptions (Release 3); until then the UI states that travel times are not modelled.

### 5.5 Local Authority Food Security Profiles (LP) — Release 1 flagship

- **LP-01** Select any UK LAD from search, map click or list → map flies to the authority boundary and the profile opens.
- **LP-02 A. Area overview**: name, nation, GSS code, area (km²), population and reference year, urban/rural characterisation from the nation's classification, sources and dates.
- **LP-03 B. Food retail network**: total mapped stores by class and retailer, stores per 10,000 residents, map of store locations, coverage summary (share of population within thresholds — deep profiles only), potential underserved neighbourhoods (deep only).
- **LP-04 C. Community food accessibility** (deep): car availability, deprivation, PPFI indicators, selected small-area vulnerabilities, population potentially affected by access gaps under the user's thresholds.
- **LP-05 D. Wider food-system exposure** — all labelled **National context**: national import concentration for key commodities, food price trends (CPIH food), relevant domestic production, Short Straits dependence evidence (UKFSR 2024), documented climate/agricultural risks from Defra publications. P6 applies.
- **LP-06 E. Interactive geographic assessment** (deep): authority boundary, stores, small areas, vulnerability layers; click a neighbourhood for its indicator card; calculation and source panel.
- **LP-07 F. Authority comparison**: 2–4 LADs side by side; benchmarks against authorities of a similar type where an official classification exists; comparability warnings across nations and vintages.
- **LP-08 G. ConsultingWhere Food Security Opportunity Assessment**: key findings, potential vulnerabilities, evidence, uncertainty/limitations, recommended follow-up analysis, opportunities for investigation, possible work packages. Generated deterministically from templates and computed indicators (no free-text model output in Release 1).
- **LP-09 H. Export to PDF** (EX-01..05).
- **LP-10** Initial deep profiles: **Belfast (N09000003)** and **Manchester (E08000003)** — codes verified against the ONS LAD May 2025 boundary service.

**As built (Stage 5, 25 Oct 2026; ADR-0023):**
- LP-01: search by name or GSS code, a list with a nation filter, shortcuts to the deep profiles, or a click on the map. The map fits the council (up to zoom 13) and outlines it; the council stays selected in every module and in the URL (`lad`).
- LP-02: name, nation, code, mid-2025 population, land area, density, urban/rural class where the nation publishes one at council level (ONS 2021 RUC for England and Wales; "Data unavailable" for Northern Ireland and Scotland), Census 2021 car availability (not Scotland), and the date of each source.
- LP-03: stores by type and retailer (donut, table and store list), supermarkets and all stores per 10,000 residents, retailers represented and concentration (§6.3). Underserved neighbourhoods are in the deep profiles (LP-04).
- LP-04 and LP-06 (deep profiles): straight-line accessibility (§6.3) at 1, 2 and 5 km with the underserved areas listed (car availability beside them); PPFI v2.1 (combined and the seven domains) and the nation's deprivation index, each on its own geography and ranked within the nation; a small-area map with fixed classes (deciles in five classes, deciles 1–2 most salient; no car or van 15/30/45/60 %; straight-line distance 0.5/1/2/5 km; no data hatched). Clicking an area opens its card; clicking a chart bar (or its keyboard button) outlines the areas of that class on the map.
- LP-05: recorded imports (largest partner's share over the latest 12 months, HMRC) and UK production share of supply (Defra, annual) for the Food Origins baskets, labelled National context. CPIH food prices, Short Straits dependence and climate risks are not included yet (sources not verified in this stage).
- LP-07: the selected council and up to three others, in the order chosen, never ranked. Each row says how far it compares: UK-wide definitions; Census 2021 (not Scotland); ranked within each nation; each nation's own classification. A banner appears when the councils are in different nations. Benchmarks against authorities of a similar type follow in Release 2.
- LP-08: provisional "Consulting opportunities" prompts from transparent rules on the figures shown, with "why am I seeing this?"; expanded in Stage 8 (Consulting Insights). No requirement, budget or procurement is implied.

### 5.6 UK Food Resilience — Risk Explorer (RK) — Release 1 (Stage 6); RK-05 Release 2

Moved into Release 1 by John's Stage 6 brief (25 Oct 2026; roadmap §1, §8). Design: ADR-0024.

- **RK-01** Three separate views, one map: International supply · Logistics · Community access (`rv` in the URL). Each view has its own controls, KPI cards, charts, legend, tooltip and explanation.
- **RK-02** International supply exposure, per commodity basket and period (shared with Food Origins):
  - recorded imports, number of partners, top-supplier and top-three shares, HHI (0–10,000, §6.2), year-on-year change, and monthly concentration (HHI heatmap, fixed classes of 1,000);
  - a ranking of the baskets by HHI and a commodity–country matrix;
  - estimated exposure to one supplier's disruption: its share of recorded imports over the period and by month, never a shortage;
  - partners' national water stress (FAO SDG 6.4.2, §S30) as a map fill, with a no-data class;
  - Defra's annual UK production share as national context (§S09, §S10), never combined with monthly imports;
  - zero, suppressed and non-country trade and commodity-code changes shown as such.
- **RK-03** Food logistics and infrastructure:
  - major ports (DfT PORT0499, §S23): inward freight from abroad, agricultural products inwards, or roll-on/roll-off inwards, 2015–2025, as proportional circles;
  - UKFSR 2024 port-of-entry and Short Straits shares of food, feed and drink imports (§S03), shown as published, never derived from DfT tonnage;
  - England's Strategic Road Network delay (§S03);
  - strategic road corridors for Great Britain (OS Open Roads, §S35) and Northern Ireland (OpenStreetMap motorways and primary roads, §S38; community-mapped, not official, labelled as such; added at John's request);
  - railway lines for Northern Ireland (Translink NIR network, 2015, §S37; added at John's request);
  - agricultural production regions (Defra June survey 2025, §S31, on ITL1, §S33).

  Rail freight, distribution centres and Great Britain's railway lines are listed as not available, with the reason. HMRC port-level commodity trade (§S28) is not used (gate G13).
- **RK-04** Community food access:
  - every council's share of small areas in its nation's two highest-priority deciles of the Priority Places for Food Index v2.1 (§S13), combined or by domain;
  - ranked within its own nation only (ties marked);
  - Northern Ireland's three missing domains shown as no data;
  - small areas by decile, urban/rural context (England and Wales) and a link to the council's profile.
- **RK-05** *(Release 2.)* Within a view, the user may combine normalised indicators with user-set weights. The method (normalisation, direction, weights) is shown beside the result. Sensitivity analysis: one-at-a-time weight perturbation (±25 %) and random weight sampling (Dirichlet, n = 500) reporting rank stability (median rank, 5th–95th percentile). Not built in Stage 6: no published indicators within a view share a unit and direction yet.
- **RK-06** No cross-view composite score (P10).
- **RK-07** "Explain this risk" for the selected subject (commodity, port network, port, road corridors, farming region, council). It sets out:
  - what is measured, why it matters and how it is calculated;
  - the observed evidence (values with provenance);
  - sources, limitations, evidence that would help, and general options (never recommendations or an organisation's needs);
  - separately and labelled, an interpretation that is never a forecast or probability.
- **RK-08** Linked selection: a click on a chart bar, table row or map feature selects the commodity, partner, port or council everywhere (map, cards, charts, explanation, URL); keyboard alternatives exist for every chart selection.

### 5.7 Scenario Lab (SC)

Common requirements:

- **SC-01** Each scenario has: description, observed baseline (with sources), model inputs, user assumptions (sliders), outputs, uncertainty notes. These five are visually distinct groups (brief §11).
- **SC-02** Sliders: disruption intensity (%), duration (months), recovery profile (immediate / linear over N months), substitution assumption (default **0 %**, labelled "user assumption — no evidence of actual substitution capacity").
- **SC-03** Baseline vs scenario shown side by side on map, KPIs and charts; reset to baseline always available.
- **SC-04** Output wording: "estimated exposure" / "volume of recorded imports affected"; never "shortage", "empty shelves" or retailer impact.
- **SC-05** Every scenario run is reproducible from the URL.

Scenarios:

| ID | Release | Scenario | Method summary (full formulas §6.5) |
|---|---|---|---|
| **SC-A/E** | 1 | Country × commodity import disruption (Spanish tomatoes is the preset; any partner/commodity selectable — this generalises brief scenarios A and E) | Apply reduction to the partner's recorded monthly net mass over the disruption window with recovery profile; report affected tonnes, share of recorded imports affected by month, post-disruption partner shares and HHI. |
| **SC-D** | 1 | Supermarket closure | Remove the selected store; recompute straight-line nearest-store distance for affected small areas; report change in population beyond each threshold and in mean/median distance, by deprivation decile. |
| **SC-B** | 2 | Short Straits / Port of Dover disruption | Uses published UKFSR 2024 shares of import volume via the Short Straits by commodity group as the *observed* input; HMRC port-level data only if verified suitable. User sets disruption intensity and duration. |
| **SC-C** | 2 | UK wheat harvest reduction | Applies a user shock to the latest Defra annual wheat production; reports the change alongside recorded imports and Defra's published supply context. No inventory or substitution modelling. |

### 5.8 ConsultingWhere Insights (CI) — Release 1

- **CI-01** Ten workstream definitions (brief §12) held as structured content (`content/workstreams.json`).
- **CI-02** For the current selection (authority, commodity or scenario), generate an opportunity statement: challenge, available evidence (linked indicators), what spatial analysis could reveal, additional datasets needed, proposed tasks, potential deliverables, relevant stakeholders (by role, not named individuals), limitations and dependencies.
- **CI-03** Rules map evidence patterns to workstreams (e.g. high partner concentration → Supply Chain Geographic Risk Assessment). Rules are listed on the page ("Why am I seeing this?").
- **CI-04** "About ConsultingWhere": generic capability description approved by ConsultingWhere. No staff qualifications, client names, project references or credentials unless supplied and approved (P14).
- **CI-05** No statement that any organisation has a requirement, budget or procurement (P14).

### 5.9 Ask FOODSCOPE (AF) — Release 2 (deterministic), Release 3 (LLM)

- **AF-01** Floating command panel with suggested prompts (brief §13 examples).
- **AF-02** Deterministic parser: intents (show commodity, set month/year, compare months, filter retailers, locate place, open profile, compare authorities, run scenario, list consulting services) with gazetteers for commodities (and synonyms), months, LAD names/aliases (e.g. "Belfast City Council" → N09000003), retailers.
- **AF-03** Every answer is a state change plus a short templated explanation citing sources; unknown intents return suggestions, never invented answers.
- **AF-04** Release 3 LLM mode runs only through a secure backend; the model can call only the same command and data-retrieval functions; factual statements must cite retrieved records.

### 5.10 Cross-cutting

**Evidence & provenance (EV)**

- **EV-01** Indicator metadata envelope (architecture §5.2) on every value.
- **EV-02** Source badge → popover with title, publisher, licence, reference period, retrieval date, method, link.
- **EV-03** Evidence & Limitations page generated from the data manifest plus curated caveats; includes the full verification log from `03-DATA-SOURCES.md`.

**Export (EX)**

- **EX-01** Profile PDF: ConsultingWhere branding (approved assets only), location map, key indicators with provenance classes, charts, food-access analysis, resilience challenges, recommendations, full sources and limitations, generation timestamp, data snapshot ID and the app URL that reproduces the view.
- **EX-02** Export is generated from the same in-memory profile model used for the screen; a checksum of that model is printed in the PDF footer and logged, so exported figures exactly match the screen (brief §9H).
- **EX-03** A4 portrait, selectable text (not a page screenshot), embedded fonts, accessible reading order where the library allows.
- **EX-04** Map image via the view's screenshot API; charts via ECharts image export.
- **EX-05** Also export CSV of the indicators in the profile.

**Accessibility (AX)** — target WCAG 2.2 AA

- **AX-01** Contrast: palette checked (§7.2). Muted text only on navy/emerald or panels whose effective background is at least as dark as teal `#0A444A`.
- **AX-02** Full keyboard operation of navigation, selectors, timeline, play/pause, sliders, tables; visible focus rings (cyan, 2 px).
- **AX-03** Map content has a non-map equivalent (partner table, store list, indicator tables).
- **AX-04** `prefers-reduced-motion` honoured; in-app motion toggle.
- **AX-05** Colour is never the only carrier of meaning (patterns/labels for provenance classes, no-data and warnings).
- **AX-06** Charts expose data tables and ARIA descriptions.

**Performance (PF)**

- **PF-01** First meaningful paint of shell < 2.5 s; map ready < 4 s on a 2020-era laptop over typical broadband (measured in CI with throttling profile, informative only).
- **PF-02** Initial data payload ≤ 2.5 MB compressed; module data lazy-loaded.
- **PF-03** Interactions (commodity/month change) update map and charts < 300 ms after data is cached.
- **PF-04** Code-split per module; ArcGIS and ECharts modules imported granularly.

**Security & privacy (SE)**

- **SE-01** No secrets in the client bundle or repository. Basemap access uses an ArcGIS Location Platform API key restricted by HTTP referrer and scoped to basemap/location services only; any privileged operation (publishing, LLM) runs server-side or in CI with secrets.
- **SE-02** No user tracking or third-party analytics by default. No personal data collected.
- **SE-03** Content Security Policy documented for hosting environments that support headers (GitHub Pages does not; documented as a limitation).
- **SE-04** Dependency audit in CI; lockfile committed.

**Browser support** — follows ArcGIS Maps SDK 5.1 system requirements (verified 23 Oct 2026): Chrome/Edge 146+, Firefox 151+ and Firefox ESR 140, Safari / iOS Safari 18+, 64-bit with WebGL2.

---

## 6. Indicator and method definitions

All formulas are implemented as pure, unit-tested functions in `src/analysis/` (architecture §4). Symbols: *m* = month, *p* = partner, *c* = commodity basket.

### 6.1 Commodity baskets

Baskets map the 16 commodities to HMRC commodity codes. The table below is the **proposed** mapping; it must be confirmed against Defra's published trade codes (§S05) and the HMRC `/Commodity` endpoint before any figure is shown. Labels in the UI use the definition column, not just the short name.

**Stage 2 status (23 Oct 2026):** tomatoes, strawberries, bananas, potatoes and wheat are **confirmed against `/Commodity`** and in use; their CN8 lists (current and discontinued codes) are in `docs/03-DATA-SOURCES.md` §S01. The Defra trade-code comparison and the other 11 baskets follow in Stage 3.

| Commodity | Proposed HS scope | Definition shown in UI / notes |
|---|---|---|
| Tomatoes | 0702 | Fresh or chilled tomatoes (excludes processed) |
| Strawberries | 0810 10 | Fresh strawberries |
| Apples | 0808 10 | Fresh apples |
| Potatoes | 0701 | Fresh or chilled potatoes (excludes frozen/processed, which are large separate flows) |
| Bananas | 0803 | Bananas incl. plantains, fresh or dried |
| Oranges | 0805 10 | Fresh or dried oranges |
| Wheat | 1001 | Wheat and meslin |
| Rice | 1006 | Rice (all stages) |
| Beef | 0201, 0202 | Bovine meat, fresh/chilled/frozen |
| Lamb | 0204 | **Sheep and goat meat** — HS does not separate lamb from mutton/goat; label accordingly |
| Poultry | 0207 | Poultry meat and offal |
| Cheese | 0406 | Cheese and curd |
| Milk products | 0401–0405 | Milk, cream, concentrated milk, buttermilk/yoghurt, whey, butter — **excludes cheese** to avoid double counting |
| Sugar | 1701 | Cane or beet sugar |
| Coffee | 0901 | Coffee (beans, roasted, decaf, husks) |
| Cocoa | 1801, 1803–1805 | Cocoa beans and intermediates (paste, butter, powder); excludes chocolate (1806) |

### 6.2 Trade indicators (class: Measured / Derived)

- Recorded import net mass (tonnes): `M(c,p,m) = Σ NetMass / 1000` over CN8 codes in *c*, flows 1 (EU imports) and 3 (non-EU imports). *Measured.*
- Recorded import value (£): `V(c,p,m) = Σ Value`. *Measured.* Valuation basis to be confirmed for the API (§S01).
- Partner share: `s_p = M_p / Σ_q M_q` over **allocated** partners; suppressed/unallocated trade reported separately with its own share of the grand total. *Derived.*
- Herfindahl–Hirschman Index: `HHI = Σ_p (100·s_p)²`, range 0–10,000. *Derived.* Reference lines, if shown, are labelled with their origin (competition-analysis conventions) and described as illustrative.
- Effective number of partners: `N_eff = 10,000 / HHI`. *Derived.*
- Concentration ratios: CR1, CR3 (sum of top 1/3 shares). *Derived.*
- Year-on-year share change: `Δs_p = s_p(m, y) − s_p(m, y−1)` in percentage points. *Derived.*
- Seasonality: monthly HHI; peak-month share of annual mass; coefficient of variation of monthly mass (population standard deviation ÷ mean of the 12 monthly totals). Annual measures need all 12 months published; otherwise they are not shown. Year-on-year totals for a partial year compare only months published in both years. *Derived.*

### 6.3 Retail provision indicators

- Store count by class within LAD (point-in-polygon on LAD May 2025 boundaries). *Derived.*
- Stores per 10,000 residents: `count / population × 10,000` using the mid-year estimate for the same nation and the latest available year (year shown). *Derived.* Cross-checked against ONS's own LAD supermarket counts (§S12) as a validation step, not displayed as a second value.
- Stores per km²: count / LAD land area where available (else total area, stated). *Derived.*
- Retail concentration (Stage 5): over a council's mapped supermarkets (280 m² and over, standard format), the largest retailer's share of stores and the Herfindahl–Hirschman index `HHI = 10,000 × Σ sᵢ²`, where `sᵢ` is retailer *i*'s share of those stores. Store counts, not floorspace or sales: it describes the store network, not market share. *Derived.*
- Straight-line proximity (Stage 5, deep profiles): for each small area, the straight-line distance from its Census 2021 population-weighted centroid to the nearest mapped supermarket in the same national grid (EPSG:27700; EPSG:2157 in Northern Ireland). Population beyond `T` km: `Σ population of areas with distance > T / Σ population of the council's areas`, Census 2021 usual residents, `T` ∈ {1, 2, 5}. Whole areas are counted; it is not a count of people, nor a travel time. *Derived.*

### 6.4 Rounding and display

| Quantity | Display rule |
|---|---|
| Tonnes | ≥ 1,000: nearest 100 t, shown as e.g. "12.3 kt"; < 1,000: nearest tonne |
| £ | ≥ £1 m: one decimal "£12.3m"; else nearest £1,000 |
| Shares | 1 decimal place; "< 0.1 %" for positive values below that |
| HHI | nearest 10 |
| Distances | 0.1 km |
| Population | nearest 10 for small areas, nearest 100 for LADs |
| Small totals | Share computed on totals < 100 t flagged "small base" |

### 6.5 Scenario formulas

**Import disruption (SC-A/E)** for partner *p*, commodity *c*, start month *m₀*, duration *d* months, intensity *r* (0–1), recovery length *k* months, substitution assumption *σ* (0–1):

```
effective_r(m) = r                                  for m₀ ≤ m < m₀ + d
               = r · (1 − (m − (m₀ + d) + 1)/(k + 1)) for m₀ + d ≤ m < m₀ + d + k   (linear recovery)
               = 0                                  otherwise
affected_t(m)     = effective_r(m) · M(c,p,m_baseline)
unreplaced_t(m)   = (1 − σ) · affected_t(m)
share_affected(m) = unreplaced_t(m) / Σ_q M(c,q,m_baseline)
```

Baseline months come from the user-selected reference year (default: latest complete calendar year). Outputs: affected and unreplaced tonnes by month, share of recorded imports affected, post-scenario partner shares and HHI assuming other partners unchanged (stated). *Scenario-modelled.*

**Store closure (SC-D)**: for each small area *i* with representative point *x_i* and population *P_i*, `d_i = min_s dist(x_i, s)` over qualifying stores *s* (straight-line, metres, computed in a projected CRS — British National Grid EPSG:27700 for GB, Irish Transverse Mercator EPSG:2157 for Northern Ireland). Outputs before/after: `Σ P_i · [d_i > T]` for each threshold *T*, population-weighted mean and median distance, broken down by within-nation deprivation decile. *Scenario-modelled.*


### 6.6 Risk Explorer indicators (Stage 6, ADR-0024)

Implemented in `src/analysis/risk.ts` and `src/features/risks/model.ts`, with unit tests against independent computations from the raw files (stage 6 report, hand checks).

- **Concentration** (RK-02): partner shares, HHI, CR1, CR3 and partner count as §6.2, over the **allocated** partner total of the period. Monthly HHI per month; a month with nothing recorded has no HHI and is shown as a gap. Fixed HHI classes: below 1,000, then steps of 1,000 to 5,000 and over (descriptive classes, not thresholds of risk). *Derived.*
- **Estimated exposure to partner *p*** over the months *P* of the period: `E_p = Σ_{m∈P} M(p,m) / Σ_{m∈P} Σ_q M(q,m)`. The same by month, `e_p(m) = M(p,m) / Σ_q M(q,m)`, with its largest month and the number of months with `e_p(m) ≥ 0.5`. The part of recorded supply exposed if recorded imports from *p* stopped; no substitution, stocks or production are modelled. Never called a shortage. *Derived.*
- **Water stress** (S30): FAO SDG 6.4.2, total freshwater withdrawal ÷ available freshwater resources (%), the latest year per country (mostly 2022). FAO classes: none < 25; low 25–50; medium 50–75; high 75–100 (100 included); critical > 100. Share of recorded imports by class: `Σ s_p` over partners in the class; partners without a value form a "no data" class, never counted as low. A national figure: it does not describe where the produce was grown or how it was irrigated. *Official estimate* (class) / *Derived* (shares).
- **Port freight** (S23): DfT PORT0499 tonnage (thousand tonnes) by port and year, summed over cargo rows:
  - inward freight from abroad: direction "Inwards", load region not "United Kingdom (inc CHI & IOM)" and not "Unspecified";
  - agricultural products inwards: cargo category 23 (grain, soya, tapioca…), loaded abroad as above;
  - roll-on/roll-off inwards: the two Ro-Ro cargo groups (self-propelled and non-self-propelled), any origin, because DfT records no commodity for them.

  A port's share is its tonnage ÷ the sum over the major ports for the same measure and year. Change on the previous year is `(t_y − t_{y−1}) / t_{y−1}`. Symbol area is proportional to tonnage (radius `26 px · √(t / t_max)`, at least 3 px); a zero is a hollow ring. *Measured* / *Derived.*
- **Port of entry and road delay** (S03): as published in UKFSR 2024 theme 3 (charts 3_2_2a, 3_2_2b, 3_2_1a); nothing is recomputed. *Official estimate.*
- **Farming density** (S31, S33): `value ÷ region area (km², ONS ITL1, clipped)`. For wheat (hectares) the same quotient is the percentage of the region under wheat (1 km² = 100 ha). Fixed manual breaks (five classes):
  - wheat: 2 / 5 / 10 / 15 %;
  - cattle: 20 / 30 / 50 / 70 per km²;
  - sheep: 50 / 100 / 150 / 250 per km²;
  - pigs: 5 / 10 / 20 / 60 per km²;
  - poultry: 250 / 500 / 1,000 / 1,500 per km².

  England's figures cover commercial holdings. *Derived.*
- **Priority places by council** (S13): `share = (council's small areas in its nation's deciles 1–2) ÷ (council's small areas)`, for the combined index or one domain. Small areas are assigned to councils by official lookups:
  - England and Wales: LSOA 2021 → LAD 2025;
  - Scotland: Data Zone 2011 → council;
  - Northern Ireland: SOA 2011 → LGD 2014.

  The nation's share pools all its areas (about 20 % by construction). Classes: none (0 %), under 10 %, 10–20 %, 20–30 %, 30–50 %, 50 % and over. Ranked within the nation only, highest share first; equal shares share a rank, marked "=" (competition ranking). Councils with fewer than 10 small areas carry a caution. A council is always set against its own nation's pooled share. The count of councils at 40 % or more (twice the about 20 % by construction) is given for one nation at a time, as is the median share by ONS urban/rural flag (England, Wales). *Derived.*

---

## 7. Visual design specification

### 7.1 Design tokens

| Token | Value | Use |
|---|---|---|
| `--fs-navy` | `#071923` | app background, map surround |
| `--fs-emerald` | `#063D3B` | panel base (with alpha for glass) |
| `--fs-teal` | `#0A444A` | raised surfaces, table headers |
| `--fs-cyan` | `#49EAD8` | primary accent, imports/flows, focus ring |
| `--fs-green` | `#A1EB83` | domestic production, positive change |
| `--fs-amber` | `#E8B76B` | warnings, scenario-modelled values, assumptions |
| `--fs-text` | `#EDF7F5` | primary text |
| `--fs-text-muted` | `#8EADAE` | secondary text |

Calcite components are themed through their CSS custom properties so that Calcite controls inherit these tokens; the app runs in Calcite dark mode.

### 7.2 Contrast check (computed 23 Oct 2026, WCAG relative luminance)

| Foreground | on navy | on emerald | on teal |
|---|---|---|---|
| Text `#EDF7F5` | 16.4 : 1 | 11.1 : 1 | 9.9 : 1 |
| Muted `#8EADAE` | 7.5 : 1 | 5.0 : 1 | **4.5 : 1 (minimum)** |
| Cyan `#49EAD8` | 12.0 : 1 | 8.1 : 1 | 7.2 : 1 |
| Green `#A1EB83` | 12.6 : 1 | 8.5 : 1 | 7.6 : 1 |
| Amber `#E8B76B` | 9.7 : 1 | 6.6 : 1 | 5.9 : 1 |

Glass panels sit over a dark basemap, so their *effective* background must be tested in-situ (Stage 1 includes an automated contrast check on rendered panels). Muted text is not used on surfaces lighter than teal.

### 7.3 Surfaces, type and motion

- **Glass panels**: `background: color-mix(in oklab, var(--fs-emerald) 78%, transparent)`, `backdrop-filter: blur(14px) saturate(120%)`, 1 px border `rgba(73,234,216,0.18)`, radius 14 px, soft outer glow on focus/selection only. Fallback solid background where `backdrop-filter` is unsupported.
- **Type**: proposed IBM Plex Sans (UI) and IBM Plex Mono with tabular figures (numbers, KPIs), self-hosted via `@fontsource` (no third-party font requests). Confirmed in the Stage 1 design spike.
- **Icons**: Lucide (UI), custom single-colour SVG commodity icons in a consistent 24 px grid.
- **Motion**: UI transitions 150–250 ms ease-out; chart updates ≤ 400 ms without bounce; map flights 1.2–2.0 s; flow animation subtle (low-contrast particles/dashes). All disabled or instant under reduced motion.
- **Map styling**: dark, muted basemap that never competes with thematic layers; country choropleth with a sequential ramp derived from the palette and checked for colour-vision deficiency; no-data in neutral grey with hatch.

### 7.4 Cartographic rules (from the cartography standard applied to this project)

- Choropleths show rates/shares/per-capita values; raw counts use proportional symbols.
- Map series and year comparisons use **fixed, manually defined class breaks** and identical ramps.
- Flow width ∝ volume, aggregated (top-N + others) to avoid clutter.
- The 2D world view uses Web Mercator for continuity with UK basemaps; therefore **country areas are not used to encode quantities** and no area comparisons are made at continental scale. An equal-area option for static exports is a Release 2 consideration.
- Every map legend states units, class scheme and data date.

---

## 8. Glossary (UI terminology)

| Term | Meaning in FOODSCOPE UK |
|---|---|
| Recorded import partner | The partner country recorded by HMRC for an import — country of dispatch in headline OTS |
| Country of dispatch | Country from which goods were consigned; may differ from country of origin (production) |
| Recorded imports | Imports as recorded in HMRC OTS, subject to suppression and revision |
| Supermarket / store class | Class derived from GEOLYTIX fields (definition shown in legend) |
| Straight-line distance | Euclidean distance in a projected CRS; not travel distance or time |
| Exposure | Volume or population affected under a stated scenario assumption |
| National context | National indicator shown for orientation, not measured locally |
| Snapshot | A dated, versioned copy of source data built by the pipeline |

---

## 9. First-release acceptance criteria

Mapped from brief §19, with how each is verified.

| # | Criterion | Verified by |
|---|---|---|
| 1 | App starts and renders a functioning ArcGIS map | Playwright: `arcgisViewReadyChange` fires; basemap and one operational layer load |
| 2 | Polished, consistent visual design | Design review against §7 at 1920×1080, 1366×768, 1024×768, 390×844; contrast check |
| 3 | Commodity selection updates real data-driven maps and charts | E2E + reconciliation test vs recorded HMRC fixture |
| 4 | Month change updates recorded import information | E2E: month step changes KPI values to fixture-expected figures |
| 5 | Supermarkets load from real dataset or configured service | E2E with static snapshot; unit test of FeatureLayer adapter config |
| 6 | Retailer filtering works | E2E: filter reduces feature count to expected value |
| 7 | LAD selection zooms to correct boundary | E2E: view extent contains Belfast/Manchester boundary extent |
| 8 | Two real authority profiles work | E2E: Belfast and Manchester profiles render all sections with provenance |
| 9 | Indicators match sources and formulas | Unit tests on `src/analysis` with hand-checked fixtures; documented reconciliations |
| 10 | Two scenarios work transparently | Unit + E2E for SC-A/E and SC-D; assumptions panel present |
| 11 | Insights give meaningful evidence-based output | Rule tests: given indicator pattern → expected workstreams and cited evidence |
| 12 | Loading, empty and error states handled | Component tests with mocked failures; E2E with blocked data request |
| 13 | Production build succeeds | CI `npm run build` |
| 14 | GitHub Pages config with correct base path | CI deploy workflow; smoke test against deployed URL |
| 15 | README documents setup, data prep, refresh, licensing, assumptions, limitations | Review checklist |

---

## 10. Out of scope

- Real-time logistics, shipping (AIS) or port-call data.
- Retailer inventory, sales or supply-chain data.
- Household-level food insecurity measurement (survey microdata).
- Price forecasting or shortage prediction.
- Any user accounts, data entry or persistence beyond the browser URL and local preferences.

## 11. Open decisions for ConsultingWhere

| # | Decision | Needed by |
|---|---|---|
| D1 | ~~GitHub repository owner/organisation and final Pages URL~~ **Resolved 23 Oct 2026**: repo `johnchewitt/FoodScopeUK`; Pages URL `https://johnchewitt.github.io/FoodScopeUK/`; Vite `base` `/FoodScopeUK/` | — |
| D2 | ArcGIS API key: John creates API key credentials in ArcGIS Location Platform (steps in `docs/setup/arcgis-api-key.md`) and stores the key as the GitHub Actions secret `ARCGIS_API_KEY` | Stage 1 (fallback map until then) |
| D3 | Brand assets and permission for "Powered by ConsultingWhere" and PDF branding | Stage 1 (placeholder) / Stage 8 (final) |
| D4 | Retailer logos: use or not (default: no logos) | Stage 4 |
| D5 | ~~Store class definition (which GEOLYTIX size bands/formats count as "supermarket")~~ **Resolved 24 Oct 2026** (John): class from `size_band` (convenience under 280 m²; supermarket 280 m² and over in three bands); forecourt, motorway, travel and hospital stores flagged as formats; default view supermarkets in the standard format; wholesale and mainly non-food stores left out; Crown Dependency stores shown with no council (S11, ADR-0020) | — |
| D6 | Default straight-line thresholds (proposed 1 / 2 / 5 km) | Stage 5 |
| D7 | "About ConsultingWhere" approved copy | Stage 8 |
| D8 | Whether to publish curated layers to a ConsultingWhere ArcGIS Online org (Release 3) | Release 3 |
