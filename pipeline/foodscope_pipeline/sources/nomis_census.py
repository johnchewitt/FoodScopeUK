"""Census 2021 topic summaries for England and Wales from Nomis (S18, S20) — online download.

Stage 5 needs, per LSOA (2021), the usual resident population (TS001) and households by car or
van availability (TS045) for the Manchester deep profile (LP-04, FA-02, FA-03; gate G10). Nomis
publishes each topic summary as a bulk zip of CSV files, one per geography type (output areas,
LSOAs, MSOAs, local authorities, regions, countries): "Census 2021 bulk data download"
(https://www.nomisweb.co.uk/sources/census_2021_bulk, read 24 Oct 2026). The zips are cached
byte-for-byte in `pipeline/raw/nomis/<snapshot>/` with the same index format as the ONS cache;
the build reads only the LSOA CSV from each. Runs on GitHub Actions (the sandbox cannot reach
Nomis), through `fetch-reference`.
"""

from __future__ import annotations

from foodscope_pipeline.sources.ons_files import OGL, OnsFile

NOMIS_BULK = "https://www.nomisweb.co.uk/output/census/2021"

FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="nomis.census2021_ts001",
        filename="census2021-ts001.zip",
        url=f"{NOMIS_BULK}/census2021-ts001.zip",
        source_id="S18",
        licence=OGL,
        description="Census 2021 TS001 Number of usual residents in households and communal establishments (E&W)",
    ),
    OnsFile(
        id="nomis.census2021_ts045",
        filename="census2021-ts045.zip",
        url=f"{NOMIS_BULK}/census2021-ts045.zip",
        source_id="S20",
        licence=OGL,
        description="Census 2021 TS045 Car or van availability (households, E&W)",
    ),
)
