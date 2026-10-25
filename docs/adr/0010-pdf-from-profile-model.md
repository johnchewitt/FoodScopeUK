# ADR-0010 — PDF built from the profile model

- Status: Proposed (Stage 8; renumbered from 7 on 25 Oct 2026)
- Date: 2026-10-23

## Decision (proposed)
Generate profile PDFs programmatically (jsPDF) from the same `ProfileModel` object the screen renders, with a SHA-256 of the model in the footer, so exported figures match the screen exactly.
