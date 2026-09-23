# RUNBOOK — westpeek-live

Read this before changing anything. It is the file an AI employee (Porter in West Peek OS,
Danielle in Boss OS) reads at plan time; `scripts/validate_runbook.mjs` fails the build if the
paths and scripts named here stop existing.

## What this repo is
**West Peek Live!** — the virtual-event platform (public event pages, attendee venue, agency
production workspace). Partners call it "westpeek live", "west peek live", "the live site",
"West Peek Live!" or "the events platform". One Next.js App Router app at the repo root, built with
OpenNext into one Cloudflare **Worker** (not Pages):

| Thing | Where |
|---|---|
| Worker | `west-peek-live` — `wrangler.jsonc` (entry is the OpenNext build output, never committed) |
| Public host | https://westpeek.live (same app as https://west-peek-live.seq-taylor.workers.dev); production workspace at westpeek.live/app |
| Routes / pages | `app/` (e.g. `app/page.tsx` home, `app/venue/`, `app/events/`, `app/app/` workspace, `app/api/`) |
| UI components | `components/` (brand marks in `components/brand/`) |
| Domain logic | `lib/`, `services/`, `types/` |
| Database | Supabase; migrations in `db/migrations/` (readable history) mirrored byte-for-byte into `supabase/migrations/` (what production applies) |
| Worker secrets | `deployment/cloudflare-required-secrets.json`, `_env_contract.json` |
| Tests | `tests/unit/` (Vitest), `tests/e2e/` (Playwright) |

## Standing rules (from this repo's own docs and guards)
- **Client data never feeds West Peek.** westpeek.live form submissions belong to the event
  clients; they are excluded from the West Peek master network sheet (`excluded_not_ours`,
  Sequoia, 22 Sep 2026). Never wire a form here to the Network OS intake door.
- **Brand is locked**: `WEST_PEEK_BRAND_SYSTEM.md` is CANONICAL / LOCKED (palette, logo). Every
  rendered West Peek mark links home through `components/brand/WestPeekHomeLink.tsx`
  (guard `npm run validate:logo-home-links`; brand `npm run validate:brand`).
- **A migration only reaches production through `supabase/migrations/`** — the Supabase GitHub
  integration applies it on merge to `main`. Add the canonical file under `db/migrations/` AND its
  byte-identical mirror (guard `npm run validate:migration-mirror-parity`). Why, and what to do when
  it goes red: `docs/manual-notes/migration-assurance.md`.
- **Worker secret budget**: the required-secrets manifest stays at 60 or fewer
  (`npm run validate:worker-variable-budget`).
- **Never a bare `wrangler deploy` or plain `next build` + wrangler** — see
  `docs/runbooks/deployment-cloudflare.md`. Production deploys come from `main` only (below).
- **Validators are HARD FAIL or nothing** (`docs/ACTIVE_DOCS.md`); every new `validate:*` /
  `test*` / `audit*` package script needs a row in `_validator_admission_register.json`
  (`npm run validate:validator-admission`). A new root doc is listed in
  `DOCUMENTATION_AUTHORITY_INDEX.md` and `docs/DOCS_CONSOLIDATION_MAP.md`.
- **Merge law** (`AGENTS.md`): only on every required check green; never `--admin`, never force-push;
  a blocker that cannot go green on its own is a NAMED STOP.
- **Ask, don't decide**: brand/colour, copy meaning, legal wording (`npm run validate:legal-brand`),
  anything about money or client data. Structure, CSS, validators, redirects: decide and record.

## How to make a change
1. Branch `work/<slug>` off `origin/main` (a worktree is fine; symlink `node_modules`). Node 22 (`.nvmrc`).
2. Edit under `app/`, `components/`, `lib/`. New validator → `scripts/`, a package script, an
   admission row, and wire it into `npm run validate` (via `validate:v5-hard`).
3. Run exactly what CI runs:
   - `npm run validate:cloudflare-workflow-contract`
   - `npm run release:prepush:container` — route manifest, validator admission, no-secrets, then
     `npm run validate` (typecheck, lint, Vitest, `validate:v5-hard`, `validate:v7`,
     `validate:deploy-parity`), then `npm run validate:lifecycle-governance`,
     `npm run validate:ui-test-parity`, `npm run validate:browser-suite-contract`.
   Quick loop while editing: `npm run typecheck`, `npm run test`, the one guard you touched.
4. Look at it: `npm run dev`, screenshot desktop and 390px. The PR also gets a Workers Builds
   preview (version URL `https://<hash>-west-peek-live.seq-taylor.workers.dev`, posted as a PR comment).
5. Commit, push, open the PR with the change spelled out. CI (`.github/workflows/validation.yml`,
   plus `.github/workflows/supabase-migration-apply.yml`) takes about 2–3 minutes.
6. `~/bin/land <pr>` — verifies green, squash-merges, watches `main` to a terminal state.
7. Prove it live: the "Workers Builds: west-peek-live" check-run on the merge commit succeeded
   (`gh api repos/seq23/westpeek-live/commits/<sha>/check-runs`), then
   `curl -sI https://westpeek.live/` answers 200 and `SMOKE_BASE_URL=https://westpeek.live npm run postdeploy:smoke`
   prints PASS (it prints SKIP, not PASS, if the URL is unset — that is not proof). A migration
   also needs "Supabase Preview" green on the merge commit.

## How it deploys
Cloudflare **Workers Builds** (Git integration) builds and deploys `main` on every push; nothing
else to run. `.github/workflows/deploy-cloudflare-worker.yml` is a manual `workflow_dispatch`
fallback — do not dispatch it. Deeper procedure, rollback and postdeploy proof:
`TERMINAL_RELEASE_RUNBOOK.md`, `PREDEPLOY_POSTDEPLOY_RUNBOOK.md`,
`ROLLBACK_AND_CONTAINMENT_RUNBOOK.md`, `AUTONOMOUS_TERMINAL_RUNBOOK.md`, `docs/runbooks/postdeploy.md`,
`docs/runbooks/environment-setup.md`, `docs/runbooks/validation-operations.md`.

## Guards, and what each pins
| Script | Pins |
|---|---|
| `scripts/validate-cloudflare-workflow-contract.mjs` | the manual fallback deploy workflow keeps its timeout, gate, OpenNext build and smoke steps; `wrangler.jsonc` still targets the `west-peek-live` Worker |
| `scripts/validate-validator-admission.mjs` | every validation package script has an admission row |
| `scripts/validate-deployed-route-manifest.mjs` | every route in `config/deployed-route-manifest.json` is fully described, unique, and covers desktop + mobile |
| `scripts/validate_logo_home_links.js` | every rendered mark links home through the one home link |
| `scripts/validate_migration_mirror_parity.js` | each migration since 0023 has exactly one byte-identical `supabase/migrations/` mirror |
| `scripts/validate_worker_variable_budget.js` | Worker secrets stay under the per-Worker cap with headroom |
| `scripts/post_deploy_smoke_test.js` | public pages 200 with markers, protected pages redirect, video APIs fail safe |
| `scripts/validate_runbook.mjs` | this file names real paths and scripts |

Prove a new guard negatively before merging: plant the defect, watch it fail, remove it.
