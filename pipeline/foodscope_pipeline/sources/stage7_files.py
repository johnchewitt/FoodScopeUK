"""Stage 7 (Scenario Lab) reference files: registry for `fetch-reference --set stage7` (online).

John's Stage 7 brief (26 Oct 2026) asks the supermarket-closure scenario for the neighbourhoods whose
nearest mapped supermarket would change and the population potentially affected, anywhere in the UK.
His decision the same day: a population-weighted point and Census population for every small area in
the UK, fetched and verified first in its own data step. What is already cached is reused:
- England and Wales: Census 2021 usual residents by LSOA (Nomis TS001, stage5 set) and the LSOA to
  council lookup for every LSOA (stage6 set); only the Manchester box of LSOA centroids is cached, so
  every centroid is fetched here;
- Northern Ireland: Data Zone 2021 population-weighted centroids and Census 2021 MS-A01 (stage5 set);
- Scotland: nothing yet. The Scottish Government's "Data Zone Centroids 2022" (record
  6755b5a3-5d99-4ca3-bd19-33d5454774ac on spatialdata.gov.scot, published 16 Dec 2024, read 26 Oct
  2026) are population-weighted (median of Output Area centroids weighted by household residents) and
  carry Census 2022 population; the 2022 Data Zone lookup with council codes is cached (stage6 set).

Structures and fields are verified from the cached files before anything is built from them. The
sandbox cannot reach these hosts: `refresh-reference-data.yml` fetches them on GitHub Actions.
"""

from __future__ import annotations

from foodscope_pipeline.sources.ons_files import LSOA21_PWC_LAYER, OGL, OnsFile, OnsQuery

# S15: every LSOA (December 2021) population-weighted centroid in England and Wales (35,672).
ONS_QUERIES: tuple[OnsQuery, ...] = (
    OnsQuery(
        id="ons.lsoa21_pwc_all",
        stem="lsoa-dec-2021-ew-pwc-v4",
        layer_url=LSOA21_PWC_LAYER,
        params=(
            "where=1%3D1&outFields=LSOA21CD&returnGeometry=true&outSR=27700"
            "&orderByFields=LSOA21CD&f=json"
        ),
        page_size=1000,
        source_id="S15",
        licence=OGL,
        description="LSOA (December 2021) EW Population Weighted Centroids (V4), every LSOA, EPSG:27700",
    ),
)

# S17: Scottish Government Data Zone Centroids 2022 (shapefile ATOM download from the record above).
SCOTGOV_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="scotgov.dz2022_centroids",
        filename="SG_DataZoneCent_2022.zip",
        url="https://maps.gov.scot/ATOM/shapefiles/SG_DataZoneCent_2022.zip",
        source_id="S17",
        licence=OGL,
        description="Data Zone Centroids 2022 (population-weighted, with Census 2022 population), Scottish Government",
    ),
)
