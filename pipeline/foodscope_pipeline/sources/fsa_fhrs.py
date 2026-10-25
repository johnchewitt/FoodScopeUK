"""Food Standards Agency food hygiene register for Northern Ireland (S29) — online download.

Why: GEOLYTIX (S11) has only ten retailers in Northern Ireland. John asked (25 Oct 2026) to add
the NI grocers it misses "from another source if possible". The FSA's Food Hygiene Rating Scheme
open data lists every registered food business with its business type, address and position.

Source (read 25 Oct 2026): https://ratings.food.gov.uk/open-data/ — one XML file per council,
updated daily, URL pattern `https://ratings.food.gov.uk/api/open-data-files/FHRS<code>en-GB.xml`.
The eleven Northern Ireland councils use codes 801–816 (below). Re-use is under the Open
Government Licence (https://ratings.food.gov.uk/terms-and-conditions); ratings imagery and the
FSA logo have their own rules and are not used. Field names and business types are verified in
the downloaded files before anything is built from them. Cached in `pipeline/raw/fsa/<snapshot>/`;
runs on GitHub Actions through `fetch-reference`.
"""

from __future__ import annotations

from foodscope_pipeline.sources.ons_files import OnsFile

FSA_OPEN_DATA = "https://ratings.food.gov.uk/api/open-data-files"
FSA_OGL = "Open Government Licence v3.0 (Food Standards Agency, food hygiene rating data)"

# FSA local authority code → council (May 2025 code), as listed on the open-data page.
NI_COUNCILS: tuple[tuple[str, str, str], ...] = (
    ("801", "N09000001", "Antrim and Newtownabbey"),
    ("802", "N09000011", "Ards and North Down"),
    ("803", "N09000002", "Armagh City, Banbridge and Craigavon"),
    ("804", "N09000008", "Mid and East Antrim"),
    ("805", "N09000004", "Causeway Coast and Glens"),
    ("807", "N09000003", "Belfast City"),
    ("809", "N09000007", "Lisburn and Castlereagh City"),
    ("811", "N09000009", "Mid Ulster"),
    ("813", "N09000005", "Derry City and Strabane"),
    ("814", "N09000010", "Newry, Mourne and Down"),
    ("816", "N09000006", "Fermanagh and Omagh"),
)

FILES: tuple[OnsFile, ...] = tuple(
    OnsFile(
        id=f"fsa.fhrs_{code}",
        filename=f"FHRS{code}en-GB.xml",
        url=f"{FSA_OPEN_DATA}/FHRS{code}en-GB.xml",
        source_id="S29",
        licence=FSA_OGL,
        description=f"FSA food hygiene rating open data: {name} (FHRS {code}; council {lad})",
    )
    for code, lad, name in NI_COUNCILS
)
