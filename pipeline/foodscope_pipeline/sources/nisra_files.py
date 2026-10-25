"""NISRA files for the Belfast deep profile (S16, S18, S19) — online download.

Gates G9 (Data Zones 2021) and the Northern Ireland part of S19, read on nisra.gov.uk on 24 Oct
2026 (docs/03-DATA-SOURCES.md):
- Data Zone (2021) boundaries, ESRI Shapefile (publication "Data Zone Boundaries GIS format",
  21 Feb 2023; "Contains Ordnance Survey of Northern Ireland information licensed under the Open
  Government Licence v3.0"). 3,780 Data Zones nesting in Super Data Zones, DEAs and LGDs; the
  attribute table carries the DZ, SDZ, DEA and LGD codes.
- Census 2021 population-weighted centroids for Data Zones and Super Data Zones, CSV (zip),
  published 6 Oct 2023.
- Census 2021 MS-A01 usual resident population, including Data Zones (21 Feb 2023).
- Super Output Area (2011) boundaries, ESRI Shapefile (2 Sep 2013): the geography NIMDM 2017 is
  published on. John's decision (24 Oct 2026): deprivation is shown on these areas, not
  reallocated to Data Zones.
- NIMDM 2017 SOA-level results (.xls, 23 Nov 2017), the latest Northern Ireland deprivation
  measure. Ranks are within Northern Ireland only (P11).

Car or van availability by Data Zone is only in NISRA's flexible table builder, which does not
allow automated access; John provides that file (`pipeline/raw/nisra-provided/`). Cached in
`pipeline/raw/nisra/<snapshot>/`; runs on GitHub Actions through `fetch-reference`.
"""

from __future__ import annotations

from foodscope_pipeline.sources.ons_files import OnsFile

NISRA = "https://www.nisra.gov.uk"
# NISRA's copyright page (read 24 Oct 2026): its material is re-usable under the OGL with the
# attribution "Source: NISRA"; OSNI mapping is exempt unless a publication says otherwise. The
# Data Zone page says its boundaries contain OSNI information licensed under the OGL v3.0; the
# SOA 2011 boundaries are listed under the OGL by OpenDataNI (data.gov.uk record).
NISRA_OGL = "Open Government Licence v3.0 (Source: NISRA)"
OSNI_OGL = "Open Government Licence v3.0 (contains Ordnance Survey of Northern Ireland information)"
SOA_OGL = "Open Government Licence v3.0 (OpenDataNI record of the NISRA SOA 2011 boundaries)"

FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="nisra.dz2021_boundaries",
        filename="geography-dz2021-esri-shapefile.zip",
        url=f"{NISRA}/files/nisra/publications/geography-dz2021-esri-shapefile.zip",
        source_id="S16",
        licence=OSNI_OGL,
        description="Data Zone (2021) boundaries, ESRI Shapefile",
    ),
    OnsFile(
        id="nisra.dz2021_pwc",
        filename="geography-census-2021-population-weighted-centroids-csv.zip",
        url=f"{NISRA}/system/files/statistics/geography-census-2021-population-weighted-centroids-csv.zip",
        source_id="S16",
        licence=NISRA_OGL,
        description="Census 2021 population weighted centroids for Data Zones and Super Data Zones (CSV)",
    ),
    OnsFile(
        id="nisra.census2021_ms_a01",
        filename="census-2021-ms-a01.xlsx",
        url=f"{NISRA}/system/files/statistics/census-2021-ms-a01.xlsx",
        source_id="S18",
        licence=NISRA_OGL,
        description="Census 2021 MS-A01 Usual resident population (incl. Data Zones)",
    ),
    OnsFile(
        id="nisra.soa2011_boundaries",
        filename="SOA2011_Esri_Shapefile_0.zip",
        url=f"{NISRA}/files/nisra/publications/SOA2011_Esri_Shapefile_0.zip",
        source_id="S19",
        licence=SOA_OGL,
        description="Super Output Area (2011) boundaries, ESRI Shapefile",
    ),
    OnsFile(
        id="nisra.nimdm2017_soa",
        filename="NIMDM17_SOAresults.xls",
        url=f"{NISRA}/files/nisra/publications/NIMDM17_SOAresults.xls",
        source_id="S19",
        licence=NISRA_OGL,
        description="Northern Ireland Multiple Deprivation Measure 2017, SOA level results",
    ),
)
