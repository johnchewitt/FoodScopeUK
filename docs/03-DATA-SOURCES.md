# FOODSCOPE UK — Data-Source Inventory

| | |
|---|---|
| **Document** | 03 — Verified data catalogue and manifest |
| **Version** | 0.1 — 23 October 2026 |
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
| S24 | Natural Earth Admin 0 countries | Natural Earth | 🟡 (1:110m in use as reference outlines) | Map reference layer; Origins map | R1 |
| S25 | Basemap styles service | Esri (ArcGIS Location Platform) | 🔴 key needed | Map | R1 |
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
| Documentation | https://www.uktradeinfo.com/api-documentation |
| Service URL | `https://api.uktradeinfo.com` — OData; JSON default, CSV via `$format=csv` (with limitations) |
| Licence | Open Government Licence v3.0 (© Crown copyright), per API documentation page |
| Access | Open, no authorisation header |
| Limits | **60 requests per minute per user**; responses capped at **40,000 items** with `@odata.nextLink` paging (or `$skip`/`$top`) |
| Refresh | Monthly |
| Latest period | Records for **August 2026** (`MonthId` 202608) returned on 23 Oct 2026 |
| Coverage | UK imports/exports by commodity, partner country and port |
| Endpoints used | `/OTS`, `/Commodity`, `/Country`, `/Port`, `/FlowType` (others available: `/Date`, `/Region`, `/RTS`, `/SITC`, `/Trader`, `/Import`, `/Export`, `/Trade`, `/TradeType`) |
| Verified OTS fields | `MonthId`, `FlowTypeId`, `SuppressionIndex`, `CommodityId`, `CommoditySitcId`, `CountryId`, `PortId`, `Value`, `NetMass`, `SuppUnit` |
| Verified Commodity fields | `CommodityId`, `Cn8Code`, `Hs2Code`, `Hs4Code`, `Hs6Code`, `Hs2Description`, `Hs4Description`, `Hs6Description`, `SitcCommodityCode`, `Cn8LongDescription` (e.g. `Hs4Code` "0702" → tomatoes; CN8 `07020010` ↔ `CommodityId` 7020010) |
| Verified Country fields | `CountryId`, `CountryCodeNumeric`, `RegionId`, `CountryName`, `CountryCodeAlpha` (e.g. FR, NL, DE), `Area1`–`Area5`, `Area1a`–`Area5a` (e.g. "European Union") |
| Flow types | 1 = EU imports, 2 = EU exports, 3 = Non-EU imports, 4 = Non-EU exports (OTS) |
| Query options | `$select`, `$expand`, `$filter`, `$top`, `$skip`, `$apply` (`groupby`, `aggregate`), `$count`, `$format`. `$orderby` returned a client error in testing — do not rely on it. |
| Grain | One row per month × flow × CN8 commodity × country × port × suppression index → must be aggregated |
| Processing | Pipeline: for each commodity basket, query CN8 codes by month range with `$apply=groupby((MonthId,FlowTypeId,CountryId),aggregate(NetMass with sum as …, Value with sum as …))` where supported (verify in Stage 2; fall back to paged raw rows); store raw responses; aggregate to month × partner; separate suppressed rows (`SuppressionIndex` > 0) into their own bucket |
| CORS | **Not verified.** Not needed under ADR-01. |

**Interpretation caveats (verified)**

- **Partner country = country of dispatch.** HMRC's bulk data dictionary defines the import country field as the country of dispatch — the country of the last commercial transaction — which may not be the country of origin or manufacture. HMRC states its headline import data has historically been published on a dispatch basis.
- **Netherlands effect.** HMRC's 2024 origin-vs-dispatch comparison (S02) shows the Netherlands with about £19.7bn of imports by origin but about £46.5bn by dispatch, the largest gap of any partner. Expect Netherlands to appear as a major "partner" for produce it re-exports.
- **Series breaks.** GB–EU import data has come from customs declarations since January 2022; before that, EU trade was collected through Intrastat. Combined with the 2021 EU exit, trends spanning 2021–2022 need break markers (spec FO-11).
- **Northern Ireland.** NI–EU goods trade is still reported through Intrastat; HMRC notes that country of origin is not required on Intrastat.
- **Suppression.** `SuppressionIndex` indicates confidentiality suppression (in the bulk dictionary: level 1 complete; level 2 countries and ports; level 3 countries, ports and total trade). The API documentation describes levels 1–5. Suppressed quantities must be shown as their own category, never redistributed.
- **Valuation.** The bulk data dictionary describes import statistical value on a cost-insurance-freight basis; confirm the API `Value` basis in Stage 2 before labelling.
- **Revisions.** Recent months are revised; snapshots record retrieval date and the app labels the latest 3 months "provisional — subject to revision" (confirm HMRC revision policy in Stage 2).

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

### S24 — Country geometries 🟡

**In use since Stage 1 (reference outlines only):** Natural Earth **v4.1.0** Admin 0 countries at **1:110m**, from the `world-atlas` npm package **2.0.2** (ISC packaging; Natural Earth data is public domain). Converted by `scripts/build-reference-layers.mjs`: 177 features, coordinates rounded to 3 dp, rings that jumped across the antimeridian (Russia, Fiji, Antarctica) split at ±180° so they do not draw lines across the map. Output `public/data/reference/world-countries-110m.geojson` with a provenance sidecar; checksum verified by the pipeline's `publish` step. Properties: `name`, `iso_n3` (ISO numeric, not alpha-2). Antarctica is hidden on the map by a display filter.

**Still to verify for Stage 3:** Natural Earth Admin 0 (public domain), 1:50m, with ISO alpha-2 codes, version recorded in catalogue. Representative points computed in pipeline (pole of inaccessibility or Natural Earth label points). Crosswalk HMRC `CountryCodeAlpha` → ISO 3166-1 alpha-2 → Natural Earth `ISO_A2`/`ISO_A2_EH`; HMRC non-country codes (e.g. stores and provisions, unspecified) are listed explicitly in `trade/countries.json` and mapped to "not mappable".

---

## 7. Transport and logistics

### S23 — DfT Port freight annual statistics 2025 🟡

Published 29 July 2026 (accredited official statistics); data tables as a 39.9 MB ZIP; cargo groups (liquid bulk, dry bulk, Ro-Ro, container, others); OGL v3.0. URL: https://www.gov.uk/government/statistics/port-freight-annual-statistics-2025. **To verify**: which PORT tables give port-level Ro-Ro units/tonnage and any agricultural/food cargo categories. Food-specific port dependence comes from UKFSR (S03), not DfT.

---

## 8. Platform and reference services

### S25 — Esri basemap styles 🔴

Requires an ArcGIS Location Platform (or ArcGIS Online) API key restricted by HTTP referrer (decision D2). Attribution is rendered automatically by the map component; do not hide it.

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
