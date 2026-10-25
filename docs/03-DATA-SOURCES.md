# FOODSCOPE UK — Data-Source Inventory

| | |
|---|---|
| **Document** | 03 — Verified data catalogue and manifest |
| **Version** | 0.7 — 25 October 2026 (Stage 6 data step: S03 theme 3 tables and S23 verified; S30–S33, S35 and S36 added and verified; S34 (OSNI roads) unreachable; S13, S15 and S17 notes updated. Earlier: pre-Stage 5 data steps S13, S15, S16, S19, S20, S29, gates G8–G11; context step S09, S10, S21) |
| **Verification date** | 23 October 2026; S11, S12, S14 and S18 re-verified 24 October 2026; S09, S10 and S21 verified 25 October 2026; S03, S23, S30–S33, S35 and S36 verified 25 October 2026 (Stage 6 data step) |
| **Machine-readable form** | Generated into `public/data/snapshots/<date>/catalogue.json` by the pipeline from Stage 2 |

## How to read this document

Each source has an ID (`S01`…) used in code (`Indicator.sourceIds`), the manifest and the Evidence page.

**Verification status**

| Status | Meaning |
|---|---|
| ✅ **Verified** | Endpoint/download and schema were checked directly (e.g. live API query, service metadata) |
| 🟡 **Partly verified** | Publisher page and key facts checked; schema/coverage still to confirm from the actual file |
| 🔴 **To verify** | Identified as the right source but not yet checked; must not be coded against until verified |
| ⚠️ **Gap** | No suitable source found; a substitute or explicit limitation is recorded |

**Rule:** code may only depend on fields marked as verified. Each 🟡/🔴 item has a *verification gate* in the roadmap (`04-ROADMAP.md`), to be cleared before the stage that uses it.

---

## 1. Summary

| ID | Source | Publisher | Status | Used by | Release |
|---|---|---|---|---|---|
| S01 | Overseas Trade Statistics API (uktradeinfo) | HMRC | ✅ | Origins, Seasonal, Scenarios, Risks | R1 |
| S02 | UK import trade by country of origin and country of dispatch, 2024 | HMRC | ✅ (context) | Evidence page, caveats | R1 |
| S03 | United Kingdom Food Security Report 2024 | Defra | ✅ theme 3 tables 3_2_1a, 3_2_2a, 3_2_2b (25 Oct 2026); 🟡 other themes | Risk Explorer (logistics), Profiles (national context), Scenario B | R1 |
| S04 | United Kingdom Food Security Digest 2025 | Defra | 🟡 | National context | R1 |
| S05 | Food statistics in your pocket (+ Defra trade codes) | Defra | 🟡 | Commodity definitions, prices, production-to-supply | R1 |
| S06 | Monthly UK cattle, sheep and pig slaughter and meat production | Defra | 🟡 | Seasonal (production) | R2 |
| S07 | Monthly UK hatcheries and poultry slaughterhouse statistics | Defra | 🟡 | Seasonal (production) | R2 |
| S08 | Milk utilisation by dairies (monthly) | Defra | 🟡 | Seasonal (production) | R2 |
| S09 | Horticulture statistics 2025 (annual dataset) | Defra | ✅ (tomatoes, strawberries: supply balance; 25 Oct 2026) | Profiles (national context) | R1 |
| S10 | Agriculture in the United Kingdom 2025, chapter 7 (crops) | Defra | ✅ (wheat, potatoes: supply and use; 25 Oct 2026) | Profiles (national context), Scenario C | R1/R2 |
| S11 | Grocery / Supermarket Retail Points (v46, June 2026) | GEOLYTIX | ✅ | Supermarkets, Profiles, Access, Scenario D | R1 |
| S12 | Number of chain supermarkets across LADs and smaller areas in the UK | ONS | ✅ (LAD tables 1–4) | Validation of store counts | R1 |
| S13 | Priority Places for Food Index (v2.1) | CDRC / Leeds HASP | ✅ (all four nations; Scotland on 2011 Data Zones; NI on SOAs 2011, three domains without data) | Access, Profiles, Risk Explorer (every council) | R1 |
| S14 | Local Authority Districts (May 2025) Boundaries UK, BGC (display) and BFE (store assignment) | ONS | ✅ | All UK views, Profiles | R1 |
| S15 | LSOA 2021 boundaries and population-weighted centroids (E&W); LSOA → council lookup | ONS | ✅ (boundaries for Manchester, G11; lookup for all 35,672 LSOAs, Stage 6) | Access, Profiles (Manchester), Risk Explorer | R1 |
| S16 | Data Zones 2021 (and Super Data Zones) | NISRA | ✅ (boundaries, centroids; G9) | Access, Profiles (Belfast) | R1 |
| S17 | Data Zones 2022 | Scottish Government / NRS | 🔴 | Access (Scotland) | R2 |
| S18 | Mid-year population estimates (ONS UK tables, mid-2025) | ONS (with NRS and NISRA) | ✅ (council level; Census 2021 small areas for Manchester and Belfast) | All per-capita indicators | R1 |
| S19 | Deprivation indices (IoD 2025, WIMD 2025, SIMD, NIMDM 2017) | MHCLG / Welsh Gov / Scottish Gov / NISRA | ✅ England (IoD 2025), Northern Ireland (NIMDM 2017); 🟡 Wales, Scotland | Access, Profiles, Scenario D | R1 (Eng, NI) |
| S20 | Car or van availability (Census 2021 / Scotland's Census 2022) | ONS / NISRA / NRS | ✅ England & Wales (TS045), Northern Ireland (table builder, file from John); 🔴 Scotland | Access, Profiles | R1 (Eng, NI) |
| S21 | Rural–urban classifications | ONS / Scottish Gov / NISRA | ✅ England & Wales (ONS 2021, councils and LSOAs); Northern Ireland 2015 class per SOA (NIMDM file); 🔴 Scotland | Profiles, Access | R1 (E&W, NI small areas) |
| S22 | Journey time statistics | DfT | 🔴 (England only) | Access context | R2 |
| S23 | Port freight annual statistics 2025 (PORT0499, PORT0304, port list) | DfT | ✅ (25 Oct 2026) | Risk Explorer (logistics), Scenario B | R1 |
| S24 | Natural Earth Admin 0 countries (v5.1.2) | Natural Earth | ✅ (1:110m outlines, 1:50m label points, ISO crosswalk) | Map reference layer; Origins map | R1 |
| S25 | Basemap styles service: dark grey, light grey, imagery | Esri (ArcGIS Location Platform) | ✅ all three styles (live site, 24 Oct 2026) | Map | R1 |
| S26 | ArcGIS Living Atlas items | Esri and contributors | 🔴 per item | Optional reference layers | R2 |
| S27 | Consumer price inflation — food (CPIH) | ONS (via Defra pocketbook CSV) | 🟡 | National context | R1 |
| S28 | HMRC port reference and port-level OTS detail | HMRC | 🟡 | Risks, Scenario B | R2 |
| S29 | Food hygiene rating open data (Northern Ireland councils) | Food Standards Agency | ✅ (NI; 25 Oct 2026) | UK Food Access, Profiles: NI grocers GEOLYTIX misses (supplementary layer) | R1 (NI) |
| S30 | Level of water stress (SDG 6.4.2), FAO AQUASTAT via the World Bank API | FAO / World Bank | ✅ (25 Oct 2026) | Risk Explorer (supply) | R1 |
| S31 | Structure of the agricultural industry at June: England regions; UK key results by country | Defra | ✅ (2025; 25 Oct 2026) | Risk Explorer (logistics: farming regions) | R1 |
| S32 | Data Zone lookups (2011 and 2022) | Scottish Government | ✅ (25 Oct 2026) | Risk Explorer (PPFI by council, Scotland) | R1 |
| S33 | International Territorial Level 1 (January 2025) Boundaries UK BGC | ONS | ✅ (25 Oct 2026) | Risk Explorer (farming regions) | R1 |
| S34 | OSNI Open Data 1:50,000 transport | OSNI / OpenDataNI | ⚠️ service closed the connection to the pipeline in three runs (25 Oct 2026) | — (Northern Ireland roads not shown) | — |
| S35 | OS Open Roads | Ordnance Survey | ✅ (extract, 25 Oct 2026) | Risk Explorer (logistics: road corridors, GB) | R1 |
| S36 | EMODnet Human Activities, main ports: port locations | EMODnet | ✅ (25 Oct 2026) | Risk Explorer (locations of 24 ports DfT does not locate) | R1 |

---

## 2. Trade

### S01 — HMRC Overseas Trade Statistics API ✅

| Field | Detail |
|---|---|
| Official title | uktradeinfo API (Overseas Trade Statistics) |
| Publisher | HM Revenue & Customs |
| Documentation | https://www.uktradeinfo.com/api-documentation/ (OData; Swagger at `/swagger/ui/index`) |
| Service URL | `https://api.uktradeinfo.com` — OData; JSON default |
| Licence | Open Government Licence v3.0 (© Crown copyright), per API documentation page |
| Access | Open, no authorisation header. **Not reachable from the build sandbox** (proxy denies the host); reachable from GitHub Actions runners and from a desktop browser |
| Limits | **60 requests per minute** (the pipeline uses ≤ 50); responses capped at **40,000 items**, paging via `@odata.nextLink`; "aggregations and filtering are still made across the whole dataset before the limit is applied" |
| Refresh | Monthly. August 2026 data published 15 Oct 2026; September 2026 due 12 Nov 2026 (HMRC release calendar, methodology notes) |
| Latest period | **August 2026** (`MonthId` 202608) — confirmed on 23 Oct 2026 by the pipeline: August has records, September (202609) has none |
| Endpoints used | `/OTS`, `/Commodity`, `/Country` |
| Verified OTS fields | `MonthId`, `FlowTypeId`, `SuppressionIndex`, `CommodityId`, `CountryId`, `PortId`, `Value`, `NetMass` (also `CommoditySitcId`, `SuppUnit`, not used) |
| Verified Commodity fields | `CommodityId`, `Cn8Code`, `Hs2Code`, `Hs4Code`, `Hs6Code`, `Hs2Description`, `Hs4Description`, `Hs6Description`, `SitcCommodityCode`, `Cn8LongDescription`. `/Commodity` lists **current and discontinued** CN8 codes under each heading (e.g. tomatoes `07020000` and `07020010/91/99`), so baskets filtered by HS heading are continuous across nomenclature changes |
| Verified Country fields | `CountryId`, `CountryCodeNumeric`, `CountryName`, `CountryCodeAlpha`, `Area1a`. **`CountryCodeNumeric` is HMRC's own code, not ISO 3166 numeric** (France = `001`). `CountryCodeAlpha` is ISO alpha-2 except HMRC-specific codes (Serbia `XS`, Kosovo `XK`, Ceuta `XC`, Melilla `XL`, Serbia-Montenegro `CS`, UAE emirates `DH`/`DU`/`HA`, regional aggregates `XO`/`XA`/`XR`); two `CountryId`s share `US`; non-country categories (stores and provisions `QR`/`QS`, low-value trade `ZY`/`QV`, estimates `QV`, confidential `977` and "Other …" `1001`–`1007`) have their own ids, some with no alpha code |
| Flow types | 1 = EU imports, 2 = EU exports, 3 = Non-EU imports, 4 = Non-EU exports (OTS) |
| Units | `NetMass` kilograms; `Value` pounds sterling |
| Valuation (gate G2 ✅) | Imports on a **cost, insurance and freight (CIF)** basis — the UN-recommended statistical value; EU trade collected through Intrastat uses **invoice value** (HMRC OTS methodology and quality report, updated 9 Dec 2025) |
| Net mass quality | About a third of Intrastat goods need no weight declaration and are estimated; customs records with missing mass get an estimate from Eurostat commodity factors (same report; HMRC policies and methodologies page) |
| Revisions (gate G2 ✅) | "Published data is provisional for up to 18 months after it is published" (uktradeinfo suppressions and revisions page). The app marks months first published within 18 months of retrieval as **provisional** (from Mar 2025 in the 23 Oct 2026 snapshot; estimated with a ~6-week publication lag) |
| Low-value trade | Individual consignments ≤ £873 are aggregated under commodity `99500000`, so they never appear in the food baskets |
| Query options | `$filter`, `$select`, `$expand`, `$top`, `$skip`, `$apply` (`filter(…)/groupby((…),aggregate(… with sum as …, $count as …))`), `$count`, `$format`. `$orderby` is not documented and returned a client error in planning — not used |
| `$apply` aggregation (gate G1 ✅) | Verified 23 Oct 2026: `groupby((MonthId,FlowTypeId,CountryId,CommodityId,SuppressionIndex))` with `NetMass`/`Value` sums matches the sum of unaggregated `/OTS` rows exactly for five basket-months (tomatoes Jan 2025: 117 rows, 33,060,038 kg, £57,382,707; strawberries Jun 2024; bananas Jul 2024; potatoes Mar 2025; wheat Nov 2023) — `pipeline/reports/hmrc-reconciliation-2026-10-23.json` |
| Grain | One row per month × flow × CN8 commodity × country × port × suppression index; the pipeline aggregates server-side to month × flow × country × CN8 × suppression |
| Suppression | `SuppressionIndex` 0 = not suppressed; 1–5 per the API documentation (1 complete; 2 countries and ports; 3 countries, ports and total quantity; 4 quantity for countries and ports; 5 quantity for countries, ports and total). Present elsewhere in OTS (levels 2 and 3 in Jan–Mar 2025), **but no rows with `SuppressionIndex` > 0 exist for the five Food Origins baskets since Jan 2019** (pipeline check). Suppressed rows would be kept in their own bucket with quantity `null` where withheld |
| CORS | Not verified. Not needed: the browser never calls the API (ADR-01) |

**Food Origins baskets (gate G3, partly cleared).** Verified against `/Commodity` on 23 Oct 2026. The Defra trade-code comparison (S05 ODS) is still to do; the definitions below follow HMRC's HS headings and are shown in the UI.

| Basket | HS scope | CN8 codes in the snapshot (current and discontinued) |
|---|---|---|
| Tomatoes | 0702 — fresh or chilled | 07020000, 07020010, 07020091, 07020099 |
| Strawberries | 0810 10 — fresh | 08101000 |
| Bananas | 0803 — incl. plantains, fresh or dried | 08030011, 08030019, 08030090, 08031010, 08031090, 08039010, 08039011, 08039019, 08039090 |
| Potatoes | 0701 — fresh or chilled, incl. seed (excl. frozen/processed) | 07011000, 07019010, 07019050, 07019090 |
| Wheat | 1001 — wheat and meslin, incl. durum and seed | 10011000, 10011100, 10011900, 10019010, 10019091, 10019099, 10019110, 10019120, 10019190, 10019900 |

**Commodity-code history (Stage 3).** The offline build also writes, for every CN8 code in a basket:
- `firstMonth` and `lastMonth` (first and last month with recorded import rows);
- `monthsRecorded`;
- `calendarMonths` (calendar months that ever have rows);
- `netMassKgByCalendarMonth` (unsuppressed net mass summed by calendar month).

It also writes basket-level `codeChanges`: months where one code's records end and another's begin, strictly inside the snapshot. All of this is derived from the same committed `/OTS` aggregate responses as the totals, which are unchanged (fingerprint and reconciliation tests in `pipeline/tests/test_trade_snapshot.py`). Facts in the 23 Oct 2026 snapshot:

| Basket | Code history |
|---|---|
| Tomatoes | `07020000` ("Tomatoes, fresh or chilled"; /Commodity gives no CN8 long description, so the HS6 text is used) recorded Jan 2019 – Dec 2024; `07020010`, `07020091` and `07020099` (HMRC: whole tomatoes under 47 mm; tomatoes in trusses, 47 mm and over; other tomatoes) recorded from Jan 2025 |
| Bananas | `08039010` (fresh bananas) recorded Jan 2019 – Dec 2023; `08039011` (Plátano de Canarias) and `08039019` (other fresh bananas) from Jan 2024. `08030011`, `08030019` and `08030090` have no records since Jan 2019 |
| Potatoes | `07019050` (HMRC: "new potatoes from 1 January to 30 June") holds 99.6 % of its net mass in January–June (small amounts in Jul 2024, Jul 2025 and Dec 2024) and 10.8 % of the basket. HMRC's description of `07019090` excludes those new potatoes, so code-level series switch with the season; the basket includes both, so its totals do not |
| Wheat | `10011000`, `10019010`, `10019091` and `10019099` have no records since Jan 2019; other codes are recorded with gaps (seed codes) |
| Strawberries | One code (`08101000`), recorded every month |

The wording says when a code is *recorded*: the API gives no validity dates, so the app does not claim when a code was introduced.

**Ingestion (Stage 2).** `pipeline/foodscope_pipeline/sources/hmrc_ots.py` (online) fetches `/Commodity`, `/Country`, one `$apply` aggregate per basket from Jan 2019, the raw rows for one reconciliation month per basket, and probes the latest and next month — 15 requests on 23 Oct 2026. Every response is stored byte-for-byte in `pipeline/raw/hmrc/<snapshot>/` with URL, timestamp and SHA-256. `trade.py` (offline) builds `public/data/snapshots/<snapshot>/trade/<basket>.json` and fails if the reconciliation does not match. It runs in GitHub Actions (`refresh-trade-data.yml`), never in the browser.

**Interpretation caveats (verified)**

- **Partner country = country of dispatch.** HMRC: "For goods entering the UK, country data is based on the country of dispatch … the country the goods were exported from to come to the UK", which may differ from the country of origin or manufacture (uktradeinfo policies and methodologies page; bulk data dictionary).
- **Netherlands effect.** HMRC's 2024 origin-vs-dispatch comparison (S02) shows the Netherlands with about £19.7bn of imports by origin but about £46.5bn by dispatch, the largest gap of any partner. In the snapshot the Netherlands is the largest recorded partner for tomatoes (43.8 % of net mass, 12 months to Aug 2026), and Ireland appears as a recorded banana partner.
- **Series breaks.** GB imports from the EU have been compiled from customs declarations since 1 January 2022; Intrastat still applies to Northern Ireland–EU movements; imports from the EU were not affected in 2021 (August 2026 methodology notes). Trends spanning January 2021 and January 2022 carry break markers (FO-11).
- **Northern Ireland.** NI–EU goods trade is still reported through Intrastat; country of origin is not required on Intrastat.
- **Suppression.** Suppressed quantities are shown as their own category, never redistributed (P12).
- **Odd partners.** Very small recorded partners (e.g. Nauru for tomatoes) are shown as recorded; they are not filtered.

### S02 — UK import trade in goods by country of origin and country of dispatch, 2024 ✅ (context)

| Field | Detail |
|---|---|
| Publisher | HMRC (official statistics, ad hoc) |
| URL | https://www.gov.uk/government/statistics/uk-import-trade-in-goods-by-country-of-origin-and-country-of-dispatch-2024 |
| Published | 21 May 2026; covers 2024; no planned repeat |
| Use | Evidence page and P3 caveat; not used for figures in maps (it covers only trade where both CoO and CoD were declared and won't match headline OTS) |

### S30 — Level of water stress (SDG 6.4.2), FAO AQUASTAT ✅ (25 Oct 2026)

| Field | Detail |
|---|---|
| Indicator | World Bank `ER.H2O.FWST.ZS`, "Level of water stress: freshwater withdrawal as a proportion of available freshwater resources" (data.worldbank.org, read 25 Oct 2026); source FAO AQUASTAT; licence CC BY 4.0 |
| Download | `https://api.worldbank.org/v2/country/all/indicator/ER.H2O.FWST.ZS?format=json&per_page=20000&date=2000:2025` (one page: header `total` 6,916, `lastupdated` 2026-10-08) and the country list `https://api.worldbank.org/v2/country?format=json&per_page=400` (296 entries, 79 aggregates). Fetched on GitHub Actions into `pipeline/raw/worldbank/2026-10-25/` |
| Fields used | `countryiso3code`, `date`, `value` (per cent), `indicator.id`; the country list's `id` (ISO3), `iso2Code`, `name`, `region.value` (`Aggregates` marks regions and income groups, which are excluded) |
| Coverage | 217 economies: 178 with a value (latest year 2022; 2021 for Israel and West Bank and Gaza), 39 without (e.g. Hong Kong, Gibraltar, Kosovo, Montenegro; listed in the dataset, never filled in) |
| Classes | FAO and UN-Water SDG 6.4.2 thresholds: no stress below 25 %, low 25–50 %, medium 50–75 %, high 75–100 %, critical above 100 % (Progress on Level of Water Stress, 2021). A value on a threshold takes the higher class, except 100 %, which is high. In the 2026 file: 117 none, 23 low, 15 medium, 6 high, 17 critical |
| Join to trade partners | ISO 3166 alpha-2 (`iso2Code`) to HMRC partners' `iso2` (S24 crosswalk). Partners with no value (e.g. Taiwan, which the World Bank list does not include) are shown as "no data" |
| **Limits** | A national figure: total withdrawals against renewable resources for the whole country. It does not describe the region where a crop is grown (e.g. southern Spain), the season, or whether the UK's imports are irrigated, and it is not a probability of disruption. The app says so wherever it is shown, and never folds it into a score |

### S28 — HMRC port reference and port-level detail 🟡

`/Port` endpoint lists `PortId` values used in `/OTS`. Port-level commodity imports could support a commodity-specific view of Short Straits dependence. **To verify** in Stage 10 (Release 2): completeness of port allocation for EU roll-on/roll-off imports, suppression at port level, and how Dover/Channel Tunnel are coded. Until verified, Scenario B uses UKFSR published shares (S03).

---

## 3. Food security context and domestic production (Defra)

### S03 — United Kingdom Food Security Report 2024 ✅ theme 3 tables (25 Oct 2026); 🟡 other themes

| Field | Detail |
|---|---|
| URL | https://www.gov.uk/government/statistics/united-kingdom-food-security-report-2024 |
| Published | 11 December 2024; next report towards the end of 2027 (statutory, at least every three years) |
| Format | HTML themes 1–5; PDF; one ODS dataset per theme |
| Licence | OGL v3.0 |
| Key facts used (Theme 3) | Short Straits carried on average about 18 % of total food, feed and drink import volume; higher for perishables in 2023 — about 42 % of dairy and eggs, 39 % of meat, 29 % of fruit and vegetables. EU supplied 64 % of food, feed and drink import volume in 2023. |
| **Theme 3 dataset (verified 25 Oct 2026)** | `FSR-theme3-241211.ods` (asset `6756c6a1a63e1781efb87778`, linked from the theme 3 page), fetched by `fetch-reference --set stage6` into `pipeline/raw/defra/2026-10-25/`. Sheets used, each a long table with a header row: **3_2_2a** `port`, `year`, `value` — "Percentage of imports of food, feed, and drink (FFD) by volume in the UK by port of entry, 2022 and 2023", 13 port groups including "Other recorded ports" and "No port recorded" (each year sums to 100 ± 0.01); **3_2_2b** `food`, `year`, `percentage`, `food_order` — proportion of each food group's import volume recorded as entering at Dover, Dover/Eurotunnel or Eurotunnel (Folkestone), 12 groups, 2022 and 2023 (2023: dairy 42.2, meat 38.78, fruit & veg 29.03 — the key facts above); **3_2_1a** `month`, `variable` (`Monthly`, `Year ending`), `value` — average delay on England's Strategic Road Network, seconds per vehicle per mile, April 2015 to December 2023 (the title says "to 2024"); the year-ending series has no value for its first 11 months. |
| Not used | 3_2_3a (agri-food import volume, EU and non-EU): its title says "MT" but the values (e.g. 20,514,812,183 for the EU in 2010) are not in million tonnes; not used until the unit is confirmed. |
| Processing | `build-risk` → `risk/port-entry.json`, values as published. Port groups are linked to DfT statistical ports (`config/risk.json`) for highlighting only; the percentages are never combined with DfT tonnages. |

### S04 — United Kingdom Food Security Digest 2025 🟡

Annual official statistics; 2025 edition published 11 December 2025. The next digest is expected towards the end of 2026; there will be no digest in 2027 (replaced by the triennial report). URL: https://www.gov.uk/government/collections/united-kingdom-food-security-digest. **Check for the 2026 edition** before Release 1 sign-off.

### S05 — Food statistics in your pocket 🟡

| Field | Detail |
|---|---|
| URL | https://www.gov.uk/government/statistics/food-statistics-pocketbook |
| Last updated | 29 July 2026 |
| Formats | HTML; CSV chart data (e.g. production-to-supply ratio 1956–2023; CPIH food since 2020; consumer price change by food group); **ODS "Defra trade codes and descriptions"** |
| Licence | OGL v3.0 |
| Use | (1) Align commodity baskets with Defra's trade code groupings (spec §6.1); (2) national production-to-supply ratio; (3) food price context (S27) |
| To verify | CSV column names; whether commodity-level self-sufficiency figures are available (the overall ratio is; per-commodity is not confirmed) |

### S06–S08 — Monthly domestic production series 🟡

| ID | Title | Latest seen | Use |
|---|---|---|---|
| S06 | Monthly UK statistics on cattle, sheep and pig slaughter and meat production | statistics notice with data to **September 2026** | Beef, sheep meat monthly production |
| S07 | Monthly statistics on the activity of UK hatcheries and UK poultry slaughterhouses | data for June 2026 seen (later editions likely) | Poultry monthly production |
| S08 | Milk utilisation by dairies | monthly; latest edition to confirm | Milk products context |

Publisher: Defra (gov.uk statistics collections). Licence OGL v3.0. **To verify**: dataset file formats and column names; unit definitions (dressed carcase weight etc.).

**Stage 3 (Seasonal Supply).** None of S06–S08 covers the five baskets in the app (tomatoes, strawberries, bananas, potatoes, wheat). Seasonal Supply therefore shows **no UK production** (SS-07). Its "UK production" and "Combined" options are disabled, with this explanation:
- tomatoes, strawberries and potatoes point to S09;
- wheat points to S10;
- bananas: the inventory lists no source.

Imports are never used to estimate domestic production.

### S09 / S10 — Annual production ✅ (25 October 2026)

Verified from the files themselves (fetched by `fetch-reference --set context` on GitHub Actions, run 40190433555; `pipeline/raw/defra/2026-10-25/`) for the Stage 5 national context (John, 25 Oct 2026). Both are accredited official statistics under OGL v3.0. Used only as annual national context, side by side with (never combined with) HMRC monthly trade (spec SS-07).

| | S09 Horticulture statistics 2025 | S10 Agriculture in the United Kingdom 2025, chapter 7 |
|---|---|---|
| Publisher page | `https://www.gov.uk/government/statistics/latest-horticulture-statistics/horticulture-statistics-2025` (published 25 June 2026) | `https://www.gov.uk/government/statistics/agriculture-in-the-united-kingdom-2025/chapter-7-crops` (published 9 July 2026, updated 3 Sept 2026) |
| File | `hort-dataset-25-20260625.ods` | `AUK-chapter7-20260709.ods` |
| Baskets | Tomatoes (Table 23, sheet `Table_23_Veg_Supply`), strawberries (Table 12, sheet `Table_12_Fruit_Supply_`) | Wheat (Table 7.2c, sheet `Table_7_2`), potatoes (Table 7.10c, sheet `Table_7_10`) |
| Layout | Header row with `CALENDAR YEAR` in column B and years 1988–2025; a crop heading in column A ("Tomatoes", "Strawberries:"), then five rows in column B: `Home Production Marketed (HPM)`, `Imports`, `Exports`, `Total Supply:`, `HPM as % of Total Supply` (thousand tonnes; the share in per cent) | Each sheet stacks sub-tables: a title row ("Table 7.2c Wheat supply and use (thousand tonnes)"), a header row of years (`2025 (provisional)`) and a `Notes` column, rows until a blank row. `[x]` = not available. The production share is stored as a fraction in a percentage-formatted cell |
| Rows used | as listed | Wheat: `Production`, `Imports from the EU`, `Imports from the rest of the world`, `Exports to the EU`, `Exports to the rest of the world`, `Total new supply`, `Production as % of total new supply for use in UK`. Potatoes: `Total production`, `Imports`, `Exports`, `Total new supply (raw equivalent)`, `Production as % of total new supply for use in the UK` |
| 2025 values (read by the build) | Tomatoes: HPM 79.0, imports 389.8, exports 1.2, supply 467.6 thousand tonnes; HPM 16.9 % of supply. Strawberries: 92.9, 72.8, 1.2, 164.5; 56.5 % | Wheat (provisional): production 11,958, imports 2,674, exports 207, total new supply 14,425; 82.9 %. Potatoes (provisional): 5,083, 2,496, 430, 7,149; 71.1 % |
| Caveats | Defra's trade figures are HMRC "fresh produce where distinguishable" with Defra's product definitions: not the Food Origins basket. No per-crop supply for other crops is needed | Potato production in the supply table is for human consumption and seed; harvested production (Table 7.10a) is larger. Potato trade includes processed potatoes in raw equivalent. Cereals are standardised to 14.5 % moisture |

The build checks, for the year it shows, that total supply = production + imports − exports and that the share = production ÷ total supply (both exact for 2025). **Bananas:** Defra publishes no UK production statistics; the profile says so. Config: `pipeline/foodscope_pipeline/config/national_production.json`. The Seasonal Supply text (SS-07) still calls S09/S10 "not yet verified"; Stage 5 updates it (monthly production is still not published).

---

### S31 — Structure of the agricultural industry at June ✅ (2025 results; 25 Oct 2026)

Defra, "Structure of the agricultural industry in England and the UK at June" (page updated 22 Sep 2026; OGL v3.0). Two datasets fetched into `pipeline/raw/defra/2026-10-25/`:

| File | Verified structure | Use |
|---|---|---|
| `structure-england-june-regions-16apr26.ods` | One sheet per year (2010–2025, no 2020); sheet `2025`, header row 3 (`England 2025 Region`, then farm size, farm type, land use, crop, livestock and labour columns); rows for 8 Defra regions and England. Columns used: `Wheat`, `Total cattle`, `Total sheep`, `Total pigs`, `Total poultry`. Commercial holdings only; cattle from the Cattle Tracing System (commercial holdings) | Regions of England (London is counted with the South East: `South East (incl. London)`; `North West and Merseyside`; `Eastern`) |
| `UK_key_results_by_country_1866-2025.ods` | Sheets `Wheat` (thousand hectares), `Cattle`, `Sheep`, `Pigs`, `Poultry` (million birds); columns `Year`, `England`, `Wales`, `England & Wales`, `Scotland`, `Great Britain`, `Northern Ireland`, `United Kingdom` | Wales, Scotland, Northern Ireland |

- **Checks (build):** the 8 regions add up to the England row for every measure; for wheat, sheep, pigs and poultry they also equal England in the UK table. Cattle differ by design: regions 4,660,871 head (commercial holdings) against 4,911,311 for all holdings in England (2025). The four countries add up to the UK row.
- **Unit labels:** the `Cattle`, `Sheep` and `Pigs` sheets say "thousand head" but hold head counts (England's sheep, 13,312,071, equals the regional table's total). Values are used as head and the discrepancy is noted in the dataset.
- **Comparability:** England's figures are commercial holdings; each devolved country's come from its own survey or census, as compiled by Defra. Regional figures are survey estimates (sampling error). Shown as counts by region, never as a regional score.

## 4. Retail

### S11 — GEOLYTIX Grocery / Supermarket Retail Points ✅

| Field | Detail |
|---|---|
| Official title | Grocery Retail Points (earlier releases: Supermarket Retail Points) |
| Publisher | GEOLYTIX |
| Info pages | https://geolytix.com/blog/supermarket-retail-points/ · Q1 2026 update: https://geolytix.com/blog/grocery-retail-points-2026q1/ |
| Download | Via GEOLYTIX's data viewer (geolytixmapp.com/product, Grocery layer) |
| Edition in use | **v46, June 2026** (`geolytix_retailpoints_v46_202606.xlsx`), provided by John on 24 Oct 2026; committed with its SHA-256 in `pipeline/raw/geolytix/v46-202606/` |
| Licence | No named licence. The Q1 2026 blog page (read 24 Oct 2026) calls it "completely free and open to use data" and says it has been open data for 12 years. Attribution used as a courtesy: "Contains GEOLYTIX Grocery Retail Points data (v46, June 2026)" |
| Refresh | Quarterly |
| Verified fields (v46, 24 Oct 2026) | One sheet, 19,299 rows, unique integer `id`. Exactly these 17 columns: `id`, `retailer`, `fascia`, `store_name`, `add_one`, `add_two`, `town`, `suburb`, `postcode`, `long_wgs`, `lat_wgs`, `bng_e`, `bng_n`, `pqi`, `open_date`, `size_band`, `county`. The reader stops on any other header |
| Retailers and fascias | 37 retailers, 53 fascias |
| `size_band` values | `< 3,013 ft2 (280m2)` (11,988) · `3,013 < 15,069 ft2 (280 < 1,400 m2)` (4,503) · `15,069 < 30,138 ft2 (1,400 < 2,800 m2)` (1,226) · `30,138 ft2 > (2,800 m2)` (1,582); the same labels as S12 |
| Coordinates | `long_wgs`/`lat_wgs` present for 19,298 rows. One store (id 1010001979, M&S Anlaby, HU10 6RJ) has BNG only and is placed from it, flagged |
| `bng_e`/`bng_n` | Equal to the WGS84 point projected to British National Grid with PROJ's default OSGB36 transformation (median difference 0.00 m), **including in Northern Ireland**, where they are therefore BNG values derived from WGS84, not Irish Grid. Three GB stores differ by 48–67 m; the pipeline uses WGS84 |
| `pqi` | Values Rooftop (19,254), Building (28), Third Party (17); read as a location-quality indicator (no user guide read) |
| Coverage | UK including Northern Ireland (627 `BT` postcodes; 725 stores in the 11 NI councils, 722 published) **plus the Crown Dependencies**: Guernsey 30, Jersey 51, Isle of Man 44. These have no UK council: they are on the map (John, 24 Oct 2026) but in no council figure. **Northern Ireland retailers:** the file has only ten: Spar (incl. Eurospar, 385), Centra (102; 98 without a postcode), Tesco (56), Lidl (44), Iceland (40), M&S (26), Co-op (25), Asda (17), Dunnes Stores (15) and Sainsbury's (12). No other NI symbol group or independent grocer is in it |
| Formats included | Supermarkets, convenience, petrol forecourts, motorway services, travel, hospital, wholesale and non-food outlets. Classes and formats per decision D5 (below) |
| Processing | `foodscope-pipeline build-local`: read the .xlsx; classify by D5; council by point-in-polygon on the S14 BFE edition in EPSG:27700; a store up to 50 m outside every council (2 Northern Ireland shore-front stores) takes the nearest one and is flagged; Crown Dependency stores kept with no council (`lad: null`, `crownDependency` named); wholesale and mainly non-food stores left out (116); properties trimmed (`public/data/snapshots/<snapshot>/local/stores.geojson`, 19,183 stores) |
| Store classes (D5, agreed 24 Oct 2026) | Class from `size_band` only: convenience under 280 m²; supermarket 280 m² and over (three bands). Format from `fascia` (`pipeline/foodscope_pipeline/config/store_classes.json`): forecourt, motorway, travel and hospital, following the GEOLYTIX groupings ONS prints in S12; wholesale (Costco, Makro) and mainly non-food (M&S Outlet, Asda Living, M&S Clothing) left out of the app (John, 24 Oct 2026). Default view: supermarkets in the standard format (7,171 stores in UK councils, plus 22 in the Crown Dependencies) |
| Restrictions / cautions | Retail presence only: no turnover, prices or opening hours. `open_date` is sparse and not used. Size band and fascia sometimes disagree (for example 94 Tesco Express stores in a band of 280 m² or more); the class follows the size band as delivered |

### S12 — ONS: Number of chain supermarkets across LADs and smaller areas in the UK ✅

Published 7 March 2024, OGL v3.0. URL: https://www.ons.gov.uk/peoplepopulationandcommunity/wellbeing/datasets/1numberofchainsupermarketsacrosslocalauthoritydistrictsladandsmallergeographicalareasintheuk. John provided the file on 24 Oct 2026; it is committed in `pipeline/raw/ons-supermarkets/2024-03-07/`.

- **Underlying source:** GEOLYTIX (cover sheet: "Supermarkets data source: Geolytix"), plus 52 stores from retailers not in the GEOLYTIX data (note 1).
- **Populations used for per-capita figures:** Census 2021 for England, Wales and Northern Ireland; Census 2022 for Scotland (note 2).
- **Verified tables (LAD level):**
  - Table 1: `LAD code`, `LAD name`, `Counts`. 376 rows, including `L99999999` Channel Islands and `M99999999` Isle of Man; total 18,160.
  - Table 2: `Supermarkets`, `People per Supermarket`, `Supermarkets per 10,000 people`.
  - Table 3: the four GEOLYTIX size bands.
  - Table 4: ONS retailer type (Convenience, Discounter, Freezer Centre, Petrol Forecourt, Specialist, Symbol Group, Traditional, Travel, Wholesaler, Other). The fascias in each type are listed in the Notes worksheet.
  - The four tables agree for every council (checked by the reader).
- **Councils:** those of the time, before the 2023 mergers (Cumbria, North Yorkshire, Somerset) and before the 2025 Barnsley and Sheffield codes. The pipeline maps them to May 2025 councils with the S14 lookup and `config/lad_code_changes.json`.
- **Use:** a validation benchmark for our council counts (spec §6.3), never displayed as a second value. Expect differences from vintage and class definition; report them, don't force agreement. First comparison: `pipeline/reports/ons-s12-comparison-2026-10-24.json` (our 19,174 stores against S12's 18,069 in UK councils, +6.1 %; explained in `docs/stage-reports/pre-stage-4-data.md`). Stage 4 adds the counts the app displays to the same report (`displayed`): every type shown 19,058 against 18,069 (+5.5 %); supermarkets 7,171 against S12's 280 m² and over bands 7,420 (−3.4 %); convenience stores 10,622 against S12's under 280 m² band 10,649 (−0.3 %). Explained in `docs/stage-reports/stage-4.md`.

---

## 5. Food-access vulnerability

### S13 — Priority Places for Food Index ✅ (gate G8 cleared 25 Oct 2026)

| Field | Detail |
|---|---|
| Publisher | Consumer Data Research Centre (CDRC) / Leeds Healthy & Sustainable Places Data Service (HASP); interactive map https://priorityplaces.cdrc.ac.uk/ |
| Current version | **Index v2.1** — LSOA release on HASP (dataset 5276; first release 22 Jan 2024, latest release 14 Jul 2024; record updated 2026) |
| Licence | OGL v3.0; open access, tier 0, CSV |
| Geography | LSOA 2021 and Data Zones 2022 listed; spatial coverage listed as **Great Britain** |
| Composition | Seven domains: four retail-access domains at 12.5 % each (supermarket proximity, supermarket accessibility, online delivery access, non-supermarket food provision) and three affordability/need domains (socio-demographic barriers, family food support, fuel poverty) |
| Version 1 | Launched 2022; covered England, Wales, Scotland and Northern Ireland using **2011** geographies (LSOA, Data Zones, NI Super Output Areas). CDRC advises **not comparing v1 with v2**. |
| Constituency product | v2.1 by Westminster constituency (2024), England & Wales only, approximate best-fit aggregation |
| **Gate** | Download v2.1 LSOA CSV; check for NI codes and record column names. If NI is absent, the Belfast profile says PPFI is not available and uses NI-native indicators (S19 NIMDM, S20 car availability, S11 proximity); no v1 reference (John's decision, 24 Oct 2026). |
| **Columns (verified 25 Oct 2026)** | From the HASP data dictionary for record version 1.0.24, provided by John (`pipeline/raw/hasp-provided/ppfi-v2.1-lsoa-1.0.24/`): `lsoa21cd` (area code: LSOA / data zone / SOA); domain ranks `domain_supermarket_proximity`, `domain_supermarket_accessibility`, `domain_ecommerce_access`, `domain_socio_demographic`, `domain_nonsupermarket_proximity`, `domain_food_for_families`, `domain_fuel_poverty`; `country`, `country_denominator`; `combined` (rank); deciles `pp_dec_<domain>` and `pp_dec_combined`. Ranks are within each country. |
| **NI in the user guide** | The v2.1 user guide (leeds-hasp.github.io data docs, read 25 Oct 2026) says the index covers "Super Output Areas in Northern Ireland (2011 boundaries)", ranked within each country, and that cross-country comparison is not recommended. Several NI indicators were not available: supermarket accessibility, online deliveries, markets, Healthy Start and fuel poverty. If NI rows are present, Belfast's PPFI is on the same SOAs as NIMDM 2017. |
| **Download** | HASP needs a free account (the basket goes to a sign-in page). John downloaded the data file `hasp_ppfi_v2.1.csv` (3.4 MB) on 25 Oct 2026. It is in `pipeline/raw/hasp-provided/ppfi-v2.1-lsoa-1.0.24/` with its dictionary and checksums. |
| **Gate G8 result (25 Oct 2026)** | **Northern Ireland is included.** 43,538 rows, ranked 1…n within each country: England 33,755 LSOAs (2021), Wales 1,917 LSOAs, Scotland 6,976 Data Zones, Northern Ireland 890 SOAs (2011, codes such as `95GG01S1`). `country` takes the values `E`, `W`, `S`, `NI`, and `country_denominator` is the number of areas in that country. In Northern Ireland three domains are empty: `domain_supermarket_accessibility`, `domain_ecommerce_access` and `domain_fuel_poverty`, with their deciles. So NI's combined index rests on four domains. Belfast's 174 SOAs carry PPFI on the same geography as NIMDM 2017, and none is in NI's top-priority decile. |
| **Orientation** | The publisher's pages (user guide, CDRC FAQ and news page, read 25 Oct 2026) do not say which end is highest priority. The data shows it. The socio-demographic domain (income deprivation and no car) ranks with IoD 2025 (decile against decile, r = 0.86, England) and with NIMDM 2017 (rank against rank, r = 0.93, NI), both of which put 1 = most deprived. So **rank 1 and decile 1 = highest priority**. The build stops if this correlation ever falls below 0.5. |
| **Records disagree (24 Oct 2026)** | The HASP record (dataset 5276, v2.1 LSOA) lists spatial coverage "Great Britain"; the CDRC page (data.cdrc.ac.uk/node/2443) says "the four nations" and lists "NI SOA (2011)". Downloads go through a HASP basket, so John provides the file. |
| **Scotland's geography (Stage 6, 25 Oct 2026)** | Scotland's 6,976 codes run from `S01006506` to `S01013481`: **2011 Data Zones**, not the 2022 Data Zones the HASP record lists (2022 codes start at `S01013482`). They are assigned to councils with the Scottish Government's 2011 Data Zone lookup (S32), which matches every one. |
| **App use (Stage 6)** | Risk Explorer, every council (John, 25 Oct 2026): per council, the number of its small areas in the nation's deciles 1–2, for the combined index and each domain (`risk/council-ppfi.json`); England and Wales via the S15 lookup (35,672 LSOAs), Scotland via S32, Northern Ireland via the council named for each SOA in NIMDM 2017 (S19). Each nation keeps 20.0 % of its areas in deciles 1–2. Shares are of small areas, not people, and councils are ranked within their nation only. |
| **App use (Stage 5)** | Deep profiles only (Belfast on its 174 SOAs, Manchester on its 295 LSOAs). The combined index and the seven domains use the published deciles, drawn in five fixed classes (deciles 1–2 most salient), always "within England" or "within Northern Ireland". The three NI domains without data are shown as "Data unavailable", never zero. The direction note above is shown in the profile and the Evidence page. Checked by hand against the raw file for five areas per council (stage 5 report). |

### S19 — Deprivation indices 🟡

| Nation | Index | Geography | Status |
|---|---|---|---|
| England | **English Indices of Deprivation 2025** (MHCLG, October 2025; accredited official statistics) | 33,755 LSOAs (2021) | Partly verified; download URLs to confirm |
| Wales | **WIMD 2025** (Welsh Government; LSOA ranks published on stats.gov.wales) | LSOA | Partly verified |
| Scotland | **SIMD 2020** current; next update (on 2022 Data Zones) anticipated in the latter part of 2026 | Data Zones | **Check whether SIMD 2026 has been released** |
| Northern Ireland | **NIMDM 2017** (NISRA) — latest found | 890 Super Output Areas (2011) | Partly verified; NI uses SOA 2011, not DZ 2021 |

Indices are **relative rankings within each nation** and are not comparable across nations (P11). Display deciles within nation only.

**Verified 24 Oct 2026 (fetched by `fetch-reference`, run 40137753934):**
- **England, IoD 2025** (MHCLG, published 30 Oct 2025, OGL v3.0): File 7 `https://assets.publishing.service.gov.uk/media/691ded56d140bbbaa59a2a7d/File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv`, 56 columns, 33,755 LSOAs. Used: `LSOA code (2021)`, `Local Authority District code (2024)`, `Index of Multiple Deprivation (IMD) Rank (where 1 is most deprived)`, `Index of Multiple Deprivation (IMD) Decile (where 1 is most deprived 10% of LSOAs)`. Deciles are published, within England. Manchester's 295 LSOAs: 120 in decile 1.
- **Northern Ireland, NIMDM 2017** (NISRA, 23 Nov 2017; still the latest): `https://www.nisra.gov.uk/files/nisra/publications/NIMDM17_SOAresults.xls` (read with `xlrd`), sheet `MDM`. Columns: `LGD2014NAME`, `2015 Default Urban/Rural`, `SOA2001` (the SOA code, e.g. `95AA01S1`), `SOA2001_name`, `Multiple Deprivation Measure Rank (where 1 is most deprived)` and the seven domain ranks. 890 SOAs ranked 1–890. Most indicators relate to 2015/16 (metadata sheet). NISRA publishes ranks only. The app's deciles are derived, 89 SOAs each, and labelled as derived.
- **SOA 2011 boundaries:** `https://www.nisra.gov.uk/files/nisra/publications/SOA2011_Esri_Shapefile_0.zip` (2 Sep 2013), EPSG:29902, fields `SOA_CODE`, `SOA_LABEL`, 890 SOAs matching NIMDM's codes. The OpenDataNI record lists them under the OGL v3.0.
- **Belfast:** 174 SOAs have `LGD2014NAME = Belfast` (172 urban, 2 mixed urban/rural). They predate the 2015 council boundaries. Together they cover 141.3 km² against 137.7 km² for Belfast's Data Zones, and 13.3 km² differ. The profile says so and shows NIMDM on these SOAs, never reallocated (John's decision, 24 Oct 2026).

### S20 — Car or van availability ✅ England & Wales, Northern Ireland; 🔴 Scotland

- **England & Wales (gate G10 ✅, 24 Oct 2026):** Census 2021 TS045, Nomis bulk download `https://www.nomisweb.co.uk/output/census/2021/census2021-ts045.zip`, member `census2021-ts045-lsoa.csv` (35,672 LSOAs). Columns: `Number of cars or vans: Total: All households`, `Number of cars or vans: No cars or vans in household`, then 1, 2, 3 or more. Unit: households. Manchester: 83,777 of 214,712 households have no car or van (small-area sum; council table 83,770 of 214,732).
- **Northern Ireland (gate G10 ✅, 25 Oct 2026):**
  - **Where:** the published table MS-E10 covers Northern Ireland and its 11 councils only. Data Zones are only in NISRA's flexible table builder, whose robots policy disallows automated access.
  - **Table:** dataset `HOUSEHOLD`, geography `DZ21`, variable `HH_CAR_VAN_TC5` (codes read in the builder, 25 Oct 2026). The CSV link is `https://build.nisra.gov.uk/en/custom/table.csv?d=HOUSEHOLD&v=DZ21&v=HH_CAR_VAN_TC5`, and all 3,780 Data Zones pass the builder's confidentiality check. The builder also offers 2- and 3-category versions (`HH_CAR_VAN_IND`, `HH_CAR_VAN_TC2`).
  - **Columns:** `Census 2021 Data Zone Code`, `Census 2021 Data Zone Label`, `Car or Van Availability Code`, `Car or Van Availability Label`, `Count`. Codes run 0 ("No cars or vans available") to 5 ("5 or more cars or vans available"), 22,680 rows.
  - **Units:** households, the same as TS045. Households = the sum of the six categories.
  - **Files:** John downloaded the CSV and the council version (.xlsx, sheet `Table`). Both are in `pipeline/raw/nisra-provided/census2021-car-van-2026-10-25/` with checksums.
  - **Totals** (perturbed, so they need not add up): Belfast's Data Zones 50,595 of 149,193 households with no car or van, against 50,594 of 149,207 in the council table. Northern Ireland's Data Zones 768,805 households, its councils 768,810.
  - **Not used:** an ArcGIS Online layer labelled "NISRA" (`NISRA_Other/FeatureServer/1`, "CarAvailability"). It describes people by household and has no publication record.
- **Scotland:** Scotland's Census 2022 (NRS; table ID to confirm), Release 2. Note the one-year difference.
- **Councils (Stage 5 context, 25 Oct 2026):** England and Wales from the same TS045 zip, member `census2021-ts045-ltla.csv` (331 councils on their 2021–22 codes: every code is a `LAD22CD` of the ONS LAD 2022 → 2023 lookup). Councils formed in April 2023 (Cumberland, Westmorland and Furness, North Yorkshire, Somerset) get the sum of the councils they replaced; Barnsley and Sheffield keep their pre-2025 figures (small boundary change, `config/lad_code_changes.json`). Northern Ireland from John's council file (`HH_CAR_VAN_TC5` by LGD 2014). Built by `build-context` into the `context` family.

### S21 — Rural–urban classifications ✅ England & Wales; Northern Ireland small areas; 🔴 Scotland

- **England & Wales ✅ (25 Oct 2026):** ONS 2021 Rural Urban Classification (methodology `https://www.ons.gov.uk/methodology/geography/geographicalproducts/ruralurbanclassifications/2021ruralurbanclassification`, last updated 31 March 2026; produced by ONS with Defra, the Welsh Government and the Government Geography Profession). Two tables fetched by `fetch-reference --set context` (`pipeline/raw/ons/2026-10-25/`), service names from their data.gov.uk records:
  - councils: `LAD24_RUC21_EW_LU` (layer 0, a table; fields `LAD24CD`, `LAD24NM`, `RUC21CD`, `RUC21NM`, `Urban_rural_flag`; 318 rows; released 9 March 2025). Eight classes: `UUN`/`UUF` Urban, `UIN`/`UIF` Intermediate urban, `RIN`/`RIF` Intermediate rural, `RMN`/`RMF` Majority rural, each "majority nearer to" or "further from a major town or city" (share of the population in rural Output Areas: ≤ 20 %, 20–35 %, 35–50 %, ≥ 50 %). Manchester: `UUN`. All 318 match a May 2025 council by code except Barnsley and Sheffield (new codes in 2025 after a small boundary change), which keep their 2024 class with a note.
  - LSOAs: `LSOA21_RUC21_EW_LU` (fields `LSOA21CD`, `LSOA21NM`, `LSOA21NMW`, `RUC21CD`, `RUC21NM`, `Urban_rural_flag`; 35,672 rows in 36 pages). Six classes: `UN1`/`UF1` Urban, `RLN1`/`RLF1` Larger rural, `RSN1`/`RSF1` Smaller rural (nearer/further). For the Manchester small areas (Stage 5).
- **Scotland 🔴:** Scottish Government Urban Rural Classification, published for Data Zones (not councils); not yet included.
- **Northern Ireland:** NISRA's urban–rural page (`https://www.nisra.gov.uk/support/geography/urban-rural-classification`, read 25 Oct 2026) lists only the 2015 and 2005 Settlement Development Limits editions; no Census 2021-based edition. There is no council-level class. The NIMDM 2017 file carries NISRA's "2015 Default Urban/Rural" class per SOA (Belfast: 172 urban, 2 mixed urban/rural), shown with the SOAs in Stage 5.
- Classifications are not harmonised; profiles show each nation's own class with its definition and never compare them.

### S22 — Journey time statistics (DfT) 🔴

England only; includes access to key services such as food stores in some editions. Latest edition and methodology to verify. Release 2 context only; not combined with other nations.

---

### S29 — FSA food hygiene register, Northern Ireland ✅ (25 Oct 2026)

| Field | Detail |
|---|---|
| Why | GEOLYTIX (S11) has only ten retailers in Northern Ireland. John asked on 25 Oct 2026 to add the NI grocers it misses, from another source if possible. |
| Publisher, licence | Food Standards Agency, Food Hygiene Rating Scheme open data: https://ratings.food.gov.uk/open-data/ (free, no registration, updated daily). Re-use is under the Open Government Licence (https://ratings.food.gov.uk/terms-and-conditions). Rating images and the FSA logo have their own rules; they are not used. |
| Files | One XML file per council: `https://ratings.food.gov.uk/api/open-data-files/FHRS<code>en-GB.xml`. Northern Ireland codes are 801–805, 807, 809, 811, 813, 814 and 816 (`pipeline/foodscope_pipeline/sources/fsa_fhrs.py`, with their May 2025 council codes). Fetched by `fetch-reference` (run 40178373516, 25 Oct 2026) into `pipeline/raw/fsa/2026-10-24/`; the folder takes the reference-data snapshot id, and each file's own retrieval time and extract date are recorded. |
| Verified structure | `FHRSEstablishment/Header`: `ExtractDate`, `ItemCount`, `ReturnCode`. Each `EstablishmentDetail` has `FHRSID`, `BusinessName`, `BusinessType`, `BusinessTypeID`, `AddressLine1`–`4`, `PostCode`, `LocalAuthorityCode`, and `Geocode/Longitude`, `Geocode/Latitude` (WGS84; missing for some records). 16,983 establishments in the 11 councils. Business types used: `7840` "Retailers - supermarkets/hypermarkets" (416 in NI) and `4613` "Retailers - other" (3,450). |
| Classification caveat | Business types are assigned by council officers and applied unevenly: Spar shops, for example, appear under both types. So the build selects by name and type with documented rules (`config/ni_grocers.json`), not by type alone. |
| Use | `build-ni-grocers` keeps two sets. First, grocery symbol groups that GEOLYTIX does not carry in NI (SuperValu, Mace, Vivo, Costcutter, Nisa, Premier), matched by name in either retail type. Second, independent grocers registered as supermarkets/hypermarkets that carry no chain or group name and are not within 50 m of a mapped store. Chains GEOLYTIX maps are left to it. The same group or name at the same postcode counts as one shop. Records without coordinates are dropped and counted. Result: **285 grocers** (Belfast 41): Vivo 76, Mace 55, SuperValu 30, Nisa 25, Costcutter 24, Premier 11, independents 64. Details in `pipeline/reports/ni-grocers-qa-2026-10-24.json`. |
| Display rule | A supplementary layer labelled with its source. It is **never** added to the GEOLYTIX store counts or per-10,000 rates, which stay like for like across the UK. Great Britain has no equivalent layer, so the app must not imply one. |
| App use (Stage 5) | An optional layer (`ng=1`) in UK Food Access and Local Authority Profiles: hollow diamonds drawn from about zoom 7.5 (at UK scale the 285 points would cover Northern Ireland), with a tooltip and a legend entry that says it is not counted. Offered by the Northern Ireland coverage note. |
| Attribution | "Food Standards Agency food hygiene rating data, Northern Ireland councils, licensed under the Open Government Licence v3.0" |

## 6. Geography and population

### S14 — Local Authority Districts (May 2025) Boundaries UK ✅

Two editions of the same 361 councils, each used for what it is good at (ADR-0020):

| Field | BGC (display) | BFE (store assignment) |
|---|---|---|
| Title | Local Authority Districts (May 2025) Boundaries UK BGC (V2) | Local Authority Districts (May 2025) Boundaries UK BFE (V2) |
| Geometry | Generalised (20 m), clipped to the coastline | Full resolution, to the extent of the realm (low-water line): 248,695 km² against 242,494 km² of ONS land area |
| How it arrives | Feature service `https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD_MAY_2025_UK_BGC_V2/FeatureServer/0`, fetched by `fetch-ons` on GitHub Actions in 8 pages of 50 (EPSG:27700, Esri JSON), total checked against `returnCountOnly` (361) | FileGDB from the ONS Open Geography Portal, provided by John (`LAD_MAY_2025_UK_BFE_V2_7705143053794342073.zip`, 32 MB), read from the zip |
| Raw cache | `pipeline/raw/ons/2026-10-24/lad-may-2025-uk-bgc-v2.*.json` | `pipeline/raw/ons-lad-boundaries/may-2025-uk-bfe-v2/` |
| Verified fields | Service: `FID`, `LAD25CD`, `LAD25NM`, `LAD25NMW`, `BNG_E`, `BNG_N`, `LONG`, `LAT`, `Shape__Area`, `Shape__Length`, `GlobalID`; `maxRecordCount` 2000, pagination and orderBy supported, WKID 27700 | Layer `LAD_MAY_2025_UK_BFE_V2`, MultiPolygon, EPSG:27700: `LAD25CD`, `LAD25NM`, `LAD25NMW`, `BNG_E`, `BNG_N`, `LONG`, `LAT`, `GlobalID`, `SHAPE_Length`, `SHAPE_Area` |
| Checks | Valid coverage (no overlaps, edges matched); same codes and names as BFE | Valid geometries; 361 unique codes; E 296, W 22, S 32, N 11 |
| Processing | Coverage clean (1 cm), coverage simplify at 150 m, island parts under 1 ha touching no other council dropped (3,379, 939 ha), WGS84 to 6 dp → `public/data/snapshots/<snapshot>/local/lad-2025-uk.geojson` (2.7 MB, 0.87 MB gzip) | Point-in-polygon for stores, in EPSG:27700 |

- **Demo authorities:** `N09000003` Belfast, `E08000003` Manchester.
- **Licence:** OGL v3.0.
- **Attribution (gate G5, cleared 24 Oct 2026):** "Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data © Crown copyright and database right 2025". Lookups and ONS tables carry the first sentence only.
- **Lookup:** ONS "Local Authority District (2022) to Local Authority District (2023) Lookup in the UK" (feature service `LAD22_LAD23_UK_LU_v1`; fields `LAD22CD`, `LAD22NM`, `LAD22NMW`, `LAD23CD`, `LAD23NM`, `LAD23NMW`; 374 rows, 17 changed codes for the 2023 mergers). Used only to compare with S12.
- **2025 code changes:** Barnsley E08000016 → E08000038 and Sheffield E08000019 → E08000039, after The Barnsley and Sheffield (Boundary Change) Order 2024 (SI 2024/1328) moved the Oughtibridge Mill development into Sheffield (`pipeline/foodscope_pipeline/config/lad_code_changes.json`, with sources).
- **Areas:** for council areas use S18's land area. For a BFE or BGC area in Northern Ireland, compute in ITM (EPSG:2157), not BNG.

### S15 — LSOA 2021 boundaries and population-weighted centroids (E&W) ✅ (gate G11, 24 Oct 2026)

Fetched by `fetch-reference` on GitHub Actions (run 40137753934) into `pipeline/raw/ons/2026-10-24/`. Service names from their data.gov.uk records; fields verified in the downloaded responses.

| Item | Service | Verified fields | What is fetched |
|---|---|---|---|
| Lookup | `LSOA21_WD25_LAD25_EW_LU_v2` (LSOA (2021) to Electoral Ward (2025) to LAD (2025) Best Fit Lookup in EW (V2)) | `LSOA21CD`, `LSOA21NM`, `LSOA21NMW`, `WD25CD`, `WD25NM`, `WD25NMW`, `LAD25CD`, `LAD25NM`, `LAD25NMW` | `LAD25CD = 'E08000003'`: 295 LSOAs |
| Boundaries | `Lower_layer_Super_Output_Areas_December_2021_Boundaries_EW_BGC_V5` (generalised to 20 m, clipped) | `LSOA21CD`, `LSOA21NM`, `LSOA21NMW`, `BNG_E`, `BNG_N`, `LAT`, `LONG`; EPSG:27700 | A box around Manchester (378,300–390,900 E, 382,100–405,900 N): 714 LSOAs, 8 pages of 100, count checked |
| Population-weighted centroids | `LSOA_PopCentroids_EW_2021_V4` | `LSOA21CD`; points in EPSG:27700 | The same box: 651 points |

- **Stage 6 (25 Oct 2026):** the same lookup service fetched for every LSOA (`ons.lsoa21_lad25_all`, 36 pages of 1,000, `pipeline/raw/ons/2026-10-25/`): 35,672 LSOAs, each once, matching the count query; 318 councils, all May 2025 councils of England and Wales. Used to assign the Priority Places index to councils (best fit).
- **Checks:** every Manchester LSOA in the lookup has a boundary and a centroid; names agree between lookup and boundaries. Two centroids lie on or 1.6 m outside their generalised boundary (BGC generalisation), recorded in `pipeline/reports/areas-qa-2026-10-24.json`.
- **Licence and attribution:** OGL v3.0; "Source: Office for National Statistics licensed under the Open Government Licence v.3.0. Contains OS data © Crown copyright and database right 2025" (G5 wording).

### S16 — NISRA Data Zones 2021 ✅ (gate G9, 24 Oct 2026)

Fetched by `fetch-reference` on GitHub Actions (run 40137753934) into `pipeline/raw/nisra/2026-10-24/`.

- **Boundaries:** "Data Zone Boundaries GIS format" (21 Feb 2023), ESRI Shapefile `https://www.nisra.gov.uk/files/nisra/publications/geography-dz2021-esri-shapefile.zip` (14.8 MB). 3,780 Data Zones. Fields: `DZ2021_cd`, `DZ2021_nm`, `SDZ2021_cd`, `SDZ2021_nm`, `DEA2014_cd`, `DEA2014_nm`, `LGD2014_cd`, `LGD2014_nm`, `Area_ha`, `Perim_km`. **CRS: Irish Grid on the TM65 datum (EPSG:29902)**, from the `.prj`. Belfast (`LGD2014_cd = N09000003`) has 735 Data Zones.
- **Licence:** "Contains Ordnance Survey of Northern Ireland information licensed under the Open Government Licence v3.0" (publication page). NISRA's copyright page: NISRA material is under the OGL with the attribution "Source: NISRA"; OSNI mapping is exempt unless a publication says otherwise, as this one does.
- **Coverage quality:** 36 of Belfast's Data Zones have edges that do not match their neighbours exactly (overlaps totalling 0.01 m² and hairline gaps). The display build cleans them (1.1 m² moved in total) before simplifying; recorded in the QA report.
- **Population-weighted centroids:** "Census 2021 population weighted centroids for Data Zones and Super Data Zones" (6 Oct 2023), CSV zip `https://www.nisra.gov.uk/system/files/statistics/geography-census-2021-population-weighted-centroids-csv.zip`. Member `census-2021-population-weighted-centroids-data-zone.csv`, columns `DZ2021_code`, `DZ2021_name`, `X`, `Y`. The CRS is not stated; all 3,780 centroids lie inside their own Data Zone in EPSG:29902, which confirms the Irish Grid.
- **Transformation to WGS84:** PROJ's "Irish Grid + TM65 to WGS 84 (2)" (pyproj 3.8.0). Accuracy is about a metre, well inside the display and straight-line distance precision.
- **DZ2021 ↔ SOA 2011 lookup:** NISRA publishes none (its information papers describe approximations). Not needed: John decided on 24 Oct 2026 that NIMDM 2017 is shown on its own SOAs (S19).

### S17 — Scotland Data Zones 2022 🔴

Release 2 (national access layers). The Priority Places index uses Scotland's **2011** Data Zones (S13), so the Stage 6 council aggregation needs only the 2011 lookup (S32), not 2022 boundaries.

### S18 — Population ✅ (council level, mid-2025)

- **Edition in use:** ONS "Estimates of the population for the UK, England, Wales, Scotland and Northern Ireland", mid-2025 (`mye25tablesuk.xlsx`, released 1 October 2026; OGL v3.0, accredited official statistics). URL: https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/populationestimatesforukenglandandwalesscotlandandnorthernireland/mid2025/mye25tablesuk.xlsx
- **Retrieval:** fetched by `fetch-ons` on GitHub Actions on 24 Oct 2026 and committed in `pipeline/raw/ons/2026-10-24/`.
- **Reference date:** one date for all four nations, 30 June 2025. The figures were first published by ONS (England and Wales, 29 July 2026), NRS (Scotland, 14 July 2026) and NISRA (Northern Ireland, 24 September 2026).
- **Verified tables (24 Oct 2026):**
  - `MYE2 - Persons`: header row `Code`, `Name`, `Geography`, `All ages`, then single years of age.
  - `MYE5`: `Code`, `Name`, `Geography`, `Area (sq km)`, `Estimated Population mid-2025`, … back to mid-2011.
  - Council rows are those whose `Geography` is Non-metropolitan District, Unitary Authority, Metropolitan District, London Borough, Council Area or Local Government District: 361 rows, summing to the UK total of 69,483,939.
- **Land area (MYE5):** land excluding inland water. It uses Standard Area Measurements (January 2025) for England, Wales and Scotland, and NISRA's estimate for Northern Ireland (notes 18 and 19).
- **Boundaries:** April 2024 (note 10). Barnsley and Sheffield changed codes in 2025 after a small boundary change (S14). ONS's note 18 says the estimates do not account for it. The pipeline gives both councils their old-code figures with a note on each.
- **Rounding:** Scotland's estimates involve some rounding to the nearest 10 (note 7); display LAD populations to the nearest 100 (spec §6.4).
- **Rule:** per-capita indicators use the latest year available **for all nations being compared**. Mid-2025 meets this for all four. Where vintages differ, the comparability warning appears.
- **Small areas (Stage 5, verified 24 Oct 2026):** Census 2021 usual residents, the same date in both nations (21 March 2021):
  - **England and Wales:** Nomis bulk download `https://www.nomisweb.co.uk/output/census/2021/census2021-ts001.zip`, member `census2021-ts001-lsoa.csv` (35,672 LSOAs), columns `date`, `geography`, `geography code`, `Residence type: Total; measures: Value`.
  - **Northern Ireland:** NISRA MS-A01 `https://www.nisra.gov.uk/system/files/statistics/census-2021-ms-a01.xlsx`, sheet `DZ` (header `Geography`, `Geography Code`, `All usual residents`; 3,780 Data Zones) and sheet `LGD` (`Geography code`).
  - **Totals:** small areas do not sum exactly to council tables because both offices perturb counts for confidentiality. Manchester's LSOAs sum to 551,919 against 551,938 in the council table; Belfast's Data Zones sum to 345,423 against 345,418. Values are used as published, with the difference reported.

### S24 — Country geometries ✅

**Since Stage 2:** Natural Earth **v5.1.2** Admin 0 countries (public domain), GeoJSON from the Natural Earth repository (`github.com/nvkelso/natural-earth-vector`, tag `v5.1.2`), downloaded by `scripts/build-reference-layers.mjs` and pinned by SHA-256 (1:110m `6866c877…`, 1:50m `3e458fc0…`). Replaces the Stage 1 world-atlas 4.1.0 packaging.

| Output | Content |
|---|---|
| `reference/world-countries-110m.geojson` | 176 outlines (Antarctica omitted — never displayed and its ring closes along ±180°), properties `name` (`NAME`), `name_long` (`NAME_LONG`), `iso_a2` (`ISO_A2_EH`), `iso_n3` (`ISO_N3_EH`); `-99` → null (N. Cyprus, Somaliland); coordinates 3 dp |
| `reference/world-country-points.json` | 237 points: Natural Earth's own label point (`LABEL_X`, `LABEL_Y`) per `ISO_A2_EH` at 1:50m, flagged `in110m`; 63 are not in the 1:110m outlines (e.g. Malta, Singapore, Mauritius, Hong Kong) and are drawn as points. Where two features share a code (Australia), the one with `ADM0_A3 = ISO_A3_EH` wins |

**HMRC crosswalk (gate G4 ✅).** `CountryCodeAlpha` → `ISO_A2_EH`, with `XS` → `RS` (Serbia) and the non-country HMRC ids listed in `pipeline/foodscope_pipeline/config/hmrc_country_crosswalk.json`. Result for the 23 Oct 2026 snapshot: every partner of the five baskets is crosswalked; only **Gibraltar** (strawberries) has no Natural Earth geometry at these scales and is listed in the table as "not drawn on the map"; Nauru, Macao, Barbados, Dominica, Guam, Saint Lucia, Mauritius, Maldives, Singapore, Malta, Hong Kong and Liechtenstein are drawn as points. Label points are the symbolic start of import connections — not ports or production areas.

---

### S32 — Scottish Government Data Zone lookups ✅ (25 Oct 2026)

| File | Source | Verified structure |
|---|---|---|
| `dz2011-lookup.csv` | https://data.gov.scot/dataset/2011_data_zone_lookup (CSV, 3.1 MB, updated 19 Aug 2026, OGL v3.0) | Windows-1252 text; columns `DZ2011_Code`, `DZ2011_Name`, `IZ2011_Code`, …, `LA_Code`, `LA_Name`, …, `UR2_Code`–`UR8_Name`, `Country_Code`, `Country_Name`; 6,976 Data Zones, each once, in 32 councils whose codes are all May 2025 council codes. Every PPFI Scotland code is in it |
| `dz2022-lookup.csv` | https://data.gov.scot/dataset/2022_data_zone_lookup (fetched first; not used) | 7,392 Data Zones (2022) — not the PPFI geography |

### S33 — ONS International Territorial Level 1 (January 2025) ✅ (25 Oct 2026)

Feature service `ITL1_JAN_2025_UK_BGC/FeatureServer/0` (data.gov.uk record "International Territorial Level 1 (January 2025) Boundaries UK BGC"); one page, 12 features, EPSG:27700; fields `ITL125CD` (`TLC`…`TLN`), `ITL125NM`, `BNG_E`, `BNG_N`, `LAT`, `LONG` (label point), `Shape__Area`, `Shape__Length`. Defra's English regions are ITL1 regions with London (`TLI`) and the South East (`TLJ`) merged; Wales, Scotland and Northern Ireland are `TLL`, `TLM`, `TLN`. Coverage-simplified at 500 m for national display (islands under 1 km² dropped: 4,650 parts, 108 km² in all, mostly Scottish islets).

## 7. Transport and logistics

### S23 — DfT Port freight annual statistics 2025 ✅ (25 Oct 2026)

Published 29 July 2026 (accredited official statistics); OGL v3.0. URL: https://www.gov.uk/government/statistics/port-freight-annual-statistics-2025. The data tables page ("Port and domestic waterborne freight statistics: data tables (PORT)", updated 10 Sep 2026) links each table as an .ods asset. Fetched by `fetch-reference --set stage6` into `pipeline/raw/dft/2026-10-25/`.

| File | Verified structure | Use |
|---|---|---|
| `port0499.ods` (PORT0499, "UK major port freight traffic, port level downloadable dataset, from 2000") | Sheet `port0499`, header on row 8: `Year`, `Major Port`, `Port of Load/Unload Region`, `Port of Load/Unload Country`, `Direction` (`Inwards`, `Outwards`), `Cargo Group` (6), `Cargo Category` (27 codes), `Cargo Description`, `Tonnage (thousands)`, units and TEU. 146,020 rows, 2000–2025, every tonnage numeric; two 2002 rows have no port and zero tonnage. 8 regions (including `United Kingdom (inc CHI & IOM)` = coastwise and `Unspecified`). Notes 1–6 (revisions for Hull 2019 and London 2019–2023; 2025 recategorisation of wood pellets and wind-farm products; London Ro-Ro categories 2025) | `risk/ports.json`: 51 ports with 2025 data, 2015–2025, inwards by region and cargo group, outwards, and inwards of cargo category 23 "Agricultural products (eg grain, soya, tapioca)" by region |
| `port0304.ods` (PORT0304, map data for ports over 2 million tonnes) | Sheet `Data`: `Port`, `Liquid Bulk`, `Dry bulk & other general cargo`, `Ro-Ro`, `Containers`, `Total`; 33 ports, 2025 | Check: PORT0499's 2025 totals equal PORT0304's for all 33 (to 0.01 kt) |
| `Major_and_Minor_Port_List_for_Freight_Statistics.ods` | Sheet `Major_Ports_List`, header row 5: `Port Locode`, `Port Name`, `Published Port Locode`, `Published Port Name`, `Country of the UK`, …, `Published Port Latitude`, `Published Port Longitude` ("rough location for mapping purposes"); 53 statistical ports, 26 with `NA` coordinates (among them Dover, Felixstowe, Belfast, Holyhead) | UN/LOCODE, nation and map point of each port; the 24 of the 51 ports without a point take EMODnet's (S36) |

**What it can and cannot say.** Tonnage covers all cargo. Only the dry-bulk category "agricultural products" is food or feed, and it is mostly grain and soya for feed and milling. Containers and roll-on/roll-off units — the way most fresh food arrives — are not recorded by commodity, so Dover shows no agricultural dry bulk at all. Food-specific port dependence therefore comes from UKFSR (S03), not DfT; the app never derives food flows through a port.

---

### S34 — OSNI Open Data 1:50,000 transport ⚠️ not reachable from the pipeline

data.gov.uk record "OSNI Open Data - 50K Transport - Transport lines" (OpenDataNI, OGL / LPS Open Government Data Licence): the only resource is the Esri REST layer `services.spatialni.gov.uk/opendata/rest/services/OSNIVector/OSNIOpenData_Transport_50K/MapServer/2`. Three GitHub Actions runs (25 Oct 2026) got "Remote end closed connection without response" for the service metadata, and the build sandbox cannot reach the host. The probe (`stage6_files.OSNI_PROBE_FILES`) was then taken out of the `stage6` set so that each push does not fail on it. Northern Ireland's roads are therefore **not shown**; the map and the panel say so. To retry before Release 1 sign-off.

### S35 — OS Open Roads ✅ (extract, 25 Oct 2026)

OS Downloads API `https://api.os.uk/downloads/v1/products/OpenRoads/downloads` (OGL v3.0): GB GeoPackage `oproad_gpkg_gb.zip`, 1,016,021,285 bytes, MD5 checked. Too large to commit: `fetch-open-roads` (GitHub Actions) downloads it to a temporary folder, records its schema (`open-roads-schema.json`: layer `road_link`, 3,961,077 links, EPSG:27700; fields `road_classification`, `road_classification_number`, `primary_route`, `trunk_road`, …) and writes the extract `open-roads-strategic.geojson` (115,947 links → 792 roads).

- **Definition:** `strategic` = `trunk_road` true or `road_classification` = Motorway (the national highway authorities' networks: National Highways, Transport Scotland, Welsh Government); `primary` = other `primary_route` A roads. Links merged by road number and category, simplified at 60 m, WGS84 to 5 decimals.
- **Limits:** Great Britain only (Northern Ireland: S34). Corridors, not freight flows or volumes; no traffic or delay per road (England's network-wide delay comes from S03).

### S36 — EMODnet Human Activities, main ports: port locations ✅ (25 Oct 2026)

EMODnet catalogue record `379d0425-8924-4a41-a088-1a002d2ea748` ("Main Ports, Goods-Passengers-Vessels Traffic", revised 10 Dec 2025; CC BY 4.0; credit the EMODnet portal, originators Eurofish International Organisation and Cogea Srl). WFS `https://ows.emodnet-humanactivities.eu/wfs`, layer `emodnet:portlocations`, GeoJSON, EPSG:4326 (lon, lat): 946 ports, 66 in the UK (`country` `UK` or `GB`). Fields used: `port_id` (UN/LOCODE, or DfT's own `GB203`/`GB221` for River Trent and Rivers Hull & Humber — the same codes as DfT's list), `port`, `source` (e.g. `GISCO`, `UN/LOCODE`, `Marine Traffic`), `pointx`, `pointy`.

- **Use:** only for the 24 of DfT's 51 current ports that DfT does not locate (Dover, Felixstowe, Belfast, Holyhead, Larne, Cairnryan, Heysham, …). Each port records which source placed it.
- **Check:** for the 27 ports both locate, the points agree within 3 km except multi-site estuary ports (Forth 18 km, Rivers Hull & Humber 12 km, Tees & Hartlepool 9 km, River Trent 5 km). Port symbols are "rough locations", not terminals.

## 8. Platform and reference services

### S25 — Esri basemap styles ✅

ArcGIS dark grey style (`arcgis/dark-gray`) through the Basemap styles service, authorised by a referrer-restricted API key (decision D2) registered as `esriConfig.apiKeys.basemapStyles` (ADR-0011). Verified on the live site on 23 Oct 2026: style and tiles load, post-deploy smoke test requires `data-basemap-status="ready"`. Not reachable from the build sandbox. Attribution is rendered automatically by the map component; do not hide it.

**Stage 4 (SH-08, ADR-0022): three styles.**

| App choice | Style ID | What Esri's style list says (read 24 Oct 2026) |
|---|---|---|
| Dark grey (default) | `arcgis/dark-gray` | Vector tiles; Reference group, "minimal geographic features such as boundaries and place labels" |
| Light grey | `arcgis/light-gray` | Vector tiles; same group; base and labels also available separately (`/base`, `/labels`) |
| Imagery | `arcgis/imagery` | Map tiles and vector tiles: satellite imagery with labels (`arcgis/imagery/standard` would be imagery without labels) |

- **Source of the IDs:** the Esri developer page "arcgis styles" (https://developers.arcgis.com/documentation/mapping-and-location-services/mapping/basemaps/arcgis-styles), read 24 Oct 2026.
- **How SDK 5.1 loads a style:** read from `Basemap._loadFromStylesService` in the installed package. It makes two requests to `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/`:
  - `styles/<id>/self`: metadata;
  - `webmaps/<id>`: a web map whose `baseMap` holds the layers.

  The E2E stub (`tests/e2e/support/basemapStub.ts`) imitates these two responses.
- **Verified on the live site, 24 Oct 2026** (stage 4 report, "Deployment and live checks"):
  - each style loads with the site's key and reports "ready";
  - attribution changes with the style (and with the area shown, e.g. "Earthstar Geographics" on imagery over Manchester);
  - light grey's land colour, read from the style's own layers: `#f4f4f4` below zoom 7, `#efefef` from zoom 7, water and background `#cfd3d4`. The light colour set passes against these.
- **Still open:** basemap request usage under the key (risk R8), from John's ArcGIS Location Platform dashboard.

### S26 — ArcGIS Living Atlas 🔴

Use only for optional reference layers (e.g. major roads/rail) after checking each item's terms of use and update date. Not used as a statistical source where an official publisher's dataset exists.

### S27 — Food price inflation 🟡

Defra pocketbook CSV of CPIH food and non-alcoholic beverages since 2020 (S05) for Release 1. ONS series ID for a direct feed to be verified before switching.

---

## 9. Known gaps and substitutes

| Need in brief | Situation | Approach |
|---|---|---|
| Where food is *grown* | Headline HMRC data is by dispatch | Use "recorded import partner"; Evidence page explains; S02 context |
| Monthly domestic production for fruit/veg | Not published monthly | Show annual figure; no monthly domestic share (brief §6) |
| Supermarket-level supply chains | Not public | Out of scope (P5) |
| Realistic travel-time catchments | Requires routing | Release 1 straight-line (labelled); Release 3 pre-computed network times (OSM + documented speeds) |
| UK-wide comparable deprivation | Indices differ by nation and year | Within-nation deciles; comparability warnings |
| PPFI for Northern Ireland (v2) | Unconfirmed | Gate in Stage 2; NI-native indicator set as fallback |
| Food import entry-point dependency by commodity | Published for food groups only (UKFSR 3_2_2a/b, S03); DfT records no commodity for unitised traffic (S23) | Risk Explorer and Scenario B show UKFSR's published shares; DfT tonnage shown as all-cargo context; HMRC port data only if verified (S28) |
| Climate/agricultural risk indicators | No authoritative per-commodity or sub-national index identified | FAO water stress by country (S30, John's choice, 25 Oct 2026), labelled national; no invented scores |
| Rail freight routes and terminals | No open, official mapped dataset found (ORR publishes national freight statistics, not routes) | Not shown in the logistics view; stated |
| Distribution centres and warehouses | No authoritative public register found | Not shown; stated (never inferred from store or trade data) |
| Northern Ireland road corridors | OSNI service unreachable from the pipeline (S34) | Not shown; stated |
| Public transport accessibility (UK-wide) | England-only DfT statistics | England context only, Release 2 |

---

## 10. Attribution statements (to appear in app footer, Evidence page and PDFs)

- Contains public sector information licensed under the Open Government Licence v3.0 (HMRC, Defra, ONS, DfT, NISRA, NRS, Welsh Government, MHCLG, as applicable).
- Source: Office for National Statistics licensed under the Open Government Licence v3.0. Contains OS data © Crown copyright and database right [year] (exact wording to be taken from the ONS boundary metadata in Stage 2).
- Contains GEOLYTIX Grocery Retail Points data (v46, June 2026) (courtesy acknowledgement; on the store layer and the Evidence page from Stage 4).
- Priority Places for Food Index © CDRC / Leeds HASP, OGL v3.0 (wording to confirm).
- Made with Natural Earth.
- Level of water stress: FAO AQUASTAT, via World Bank World Development Indicators (ER.H2O.FWST.ZS), CC BY 4.0.
- Port locations (where DfT gives none): EMODnet Human Activities, Main ports (Eurofish, Cogea), CC BY 4.0.
- Road corridors: Contains OS data © Crown copyright and database right 2026 (OS Open Roads).
- Basemap © Esri and its data providers (rendered by the SDK).

---

## 11. Verification log — 23 October 2026

| Check | Method | Result |
|---|---|---|
| HMRC API endpoints, limits, licence | Read API documentation page | Base URL, 14 endpoint families, 40,000 cap, 60 req/min, OGL v3.0 confirmed |
| HMRC `/Country` schema | Live query `$top=3` | Fields confirmed; FR/NL/DE alpha codes; EU area labels |
| HMRC `/Commodity` schema | Live query `Hs4Code eq '0702'` | Fields confirmed; CN8 ↔ integer `CommodityId` mapping confirmed |
| HMRC `/OTS` schema | Live query `MonthId eq 202507 and CommodityId eq 7020010` | Fields confirmed; port-level grain observed |
| HMRC latest month | Live query `MonthId eq 202608` | Records returned (Aug 2026 available) |
| HMRC `$orderby` | Live query on `/Date` | Client error — not relied upon |
| HMRC partner basis | Bulk data dictionary; 2024 CoO/CoD release | Dispatch basis confirmed; Netherlands gap confirmed |
| LAD May 2025 service | Service JSON + query | Fields, CRS 27700, maxRecordCount 2000, GeoJSON support, Belfast/Manchester codes confirmed |
| GEOLYTIX | Publisher blog pages; third-party schema listing of v31 file | Open terms, quarterly cadence, Q1 2026 counts; schema and NI coverage confirmed from the v46 file on 24 Oct 2026 (S11, gate G7) |
| PPFI | CDRC pages; HASP dataset records | v2.1, OGL, GB coverage listed, domain weights; NI in v2 **unconfirmed** |
| UKFSR 2024 / Digest 2025 / Pocketbook | gov.uk pages | Dates, formats, licence, next editions; Short Straits shares from Theme 3 |
| Defra monthly production | gov.uk search results | Slaughter statistics to Sept 2026; poultry and milk series exist |
| IoD 2025 / WIMD 2025 / SIMD / NIMDM | Publisher and Analysis Function pages | Editions and geographies as tabled |
| DfT port freight 2025 | gov.uk page | Published 29 Jul 2026, ZIP tables; food breakdown unconfirmed |
| NISRA DZ2021 | NISRA geography page | Counts, nesting, formats; CRS and licence unconfirmed |
| npm package versions | `npm view` | As listed in architecture §2 |

### Stage 1 additions (23 October 2026)

| Check | Method | Result |
|---|---|---|
| world-atlas package contents | Read package files and README | Natural Earth v4.1.0 confirmed; 1:110m, 1:50m, 1:10m TopoJSON; ISC licence |
| Reference outlines conversion | `scripts/build-reference-layers.mjs` + Vitest | 177 features in → 177 out; no ring segment crosses more than 180° of longitude |
| Manifest publish | `uv run foodscope-pipeline publish` + pytest | Manifest validates against schema; checksum and size verified; reruns byte-identical |
| ArcGIS services from the build sandbox | `curl` (one attempt each) | `js.arcgis.com`, `services1.arcgis.com`, `basemapstyles-api.arcgis.com` unreachable from the sandbox — so the Esri basemap (S25) and CDN mode were not exercised there |

Not verified on this date (and therefore not to be coded against yet): CORS on the HMRC API; GEOLYTIX current schema and NI coverage; PPFI v2.1 column names and NI coverage; Census car-availability table IDs for NI and Scotland; LSOA 2021 centroid service; NISRA CRS; Natural Earth version; DfT table contents; SIMD 2026 status; Defra annual production files.

### Stage 2 additions (23 October 2026)

| Check | Method | Result |
|---|---|---|
| HMRC API documentation | Read documentation page | 60 req/min, 40,000-item pages with `@odata.nextLink`, `$apply` supported, suppression levels 1–5, flow types, OGL v3.0 |
| `/Commodity` for the five baskets | Live query (desktop browser) and pipeline | 28 CN8 codes (current and discontinued) under HS 0701, 0702, 0803, 1001 and HS6 081010 |
| `/Country` | Live query and pipeline | 263 ids; `CountryCodeNumeric` is HMRC's own code; special and non-country codes listed above |
| `$apply` groupby/aggregate (G1) | Pipeline reconciliation against raw `/OTS` rows, five basket-months | Exact match on every country × flow × CN8 × suppression key |
| Suppression in the baskets | Aggregate query with `SuppressionIndex gt 0`; pipeline | None since Jan 2019 (suppression exists elsewhere in OTS) |
| Latest month | Pipeline probes | 202608 present, 202609 absent |
| Valuation, revisions, dispatch basis (G2) | HMRC methodology and quality report; uktradeinfo methodology and revisions pages; Aug 2026 methodology notes | CIF statistical value (Intrastat: invoice value); provisional for up to 18 months; country of dispatch; customs-based GB–EU imports from Jan 2022 |
| Natural Earth v5.1.2 | Downloaded from the repository tag; SHA-256 pinned | ISO_A2_EH / LABEL_X / LABEL_Y present at 1:110m and 1:50m |
| HMRC ↔ Natural Earth crosswalk (G4) | Pipeline + tests | All partners crosswalked; Gibraltar without geometry |
| Ingest route | `curl` from the sandbox; GitHub Actions run 39969667036 | Sandbox blocked by proxy; Actions run succeeded (15 requests, 80 s) |

Still not verified: Defra trade codes for the baskets (G3, S05); HMRC port allocation (S28); CORS on the HMRC API (not needed).

### Stage 3 additions (23 October 2026)

| Check | Method | Result |
|---|---|---|
| Code history vs raw responses | pytest: months with rows and net mass per code recomputed from the committed `/OTS` aggregates | Exact for every code in the five baskets; per-code net mass sums to the basket total |
| Stage 2 figures unchanged | SHA-256 fingerprints of months, partners, rows, suppressed, nil months, flows, units and CN8 list, computed from the PR #3 files | Identical for all five baskets after the rebuild |
| Code changes | Pipeline rule (a code's last month immediately before another's first month, both inside the range) and Python cross-check | Tomatoes Jan 2025; bananas Jan 2024; none for strawberries, potatoes or wheat |
| Seasonal reference values | Independent Python over the snapshot (stage 3 report) | Match the app's model, charts and E2E (e.g. tomatoes Jul 2025 33,168.836 t, +2.15 % vs Jul 2024; Jan 2025 HHI 2,736) |

Still not verified: monthly UK production for the five baskets (none identified, SS-07); S09/S10 annual files; Defra trade codes (G3).

### Stage 5 context additions (25 October 2026)

| Check | Method | Result |
|---|---|---|
| S21 service names and fields | data.gov.uk records → layer metadata (`?f=pjson`); Manchester row queried | `LAD24_RUC21_EW_LU`, `LSOA21_RUC21_EW_LU`; fields as listed in S21; Manchester `UUN` |
| S21 completeness | Fetched on GitHub Actions (run 40190433555): count query vs pages | 318 councils; 35,672 LSOAs, all codes unique |
| S21 codes vs May 2025 councils | Build (`build-context`) | 316 of 318 match; Barnsley and Sheffield via `lad_code_changes.json` |
| S09/S10 files | gov.uk publication pages → asset URLs; files read with the standard-library .ods reader | Sheets and rows as listed in S09/S10 |
| S09/S10 internal consistency | Build check: supply = production + imports − exports; share = production ÷ supply | Exact for the four baskets, 2025 |
| S20 councils | TS045 ltla vs the LAD 2022 → 2023 lookup; household totals before and after mapping | 331 → 318 councils; 24,783,193 households in both |
| NI urban/rural edition | NISRA geography page | Latest edition 2015 (no Census 2021-based classification) |

Still not verified: Scotland's urban/rural classification and Census 2022 car availability (Release 2); CPIH food (S27); Defra trade codes (G3).

### Stage 6 data step (25 October 2026)

| Check | Method | Result |
|---|---|---|
| Fetch route | `fetch-reference --set stage6` on GitHub Actions (runs 40231289609, 40231643879, 40233240906; job annotations read through the API) | All publishers cached with checksums except OSNI (S34: connection closed twice) |
| S30 completeness | API header vs rows; country list `total` vs entries | 6,916 rows on one page; 296 entries, 79 aggregates excluded |
| S23 consistency | Build: PORT0499 2025 totals vs PORT0304 | Equal for all 33 ports over 2 Mt (to 0.01 kt) |
| S23 / S36 port codes | DfT port list vs PORT0499 names; EMODnet `port_id` vs DfT UN/LOCODEs | All 51 current ports listed; all 24 without a DfT point found in EMODnet |
| S03 tables | Sheets read; port-of-entry shares summed per year | 100.01 % (2022), 99.99 % (2023); 3_2_2b and 3_2_1a as listed in S03 |
| S31 regions vs countries | Build: regional sums vs the England row and the UK table | Equal except cattle (commercial vs all holdings, by design) |
| S13 geography in Scotland | Code ranges; S32 lookup join | 2011 Data Zones; 6,976 of 6,976 matched |
| PPFI by council | Build: small areas per nation after assignment | England 33,755, Wales 1,917, Scotland 6,976, NI 890 — all assigned, each nation 20.0 % in deciles 1–2 |
| S35 extract | Actions run: schema and counts written beside the extract | 3,961,077 links read; 115,947 kept; 792 roads |

Still not verified: OSNI transport (S34); HMRC port-level detail (S28); UKFSR 3_2_3a units; Scotland's urban/rural classification and car availability (Release 2).

