# ADR-0020 — Local data: two boundary editions, D5 store classes, built offline and published in Stage 4

- Status: Accepted (pre-Stage 4 data step)
- Date: 2026-10-24

## Context
Stage 4 (supermarket network) needs:
- council boundaries for the UK;
- the GEOLYTIX store points with a store class;
- the council each store falls in;
- a population and land area for every council.

The constraints were:
- **Boundaries:** ONS publishes the May 2025 councils in two relevant editions:
  - **BFE** runs to the low-water line. Its councils total 248,695 km², against 242,494 km² of ONS land area, and it covers estuaries such as the Wash and Morecambe Bay.
  - **BGC** is generalised to 20 m and clipped to the coastline.
- **Store classes:** GEOLYTIX v46 mixes supermarkets, convenience stores, petrol forecourts, travel sites, wholesale clubs and non-food outlets. Decision D5 had to say which count as supermarkets.
- **Population:** must be the same year for all four nations (spec §6.3, S18).
- **Network:** the build sandbox cannot reach ONS.
- **Manifest:** the app's Evidence page lists every dataset in the manifest as "data in use", and the header names one snapshot.

## Decision
1. **Two boundary editions, each for what it is good at:**
   - **BFE:** point-in-polygon assignment of stores, in EPSG:27700. John provided the FileGDB, which is committed with its checksum.
   - **BGC:** the display layer. `fetch-ons` fetches it on GitHub Actions in pages, with the total checked against the service count. The pipeline then:
     - cleans and simplifies it as a coverage at 150 m, so neighbours keep one shared edge;
     - drops island parts under 1 ha that touch no other council, and counts them;
     - publishes in WGS84 to 6 decimal places.
2. **Store class from the delivered size band only (D5, agreed with John):**
   - convenience: under 280 m²;
   - supermarket: 280 m² and over, in three bands (280–1,400, 1,400–2,800, 2,800 m² and over).

   **Format** comes from the fascia:
   - forecourt, motorway services, travel and hospital: following the GEOLYTIX groupings that ONS lists;
   - wholesale and mainly non-food: **left out of the app** (John, 24 Oct 2026). They stay in the comparison with ONS S12, which counts them.

   **Default view:** supermarkets in the standard format.

   **Unknown values:** an unknown size band stops the build.
3. **Council assignment rules:**
   - Stores in the Crown Dependencies (GY, JE, IM postcodes) have no UK council. They stay on the map with `lad: null` and their Crown Dependency named, and are in no council count (John, 24 Oct 2026).
   - A store up to 50 m outside every council takes the nearest one and is flagged `nearest`.
   - Anything further out is rejected.
   - Every rule is counted in the accounting report.
4. **Population: ONS mid-2025 estimates (S18) for all four nations.**
   - The figures come from MYE2 "All ages", with land area from MYE5.
   - The estimates are on April 2024 boundaries. For Barnsley and Sheffield, whose codes changed in 2025 after a small boundary change, the figures are carried to the new codes with a note on each council.
5. **Built offline, published later.** `build-local` writes to `pipeline/derived/<snapshot>/`. Each output carries a provenance record in the manifest's dataset shape, validated against it. Nothing enters `public/data/manifest.json` until Stage 4 shows the data, so the Evidence page never lists data that is not on screen.

## Consequences
- **Coverage:** every store in a UK council is assigned. The map shows coastlines, not low-water extents.
- **Projection slivers:** two pairs of neighbours overlap by slivers of 0.04 m² and 3.9 m² after projection and rounding, at points where simplified edges are almost collinear. Both are measured in the QA report; they are invisible at any display scale.
- **Publishing in Stage 4:** `publish` currently takes only the newest snapshot folder, so a local snapshot dated after the trade snapshot would hide the trade data. John decided (24 Oct 2026) that each kind of data keeps its own newest date, so trade and stores refresh on their own schedules; Stage 4 implements this and records it in its own ADR.
- **Repository size:** the raw inputs add about 50 MB to the repository. The BFE zip is 32 MB of that and is needed to rebuild offline.
