# ConsultingWhere Insights — methodology

Stage 8 (John's brief, 26 Oct 2026; CI-01 – CI-05, EX-01 – EX-05; ADR-0027). How the three assessments, their suggested work packages and their exports are built. The formulas behind the figures are the earlier modules' (specification §6). This page covers what Insights adds.

Every assessment is exploratory. It is built from published open data and is **not a commissioned food security audit**. It implies no requirement, budget or procurement by any organisation, and this note is printed on screen, on every PDF page and in the CSV.

## 1. One report model

- **Builders.** `buildAuthorityReport`, `buildCommodityReport` and `buildScenarioReport` (`src/features/insights/`) turn published data into one plain JSON report.
- **Contents.** The report holds:
  - key figures and findings;
  - sections with tables and chart data;
  - work packages and their rules;
  - methodology, limitations, sources, datasets with snapshot ids, the selections and the link.
- **Provenance.** Every number on screen or in the PDF is an `Indicator`, with sources, period, unit, coverage, method and provenance class. Findings name the indicators they rest on, shown under **Evidence**.
- **Checksum.** The report's SHA-256 is computed on canonical JSON (sorted keys, link left out). It is shown on screen, in the CSV and in every PDF footer, so an exported report can be matched to the screen.

## 2. Local Authority Food Security Assessment

| Section | Figures | Sources | Notes |
|---|---|---|---|
| Executive summary | residents (mid-2025); supermarkets per 10,000 (council, nation, UK); share of residents more than 1 km from a supermarket; share of small areas in the nation's PPFI deciles 1–2; hypothetical closure of the most relied-on supermarket | S11, S14, S18, S15–S17, S13 | Urban/rural class where ONS publishes one |
| Food retail network | stores, supermarkets, retailers; coverage per 10,000; largest retailer's share and HHI (store counts); residents beyond 1, 2 and 5 km | S11, S14, S18; small areas S15–S17 | Store counts are not market share; straight-line only |
| Community vulnerability | PPFI combined and domain shares (ranked within the nation); households with no car or van (Census 2021); residents in England's 20 % most deprived small areas (IoD 2025); small areas furthest from a supermarket; deprived and far areas (England) | S13, S19, S20, S15–S18 | Never compared across nations (P11); deprivation for England only |
| National supply context | UK recorded imports per basket over 12 months: largest partner and share, HHI; Defra UK production share of supply | S01, S09, S10 | Labelled national context: not the council's own supply chain (P6) |

**Small areas for every council.** These come from the Scenario Lab's UK-wide inputs (`scenario` family):
- small areas are LSOA 2021, Data Zone 2022 (Scotland) and Data Zone 2021 (Northern Ireland);
- each has its Census population and its nearest supermarket by straight line in the national grid;
- distances run to any supermarket in Great Britain, or in Northern Ireland;
- for Belfast and Manchester they reproduce the deep profiles' shares beyond 1 km (32.17 % and 14.08 %; tested).

**Most relied-on supermarket.** This is the supermarket that is nearest for the most residents of the council. The closure preview is the Scenario Lab's Scenario B for that store.

## 3. Commodity Supply Resilience Assessment

| Section | Figures | Sources |
|---|---|---|
| Recorded import partners | recorded imports (period, measure), partners, largest partner, three largest, HHI, change in share | S01 |
| Seasonal sourcing | the latest complete calendar year by month; the largest partner of each month; months in which one partner supplied at least half; peak and trough months | S01 |
| Historical changes | complete calendar years: recorded imports, partners, largest share, HHI; change from the first to the last complete year (series breaks noted) | S01 |
| Domestic production | Defra's UK production share of supply, as published, or "not published" with Defra's reason | S09, S10 |
| Possible geographic exposure | share of recorded imports from partners in high or critical national water stress; estimated exposure to the largest partner, month by month; the UK Food Security Report's port of entry for all food, feed and drink | S01, S30, S03 |
| Data gaps | share with a partner country, non-country categories, provisional months, code changes | S01 |

HMRC's partner is the country of dispatch. Estimated exposure is not a shortage, and monthly trade is never combined with annual production.

## 4. Food Supply Disruption Scenario Assessment

This reports the Scenario Lab run in the URL, or a saved scenario. It covers:
- the parameters, with user assumptions marked;
- the baseline, with its published provenance;
- the assumptions;
- the results as estimated exposure, with the Scenario Lab's confidence rating;
- the geographic consequences:
  - A: partner shares before and after;
  - B: councils reached, affected small areas and the councils' residents beyond 1, 2 and 5 km;
  - C: none, because Defra's balance is UK-wide and is never apportioned;
  - D: the port's tonnage by cargo group and UKFSR's food, feed and drink share;
- sensitivity;
- limitations and what the results do not mean;
- possible interventions.

**Sensitivity.** The same scenario is recomputed with one parameter changed:
- A: reduction at 0.5×, 1× and 1.5× the set value (capped at 100 %), and substitution at 50 % if 0 % was set, otherwise 0 %;
- C: reduction at 0.5×, 1× and 1.5×;
- D: reduction at 0.5×, 1× and 1.5×, and 6 or 12 months;
- B: no intensity to vary, so residents beyond 1, 2 and 5 km are shown before and after.

Words: results are "estimated exposure" and "affected". They are never a shortage, a forecast or a confirmed operational impact (P9). A test audits the wording.

## 5. Work packages and their rules (CI-02, CI-03)

A work package is **indicated** when its rule fires on the report's figures. Otherwise it is offered as a **supporting capability**. Each package shows:
- the challenge;
- the supporting evidence;
- the analysis that could follow;
- the additional data required;
- tasks, deliverables, stakeholders by role, and limitations.

"Why am I seeing this?" shows the rule, its threshold and the observed value.

### Local authority

| Package (service) | Rule |
|---|---|
| Geographic accessibility assessment (Food Retail Accessibility Mapping) | Share of residents more than 1 km straight-line from a supermarket at or above the nation's share |
| Retail network analysis (Food Retail Accessibility Mapping) | Largest retailer ≥ 40 % of the council's supermarkets, or fewer supermarkets per 10,000 than the nation |
| Regional food resilience strategy (National and Regional Resilience Assessment) | Share of small areas in the nation's PPFI deciles 1–2 at or above the nation's pooled share |
| Policy intervention evaluation (Scenario Modelling and Spatial Decision Support) | Small areas both in England's 20 % most deprived and more than 1 km from a supermarket, or ≥ 30 % of residents in the 20 % most deprived |
| Scenario modelling (Scenario Modelling and Spatial Decision Support) | Closing the most relied-on supermarket changes the nearest supermarket of ≥ 2 % of residents |
| Data integration and monitoring (Geospatial Data Integration and Automation) | An indicator is not published or not comparable for the council's nation (car availability in Scotland, deprivation outside England, partial store coverage in Northern Ireland) |
| Geospatial data governance and digital twin services (Digital Twins and Operational Dashboards) | Supporting capability (no rule) |

### Commodity

| Package (service) | Rule |
|---|---|
| Supply chain geographic risk analysis | Largest partner ≥ 50 % of recorded imports, or the three largest ≥ 80 % |
| Seasonal disruption scenario modelling | One partner supplied ≥ 50 % in 3 or more months of the latest complete year |
| Climate and agricultural resilience | ≥ 25 % of recorded imports from partners in high or critical water stress |
| National and regional resilience assessment | UK production < 50 % of supply in Defra's balance, or no balance published |
| Geospatial data integration and automation | < 95 % of recorded imports with a partner country, provisional months in the period, or code changes |
| Critical food infrastructure mapping | Supporting capability (port of entry is published for all foods only) |

### Scenario

| Scenario | Rules |
|---|---|
| A | ≥ 10 % of recorded imports over the window affected (supply chain risk); substitution left at 0 % (scenario modelling: test the assumption) |
| B | ≥ 1,000 residents with a different nearest supermarket (accessibility); any affected resident more than 2 km from the new nearest (spatial decision support); affected residents in England's 20 % most deprived (community resilience) |
| C | Production removed ≥ 5 % of total supply (resilience); UK production ≥ 50 % of supply (climate and agriculture) |
| D | Port ≥ 5 % of UK major-port inward freight from abroad (critical infrastructure); ≥ 50 % of its inward tonnage in Ro-Ro units or containers (data integration) |

Every scenario report also offers Digital Twins and Operational Dashboards as a supporting capability.

The thresholds are simple, stated screening rules for a demonstrator, not policy thresholds. They are constants in code (`AUTHORITY_RULES`, `COMMODITY_RULES`, `SCENARIO_RULES`) with tests, and no HHI value is classed as high (P10).

## 6. Consulting content (CI-01, CI-04, CI-05)

The nine services of John's brief and the About text are in `src/content/consulting.json`, with the `consulting-content` schema. Each service has:
- challenges, approach, deliverables, value and stakeholders by role;
- the modules it draws on.

The content is generic capability description, marked **draft for approval** until ConsultingWhere approves it (decision D7). It names no clients, projects, staff, accreditations, contracts or prices.

A claim audit (`claimProblems`) runs in tests on the content and on every generated report. It checks for client names, credentials, track record, budgets, procurement and day rates; sentences that deny a claim are allowed.

## 7. Exports

**PDF.** The PDF is A4 portrait with selectable text, embedded IBM Plex Sans (OFL-1.1) and bookmarks. It contains:
- a cover with ConsultingWhere's logo (decision D3, supplied 27 Oct 2026; a text wordmark if it cannot load), the FOODSCOPE UK identity, the key figures, the executive summary and the exploratory note;
- contents and selections;
- the map: the visible map captured at export, with its extent corners, scale, basemap, credits, Esri's map-image notice when an Esri basemap is drawn, and the map's legend in words;
- the sections, with charts and tables;
- work packages and the rules table;
- methodology, limitations, sources, dataset snapshots and attributions, the full checksum and the link.

Every page has a footer with the exploratory note, "Page n of N", the short checksum, the generation time and the data snapshots.

**Map image (PNG).** The visible map, with a strip carrying the title, extent, scale, basemap, credits and Esri's notice.

**CSV.** One row per indicator: raw value, value as shown, unit, provenance, scope, sources, period, coverage, method and missing reason. It ends with the disclaimer, data snapshots, checksum and link. Text starting with `= + - @` is neutralised.

**Link and saved configurations.**
- The URL holds the assessment (`ia`) and the selections.
- Saved configurations keep only that query, re-serialised (`localStorage foodscope.reports.v1`).
- Figures are rebuilt from the current data when a configuration is opened.

Only figures computed from the published open datasets listed in the report are exported. Nothing unpublished or restricted is held by the app.

## 8. Limitations

- Straight-line distance is a proxy for proximity, not travel time, cost, opening hours or affordability.
- Store counts are not market share.
- Indices are ranked within each nation.
- Distances near the Northern Ireland border may be overstated, because supermarkets in the Republic of Ireland are not in the data.
- HMRC's partner is the country of dispatch. Recent months are provisional, and comparisons across January 2021 and January 2022 cross series breaks.
- Water stress is a national measure of the partner country.
- Scenario results are static exposure calculations under stated assumptions.
- The PDF is not a tagged PDF (pdfmake 0.3 has no structure tree). Its reading order follows the document and it has bookmarks.
- The PDF's map shows what the view shows at export. Legends are described in words.
