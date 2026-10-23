# FOODSCOPE UK
## An AI-Powered Food Security & Supply Chain Intelligence Platform
### A flagship geospatial innovation demonstrator for ConsultingWhere

You are an elite multidisciplinary software development team comprising:

- A principal ArcGIS Maps SDK for JavaScript 5.1 engineer.
- A senior React 19, TypeScript and Vite developer.
- An award-winning geospatial UX/UI designer.
- A UK food security and agricultural policy analyst.
- A spatial data scientist specialising in supply-chain resilience.
- A government open-data integration engineer.
- A senior ConsultingWhere geospatial strategy consultant.
- A software QA and DevOps engineer.

**Your mission is to DESIGN, BUILD, RUN, TEST and DELIVER a beautiful, fully functional application called FOODSCOPE UK.**

The application must demonstrate how geographic intelligence can help the United Kingdom understand and strengthen its food security.

It must also clearly demonstrate ConsultingWhere's ability to deliver geospatial strategy, advanced spatial analysis, enterprise GIS integration, digital twins and data-driven decision support.

This is not simply a dashboard.

It should be a striking, interactive **national food security intelligence platform**, worthy of presenting to Defra, local authorities, major supermarket chains, infrastructure operators and senior public-sector executives.

---

# 1. The core idea

FOODSCOPE UK should allow a user to explore five questions:

**1. Where does our food come from?**

Explore international food imports and domestic production, with animated geographic connections between producing/supplying regions and the United Kingdom.

**2. How does this change throughout the year?**

Explore seasonal sourcing patterns using a January–December time slider and historical monthly trade records.

**3. Where are our supermarkets and food-access vulnerabilities?**

Map supermarkets using GEOLYTIX retail data and analyse accessibility, deprivation and population characteristics.

**4. How vulnerable is our food supply?**

Explore country concentration, import dependency, logistics exposure, agricultural vulnerability and scenarios such as drought, trade disruption or transport interruptions.

**5. What can be done to improve resilience?**

Generate actionable geographic insights, local authority food security profiles and clearly structured consulting opportunities.

All five elements should work together within one compelling application.

---

# 2. Visual design — this is extremely important

Create one of the most visually impressive ArcGIS JavaScript applications possible.

The application must look like a premium Bloomberg-style geographic intelligence platform combined with a sophisticated modern digital twin.

Use a consistent design system:

- Midnight navy: `#071923`
- Deep emerald: `#063D3B`
- Teal: `#0A444A`
- Electric cyan: `#49EAD8`
- Luminous green: `#A1EB83`
- Amber: `#E8B76B`
- White text: `#EDF7F5`
- Muted text: `#8EADAE`

Design characteristics:

- Full-screen mapping experience.
- Floating glassmorphism panels.
- Subtle translucent backgrounds and blurred surfaces.
- Beautiful responsive layouts.
- Rounded dashboard cards.
- Soft neon borders and tasteful glow effects.
- Modern typography with excellent legibility.
- High-quality icons.
- Smooth but restrained animations.
- Professional charting and infographics.
- Fluid transitions when changing commodity, geography or month.
- Elegant skeleton loading states.
- Attractive empty states and error messages.
- Sensible contrast and accessibility.

Make the map the visual centrepiece.

The finished product must NOT resemble a conventional ArcGIS Web AppBuilder or generic administration dashboard.

Avoid oversized panels that obscure the map.

Use compact, intelligently organised information architecture.

Design for 1920×1080 desktops first, while supporting laptop, tablet and mobile layouts.

Add reduced-motion support.

---

# 3. Technical architecture

Use:

- React 19.
- TypeScript.
- Vite.
- ArcGIS Maps SDK for JavaScript 5.1.
- `@arcgis/core`.
- `@arcgis/map-components`.
- Calcite Design System.
- ECharts for advanced visualisations.
- TanStack Query for server data fetching.
- Zustand or a similarly lightweight state-management system.
- Lucide icons.
- CSS variables and modern CSS for the design system.
- GeoJSON and ArcGIS REST Feature Services.
- Turf.js only where appropriate for supplemental client-side geometry operations.
- Vitest for unit tests.
- Playwright for browser smoke tests.

Use ArcGIS 5.1 map components directly within React 19.

Do not use the deprecated `@arcgis/map-components-react` wrapper.

Use the documented SDK, with supported 2D and optional 3D mapping features.

Avoid deprecated ArcGIS widgets and APIs.

Architect the system around reusable components, data adapters and spatial analysis modules.

Target a static GitHub Pages frontend, with optional separate serverless functions or scheduled GitHub Actions for data processing.

Do not expose secrets in browser code.

---

# 4. Main application layout

Create a full-screen application with the following structure.

## Top navigation

Left:
- FOODSCOPE UK brand.
- Subtitle: Food Security & Supply Chain Intelligence.
- Subtle "Powered by ConsultingWhere" attribution.

Centre:
- Food Origins.
- Seasonal Supply.
- UK Food Access.
- Supply Chain Risks.
- Local Authority Profiles.
- Scenario Lab.
- Consulting Insights.

Right:
- Search.
- Help.
- Export.
- Data freshness indicator.
- 2D/3D toggle where supported.

## Main content

A large interactive ArcGIS map occupies most of the screen.

A collapsible sidebar contains relevant controls for each module.

Floating KPI cards show important statistics.

Context panels respond to map clicks, filters, region selection and selected commodities.

Charts and map highlights must be connected.

## Bottom timeline

An elegant horizontal time slider allows the user to explore months and years.

In food-origin mode it controls international sourcing patterns.

In local authority mode it changes available time-dependent indicators.

## Right insights panel

Include an insights panel that identifies geographic patterns, explains data limitations and suggests appropriate resilience analysis.

Create beautiful, concise and evidence-based interpretation cards.

---

# 5. Module One — Global Food Origins Explorer

This is the application's flagship visual feature.

Build an interactive world map showing food commodities imported into the United Kingdom.

Initial commodities:

- Tomatoes.
- Strawberries.
- Apples.
- Potatoes.
- Bananas.
- Oranges.
- Wheat.
- Rice.
- Beef.
- Lamb.
- Poultry.
- Cheese.
- Milk products.
- Sugar.
- Coffee.
- Cocoa.

Provide a commodity selector with attractive icons and search.

For the selected commodity:

1. Highlight partner countries on the world map.
2. Draw animated curved geographic connections towards the UK.
3. Scale connection thickness using genuine recorded volumes.
4. Display the proportion of recorded imports from each country.
5. Show import tonnage and value.
6. Calculate country concentration indicators.
7. Identify changes in supplier patterns.
8. Display UK production statistics where comparable data exists.

The map should be beautiful and engaging, with subtle animated flows and illuminated geographic features.

**Critical scientific and statistical requirement:**

HMRC trade data may identify trading partners or dispatch countries, not necessarily the country where agricultural products were grown.

Use precise terminology such as "recorded import partner" where required.

Do not imply that a curved map line is an actual shipping route.

Do not connect commodity imports directly to specific supermarkets without actual supporting supply-chain data.

Display the source and reference period for all values.

---

# 6. Module Two — Seasonal Food Explorer

Build a highly interactive seasonal supply explorer.

At the bottom of the map, display a January–December time slider.

Allow the user to select a commodity, year and month.

As the month changes:

- Recalculate import partner contributions.
- Update international flow connections.
- Animate changes in country highlighting.
- Update the dashboard.
- Show monthly import volume and value.
- Identify significant seasonal concentration.
- Update relevant historical trend charts.

Include a seasonal heatmap with:

- Months across the horizontal axis.
- Trading partners on the vertical axis.
- Colour representing recorded import volume or share.

Allow comparison between years.

Example user question:

"How does the UK's tomato supply change between January and July?"

The application should show the recorded monthly country patterns and corresponding evidence.

Where available, combine this with Defra domestic production seasonality.

Provide a toggle:

**Imports | Domestic Production | Combined Context**

Do not calculate a monthly domestic food share from incompatible agricultural statistics.

Display missing data explicitly.

Allow users to play a smooth 12-month animation.

---

# 7. Module Three — UK Supermarket Network

Integrate the freely published GEOLYTIX Supermarket Retail Points dataset.

Also support a configurable ArcGIS Online hosted FeatureLayer URL so that a ConsultingWhere-published version of the data can be used.

Include major supermarket fascias such as:

- Tesco.
- Sainsbury's.
- Asda.
- Morrisons.
- Aldi.
- Lidl.
- Waitrose.
- Co-op.
- M&S Food.

Use actual fields and coverage found in the licensed dataset, not assumed attributes.

Display points using attractive retailer-specific symbols or brand-neutral symbols where appropriate.

Implement:

- Point clustering.
- Retina-sharp symbols.
- Retailer filtering.
- Store searching.
- Map-driven selection.
- Store details.
- Store count by local authority.
- Catchment analysis.
- Proximity analysis.
- Retail network density.

Add summary charts comparing supermarket provision across areas.

Distinguish supermarkets from convenience stores, independent food stores and other food retailers.

Do not treat simple supermarket count as a complete indicator of food access.

---

# 8. Module Four — UK Food Access & Vulnerability

Integrate:

- Priority Places for Food Index.
- Population density.
- Deprivation indicators.
- Household car availability.
- Age structure.
- Relevant public transport accessibility information.
- Rurality classifications.
- Local authority boundaries.
- Small-area statistical geographies.

Account for differences between England, Scotland, Wales and Northern Ireland.

Use appropriate ONS, NRS, NISRA and Welsh Government statistical sources.

Build interactive maps showing:

- Communities with limited supermarket accessibility.
- Areas with high food-access vulnerability.
- Differences between urban and rural locations.
- Food-access provision relative to population.
- Potential gaps in major supermarket coverage.

Provide adjustable accessibility parameters.

Where licensed routing services are available, calculate realistic travel-time catchments.

Otherwise, use clearly identified straight-line proximity measures.

Never label straight-line buffers as driving or walking times.

Support analysis at neighbourhood and local authority levels.

---

# 9. Flagship feature — Local Authority Food Security Profiles

This must be one of the most polished and useful modules.

Allow users to select any UK local authority.

The application should immediately zoom to that authority and create a beautiful interactive **Food Security Profile**.

The profile should contain:

## A. Area overview

- Authority name.
- UK nation.
- Geographic extent.
- Population.
- Urban/rural characteristics.
- Source and date of statistics.

## B. Food retail network

- Total mapped supermarkets.
- Stores per 10,000 residents.
- Supermarket locations by retailer.
- Retail coverage across the authority.
- Potential underserved neighbourhoods.

## C. Community food accessibility

- Access to food retailers.
- Car availability.
- Relevant deprivation indicators.
- Priority Places for Food indicators.
- Selected small-area vulnerabilities.
- Population potentially affected by access gaps.

## D. Wider food-system exposure

Provide contextual information on:

- National commodity import dependencies.
- Food price trends.
- Relevant domestic food production.
- Known logistics exposures.
- Documented climate or agricultural risks.

Do not present national import reliance as a measured local authority supply-chain relationship.

Clearly label indicators that are national context rather than local measurements.

## E. Interactive geographic assessment

Show the authority boundary on the map.

Overlay supermarkets, population, relevant statistical areas and food-access vulnerability.

Allow the user to select neighbourhoods for additional detail.

Include transparent calculations and source metadata.

## F. Authority comparison

Support comparison between two or more local authorities.

Show:

- Supermarket provision.
- Population characteristics.
- Accessibility indicators.
- Vulnerability measures.
- Appropriate benchmarking against similar authority types.

Warn when indicators are not directly comparable across nations or statistical years.

## G. Consultancy assessment

Generate a concise ConsultingWhere Food Security Opportunity Assessment.

Include:

- Key geographic findings.
- Potential vulnerabilities.
- Supporting evidence.
- Uncertainty and limitations.
- Recommended follow-up analysis.
- Opportunities for strategic investment or further investigation.
- Possible consulting work packages.

Make this suitable as an initial discussion document for a council or government department.

## H. Export

Allow users to export a professional PDF containing:

- ConsultingWhere branding.
- A location map.
- Key indicators.
- Charts.
- Food-access analysis.
- Potential resilience challenges.
- Recommendations for further analysis.
- Full sources and limitations.

Use browser-based PDF generation or a secure backend as appropriate.

Exported statistics must exactly match the selected filters and map results.

---

# 10. Module Five — Food Supply Chain Vulnerability

Create a UK Food Resilience Risk Explorer.

Analyse vulnerabilities across three distinct scales.

**National food supply**

- Import dependency.
- Commodity sourcing concentration.
- Changes in supply origins.
- Domestic production availability.
- Relevant climate exposure.

**Transport and logistics**

- Major ports.
- Freight routes.
- Known food import entry-point dependency where published.
- Road and rail infrastructure.
- Potential chokepoints.

**Local community access**

- Retail coverage.
- Retail concentration.
- Socioeconomic vulnerability.
- Transport constraints.
- Accessibility inequalities.

Provide maps and explainable indicators.

Avoid creating one arbitrary national risk score that combines incompatible concepts.

Each risk component should be separately understandable.

Allow analysts to adjust weights and test alternative assumptions.

Provide sensitivity analysis.

---

# 11. Module Six — Scenario Lab

Create an interactive simulation and scenario-analysis workspace.

It should feel like a premium strategic planning application.

Include editable sample scenarios:

**Scenario A — Spanish tomato disruption**

Model a hypothetical reduction in UK tomato imports from Spain.

**Scenario B — Port of Dover disruption**

Explore dependence on an assumed percentage of food imports entering through Dover, using official evidence where available.

**Scenario C — UK wheat harvest reduction**

Test a hypothetical domestic production shock.

**Scenario D — Supermarket closure**

Select a supermarket and investigate the potential local effect on food accessibility.

**Scenario E — Climate-driven import disruption**

Select a source country and commodity and adjust hypothetical export reductions.

Provide adjustable sliders for disruption intensity, duration and recovery assumptions.

The map, KPI cards and charts must update.

Compare baseline and scenario results.

All calculations must be documented.

Clearly distinguish:

- Observed data.
- Model inputs.
- User assumptions.
- Estimated exposure.
- Uncertainty.

Never present simulated disruption estimates as predicted real-world shortages.

Do not invent private supermarket inventory information, shipping movements or substitution capacity.

---

# 12. Module Seven — ConsultingWhere Insights

This is an important business-development component.

Create a premium consultancy insights workspace showing how spatial intelligence supports food-security decisions.

Define consulting workstreams including:

1. National Food Security Geospatial Strategy.
2. Regional Food Resilience Assessments.
3. Local Authority Food Accessibility Reviews.
4. Supermarket Catchment and Network Analysis.
5. Supply Chain Geographic Risk Assessment.
6. Climate and Agriculture Resilience Analysis.
7. Critical Food Infrastructure Dependency Mapping.
8. Geospatial Data Integration and Digital Twins.
9. Food Security Monitoring Dashboards.
10. Scenario Modelling and Decision Support.

For any selected authority, commodity or risk scenario, generate an evidence-based consultancy opportunity statement.

Each opportunity should include:

- The challenge.
- Available evidence.
- What spatial analysis could reveal.
- Required additional datasets.
- Proposed consulting tasks.
- Potential deliverables.
- Relevant stakeholders.
- Limitations and dependencies.

Present the information as an executive-ready report.

Do not make unsupported claims that a public body or company has an actual procurement requirement or budget.

Include an elegant "About ConsultingWhere" section describing generic geospatial consultancy capabilities, but do not fabricate staff qualifications, project references or credentials.

---

# 13. Ask FOODSCOPE — Geospatial Assistant

Add a beautiful floating conversational interface called **Ask FOODSCOPE**.

Examples:

"Where do UK strawberries come from in February?"

"Compare tomato imports in July and January."

"Show all Aldi and Lidl supermarkets around Belfast."

"Which local authorities have the greatest food-access vulnerability according to the selected index?"

"Show the Food Security Profile for Belfast City Council."

"Compare Belfast with Manchester."

"What happens to the model if tomato imports from Spain fall by 30%?"

"Which consulting services could help this local authority?"

Implement a useful deterministic command engine first.

Support commodity selection, filters, location lookup, scenario updates, map navigation and profile generation.

Optional advanced AI can use a secure backend connected to a suitable language model.

Any AI-generated factual claims must be grounded in retrieved source data.

Never fabricate data, analytical findings or service availability.

---

# 14. Government and commercial data integration

Investigate and integrate the following sources:

**HMRC UK Trade Info API**
https://www.uktradeinfo.com/api-documentation

For monthly commodity import and export data.

**Defra UK Food Security Report**
https://www.gov.uk/government/statistics/united-kingdom-food-security-report-2024

For established national food-security indicators and resilience context.

**Defra Food Statistics in Your Pocket**
https://www.gov.uk/government/statistics/food-statistics-pocketbook

For domestic production, consumption and food supply statistics.

**GEOLYTIX**
https://geolytix.com/

For openly published supermarket retail points, subject to the dataset's reuse terms.

**Priority Places for Food Index**
https://priorityplaces.cdrc.ac.uk/

For UK neighbourhood food-access vulnerability.

**ONS / NRS / NISRA**

For population, statistical geography and related area-level indicators.

**Department for Transport**

For relevant port freight and transport infrastructure datasets.

**ArcGIS Online / ArcGIS Living Atlas**

For geographic reference information, boundaries and available supporting layers.

Use a verified-data catalogue and ingestion pipeline.

For every source record:
- Official title.
- Publisher.
- Service or download URL.
- Licence.
- Refresh frequency.
- Latest available data period.
- Geographic coverage.
- Relevant attributes.
- Import/processing approach.
- Restrictions or limitations.

Verify the working URLs and data schemas before implementing integrations.

Where an official API cannot be called directly because of CORS or other restrictions, create an appropriate scheduled ingest or proxy service.

Do not invent endpoint paths or field names.

---

# 15. Data preparation and ArcGIS Online publishing

Create a reusable data pipeline with well-defined schemas for:

- Food commodities.
- Import records.
- Domestic production data.
- Countries and country geometries.
- UK supermarkets.
- Local authorities.
- Statistical neighbourhoods.
- Vulnerability indicators.
- Ports and infrastructure.
- Scenario outputs.

Allow processed spatial outputs to be published to ArcGIS Online hosted feature services when credentials and permissions are provided.

Make the frontend configurable so it can consume existing ArcGIS Online FeatureLayer URLs.

Use environment configuration or a documented JSON config file.

Do not hardcode ConsultingWhere's private ArcGIS organisation, usernames, passwords or tokens.

Provide repeatable scripts for refreshing cached public data.

Respect API request limits and attribution requirements.

---

# 16. Data provenance, analytical integrity and reliability

This application must be credible enough to use in discussions with government and senior decision-makers.

Every indicator should display:

- Source.
- Reference date.
- Units.
- Coverage.
- Calculation method.
- Data-quality or confidence information where available.

Clearly distinguish:

**Measured | Officially estimated | Derived | Scenario modelled | Illustrative**

Never display fabricated figures as genuine statistical observations.

Never imply that publicly available international trade data reveals actual supply relationships to specific retailers.

Do not equate food import dependency with food insecurity.

Do not equate supermarket proximity alone with food affordability or nutritional access.

Use comparable denominators and consistent statistical boundaries.

Include clear evidence and limitations pages.

Prioritise transparency over false precision.

---

# 17. Development process — instructions for Claude Code

You must implement this application, not merely describe it.

Follow this process:

**Step 1 — Research and verify**

Check official ArcGIS SDK documentation, data service URLs, data licences and schemas.

Identify unavailable sources and realistic substitutes.

Prepare a short architecture and data-source manifest.

**Step 2 — Scaffold the application**

Create the complete Vite/React/TypeScript project.

Install and configure dependencies.

Establish the dark emerald design system and responsive application shell.

**Step 3 — Build an exceptional working vertical slice**

Implement the main ArcGIS map, commodity selector, monthly timeline and live-data-connected food origins explorer.

This must genuinely work before proceeding.

**Step 4 — Implement GEOLYTIX integration**

Add supermarket locations, symbols, filtering and map interactions.

Support configurable hosted ArcGIS Online services.

**Step 5 — Build Local Authority Food Security Profiles**

Add administrative boundaries, area selection, linked supermarket statistics, available vulnerability indicators and a polished profile dashboard.

Implement Belfast City Council and Manchester as two initial demonstration areas, using real datasets and actual statistical boundaries.

**Step 6 — Add the Scenario Lab**

Implement two transparent, working scenarios first:
- Country-specific commodity import disruption.
- Individual supermarket closure and local accessibility change.

**Step 7 — Add ConsultingWhere Insights**

Create client-facing interpretation panels and profile export functionality.

**Step 8 — Test and refine**

Run:
- TypeScript checks.
- Production build.
- Unit tests.
- Browser smoke tests.
- Map layer loading tests where possible.
- Error and empty-data tests.
- Responsive viewport checks.

Correct implementation errors.

Check that ArcGIS map interactions and React state remain synchronised.

**Step 9 — Complete optional extensions**

Add additional food commodities, national coverage, more scenarios, charts and AI capabilities only after the core experience is stable.

**Step 10 — Package and document**

Prepare all production files and GitHub Pages deployment configuration.

Do not stop at a conceptual design.

Where tools or network access are unavailable, clearly report which verification or tests were not possible, and do not claim success without evidence.

---

# 18. Required project structure

Create a maintainable modular structure similar to:

```text
foodscope-uk/
├── public/
│   ├── data/
│   ├── assets/
│   └── config.json
├── src/
│   ├── app/
│   ├── components/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── maps/
│   │   ├── charts/
│   │   └── controls/
│   ├── features/
│   │   ├── food-origins/
│   │   ├── seasonal-supply/
│   │   ├── supermarkets/
│   │   ├── food-access/
│   │   ├── authority-profiles/
│   │   ├── vulnerabilities/
│   │   ├── scenarios/
│   │   └── consulting-insights/
│   ├── services/
│   │   ├── arcgis/
│   │   ├── hmrc/
│   │   ├── defra/
│   │   └── geolytix/
│   ├── data/
│   ├── analysis/
│   ├── hooks/
│   ├── styles/
│   ├── types/
│   └── main.tsx
├── scripts/
├── tests/
├── .github/
│   └── workflows/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── .env.example
└── README.md
```

Use this as a guide, adapting it as necessary.

---

# 19. Functional first-release acceptance criteria

The initial release is complete only when:

1. The React application starts and renders a functioning ArcGIS map.
2. The interface has a polished, consistent visual design.
3. Selecting a commodity updates actual data-driven maps and charts.
4. Changing the month updates recorded import information.
5. Supermarkets load from a real dataset or configured ArcGIS service.
6. Retailer filtering works.
7. Local authority selection zooms to the correct boundary.
8. At least two real authority profiles work.
9. Calculated indicators match their source data and documented formulas.
10. At least two scenario simulations work with transparent assumptions.
11. The ConsultingWhere Insights panel produces meaningful evidence-based output.
12. Loading, empty and error states are handled.
13. The application builds successfully for production.
14. GitHub Pages deployment configuration is present and the base path is correct.
15. The README documents setup, data preparation, refresh, licensing, assumptions and known limitations.

Visual quality matters, but functionality and credibility are mandatory.

---

# 20. Final design challenge

Make FOODSCOPE UK feel alive.

Users should feel that they are exploring the United Kingdom's interconnected food system in real time, while clearly understanding which data is updated monthly, annually or at other intervals.

The experience should be memorable:

- Global connections pulse and change.
- Countries illuminate when selected.
- The seasonal slider reveals changing food supply patterns.
- The map flies smoothly between global and local scales.
- Local authorities highlight elegantly.
- Supermarkets appear as beautiful symbols.
- Charts update without distracting transitions.
- Risk scenarios are easy to understand.
- Consulting insights appear as carefully designed executive summaries.

The result should be visually exceptional while remaining professional, accessible and scientifically credible.

**The application should demonstrate that ConsultingWhere can transform fragmented national data into geographic intelligence, identify evidence gaps and help clients plan more resilient food systems.**

Start building the project now.

Prioritise a complete, tested first release over an extensive but unfinished feature list.

Do not finish by merely describing the application. Create the source files, implement the functionality, test the build and provide deployment instructions.