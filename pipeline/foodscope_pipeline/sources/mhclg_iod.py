"""English Indices of Deprivation 2025 (S19, England) — online download.

MHCLG, "English indices of deprivation 2025" (published 30 Oct 2025, accredited official
statistics, OGL v3.0): File 7, all ranks, scores, deciles and population denominators for the
33,755 LSOAs (2021) in England, as CSV. Deciles are within England only and must never be
compared with other nations' indices (P11). URL from the collection page
https://www.gov.uk/government/statistics/english-indices-of-deprivation-2025 (read 24 Oct 2026).
Cached in `pipeline/raw/mhclg/<snapshot>/`; runs on GitHub Actions through `fetch-reference`.
"""

from __future__ import annotations

from foodscope_pipeline.sources.ons_files import OGL, OnsFile

FILE_7_URL = (
    "https://assets.publishing.service.gov.uk/media/691ded56d140bbbaa59a2a7d/"
    "File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv"
)

FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="mhclg.iod2025_file7",
        filename="File_7_IoD2025_All_Ranks_Scores_Deciles_Population_Denominators.csv",
        url=FILE_7_URL,
        source_id="S19",
        licence=OGL,
        description="English Indices of Deprivation 2025, File 7: all ranks, scores, deciles and population denominators (LSOA 2021)",
    ),
)
