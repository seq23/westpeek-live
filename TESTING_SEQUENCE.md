# Testing Sequence — agency-event-os

Status: ACTIVE
Date: 2026-06-12

## Canonical release command map

Use this map before splitting into smaller commands. Split only when a grouped command fails and the failure must be isolated.

```bash
# PRE-DEPLOY SOURCE/REPO PROOF
npm run validate

# POST-DEPLOY TIER 3 LIVE-RUNTIME PROOF
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
SMOKE_BASE_URL="https://<fresh-deployment-url>" \
npm run postdeploy:full

# TIER 4 AUTOMATED LIVE-PROVIDER PROOF
npm run env:run -- -- bash -lc 'set -a; . ./.env.local; set +a; POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" SMOKE_BASE_URL="https://<fresh-deployment-url>" TIER4_CONTROLLED_RTMP_BROADCASTER=1 TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 TIER4_RESEND_SEND_APPROVED=1 NODE_OPTIONS="--max-old-space-size=3072" npm run tier4:auto-controlled-livekit-proof'
```

Meaning:

- `npm run validate` is the pre-deploy Tier 1-3 source/repo gate: typecheck, lint, unit tests, hard validation, route/UX/operator rules, and deploy-parity/static runtime contracts.
- `npm run postdeploy:full` is the grouped Tier 3 deployed-safe gate: live smoke, click audit, role flow, video-provider audit, and deployed browser checks.
- `tier4:auto-controlled-livekit-proof` is the final live-provider gate: restores temporary env, uses controlled RTMP through the deployed LiveKit ingress path, creates redacted evidence, runs provider journey proof, and runs the final Tier 4 proof.

Do not run the older piecemeal postdeploy sequence unless `postdeploy:full` fails. Do not claim Tier 4 COMPLETE from `postdeploy:full`; Tier 4 requires provider proof.

## Tier 1 — Static/source

Run source-level validation only. Do not claim browser/deploy/provider proof.

```bash
npm run validate:final-tier-contract
npm run validate:tier4-contract
npm run validate:everything -- --tier=1
```

## Tier 2 — Local runtime/browser

Run local build and browser/self-spawn proof. Do not claim deployed/provider proof.

```bash
npm run validate:everything -- --tier=2
```

If headed browser review is supported, run the repo's headed gauntlet command from `package.json`.

## Tier 3 — Deployed postdeploy critical proof / safe provider boundary

Tier 3 must use explicit deployed URLs. It proves the deployed app survives public/access/venue/provider routes and fails safely without leaking secrets. It does not prove real live provider operations.

Primary grouped postdeploy command:

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
SMOKE_BASE_URL="https://<fresh-deployment-url>" \
npm run postdeploy:full
```

Optional aggregate validator when harvesting all tiered failures:

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
NODE_OPTIONS="--max-old-space-size=3072" \
npm run validate:everything -- --tier=3
```

Required inputs:

- POSTDEPLOY_BASE_URL or SMOKE_BASE_URL
- PLAYWRIGHT_BASE_URL or NEXT_PUBLIC_APP_URL

## Tier 4 — Final live-provider operational proof

Tier 4 must prove the real credential-dependent lanes that Tier 3 intentionally does not prove.

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 \
STREAMYARD_REAL_PROVIDER_SMOKE=1 \
STREAMYARD_OPERATOR_CONFIRMED_BROADCAST=1 \
TIER4_STREAMYARD_LIVE_EVIDENCE_PATH="reports/tier4/streamyard-livekit-evidence.json" \
NODE_OPTIONS="--max-old-space-size=3072" \
npm run validate:everything -- --tier=4
```


Automated controlled RTMP proof (no StreamYard UI required when ffmpeg is available):

```bash
npm run env:run -- -- bash -lc 'set -a; . ./.env.local; set +a; POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" SMOKE_BASE_URL="https://<fresh-deployment-url>" TIER4_CONTROLLED_RTMP_BROADCASTER=1 TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 TIER4_RESEND_SEND_APPROVED=1 NODE_OPTIONS="--max-old-space-size=3072" npm run tier4:auto-controlled-livekit-proof'
```

This lane creates/observes the deployed LiveKit ingress, pushes synthetic audio/video through the same RTMP ingest surface a StreamYard Custom RTMP destination uses, writes a redacted evidence JSON, runs the real provider journey probe, then runs the Tier 4 live-provider proof command. It uses `env:run` so `.env.local` is restored only for the command and removed afterward. It requires local ffmpeg (`TIER4_FFMPEG_BIN` may override the binary path). It does not store RTMP URLs, stream keys, API keys, bearer tokens, cookies, service-role keys, webhook secrets, or raw recipient PII.

Focused live-provider proof:

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 \
STREAMYARD_REAL_PROVIDER_SMOKE=1 \
STREAMYARD_OPERATOR_CONFIRMED_BROADCAST=1 \
TIER4_STREAMYARD_LIVE_EVIDENCE_PATH="reports/tier4/streamyard-livekit-evidence.json" \
NODE_OPTIONS="--max-old-space-size=3072" \
npm run tier4:live-provider-operational-proof
```

Required Tier 4 inputs:

- Deployed base URL
- TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1
- STREAMYARD_REAL_PROVIDER_SMOKE=1
- STREAMYARD_OPERATOR_CONFIRMED_BROADCAST=1
- TIER4_STREAMYARD_LIVE_EVIDENCE_PATH
- LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WEBHOOK_SECRET
- Supabase envs when production persistence lane is enabled
- Daily / Zoom / Resend envs when those lanes are enabled

## Failure handling

1. Classify the failure context.
2. Inspect logs/traces/provider evidence.
3. Compare runtime context parity.
4. Patch source of truth.
5. Rerun smallest proof.
6. Rerun Tier 3 for deployed-safe proof.
7. Rerun Tier 4 for final live-provider proof when COMPLETE is claimed.
8. Clean generated artifacts.
9. Push the branch, open a PR, and merge it with `land <pr>` (baseline ZIPs are retired, 31 Oct 2026).

## Completion boundary

Tier 1 + Tier 2 without Tier 3 = PARTIAL.
Tier 3 without Tier 4 = DEPLOYED SAFE POSTDEPLOY PROOF ONLY.
Tier 4 with any provider lane unproven = BLOCKED/PARTIAL.
Tier 4 with all required provider lanes passed = eligible for COMPLETE, assuming artifact and GitHub/deploy evidence also pass.

## Aggregate failure-harvesting command

Use this command when the goal is to collect every failure before patching:

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything
```

The command writes one report and per-command logs under `logs/test-everything/<timestamp>/`. Do not call a repo COMPLETE from this command alone unless the final Tier 4 provider/deploy evidence also passes.

The release sequence is a PR, then `land <pr>` (see `RUNBOOK.md`); the June 2026 terminal runbook is history in `docs/archive/history-2026/TERMINAL_RELEASE_RUNBOOK.md`.

## Temporary `.env.local` wrapper sequence

For any local command that needs provider secrets, run the `:with-env` variant. The wrapper restores `.env.local` from the repo-approved encrypted vault, runs the test command, and removes `.env.local` again when it created the file.

Predeploy local proof:

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything:tier2:with-env
```

Postdeploy deployed-safe proof:

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
NODE_OPTIONS="--max-old-space-size=3072" \
npm run test:everything:tier3:with-env
```

Final live-provider proof:

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 \
STREAMYARD_REAL_PROVIDER_SMOKE=1 \
STREAMYARD_OPERATOR_CONFIRMED_BROADCAST=1 \
TIER4_STREAMYARD_LIVE_EVIDENCE_PATH="reports/tier4/streamyard-livekit-evidence.json" \
NODE_OPTIONS="--max-old-space-size=3072" \
npm run test:everything:tier4:with-env
```

Full failure harvest:

```bash
NODE_OPTIONS="--max-old-space-size=3072" npm run test:everything:with-env
```

The final Tier 4 command must fail or block if required deployed/provider proof inputs are absent. Do not mark COMPLETE from Tier 1/Tier 2/Tier 3 alone.

## Agency Event OS local env restore policy

Real secret values are intentionally never committed to the repository. Use `npm run env:restore` or any `*:with-env` command to restore `.env.local` from an approved local-only private source. See `ENV_RESTORE_POLICY.md`.

Supported private source locations:

- `AGENCY_EVENT_OS_ENV_GPG_PATH=/absolute/path/to/agency-event-os.env.local.gpg`
- `AGENCY_EVENT_OS_ENV_LOCAL_PATH=/absolute/path/to/.env.local.backup`
- `AGENCY_EVENT_OS_ENV_BACKUP=/absolute/path/to/.env.local.backup`
- `~/.config/agency-event-os/agency-event-os.env.local.gpg`
- `~/agency-event-os.env.local.gpg`
- `~/agency-event-os.env.local.backup`

Do not commit `.env.local`.

## LiveKit Twirp URL Contract — 2026-06-12

- Validator: `npm run validate:livekit-twirp-url-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: prevent both deployed app code and Tier 4 proof harnesses from using a `wss://` LiveKit client URL for server-side Twirp `fetch()` calls.
- Required trace: Tier 4 controlled proof reports classify failures as harness/env/provider/deployed-app failures and retain sanitized phase trace.


## Tier 4 LiveKit Ingress Cleanup Lane

Controlled Tier 4 proof now auto-deletes its LiveKit ingress after the provider/media proof is captured. The normal command remains:

```bash
npm run env:run -- -- bash -lc 'set -a; . ./.env.local; set +a; POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" SMOKE_BASE_URL="https://<fresh-deployment-url>" TIER4_CONTROLLED_RTMP_BROADCASTER=1 TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 TIER4_RESEND_SEND_APPROVED=1 NODE_OPTIONS="--max-old-space-size=3072" npm run tier4:auto-controlled-livekit-proof'
```

The auto proof must write cleanup evidence:

- `cleanupStatus: deleted`
- `cleanupAttempted: true`
- `cleanupDeleted: true`
- `tier4DataTrace` entries for `livekit_ingress_cleanup_start` and `livekit_ingress_cleanup_result`

If an ingress must be retained, it is not allowed as a silent default. The operator must set `TIER4_CONTROLLED_RTMP_RETAIN_INGRESS=1` and provide `TIER4_CONTROLLED_RTMP_RETAIN_REASON`.

If provider quota is already exhausted by stale Tier 4 ingress objects, run the cleanup utility before re-running Tier 4:

```bash
npm run env:run -- -- bash -lc 'set -a; . ./.env.local; set +a; TIER4_LIVEKIT_CLEANUP_APPROVED=1 npm run tier4:cleanup-livekit-ingress'
```

The cleanup utility deletes only safe Tier 4 auto ingress objects by default. To delete specific ingress ids, use `TIER4_LIVEKIT_CLEANUP_INGRESS_IDS="IN_x,IN_y"` with `TIER4_LIVEKIT_CLEANUP_APPROVED=1`.

## Tier 4 Expanded Provider Ladder Data Trace — 2026-06-12

Tier 4 is not only StreamYard/LiveKit. The live-provider proof must trace the full production fallback ladder:

1. LiveKit-only deployed app ingress creation and cleanup via `Ingress/DeleteIngress`.
2. StreamYard-compatible controlled RTMP path through LiveKit ingress, with cleanup.
3. Daily fallback room creation, token issuance, and mandatory room deletion.
4. Zoom fallback authorization proof through the deployed signature route; no provider resource is created, so cleanup status must be `not_required_stateless_signature`.
5. Google Meet manual continuity proof through `GOOGLE_MEET_MANAGED_FALLBACK_URL` or `GOOGLE_MEET_EMERGENCY_URL`; if intentionally out of scope, `TIER4_GOOGLE_MEET_NOT_APPLICABLE_REASON` must be explicit.

A Tier 4 report that omits Daily, Zoom, or Google Meet is incomplete for this product promise. Cleanup must be machine-readable, not narrative-only.


## Tier 4 fallback ladder expansion — 2026-06-12

Show-day ladder order is now explicit and must be exercised in Tier 4:

1. StreamYard-compatible Custom RTMP path into LiveKit, proven by controlled ffmpeg RTMP broadcaster. StreamYard itself remains a manual/operator provider because automated StreamYard API access is enterprise-only.
2. LiveKit + Cloudflare Stream Live fallback, proven through the Cloudflare Stream Live Inputs API, controlled RTMP media push, and live input cleanup.
3. Daily real fallback provider, proven by room create, meeting token create, and room delete cleanup. Daily API keys are normalized so pasted `Bearer ...` values do not create `Bearer Bearer ...` authentication failures; a 401 after normalization is a real Daily key/domain/provider auth failure.
4. Zoom fallback, proven by denied unauthenticated access and authorized SDK signature generation; no provider cleanup is required because the proof is stateless.
5. Google Meet fallback, proven by valid HTTPS Meet continuity URL or explicit not-applicable disposition; no provider cleanup is required because it is a manual/static continuity link.

Tier 4 must attempt every configured rung and fail only after the full ladder trace is written.

## Tier 4 Attendee Live Consumption Gauntlet — HARD FAIL

Command: `npm run tier4:attendee-live-consumption-gauntlet`

This lane proves the end-user outcome spine for live events. It must run after controlled RTMP media has been pushed into the StreamYard-compatible RTMP → LiveKit primary path and evidence has been generated at `TIER4_STREAMYARD_LIVE_EVIDENCE_PATH`.

Required proof:
- attendee stage page renders for a scoped Tier 4 event
- controlled RTMP media has been observed before attendee consumption proof
- permitted attendee receives a live attendee token
- owner/showrunner/crew can permit, revoke, and re-permit attendee live access
- revoked attendee loses live-token access
- re-permitted attendee recovers live-token access
- backend logs show the access decisions
- no provider secrets are exposed to attendee/public users
- report is generated by the test itself at `reports/tier4/tier4-attendee-live-consumption-gauntlet.json`

## 2026-06-12 hostile attendee live-consumption review addendum

- Added same-room LiveKit ingress/attendee token proof.
- Added browser-stage proof to Tier 4 attendee consumption gauntlet.
- Added explicit generated-evidence run id matching.
- Added owner/showrunner/crew authorization and backend logging for permit/revoke/re-permit controls.
- Added best-effort LiveKit participant removal during revocation.
- Added hostile review artifact: `HOSTILE_CODE_REVIEW_TIER4_ATTENDEE_LIVE_CONSUMPTION_2026-06-12.md`.

