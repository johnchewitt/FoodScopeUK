# ADR-0001 — Static-first hosting with pipeline-built snapshots

- Status: Accepted (Stage 1)
- Date: 2026-10-23

## Context
The HMRC API allows 60 requests/minute and pages at 40,000 rows; browser CORS support is unverified. A public demo for government audiences needs reproducible, dated figures.

## Decision
Serve the app from GitHub Pages. A Python pipeline builds dated, checksummed snapshots and `public/data/manifest.json`. The browser never calls rate-limited government APIs.

## Consequences
Data latency equals pipeline cadence. Every figure is traceable to a snapshot. A live proxy is a Release 3 option only.
