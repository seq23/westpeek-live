# REPOSITORY UPDATE AND RELEASE LIFECYCLE

**Repo:** `westpeek-live` (package name `agency-event-os`)
**Status:** ACTIVE / OPERATOR ENTRY POINT
**Purpose:** One map for making a change, shipping it and closing the release lifecycle.
**Updated:** 31 Oct 2026. Baseline ZIPs and the ZIP updater are retired: every change is a pull
request, merged and deployed by `land`. The June 2026 ZIP-era version of this page, the terminal
runbook and the baseline checklist are history in `docs/archive/history-2026/`.

## 1. Product lane

- Audit model: **public + authenticated + role-specific**.
- Source of truth: `main` on GitHub and the repo-local `_repo_update_contract.json`.
- `RUNBOOK.md` is the plan-time page; this file is the release map.

## 2. Change-time lifecycle

1. Work on a branch (or a worktree) cut from `origin/main`.
2. Run `npm run release:validate:container` — the same fast gate CI runs (structural validators,
   typecheck, lint, unit tests on a real D1).
3. Run `npm run release:self-heal` when a generated file or manifest is behind.
4. Run `npm run release:hallmark` for UI work. Hallmark is mandatory before a UI change deploys.
5. Run `npm run release:prepush` (it routes to the container or local lane).
6. Push and open a PR. `Repository validation` must be green.
7. `land <pr>` — verifies green, merges, watches `main`; the deploy workflow then applies D1
   migrations and deploys the Worker from that exact commit.
8. Run `npm run release:close-lifecycle` when a release needs live proof and cleanup.

## 3. One-command lifecycle closure

`npm run release:close-lifecycle` executes this repo-specific sequence:

1. `npm run release:postpush`
2. `npm run postdeploy:full`
3. `npm run release:cleanup`
4. `npm run release:postpush`
5. `npm run release:report`

The orchestrator:

- writes logs and `summary.json` under `artifacts/diagnostics/lifecycle-close/<run-id>/`;
- uses one proof-run identifier across proof and cleanup;
- attempts exact cleanup even when a prior live-proof stage fails;
- does not run a post-cleanup audit unless cleanup passed;
- always attempts the final proof report;
- exits nonzero if any required stage fails.

Validate wiring without touching production:

`npm run release:close-lifecycle:dry-run`

## 4. Completion boundary

`release:close-lifecycle` is a deployed/live command. It requires the repo's real deployed URL, provider inputs, and session state where applicable. A dry run proves wiring only. `COMPLETE` still requires the generated final proof matrix to contain no unproven applicable lane.

## 5. Operator lookup

- Plan-time page and merge/deploy steps: `RUNBOOK.md`
- Machine-readable lifecycle: `_repo_update_contract.json`
- Validator severity/admission: `_repo_validation_matrix.json`
- Documentation authority: `DOCUMENTATION_AUTHORITY_INDEX.md`
- Suite lifecycle contract: `docs/runbooks/SUITE_RELEASE_LIFECYCLE_CONTRACT.md`
- This lifecycle entry point: `REPO_UPDATE_LIFECYCLE.md`

## Canonical West Peek brand authority

- [`WEST_PEEK_BRAND_SYSTEM.md`](WEST_PEEK_BRAND_SYSTEM.md) — locked cross-suite visual system and Hallmark acceptance criteria.

## Cloudflare Worker workflow

`.github/workflows/deploy-cloudflare-worker.yml` is the bounded production deployment lane. It runs on green `main`, applies D1 migrations before deploying, and uses concurrency cancellation, a 45-minute job ceiling, bounded dependency/build/deploy/smoke commands, explicit credential gates, and deployable-output checks so a stuck OpenNext or Wrangler process cannot run indefinitely.
