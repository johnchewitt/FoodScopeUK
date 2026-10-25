"""Defra annual production statistics for the Stage 5 national context (S09, S10) — online download.

John asked on 25 Oct 2026 for domestic production context in the council profiles. Two Defra
accredited official statistics publications, both OGL v3.0, read on gov.uk on 25 Oct 2026:

- S09: "Horticulture statistics 2025" (published 25 June 2026), accompanying dataset
  `hort-dataset-25-20260625.ods`: area, production and value of individual crops, including
  tomatoes (protected vegetables) and strawberries (soft fruit), 1985–2025. Supply and the
  home-production share are published only for all vegetables and all fruit, not per crop.
- S10: "Agriculture in the United Kingdom 2025", chapter 7 (crops) (published 9 July 2026, updated
  3 September 2026), dataset `AUK-chapter7-20260709.ods`: production, imports, exports, total new
  supply and production as a percentage of total new supply for wheat and potatoes.

These are annual national figures, shown side by side with annual HMRC imports and labelled as
national context. They are never combined with monthly trade to estimate a domestic share (spec
SS-07). Cached in `pipeline/raw/defra/<snapshot>/`; runs on GitHub Actions through
`fetch-reference --set context`.
"""

from __future__ import annotations

from foodscope_pipeline.sources.ons_files import OGL, OnsFile

HORTICULTURE_2025_URL = (
    "https://assets.publishing.service.gov.uk/media/6a327c196422bec01b1176a1/hort-dataset-25-20260625.ods"
)
AUK_2025_CHAPTER7_URL = (
    "https://assets.publishing.service.gov.uk/media/6a3d141feaee00074150f4db/AUK-chapter7-20260709.ods"
)

FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="defra.horticulture_2025",
        filename="hort-dataset-25-20260625.ods",
        url=HORTICULTURE_2025_URL,
        source_id="S09",
        licence=OGL,
        description="Horticulture statistics 2025: accompanying dataset (area, production and value by crop)",
    ),
    OnsFile(
        id="defra.auk_2025_chapter7",
        filename="AUK-chapter7-20260709.ods",
        url=AUK_2025_CHAPTER7_URL,
        source_id="S10",
        licence=OGL,
        description="Agriculture in the United Kingdom 2025, chapter 7 (crops): full crops dataset",
    ),
)
