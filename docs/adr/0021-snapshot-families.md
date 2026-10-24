# ADR-0021 — Each data family comes from its own newest snapshot

- Status: Accepted (Stage 4)
- Date: 2026-10-24

## Context
Until Stage 3 there was one kind of statistical data, HMRC trade, and `publish` listed the datasets of the newest snapshot folder (`public/data/snapshots/<date>/`). The pre-Stage 4 data step added a second kind: stores, councils and population, built on 24 Oct 2026 from sources with their own cadences:
- GEOLYTIX: quarterly;
- ONS population: annual;
- boundaries: annual.

HMRC publishes monthly. With the newest-folder rule, publishing the 24 Oct store data would have dropped the 23 Oct trade data, and the next HMRC refresh would drop the stores.

John decided on 24 Oct 2026: "each kind of data keep its own newest date, so trade and stores refresh on their own schedules".

## Decision
1. **Families.** A dataset family is a folder directly inside a snapshot:
   - `snapshots/<date>/trade/` is written by `build-trade`;
   - `snapshots/<date>/local/` is written by `build-local`.
2. **Publishing.** `publish` takes each family from the newest snapshot that contains it (`snapshot_families`), plus every reference layer.
3. **Manifest.** The manifest gains an optional `snapshots` object (family → date). `snapshotId` stays, as the newest of those dates, so older readers still work.
4. **App wording.** The app names each family's date:
   - **Header freshness indicator:** "Trade 2026-10-23 · Stores and population 2026-10-24".
   - **Evidence page:** one sentence lists every family's snapshot.
   - **Insights panel:** a status line per family.
   - **Module source notes:** each module cites its own family (Food Origins and Seasonal Supply say "trade snapshot …").

   `familySnapshot()` reads a family's date and falls back to `snapshotId` for manifests written before families.
5. **Building a family.** A refresh builds only its family into a new dated folder. Old folders stay until pruned (backlog B15); they are never edited.

## Consequences
- **Independent refreshes:** an HMRC refresh (`refresh-trade-data.yml`) and a GEOLYTIX or ONS refresh no longer interfere.
- **Mixed dates are expected:** the header shows more than one date, so the app must never describe "the" snapshot when it means one family's.
- **Tests:** `test_publish.py` checks that a newer family snapshot replaces only that family.
