# ADR-0013 — Query-string state, no path routing

- Status: Accepted (Stage 1)
- Date: 2026-10-23

## Decision
Navigation state is mirrored to the query string (`m` module, `mo` month, `lad` GSS code, `view` overlay). Parsing is defensive (invalid values fall back to defaults); serialisation omits defaults and uses a stable order. Module, overlay and authority changes push history entries; month changes replace the current entry.

## Consequences
GitHub Pages needs no rewrite rules and every view is a shareable link. Back/forward work across modules (tested in Playwright).
