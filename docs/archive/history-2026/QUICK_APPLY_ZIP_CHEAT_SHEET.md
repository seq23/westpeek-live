# Agency Event OS — Quick Apply ZIP Cheat Sheet

This file exists so the next repo update does not turn into a terminal maze.

## Repo identity

- Repo name: `agency-event-os`
- GitHub remote: `https://github.com/seq23/agency-event-os.git`
- Branch: `main`
- Apply mode: `snapshot`
- Local repo path: `/Users/sequoiataylor/Documents/GitHub/agency-event-os`
- Updater: `~/update_repo_from_zip_generic_v3_1.sh`
- Required Node lane: **Node 22**
- Package manager: `npm` with `package-lock.json`

## What this ZIP fixes

This ZIP includes quick-apply guardrails and validator fixes for the June 24, 2026 local updater failures:

1. `package-lock.json` points to public `registry.npmjs.org`, not the internal OpenAI/CAAS npm mirror.
2. `.nvmrc` pins the repo to Node 22.
3. `.npmrc` forces public npm registry and disables audit/fund/progress noise during install.
4. `scripts/diagnose_zip_apply.mjs` checks the local install lane before another updater attempt.
5. Local Playwright auth ignores placeholder `.env.local` values such as `REPLACE_WITH_LOCAL_SECRET` and falls back to registry Day 1 defaults.
6. Operator, crew, and owner gates use server actions for local browser validation cookie reliability.
7. Attendee live / My Agenda copy now exposes the proof phrases required by the E2E contracts.
8. Client `/reports` route is present and maps to the client portal dashboard.
9. Local visual proof disables Playwright video capture, runs desktop and mobile serially, and uses a 90-second per-test timeout to absorb local Next dev cold-compilation on slower machines.
10. Local visual proof prints a deterministic recovery report with isolated failed-test commands and commit/push instructions when harness restart or timeout signals appear.

## Exact apply command

Download this ZIP to `~/Downloads`, then run:

```bash
cd "/Users/sequoiataylor/Documents/GitHub/agency-event-os"
PATH="/opt/homebrew/opt/node@22/bin:$PATH" NODE_OPTIONS="--max-old-space-size=4096 --dns-result-order=ipv4first" NPM_CONFIG_REGISTRY="https://registry.npmjs.org/" NPM_CONFIG_ENGINE_STRICT=false NPM_CONFIG_AUDIT=false NPM_CONFIG_FUND=false NPM_CONFIG_PROGRESS=false NPM_CONFIG_MAXSOCKETS=2 NPM_CONFIG_FETCH_RETRIES=1 NPM_CONFIG_FETCH_TIMEOUT=60000 ALLOW_LARGE_DELETE=1 ~/update_repo_from_zip_generic_v3_1.sh "$HOME/Downloads/agency-event-os-main_BASELINE_06-24-26_a6d8e2f1.zip" "/Users/sequoiataylor/Documents/GitHub/agency-event-os" snapshot "agency-event-os"
```

## Clean recovery before applying again

If a prior updater run failed and left the working tree dirty, use the rollback tag printed by the updater. Example:

```bash
cd "/Users/sequoiataylor/Documents/GitHub/agency-event-os"
git reset --hard repo_pre_update_YYYYMMDDTHHMMSSZ_XXXXX
git clean -fd
git status --short
```

Only continue when `git status --short` is empty, unless you intentionally have local files to preserve.

## One-time Node 22 setup

Do not `brew link` unless you intentionally want Node 22 as your global default. This repo only needs Node 22 for the current terminal session.

```bash
brew list node@22 >/dev/null 2>&1 || brew install node@22
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
hash -r
node -v && npm -v && which node && which npm
```

Expected Node output starts with:

```text
v22.
```

## Preflight check before updater

After the ZIP is applied or after manually inspecting the repo, run:

```bash
cd "/Users/sequoiataylor/Documents/GitHub/agency-event-os"
PATH="/opt/homebrew/opt/node@22/bin:$PATH" node scripts/diagnose_zip_apply.mjs
```

Expected result:

```text
RESULT: READY — run the quick-apply updater command from QUICK_APPLY_ZIP_CHEAT_SHEET.md.
```

## Watch-outs from the June 24 failure

| Symptom | Meaning | Action |
|---|---|---|
| `EBADENGINE required node >=22` | Wrong Node version | Use Node 22 with `export PATH="/opt/homebrew/opt/node@22/bin:$PATH"` |
| Deprecated package warnings | Usually not fatal | Do not stop for these alone |
| `package-lock.json` contains `packages.applied-caas...` | Lockfile points to an internal mirror your Mac cannot use reliably | Use this fixed ZIP; do not use the old 06-15 ZIP |
| Updater gets past `npm ci` then fails browser proof | Code or E2E contract issue, not package install | Preserve evidence folder and fix only the named failing validator/test |
| Operator login redirects to `?error=launchpad_required` | Access cookie was not accepted by protected launchpad | This ZIP routes local operator/crew/owner gates through server actions and ignores placeholder local env values |
| Crew login stays on `/production-access/crew?next=...` | Crew access cookie was not accepted by protected crew route | This ZIP routes crew gate through server actions and uses registry defaults when `.env.local` has placeholders |
| Client `/reports` route returns 404 | Missing plural reports route | This ZIP adds `/client/[clientSlug]/events/[eventId]/reports` |
| Attendee stage proof says missing `Register to request`, `approval`, `camera`, `microphone`, or `revoke` | Copy contract drift | This ZIP updates attendee live copy and My Agenda signed-out copy |
| `ERR_INCOMPLETE_CHUNKED_ENCODING` / `ERR_CONNECTION_REFUSED` / `Test timeout of 30000ms exceeded` during long headed Playwright suite | Next dev server memory restart or cold route compilation during full visual proof | This ZIP disables Playwright video capture, runs desktop/mobile serially, raises Node heap, and hardens local visual proof to `--timeout=90000` |
| Huge delete count or wrong repo path | Possibly wrong repo root | Stop; verify `pwd`, `git rev-parse --show-toplevel`, remote, and branch |
| `No such file or directory` for ZIP | ZIP is not in Downloads or filename differs | `ls -lah "$HOME/Downloads" | grep agency-event-os` |
| `update_repo_from_zip_generic_v3_1.sh` missing | Updater not installed at expected path | `ls -lah ~/update_repo_from_zip_generic_v3_1.sh` |
| Postdeploy failure | Local update may be applied, but deployed site is not proven | Run the repo postdeploy runbook after deployment |


## Local visual-proof harness failure recovery

This repo now treats long headed Playwright failures deterministically. The updater still blocks on browser-proof failure, but `npm run release:local-visual-proof` no longer leaves the operator guessing.

When desktop or mobile visual proof fails, the script writes and prints:

```text
reports/local-visual-proof-recovery.md
```

That report includes:

1. A classification: product defect possible vs. local harness / Next dev restart / timeout suspected.
2. The exact isolated Playwright command for the failed spec only, not the whole passing suite.
3. Commit/push commands to use only after the failed isolated test passes.

### Harness failure signals

If the full suite output includes any of these, do not assume the app is broken:

- `Server is approaching the used memory threshold, restarting`
- `ERR_CONNECTION_REFUSED`
- `ERR_ABORTED`
- `ERR_EMPTY_RESPONSE`
- `ERR_INCOMPLETE_CHUNKED_ENCODING`
- `maybe frame was detached`
- `Test timeout`
- route logs show HTTP `200` before Playwright times out

These usually mean the local Next dev server restarted or cold-compiled too slowly during a long headed browser run.

### Required decision path after a harness-looking failure

If the recovery report lists many passing tests, the recovery parser is wrong and the artifact should be fixed before reuse. The expected report should list only the failed spec file, for example `tests/e2e/visitor-full-journey.spec.ts`.

Do not reset first. Run the isolated command printed in `reports/local-visual-proof-recovery.md`.

If the isolated command passes and the same updater run already passed the non-browser gates, commit and push the preserved updater-applied working tree:

```bash
cd "/Users/sequoiataylor/Documents/GitHub/agency-event-os"
git status --short
git add -A
git commit -m "snapshot update from baseline ZIP"
git push origin main
```

If the isolated command fails again with the same assertion or route behavior, do not push. Fix the product defect and deliver a new full baseline ZIP.

## If it looks stuck at `npm ci`

Open a second terminal and run:

```bash
ps -axo pid,ppid,etime,stat,%cpu,%mem,command | grep -E 'update_repo_from_zip|npm|node|next|playwright' | grep -v grep
```

If npm is alive but idle for several minutes, inspect the latest evidence folder:

```bash
ls -td "$HOME"/repo_update_logs/agency-event-os_* | head -n 3
for f in "$(ls -td "$HOME"/repo_update_logs/agency-event-os_* | head -n 1)"/*; do echo "----- $f"; tail -n 40 "$f"; done
```

## Do not confuse these

- Local updater pass does **not** prove `https://westpeek.live` is deployed.
- Mock provider tests do **not** prove live StreamYard/LiveKit/Daily provider behavior.
- Screenshots do **not** prove expert review.
- A dirty tree after failure is expected until you reset to the printed rollback tag.

## Evidence folder rule

Every updater run prints an evidence path like:

```text
Evidence: /Users/sequoiataylor/repo_update_logs/agency-event-os_YYYYMMDDTHHMMSSZ_XXXXX
```

Keep that folder. It is the source of truth for the failure stage.


## TYPECHECK SECRET FALLBACK WATCH

If `npm run typecheck` fails with `string | undefined` for `V5_ACCESS_COOKIE_SECRET` or `LIVEKIT_WEBHOOK_SECRET`, do not rerun the updater blindly. The artifact must ensure all local Playwright helper secret resolvers return concrete strings after filtering placeholder `.env.local` values. This ZIP pins those helper return types to `string`.

If headed Playwright fails with `Test timeout of 30000ms exceeded` after the route logs show HTTP 200 responses, classify it as a local visual-proof timeout policy issue before changing app logic. This ZIP sets `release:local-visual-proof` to `--timeout=90000` for both desktop and mobile projects while keeping all tests enabled.
