# ADR-0016 — HMRC ingest runs on GitHub Actions; raw responses are committed

- Status: Accepted (Stage 2)
- Date: 2026-10-23

## Context
The trade snapshot must come from the HMRC Overseas Trade Statistics API (S01), reproducibly. The browser must not call rate-limited government APIs (CLAUDE.md), and the development sandbox's proxy refuses `api.uktradeinfo.com`.

## Decision
- The pipeline has an online step (`ingest-hmrc`) and an offline step (`build-trade`). Only the online step talks to HMRC.
- The online step runs in `.github/workflows/refresh-trade-data.yml` on GitHub-hosted runners: on push to `data-refresh/**` it commits back to that branch; a manual run creates `data-refresh/<snapshot>` and opens a pull request. Data reaches `main` only by PR.
- Every HMRC response is committed, gzip-compressed deterministically, under `pipeline/raw/hmrc/<snapshot>/` with an index of URL, retrieval time, SHA-256, byte count and item count (196 KB for the 23 Oct 2026 snapshot). The offline build and the real-data tests read only this cache, so anyone can rebuild and audit the snapshot without network access, and a rebuild is byte-identical.
- The build reconciles the server-side `$apply` aggregation with raw rows for one month per basket and fails on any difference.

## Consequences
Raw responses grow the repository by roughly 0.2 MB per snapshot; old snapshots can be pruned once superseded (keep the latest and the one in production). Refreshes need a GitHub run (≈ 2 minutes), not local network access.
