# START HERE FOR FUTURE CHATS — West Peek Live

CRITICAL — DO NOT SKIP.

West Peek Live is not a simple static site. It has:

- Cloudflare Worker runtime
- OpenNext bundling
- Cloudflare secrets
- role-gated production access
- crew/special guest access cookies
- demo access codes
- runtime persistence
- Cloudflare D1 runtime tables (`migrations-d1/`) and R2 assets
- LiveKit/Daily/Zoom/Google Meet fallback behavior
- public/demo/front-door venue routes

Local source validation is not enough.

## Required reading before changing this repo

Read these files before making repo changes:

1. docs/CHAT_HANDOFF_DEPLOYMENT_PARITY_RULES.md
2. docs/DEPLOYMENT_PARITY_CHECKLIST.md
3. docs/DEPLOYMENT_ENV_CHECKLIST.md
4. docs/MASTER_PLAN_V7_UX_BRAND_DEMO_REPAIR.md
5. docs/AGENCY_EVENT_OS_DAY1_OPERATOR_PACKET.md
6. deployment/cloudflare-required-secrets.json
7. scripts/post_deploy_smoke_test.js
8. package.json scripts


## Canonical validation / deploy proof commands

Use these grouped commands before falling back to individual scripts.

### Pre-deploy source/repo proof

```bash
npm run validate
```

This is the normal pre-deploy Tier 1-3 source/repo gate for this repo. It includes typecheck, lint, unit tests, V5 hard validation, V7 validation, and deploy-parity/static runtime contracts.

### Post-deploy Tier 3 live-runtime proof

```bash
POSTDEPLOY_BASE_URL=https://west-peek-live.seq-taylor.workers.dev \
PLAYWRIGHT_BASE_URL=https://west-peek-live.seq-taylor.workers.dev \
SMOKE_BASE_URL=https://west-peek-live.seq-taylor.workers.dev \
npm run postdeploy:full
```

This replaces the old piecemeal postdeploy sequence. Use individual postdeploy scripts only to isolate a failure.

### Tier 4 automated live-provider proof

```bash
npm run env:run -- -- bash -lc 'set -a; . ./.env.local; set +a; POSTDEPLOY_BASE_URL=https://west-peek-live.seq-taylor.workers.dev PLAYWRIGHT_BASE_URL=https://west-peek-live.seq-taylor.workers.dev SMOKE_BASE_URL=https://west-peek-live.seq-taylor.workers.dev TIER4_CONTROLLED_RTMP_BROADCASTER=1 TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 TIER4_RESEND_SEND_APPROVED=1 NODE_OPTIONS="--max-old-space-size=3072" npm run tier4:auto-controlled-livekit-proof'
```

Tier 4 uses `env:run` so `.env.local` is restored only for the command and removed afterward. It uses a controlled ffmpeg RTMP broadcaster through the deployed LiveKit ingress path and writes redacted evidence under `reports/tier4/`.

## Non-negotiable delivery rule

A change is a pull request (baseline ZIPs are retired, 31 Oct 2026). It is not ready to merge until:

- `Repository validation` is green on the PR
- npm run validate passes
- npm run build passes
- npm run cf:build passes
- deploy-parity validators pass
- post_deploy_smoke_test.js is current

A Cloudflare deploy is not complete until this passes against the actual Worker URL:

```bash
SMOKE_BASE_URL=https://west-peek-live.seq-taylor.workers.dev node scripts/post_deploy_smoke_test.js
```

Never claim COMPLETE before live smoke passes.

## What failed previously

The repo validated locally, but deployed Cloudflare runtime still failed because:

- required Cloudflare secrets were missing
- smoke test paths/markers had drifted
- runtime persistence behaved differently in the Worker
- front-door routes were not smoke-tested as a hard deploy gate

This repo now has deploy-parity validators to prevent future chats from repeating that mistake.


## Runtime store deploy keys

For the Day 1 Cloudflare demo deployment, these runtime-store keys must be represented in the Cloudflare secret manifest and deployment docs:

```text
AGENCY_EVENT_OS_RUNTIME_STORE=file
ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION=true
```

Since 6 Oct 2026 production runs on Cloudflare D1 through the `DB` binding (`services/runtime/runtimeStoreFactory.ts`; `/api/runtime/health` reports `"store":"d1"`). The two keys stay in the secret manifest because the deploy-parity validator pins them; forcing `AGENCY_EVENT_OS_RUNTIME_STORE=file` is for local runs only.


## Live click audit requirement

Live smoke is not enough.

A Cloudflare deploy is not COMPLETE until the deployed click audit also passes:

\`\`\`bash
SMOKE_BASE_URL=https://west-peek-live.seq-taylor.workers.dev npm run postdeploy:full
\`\`\`

Required final status ladder:

\`\`\`text
LOCAL VALIDATION PASS
CLOUDFLARE BUILD PASS
CLOUDFLARE DEPLOY PASS
LIVE SMOKE PASS
LIVE CLICK AUDIT PASS
COMPLETE
\`\`\`

If the deployed click audit fails, status is BLOCKED.


## Emergency production access regression rule

The crew and special guest gates must never import public-runtime Node-only crypto code or runtime persistence that can throw during page render. Access audit logging is best-effort only: logging failures must never crash `/production-access/crew`, `/production-access/special-guest`, or `/production-access/launchpad`. West Peek Productions logo coverage is global and required on every page through the root layout.

## Production config hard-fail policy

Missing production config is never a success state. Branded setup errors exist only as a user-facing blast shield to prevent generic Next digest pages; they do not make a deployment complete.

Required production env/secret names are derived from `deployment/env-var-registry.json` plus `data/access/event-access-config.json`. When a new `process.env.*` key is added, `validate_required_env_registry.js` forces it to be classified, and `sync_required_secrets_manifest.js` derives the Cloudflare required-secret manifest and `.env.example` from that registry.

Before any trusted deploy, run:

```bash
npm run predeploy:hard
```

This blocks deploys when required production config is missing, when `VIDEO_PROVIDER=mock`, when mock video override is enabled, when Daily fallback is not enabled, or when the Cloudflare secret manifest is out of sync.


## Operator Launchpad Secret Split

- CREW_ACCESS_PASSWORD gates limited crew workspace access only.
- OPERATOR_LAUNCHPAD_PASSWORD gates the Operator Launchpad and high-trust show-control diagnostics.
- V5_OPERATOR_COOKIE_NAME stores the operator-gate cookie name.
- CREW_ACCESS_PASSWORD and OPERATOR_LAUNCHPAD_PASSWORD must never match.

## Cloudflare dashboard command rule

Cloudflare deploys must not run plain `next build` followed by `npx wrangler deploy`. The repo default `npm run build` is now Cloudflare-aware and emits `.open-next` output for dashboard builds. Manual operators may still run `npm run cf:build` followed by `npm run cf:deploy`.

`postdeploy:browser` is scoped to deployed-safe browser proof only. Local credentialed/operator journey gauntlets remain local validation lanes unless matching deployed test credentials and real provider proof are intentionally supplied.

