# Terminal Release Runbook — Agency Event OS

Status: ACTIVE
Purpose: run the repo from source update through failure-harvesting validation, deploy/postdeploy, final provider proof, and evidence capture without hiding failures.

## Operating rule

Use one command at a time in Terminal Mode when applying updates or investigating failures. `npm run test:everything` is the aggregate failure-harvesting command: it continues after failures, writes per-command logs, writes a markdown/json report, and exits nonzero if anything fails or times out.

## Step 0 — repo identity

```bash
pwd
```

```bash
git rev-parse --show-toplevel
```

```bash
basename "$(git rev-parse --show-toplevel)"
```

```bash
git remote -v
```

```bash
git branch --show-current
```

```bash
git status --short
```

## Step 1 — apply baseline ZIP locally

Use the correct updater for this repo and confirm the dry-run/delete plan before applying. Do not run updater commands from the wrong directory.

## Step 2 — install dependencies

```bash
npm ci 2>&1 | tee logs/npm-ci.log
```

## Step 3 — run the aggregate failure-harvesting suite

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything
```

The report will be written under:

```text
logs/test-everything/<timestamp>/test-everything-report.md
logs/test-everything/<timestamp>/test-everything-report.json
```

Send the markdown report and any failed command logs back for repair.

## Step 4 — tier-specific runs

Tier 1: static/source/governance only.

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything:tier1
```

Tier 2: local build/browser/self-spawn proof.

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything:tier2
```

Tier 3: deployed-safe postdeploy gate. It proves deployed runtime and safe provider boundaries, not real live provider operations. Tier 4: final live-provider gate using real credentials, provider evidence, operator confirmation, cleanup, and no-secret evidence scan.

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything:tier3
```

## Step 5 — deploy

Deploy only after Tier 1/Tier 2 are clean or after failures are intentionally accepted as not release-blocking by owner. Use the repo's deployment runbook and capture the deployment URL, commit SHA, and workflow run ID.

## Step 6 — GitHub Actions

```bash
gh run list --limit 20
```

If a run fails:

```bash
gh run view <RUN_ID> --log-failed
```

## Step 7 — postdeploy

Run the grouped Tier 3 postdeploy command against the fresh deployment URL. Do not run piecemeal postdeploy commands unless this grouped command fails. Do not rely on localhost defaults.

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
SMOKE_BASE_URL="https://<fresh-deployment-url>" \
npm run postdeploy:full
```

## Step 8 — deployed postdeploy proof

Run Tier 3 after deploy with an explicit deployed URL. This proves deployed-safe postdeploy behavior only.

## Step 9 — final live-provider proof

Run Tier 4 with restored local env, real provider credentials, provider accounts, automated controlled RTMP proof, cleanup/no-secret evidence review, and generated Tier 4 reports in place. The result is not COMPLETE unless Tier 4 passes or every blocked provider lane is explicitly owner-accepted as out of scope.

Preferred automated lane:

```bash
npm run env:run -- -- bash -lc 'set -a; . ./.env.local; set +a; POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" SMOKE_BASE_URL="https://<fresh-deployment-url>" TIER4_CONTROLLED_RTMP_BROADCASTER=1 TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 TIER4_RESEND_SEND_APPROVED=1 NODE_OPTIONS="--max-old-space-size=3072" npm run tier4:auto-controlled-livekit-proof'
```

## Step 9 — cleanup

```bash
git status --short
```

Confirm no real env files, generated artifacts, Playwright reports, logs with secrets, or raw provider data are staged. Logs may be shared only after secret review.

## Step 10 — repair loop

If `npm run test:everything` fails, do not rerun random commands. Send back:

1. `logs/test-everything/<timestamp>/test-everything-report.md`
2. the failed per-command log files listed in the report
3. the repo commit SHA and deployment URL if deployed

Then patch exact failures and redeliver a full baseline ZIP.
---

# Temporary Env Test-Everything Wrapper
# Terminal Release Runbook — Test Everything With Temporary Env

Status: ACTIVE  
Purpose: run the deepest available local, deployed, postdeploy, and real-provider proof sequence without leaving `.env.local` in the repo.

## Core rule

Use `test:everything:*:with-env` when a test lane needs local secrets or provider credentials.

The wrapper restores `.env.local` from the repo-approved encrypted vault, runs the command, and removes `.env.local` again if the wrapper created it. Secret values are never printed.

If `.env.local` already exists, the wrapper refuses to run unless `--allow-existing` is provided. This prevents accidental overwrite or accidental deletion of an operator-created env file.

## Predeploy — maximum local proof

Run this before deploy:

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything:tier2:with-env
```

Expected behavior:

- Runs Tier 1 static/source checks.
- Runs Tier 2 local build/browser/self-spawn checks.
- Collects all failures before exiting.
- Writes reports under `logs/test-everything/<timestamp>/`.
- Removes `.env.local` after the command if the wrapper created it.

## Deploy / postdeploy / real-provider final gate

After updater, commit, push, runtime secret sync, and fresh deploy, set the deployed URLs and run:

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
NODE_OPTIONS="--max-old-space-size=3072" \
npm run test:everything:tier3:with-env
```

Expected behavior:

- Runs the final release tier.
- Includes deployed/postdeploy proof.
- Includes real-provider lanes when the repo declares providers.
- Fails loudly when provider proof inputs, OAuth, deployed URL, provider secrets, or operator evidence are missing.
- Writes full failure logs for repair.
- Removes `.env.local` after the command if the wrapper created it.

## Full harvest — everything available

Use this when you want one large report with every admitted command:

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything:with-env
```

## Failure handoff back to Juniper

Send back:

1. `logs/test-everything/<timestamp>/test-everything-report.md`
2. `logs/test-everything/<timestamp>/test-everything-report.json`
3. Any failed command logs in the same folder
4. The fresh deploy URL if Tier 3 was run

## Cleanup check before commit

```bash
git status --short
```

Expected: `.env.local` is absent and not staged.

If `.env.local` remains, run:

```bash
npm run env:remove
```

## Completion rule

Passing Tier 1 or Tier 2 is not COMPLETE for provider-backed repos. Passing Tier 3 is deployed-safe proof only. COMPLETE requires Tier 4 live-provider operational proof or an explicitly accepted BLOCKED/NOT APPLICABLE lane.

## Agency Event OS local env restore policy

Real secret values are intentionally not stored inside baseline ZIP artifacts. Use `npm run env:restore` or any `*:with-env` command to restore `.env.local` from an approved local-only private source. See `ENV_RESTORE_POLICY.md`.

Supported private source locations:

- `AGENCY_EVENT_OS_ENV_GPG_PATH=/absolute/path/to/agency-event-os.env.local.gpg`
- `AGENCY_EVENT_OS_ENV_LOCAL_PATH=/absolute/path/to/.env.local.backup`
- `AGENCY_EVENT_OS_ENV_BACKUP=/absolute/path/to/.env.local.backup`
- `~/.config/agency-event-os/agency-event-os.env.local.gpg`
- `~/agency-event-os.env.local.gpg`
- `~/agency-event-os.env.local.backup`

Do not commit `.env.local`.

## Tier 3 deployed/provider prerequisite repair — 2026-06-11

Tier 3 and Tier 4 validators now distinguish repo/app failures from unavailable external proof.

- Postdeploy checks require an explicit non-local deployed base URL (`POSTDEPLOY_BASE_URL`, `SMOKE_BASE_URL`, `PLAYWRIGHT_BASE_URL`, or `NEXT_PUBLIC_APP_URL`).
- Real StreamYard/LiveKit proof lives in Tier 4 and requires a deployed base URL, real provider credentials, operator confirmation, and a redacted evidence JSON path.
- Missing Tier 3 prerequisites are reported as `BLOCKED`, not as app failures or false passes.
- Once prerequisites are supplied, failed commands remain hard blockers.

## LiveKit Twirp URL Contract — 2026-06-12

- Validator: `npm run validate:livekit-twirp-url-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: prevent both deployed app code and Tier 4 proof harnesses from using a `wss://` LiveKit client URL for server-side Twirp `fetch()` calls.
- Required trace: Tier 4 controlled proof reports classify failures as harness/env/provider/deployed-app failures and retain sanitized phase trace.


## Tier 4 cleanup command

If LiveKit reports ingress quota exhaustion, delete stale Tier 4 ingress objects before another Tier 4 attempt:

```bash
npm run env:run -- -- bash -lc 'set -a; . ./.env.local; set +a; TIER4_LIVEKIT_CLEANUP_APPROVED=1 npm run tier4:cleanup-livekit-ingress'
```

For explicit ids:

```bash
npm run env:run -- -- bash -lc 'set -a; . ./.env.local; set +a; TIER4_LIVEKIT_CLEANUP_APPROVED=1 TIER4_LIVEKIT_CLEANUP_INGRESS_IDS="IN_x,IN_y" npm run tier4:cleanup-livekit-ingress'
```

The normal `tier4:auto-controlled-livekit-proof` command auto-deletes its LiveKit ingress after proof capture. Retention requires `TIER4_CONTROLLED_RTMP_RETAIN_INGRESS=1` and `TIER4_CONTROLLED_RTMP_RETAIN_REASON`.
