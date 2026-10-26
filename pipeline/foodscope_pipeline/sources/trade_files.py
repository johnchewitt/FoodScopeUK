"""Reference files for the sixteen Food Origins baskets: registry for `fetch-reference --set trade` (online).

John asked on 26 Oct 2026 for the other eleven baskets of spec §6.1 (apples, oranges, rice, beef,
sheep and goat meat, poultry, cheese, milk products, sugar, coffee, cocoa). Before they are shown,
gate G3 compares the baskets with Defra's own trade codes (S05), and Defra's annual supply tables
give national production context where Defra publishes it (S10, chapter 8 for meat and dairy;
chapter 7 and horticulture, already cached in the context set, for sugar and apples).

Each item was found on its publisher's page on 26 Oct 2026; structures are verified from the
cached files before anything is built from them. The sandbox cannot reach these hosts: the workflow
`refresh-reference-data.yml` fetches them on GitHub Actions into `pipeline/raw/defra/<snapshot>/`.
"""

from __future__ import annotations

from foodscope_pipeline.sources.ons_files import OGL, OnsFile

ASSETS = "https://assets.publishing.service.gov.uk/media"

# S05: "Food statistics in your pocket" page (last updated 29 Jul 2026, read 26 Oct 2026) links
# "Defra trade codes and descriptions" (ODS, 970 KB, dated 15 Nov 2022) beside the HTML guide "A
# guide to Defra trade codes and classifications" (FFD groupings, Brigades levels 1-3,
# Indigeneity and Degree of Processing).
# S10: "Agriculture in the United Kingdom" data sets page (read 26 Oct 2026): chapter 8 -
# livestock (ODS, 139 KB), revised 3 Sep 2026 (poultry corrections in chapters 8 and 14).
DEFRA_FILES: tuple[OnsFile, ...] = (
    OnsFile(
        id="defra.trade_codes",
        filename="Defra-trade-codes-and-descriptions-15nov22.ods",
        url=f"{ASSETS}/6373bde8e90e07284de6da0c/Defra-trade-codes-and-descriptions-15nov22.ods",
        source_id="S05",
        licence=OGL,
        description="Defra trade codes and descriptions (CN8 codes with Defra's groupings), 15 Nov 2022",
    ),
    OnsFile(
        id="defra.auk_2025_chapter8",
        filename="AUK-chapter8-20260709i.ods",
        url=f"{ASSETS}/6a994f51f5b35599aec19158/AUK-chapter8-20260709i.ods",
        source_id="S10",
        licence=OGL,
        description="Agriculture in the United Kingdom 2025, chapter 8: livestock (revised 3 Sep 2026)",
    ),
)
