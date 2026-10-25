"""Stage 6 (Risk Explorer) reference files: registry for `fetch-reference --set stage6` (online).

John's Stage 6 brief (25 Oct 2026) and his decisions the same day: fetch and verify the data first;
FAO water stress as the only country climate/water indicator; the Priority Places index for every
council. Each item below was found on its publisher's page on 25 Oct 2026 (docs/03-DATA-SOURCES.md);
structures and fields are verified from the cached files before anything is built from them. The
sandbox cannot reach these hosts: the workflow `refresh-reference-data.yml` fetches them on GitHub
Actions into `pipeline/raw/<publisher>/<snapshot>/`, with checksums, as for Stage 5.

Two items are probes, fetched to read their structure before deciding what to extract: the OSNI
1:50,000 transport layer metadata (S34) and the OS Open Roads download list (S35). The road data
itself is fetched in a second run once the fields and file sizes are known.

Second run (25 Oct 2026, after reading the first): the Priority Places index codes Scotland's
small areas as 2011 Data Zones (S01006506-S01013481), not 2022 ones, so the 2011 Data Zone lookup
is added; DfT's port list gives a map location for only 27 of its 53 statistical ports (none for
Dover, Felixstowe or Belfast), so EMODnet's port locations (S36, keyed by UN/LOCODE like DfT's
list) are added. The OSNI probe is retried (its server closed the connection in the first run).
"""

from __future__ import annotations

from foodscope_pipeline.sources.ons_files import OGL, ONS_SERVICES, OnsFile, OnsQuery

CC_BY_4 = "Creative Commons Attribution 4.0 International (CC BY 4.0)"
ASSETS = "https://assets.publishing.service.gov.uk/media"

# --- S30: FAO AQUASTAT level of water stress (SDG 6.4.2), through the World Bank API -----------
# data.worldbank.org/indicator/ER.H2O.FWST.ZS (read 25 Oct 2026): "Level of water stress:
# freshwater withdrawal as a proportion of available freshwater resources"; source AQUASTAT
# (FAO); licence CC BY-4.0; latest year 2022. One request returns every country and year.
WORLDBANK_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="worldbank.water_stress",
        filename="er-h2o-fwst-zs-2000-2025.json",
        url=(
            "https://api.worldbank.org/v2/country/all/indicator/ER.H2O.FWST.ZS"
            "?format=json&per_page=20000&date=2000:2025"
        ),
        source_id="S30",
        licence=CC_BY_4,
        description="Level of water stress (SDG 6.4.2, FAO AQUASTAT) by country, 2000-2025, World Bank API",
        json_kind="any",
    ),
    OnsFile(
        id="worldbank.countries",
        filename="countries.json",
        url="https://api.worldbank.org/v2/country?format=json&per_page=400",
        source_id="S30",
        licence=CC_BY_4,
        description="World Bank country list (ISO codes; regions and income groups mark aggregates)",
        json_kind="any",
    ),
)

# --- S23: DfT Port freight annual statistics (2025) ---------------------------------------------
# gov.uk "Port and domestic waterborne freight statistics: data tables (PORT)", last updated
# 10 Sep 2026 (read 25 Oct 2026). OGL v3.0.
DFT_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="dft.port0101",
        filename="port0101.ods",
        url=f"{ASSETS}/6a62202b2dc18ebe4c3b2b06/port0101.ods",
        source_id="S23",
        licence=OGL,
        description="PORT0101: All freight tonnage traffic by port and year (filter by direction)",
    ),
    OnsFile(
        id="dft.port0304",
        filename="port0304.ods",
        url=f"{ASSETS}/6a6221092dc18ebe4c3b2b0b/port0304.ods",
        source_id="S23",
        licence=OGL,
        description="PORT0304: Map of UK ports by tonnage and direction, for major ports over 2 million tonnes",
    ),
    OnsFile(
        id="dft.port0499",
        filename="port0499.ods",
        url=f"{ASSETS}/6a7315f0011ff6453dece53a/port0499.ods",
        source_id="S23",
        licence=OGL,
        description="PORT0499: UK major port freight traffic, port level downloadable dataset",
    ),
    OnsFile(
        id="dft.port_list",
        filename="Major_and_Minor_Port_List_for_Freight_Statistics.ods",
        url=f"{ASSETS}/6888c795048fff613a4d5ae9/Major_and_Minor_Port_List_for_Freight_Statistics.ods",
        source_id="S23",
        licence=OGL,
        description="Major and Minor Port List for Freight Statistics",
    ),
)

# --- S03 (UKFSR 2024, theme 3) and S31 (Defra June survey: structure of the agricultural industry)
# UKFSR theme 3 page links its chart data as FSR-theme3-241211.ods (read 25 Oct 2026). Structure of
# the agricultural industry in England and the UK at June: page updated 22 Sep 2026; regional
# results for England (file dated 16 Apr 2026) and UK key results by country 1866-2025 (updated
# 11 Dec 2025). All OGL v3.0.
DEFRA_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="defra.ukfsr_2024_theme3",
        filename="FSR-theme3-241211.ods",
        url=f"{ASSETS}/6756c6a1a63e1781efb87778/FSR-theme3-241211.ods",
        source_id="S03",
        licence=OGL,
        description="United Kingdom Food Security Report 2024, theme 3 (food supply chain resilience): chart data",
    ),
    OnsFile(
        id="defra.structure_england_regions",
        filename="structure-england-june-regions-16apr26.ods",
        url=f"{ASSETS}/69e0b1fb6c6ccf244be42e2e/structure-england-june-regions-16apr26.ods",
        source_id="S31",
        licence=OGL,
        description="Structure of the agricultural industry in England at June: results by region",
    ),
    OnsFile(
        id="defra.structure_uk_by_country",
        filename="UK_key_results_by_country_1866-2025.ods",
        url=f"{ASSETS}/69381cbbcfacd5e888491c57/UK_key_results_by_country_1866-2025.ods",
        source_id="S31",
        licence=OGL,
        description="Structure of the agricultural industry: UK key results by country, 1866 to 2025",
    ),
)

# --- S32: Scottish Government 2022 Data Zone lookup ---------------------------------------------
# data.gov.scot/dataset/2022_data_zone_lookup (read 25 Oct 2026): CSV, 3.2 MB, updated 19 Aug 2026,
# OGL v3.0; columns include DZ22, LA, Country. Links Scotland's PPFI Data Zones to councils.
SCOTGOV_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="scotgov.dz22_lookup",
        filename="dz2022-lookup.csv",
        url=(
            "https://data.gov.scot/dataset/2022_data_zone_lookup/resource/"
            "81b010f5-0207-4ee5-bd2d-e7821aa6a3dc/download"
        ),
        source_id="S32",
        licence=OGL,
        description="2022 Data Zone Lookup (Data Zones to councils and other geographies)",
    ),
    # data.gov.scot/dataset/2011_data_zone_lookup (read 25 Oct 2026): CSV, 3.1 MB, updated
    # 19 Aug 2026, OGL v3.0; columns DZ2011, IZ2011, MMWard, LA, ..., UR2-UR8, Country. The PPFI
    # (S13) uses 2011 Data Zones for Scotland, so this lookup assigns them to councils.
    OnsFile(
        id="scotgov.dz11_lookup",
        filename="dz2011-lookup.csv",
        url=(
            "https://data.gov.scot/dataset/2011_data_zone_lookup/resource/"
            "20ad5f65-c5c2-407e-8355-7c25bf579e87/download"
        ),
        source_id="S32",
        licence=OGL,
        description="2011 Data Zone Lookup (Data Zones to current councils and other geographies)",
    ),
)

# --- S36: EMODnet Human Activities, main ports: port locations -----------------------------------
# EMODnet catalogue record 379d0425-8924-4a41-a088-1a002d2ea748 (read 25 Oct 2026): "Main Ports,
# Goods-Passengers-Vessels Traffic", Eurostat maritime statistics for EU, EFTA, Turkey and UK main
# ports; ports georeferenced from the GISCO "Ports 2013" points where possible, otherwise UN/LOCODE,
# port authorities and other sources; revised 10 Dec 2025; CC BY 4.0 (credit the EMODnet portal,
# originators Eurofish and Cogea). WFS endpoint and layer `emodnet:portlocations` from the record.
CC_BY_4_EMODNET = f"{CC_BY_4}; EMODnet Human Activities (originators Eurofish International Organisation and Cogea Srl)"
EMODNET_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="emodnet.port_locations",
        filename="emodnet-portlocations.json",
        url=(
            "https://ows.emodnet-humanactivities.eu/wfs?SERVICE=WFS&VERSION=1.1.0&REQUEST=GetFeature"
            "&TYPENAME=emodnet:portlocations&OUTPUTFORMAT=application/json"
        ),
        source_id="S36",
        licence=CC_BY_4_EMODNET,
        description="EMODnet Human Activities, main ports: port locations (WFS layer emodnet:portlocations, GeoJSON)",
        json_kind="any",
    ),
)

# --- S33 (ITL1 regions) and S15 (LSOA 2021 -> LAD 2025 for every LSOA) --------------------------
# ITL1 (January 2025) Boundaries UK BGC: FeatureServer ITL1_JAN_2025_UK_BGC (data.gov.uk record,
# read 25 Oct 2026). The LSOA lookup is the service used for Manchester in Stage 5, now unfiltered.
ITL1_BGC_LAYER = f"{ONS_SERVICES}/ITL1_JAN_2025_UK_BGC/FeatureServer/0"
LSOA21_LAD25_LAYER = f"{ONS_SERVICES}/LSOA21_WD25_LAD25_EW_LU_v2/FeatureServer/0"

ONS_QUERIES: tuple[OnsQuery, ...] = (
    OnsQuery(
        id="ons.itl1_jan2025_bgc",
        stem="itl1-jan-2025-uk-bgc",
        layer_url=ITL1_BGC_LAYER,
        params="where=1%3D1&outFields=*&returnGeometry=true&outSR=27700&f=json",
        page_size=20,
        source_id="S33",
        licence=OGL,
        description="International Territorial Level 1 (January 2025) Boundaries UK BGC, EPSG:27700",
    ),
    OnsQuery(
        id="ons.lsoa21_lad25_all",
        stem="lsoa21-wd25-lad25-ew-lu-v2",
        layer_url=LSOA21_LAD25_LAYER,
        params=(
            "where=1%3D1&outFields=LSOA21CD,LSOA21NM,LAD25CD,LAD25NM&returnGeometry=false"
            "&orderByFields=LSOA21CD&f=json"
        ),
        page_size=1000,
        source_id="S15",
        licence=OGL,
        description="LSOA (2021) to Electoral Ward (2025) to LAD (2025) Best Fit Lookup in EW (V2), all LSOAs",
    ),
)

# --- Probes: S34 OSNI 1:50,000 transport (roads) and S35 OS Open Roads ---------------------------
# OSNI Open Data 50K Transport, data.gov.uk (read 25 Oct 2026): Esri REST MapServer layer 2, OGL;
# motorways, A, B and C class roads, minor roads. OS Open Roads: OS Downloads API product list.
OSNI_TRANSPORT = "https://services.spatialni.gov.uk/opendata/rest/services/OSNIVector/OSNIOpenData_Transport_50K/MapServer"

# OSNI closed the connection to GitHub's runners in all three runs of 25 Oct 2026 ("Remote end
# closed connection without response"); the sandbox cannot reach it either. Kept for a retry, but
# not part of the stage6 set (docs/03-DATA-SOURCES.md, S34): Northern Ireland roads are not shown.
OSNI_PROBE_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="osni.transport50k_service",
        filename="osni-transport-50k-service.json",
        url=f"{OSNI_TRANSPORT}?f=json",
        source_id="S34",
        licence=OGL,
        description="OSNI Open Data 50K Transport: map service metadata (layers)",
        json_kind="any",
    ),
    OnsFile(
        id="osni.transport50k_layer2",
        filename="osni-transport-50k-layer2.json",
        url=f"{OSNI_TRANSPORT}/2?f=json",
        source_id="S34",
        licence=OGL,
        description="OSNI Open Data 50K Transport: layer 2 metadata (fields, domains, record limits)",
        json_kind="any",
    ),
)

# --- Northern Ireland transport (John, 25 Oct 2026, pointing to OpenDataNI) ---------------------
# John's links: DfI Roads "Highway Network" and Translink "NIR Railway Network" on OpenDataNI.
# - DfI Highway Network (data.gov.uk record 411c9fc1…, read 25 Oct 2026): the CSV and XML resources
#   (dfi.highway-iams.uk/OpenData/HIGHWAY_NETWORK.CSV) carry section attributes and CLASS but no
#   geometry; the geometry is only in an ArcGIS map whose service is behind a Spatial NI utility proxy
#   (credentials, whitelisted referrers; HTTP 403 without them). It cannot be fetched openly.
# - OSNI Open Data 50K Transport, transport lines (S34; data.gov.uk record 092bebf4…, OGL, use
#   subject to the LPS Open Government Data Licence): motorways, A, B and C class roads, minor roads
#   and railways. Besides the Spatial NI REST layer that refused the runners, the record lists
#   OSNI's ArcGIS Hub downloads (item 476bb4e6…, layer 2), served by ArcGIS Hub, not Spatial NI.
# - Translink NIR Railway Network (S37; OpenDataNI dataset 0297b4a0…, OGL, created 21 Sep 2015):
#   a shapefile ZIP uploaded to OpenDataNI, "must be viewed in Irish Grid projection".
OSNI_HUB_ITEM = "https://osni-spatialni.opendata.arcgis.com/api/download/v1/items/476bb4e6f8e64f60a08ae84888733bd4"
OSNI_LICENCE = "Open Government Licence v3.0 (OpenDataNI); use subject to the LPS Open Government Data Licence"

OSNI_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="osni.transport50k_lines",
        filename="osni-transport-50k-lines.geojson",
        url=f"{OSNI_HUB_ITEM}/geojson?layers=2",
        source_id="S34",
        licence=OSNI_LICENCE,
        description="OSNI Open Data 50K Transport: transport lines (roads by class, railways), GeoJSON from OSNI's ArcGIS Hub",
    ),
)

TRANSLINK_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="translink.nir_railway_network",
        filename="nir-railway-network-shp.zip",
        url=(
            "https://admin.opendatani.gov.uk/dataset/0297b4a0-5cea-4c22-97cc-346c76df33ed/resource/"
            "7bc41442-ef8b-4343-acc4-7a78d37cd6a0/download/nirshp.zip"
        ),
        source_id="S37",
        licence=OGL,
        description="Northern Ireland Railways (NIR) railway network, Translink, shapefile (Irish Grid), OpenDataNI",
    ),
)

PROBE_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="os.open_roads_downloads",
        filename="os-open-roads-downloads.json",
        url="https://api.os.uk/downloads/v1/products/OpenRoads/downloads",
        source_id="S35",
        licence=OGL,
        description="OS Open Roads: OS Downloads API list of files (formats, areas, sizes, checksums)",
        json_kind="any",
    ),
)
