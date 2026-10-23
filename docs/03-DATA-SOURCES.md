# FOODSCOPE UK — Data-Source Inventory

| | |
|---|---|
| **Document** | 03 — Verified data catalogue and manifest |
| **Version** | 0.2 — 23 October 2026 (Stage 2: HMRC trade verified and ingested) |
| **Verification date** | 23 October 2026 (all "Verified" statements refer to checks made on this date) |
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
| S11 | Grocery / Supermarket Retail Points | GEOLYTIX | 🟡 | Supermarkets, Profiles, Access, Scenario D | R1 |
| S12 | Number of chain supermarkets across LADs and smaller areas in the UK | ONS | 🟡 | Validation of store counts | R1 |
| S13 | Priority Places for Food Index (v2.1) | CDRC / Leeds HASP | 🟡 (NI coverage ⚠️) | Access, Profiles | R1 (demo LADs) |
| S14 | Local Authority Districts (May 2025) Boundaries UK BGC (V2) | ONS | ✅ | All UK views, Profiles | R1 |
| S15 | LSOA 2021 boundaries and population-weighted centroids (E&W) | ONS | 🔴 | Access, Profiles (Manchester) | R1 |
| S16 | Data Zones 2021 (and Super Data Zones) | NISRA | 🟡 | Access, Profiles (Belfast) | R1 |
| S17 | Data Zones 2022 | Scottish Government / NRS | 🔴 | Access (Scotland) | R2 |
| S18 | Mid-year population estimates | ONS / NRS / NISRA | 🟡 | All per-capita indicators | R1 |
| S19 | Deprivation indices (IoD 2025, WIMD 2025, SIMD, NIMDM 2017) | MHCLG / Welsh Gov / Scottish Gov / NISRA | 🟡 | Access, Profiles, Scenario D | R1 (Eng, NI) |
| S20 | Car or van availability (Census 2021 / Scotland's Census 2022) | ONS / NISRA / NRS | 🔴 | Access, Profiles | R1 (Eng, NI) |
| S21 | Rural–urban classifications | ONS / Scottish Gov / NISRA | 🟡 | Profiles, Access | R1 |
| S22 | Journey time statistics | DfT | 🔴 (England only) | Access context | R2 |
| S23 | Port freight annual statistics 2025 | DfT | 🟡 | Risks, Scenario B | R2 |
| S24 | Natural Earth Admin 0 countries (v5.1.2) | Natural Earth | ✅ (1:110m outlines, 1:50m label points, ISO crosswalk) | Map reference layer; Origins map | R1 |
| S25 | Basemap styles service | Esri (ArcGIS Location Platform) | ✅ (live site, API key) | Map | R1 |
| S26 | ArcGIS Living Atlas items | Esri and contributors | 🔴 per item | Optional reference layers | R2 |
| S27 | Consumer price inflation — food (CPIH) | ONS (via Defra pocketbook CSV) | 🟡 | National context | R1 |
| S28 | HMRC port reference and port-level OTS detail | HMRC | 🟡 | Risks, Scenario B | R2 |

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

### S09 / S10 — Annual production 🔴

Horticulture statistics (tomatoes, strawberries, apples, potatoes) and cereal and oilseed production (wheat) — annual Defra publications to locate and verify in Stage 2. Used only side-by-side with annual imports, never to compute monthly shares (spec SS-07).

---

## 4. Retail

### S11 — GEOLYTIX Grocery / Supermarket Retail Points 🟡

| Field | Detail |
|---|---|
| Official title | Supermarket Retail Points (recent releases described as "Grocery Retail Points") |
| Publisher | GEOLYTIX |
| Info pages | https://geolytix.com/blog/supermarket-retail-points/ · Q1 2026 update: https://geolytix.com/blog/grocery-retail-points-2026q1/ |
| Download | Via GEOLYTIX's data viewer (geolytixmapp.com/product, Grocery layer) or the Google Drive link on the info page |
| Licence | Described by GEOLYTIX as fully open data with no licensing requirements and no cost; acknowledgement requested but not required. No named licence — **record the exact wording and retrieval date in the catalogue**; attribute "Contains GEOLYTIX Retail Points data" as courtesy. |
| Refresh | Quarterly |
| Latest period seen | Data dated March 2026 (blog published 30 April 2026); 19,254 locations; 22 grocery retailers tracked |
| Coverage | Described as UK. Tracks Northern Ireland-oriented chains (e.g. Centra, Dunnes Stores) — **NI coverage to confirm by checking `BT` postcodes** (Stage 2 gate) |
| Formats included | Supermarkets **and** convenience formats (e.g. Tesco Express, Sainsbury's Local) — store-class filtering is essential |
| Fields (v31, March 2024 file) | `id`, `retailer`, `fascia`, `store_name`, `add_one`, `add_two`, `town`, `suburb`, `postcode`, `long_wgs`, `lat_wgs`, `bng_e`, `bng_n`, `pqi`, `open_date`, `size_band`, `county` — **re-verify against the current download**; schema may have changed with the product rename |
| Processing | Pipeline: load CSV with declared CRS (EPSG:4326 from `long_wgs`/`lat_wgs`); validate coordinates within UK bbox; point-in-polygon to LAD and small areas; derive `store_class` from `size_band`/`fascia` using a documented mapping (decision D5); trim to fields used |
| Restrictions / cautions | Retail presence only — no turnover, prices or opening hours guarantees; `bng_e/bng_n` meaning for NI points to check (British National Grid does not normally cover NI); `pqi` semantics to confirm from the user guide |

### S12 — ONS: Number of chain supermarkets across LADs and smaller areas in the UK 🟡

Published 7 March 2024; UK including NI; LAD, MSOA (E&W), Intermediate Zones (Scotland), Super Data Zones (NI); includes supermarkets per 10,000 people at LAD level; OGL v3.0. URL: https://www.ons.gov.uk/peoplepopulationandcommunity/wellbeing/datasets/1numberofchainsupermarketsacrosslocalauthoritydistrictsladandsmallergeographicalareasintheuk. **Use**: validation benchmark for our LAD counts (expect differences from vintage and class definition — report, don't force agreement). Underlying source not stated on the page.

---

## 5. Food-access vulnerability

### S13 — Priority Places for Food Index 🟡 (⚠️ NI coverage in v2 unconfirmed)

| Field | Detail |
|---|---|
| Publisher | Consumer Data Research Centre (CDRC) / Leeds Healthy & Sustainable Places Data Service (HASP); interactive map https://priorityplaces.cdrc.ac.uk/ |
| Current version | **Index v2.1** — LSOA release on HASP (dataset 5276; first release 22 Jan 2024, latest release 14 Jul 2024; record updated 2026) |
| Licence | OGL v3.0; open access, tier 0, CSV |
| Geography | LSOA 2021 and Data Zones 2022 listed; spatial coverage listed as **Great Britain** |
| Composition | Seven domains: four retail-access domains at 12.5 % each (supermarket proximity, supermarket accessibility, online delivery access, non-supermarket food provision) and three affordability/need domains (socio-demographic barriers, family food support, fuel poverty) |
| Version 1 | Launched 2022; covered England, Wales, Scotland and Northern Ireland using **2011** geographies (LSOA, Data Zones, NI Super Output Areas). CDRC advises **not comparing v1 with v2**. |
| Constituency product | v2.1 by Westminster constituency (2024), England & Wales only, approximate best-fit aggregation |
| **Gate** | Download v2.1 LSOA CSV; check for NI codes and record column names. If NI is absent, the Belfast profile uses NI-native indicators (S19 NIMDM, S20 car availability, S11 proximity) and may show PPFI v1 only as a clearly labelled, non-comparable 2022 reference. |

### S19 — Deprivation indices 🟡

| Nation | Index | Geography | Status |
|---|---|---|---|
| England | **English Indices of Deprivation 2025** (MHCLG, October 2025; accredited official statistics) | 33,755 LSOAs (2021) | Partly verified; download URLs to confirm |
| Wales | **WIMD 2025** (Welsh Government; LSOA ranks published on stats.gov.wales) | LSOA | Partly verified |
| Scotland | **SIMD 2020** current; next update (on 2022 Data Zones) anticipated in the latter part of 2026 | Data Zones | **Check whether SIMD 2026 has been released** |
| Northern Ireland | **NIMDM 2017** (NISRA) — latest found | 890 Super Output Areas (2011) | Partly verified; NI uses SOA 2011, not DZ 2021 |

Indices are **relative rankings within each nation** and are not comparable across nations (P11). Display deciles within nation only.

### S20 — Car or van availability 🔴

England & Wales: Census 2021 (ONS topic summary table on car or van availability — expected TS045; confirm on Nomis). Northern Ireland: Census 2021 (NISRA; table ID to confirm, at DZ 2021). Scotland: Scotland's Census 2022 (NRS; table ID to confirm). Note the one-year difference for Scotland.

### S21 — Rural–urban classifications 🟡

- England & Wales: ONS 2021 Rural Urban Classification (OA, LSOA and LAD versions published on data.gov.uk). ✅ exists; download and fields to confirm.
- Scotland: Scottish Government Urban Rural Classification (latest edition to confirm).
- Northern Ireland: NISRA settlement classification (2015 edition known; check for a Census 2021-based update).
- Classifications are not harmonised; profiles show each nation's own class with its definition.

### S22 — Journey time statistics (DfT) 🔴

England only; includes access to key services such as food stores in some editions. Latest edition and methodology to verify. Release 2 context only; not combined with other nations.

---

## 6. Geography and population

### S14 — Local Authority Districts (May 2025) Boundaries UK BGC (V2) ✅

| Field | Detail |
|---|---|
| Publisher | Office for National Statistics (Open Geography Portal) |
| FeatureServer | https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/LAD_MAY_2025_UK_BGC_V2/FeatureServer/0 |
| Downloads | GeoJSON, Shapefile, GeoPackage, FileGDB, CSV etc. via the ONS hub (item `0b8528fb4132495181d82bb65c5e370a`); WFS also available |
| Verified fields | `FID`, `LAD25CD`, `LAD25NM`, `LAD25NMW`, `BNG_E`, `BNG_N`, `LONG`, `LAT`, `Shape__Area`, `Shape__Length`, `GlobalID` |
| Service properties | `maxRecordCount` 2000; pagination supported; spatial reference WKID 27700; query formats JSON, geoJSON, PBF |
| Demo authorities | `N09000003` Belfast · `E08000003` Manchester (verified by query) |
| Licence | OGL v3.0 per data.gov.uk footer; metadata licence field not set; contains Ordnance Survey and ONS IP — include the ONS/OS attribution statement |
| Generalisation | BGC = generalised (20 m) clipped to coastline; further simplified for the national web layer, original kept for point-in-polygon |
| Note | `Shape__Area` is in the service CRS (BNG); for NI features compute area in ITM in the pipeline instead |

### S15 — LSOA 2021 boundaries and population-weighted centroids (E&W) 🔴

ONS Open Geography Portal; service URLs and fields to verify in Stage 5 (Manchester deep profile).

### S16 — NISRA Data Zones 2021 🟡

3,780 Data Zones nesting in 850 Super Data Zones, 80 District Electoral Areas (2014) and 11 Local Government Districts (2014); attribute table carries DZ2021, SDZ2021, DEA2014 and LGD2014 codes and names. Formats: Shapefile, GeoJSON, Geodatabase. Info: https://nisra.gov.uk/support/geography/data-zones-census-2021. **To verify**: CRS (expect Irish Grid or ITM), licence wording, availability of population-weighted centroids (else use a documented substitute such as polygon-interior points, flagged as lower quality). Note NIMDM 2017 uses SOA 2011 → a DZ2021↔SOA2011 best-fit lookup will be needed.

### S17 — Scotland Data Zones 2022 🔴

Release 2 (national access layers).

### S18 — Population 🟡

- ONS mid-2025 population estimates for England and Wales published; UK provisional mid-2025 published.
- NRS (Scotland) and NISRA (NI) mid-year estimates: vintages and LAD/small-area availability to confirm.
- Rule: per-capita indicators use the latest year available **for all nations being compared**; where vintages differ, the comparability warning appears.

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
- Contains GEOLYTIX Retail Points data (courtesy acknowledgement).
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
| GEOLYTIX | Publisher blog pages; third-party schema listing of v31 file | Open terms, quarterly cadence, Q1 2026 counts; schema and NI coverage **still to confirm from download** |
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

