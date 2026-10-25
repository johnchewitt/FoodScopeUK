# FOODSCOPE UK — Data-Source Inventory

| | |
|---|---|
| **Document** | 03 — Verified data catalogue and manifest |
| **Version** | 0.4 — 24 October 2026 (pre-Stage 4 data step: S11, S12, S14 and S18 verified from the delivered files; gates G5 and G7 cleared) |
| **Verification date** | 23 October 2026; S11, S12, S14 and S18 re-verified 24 October 2026 |
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
| S03 | United Kingdom Food Security Report 2024 | Defra | 🟡 | Profiles (national context), Risks, Scenario B | R1/R2 |
| S04 | United Kingdom Food Security Digest 2025 | Defra | 🟡 | National context | R1 |
| S05 | Food statistics in your pocket (+ Defra trade codes) | Defra | 🟡 | Commodity definitions, prices, production-to-supply | R1 |
| S06 | Monthly UK cattle, sheep and pig slaughter and meat production | Defra | 🟡 | Seasonal (production) | R2 |
| S07 | Monthly UK hatcheries and poultry slaughterhouse statistics | Defra | 🟡 | Seasonal (production) | R2 |
| S08 | Milk utilisation by dairies (monthly) | Defra | 🟡 | Seasonal (production) | R2 |
| S09 | Horticulture statistics (annual) | Defra | 🔴 | Origins production context | R1 |
| S10 | Cereal and oilseed production (annual) | Defra | 🔴 | Origins context, Scenario C | R1/R2 |
| S11 | Grocery / Supermarket Retail Points (v46, June 2026) | GEOLYTIX | ✅ | Supermarkets, Profiles, Access, Scenario D | R1 |
| S12 | Number of chain supermarkets across LADs and smaller areas in the UK | ONS | ✅ (LAD tables 1–4) | Validation of store counts | R1 |
| S13 | Priority Places for Food Index (v2.1) | CDRC / Leeds HASP | ✅ (all four nations; NI on SOAs 2011, three domains without data) | Access, Profiles | R1 (demo LADs) |
| S14 | Local Authority Districts (May 2025) Boundaries UK, BGC (display) and BFE (store assignment) | ONS | ✅ | All UK views, Profiles | R1 |
| S15 | LSOA 2021 boundaries and population-weighted centroids (E&W) | ONS | ✅ (Manchester; G11) | Access, Profiles (Manchester) | R1 |
| S16 | Data Zones 2021 (and Super Data Zones) | NISRA | ✅ (boundaries, centroids; G9) | Access, Profiles (Belfast) | R1 |
| S17 | Data Zones 2022 | Scottish Government / NRS | 🔴 | Access (Scotland) | R2 |
| S18 | Mid-year population estimates (ONS UK tables, mid-2025) | ONS (with NRS and NISRA) | ✅ (council level; Census 2021 small areas for Manchester and Belfast) | All per-capita indicators | R1 |
| S19 | Deprivation indices (IoD 2025, WIMD 2025, SIMD, NIMDM 2017) | MHCLG / Welsh Gov / Scottish Gov / NISRA | ✅ England (IoD 2025), Northern Ireland (NIMDM 2017); 🟡 Wales, Scotland | Access, Profiles, Scenario D | R1 (Eng, NI) |
| S20 | Car or van availability (Census 2021 / Scotland's Census 2022) | ONS / NISRA / NRS | ✅ England & Wales (TS045), Northern Ireland (table builder, file from John); 🔴 Scotland | Access, Profiles | R1 (Eng, NI) |
| S21 | Rural–urban classifications | ONS / Scottish Gov / NISRA | 🟡 | Profiles, Access | R1 |
| S22 | Journey time statistics | DfT | 🔴 (England only) | Access context | R2 |
| S23 | Port freight annual statistics 2025 | DfT | 🟡 | Risks, Scenario B | R2 |
| S24 | Natural Earth Admin 0 countries (v5.1.2) | Natural Earth | ✅ (1:110m outlines, 1:50m label points, ISO crosswalk) | Map reference layer; Origins map | R1 |
| S25 | Basemap styles service: dark grey, light grey, imagery | Esri (ArcGIS Location Platform) | ✅ all three styles (live site, 24 Oct 2026) | Map | R1 |
| S26 | ArcGIS Living Atlas items | Esri and contributors | 🔴 per item | Optional reference layers | R2 |
| S27 | Consumer price inflation — food (CPIH) | ONS (via Defra pocketbook CSV) | 🟡 | National context | R1 |
| S28 | HMRC port reference and port-level OTS detail | HMRC | 🟡 | Risks, Scenario B | R2 |
| S29 | Food hygiene rating open data (Northern Ireland councils) | Food Standards Agency | ✅ (NI; 25 Oct 2026) | UK Food Access, Profiles: NI grocers GEOLYTIX misses (supplementary layer) | R1 (NI) |

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

### S28 — HMRC port reference and port-level detail 🟡

`/Port` endpoint lists `PortId` values used in `/OTS`. Port-level commodity imports could support a commodity-specific view of Short Straits dependence. **To verify** in Stage 9: completeness of port allocation for EU roll-on/roll-off imports, suppression at port level, and how Dover/Channel Tunnel are coded. Until verified, Scenario B uses UKFSR published shares (S03).

---

## 3. Food security context and domestic production (Defra)

### S03 — United Kingdom Food Security Report 2024 🟡

| Field | Detail |
|---|---|
| URL | https://www.gov.uk/government/statistics/united-kingdom-food-security-report-2024 |
| Published | 11 December 2024; next report towards the end of 2027 (statutory, at least every three years) |
| Format | HTML themes 1–5; PDF; one ODS dataset per theme |
| Licence | OGL v3.0 |
| Key facts used (Theme 3) | Short Straits carried on average about 18 % of total food, feed and drink import volume; higher for perishables in 2023 — about 42 % of dairy and eggs, 39 % of meat, 29 % of fruit and vegetables. EU supplied 64 % of food, feed and drink import volume in 2023. |
| Processing | Stage 2: download theme ODS files; extract cited tables to `context/national.json` with table references; never retype figures by hand without a test |
| To verify | Exact ODS table IDs for the figures above; units (volume basis) |

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

### S09 / S10 — Annual production 🔴

Horticulture statistics (tomatoes, strawberries, apples, potatoes) and cereal and oilseed production (wheat) — annual Defra publications to locate and verify in Stage 2. Used only side-by-side with annual imports, never to compute monthly shares (spec SS-07).

---

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

### S21 — Rural–urban classifications 🟡

- England & Wales: ONS 2021 Rural Urban Classification (OA, LSOA and LAD versions published on data.gov.uk). ✅ exists; download and fields to confirm.
- Scotland: Scottish Government Urban Rural Classification (latest edition to confirm).
- Northern Ireland: NISRA settlement classification (2015 edition known; check for a Census 2021-based update). The NIMDM 2017 file carries NISRA's "2015 Default Urban/Rural" class per SOA (Belfast: 172 urban, 2 mixed urban/rural), kept with the SOAs in the Stage 5 build.
- Classifications are not harmonised; profiles show each nation's own class with its definition.

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

Release 2 (national access layers).

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

## 7. Transport and logistics

### S23 — DfT Port freight annual statistics 2025 🟡

Published 29 July 2026 (accredited official statistics); data tables as a 39.9 MB ZIP; cargo groups (liquid bulk, dry bulk, Ro-Ro, container, others); OGL v3.0. URL: https://www.gov.uk/government/statistics/port-freight-annual-statistics-2025. **To verify**: which PORT tables give port-level Ro-Ro units/tonnage and any agricultural/food cargo categories. Food-specific port dependence comes from UKFSR (S03), not DfT.

---

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
| Food import entry-point dependency by commodity | Partly published (UKFSR commodity groups) | Scenario B on UKFSR shares; HMRC port data only if verified |
| Climate/agricultural risk indicators | No single authoritative per-commodity index identified | Cite Defra/UKFSR narrative findings only; no invented scores |
| Public transport accessibility (UK-wide) | England-only DfT statistics | England context only, Release 2 |

---

## 10. Attribution statements (to appear in app footer, Evidence page and PDFs)

- Contains public sector information licensed under the Open Government Licence v3.0 (HMRC, Defra, ONS, DfT, NISRA, NRS, Welsh Government, MHCLG, as applicable).
- Source: Office for National Statistics licensed under the Open Government Licence v3.0. Contains OS data © Crown copyright and database right [year] (exact wording to be taken from the ONS boundary metadata in Stage 2).
- Contains GEOLYTIX Grocery Retail Points data (v46, June 2026) (courtesy acknowledgement; on the store layer and the Evidence page from Stage 4).
- Priority Places for Food Index © CDRC / Leeds HASP, OGL v3.0 (wording to confirm).
- Made with Natural Earth.
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
