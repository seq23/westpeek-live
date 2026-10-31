# CLAUDE.md — westpeek-live

Read these before changing anything:

1. `RUNBOOK.md` — what this repo is, standing rules, how to make, test, merge and deploy a change.
2. `docs/SETUP_AND_ACCOUNTS.md` — the outside accounts, domains/DNS, integrations and every secret
   name (never values), plus rollback.
3. `docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md` — how to run an event, for each role. The app renders it
   at `/manual`; after editing it (or `docs/images/manual/`), run `node scripts/build_manual_assets.js`
   and commit the regenerated `lib/manual/manualSource.generated.ts` and `public/manual/images/`.
4. `docs/README.md` — the doc map: what is current, what is history in `docs/archive/`.

Rules that bite:
- Many root docs are read by validators in `scripts/`. Before moving or renaming a doc, grep `scripts/`
  and the root `_*.json` contracts for its file name. A new or moved `.md` needs a row in
  `docs/DOCS_CONSOLIDATION_MAP.md` (active) or `docs/archive/ARCHIVE_INDEX.md` (archived).
- Screenshots in the manual come from a local production build on demo data, never from production.
- The repo is public: no client names, no secret values, no access codes in any doc.
