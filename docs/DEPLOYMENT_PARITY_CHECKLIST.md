# Deployment Parity Checklist

Use this before pushing a branch, merging a PR, or deploying to Cloudflare. (Baseline ZIPs are
retired as of 31 Oct 2026: a change is a PR, merged and deployed by `land`.)

## Before pushing a branch

Run from the branch's working tree, dependencies installed from the lockfile:

```bash
npm ci
npm run validate
npm run build
npm run cf:build
```

## Deploy parity validators

```bash
npm run validate:deploy-parity
```

This runs:

- scripts/validate_deploy_env_contract.js
- scripts/validate_smoke_test_freshness.js
- scripts/validate_frontdoor_runtime_graceful_degradation.js
- scripts/validate_cloudflare_required_secrets_manifest.js

## Local generated artifact cleanup before validation/commit

Before local validation and commit, remove generated deploy/build artifacts and move .env.local out of the repo:

```bash
/bin/mv /Users/sequoiataylor/Documents/GitHub/agency-event-os/.env.local /Users/sequoiataylor/agency-event-os.env.local.active
/bin/rm -rf .open-next .next .wrangler tsconfig.tsbuildinfo
```

Restore .env.local only after validation, commit, push, deploy, and smoke:

```bash
/bin/mv /Users/sequoiataylor/agency-event-os.env.local.active /Users/sequoiataylor/Documents/GitHub/agency-event-os/.env.local
```

## Cloudflare deploy

```bash
npm run cf:build
npm run cf:deploy
```

## Required live smoke test

```bash
SMOKE_BASE_URL=https://west-peek-live.seq-taylor.workers.dev node scripts/post_deploy_smoke_test.js
```

If live smoke fails, deployment is not complete.

## Required Cloudflare secrets for current demo/runtime mode

See:

```text
deployment/cloudflare-required-secrets.json
```

Current Day 1 access values:

```text
CREW_ACCESS_PASSWORD=Crew-Call-2026!
EVENT_DEMO_SPEAKER_CODE=Demo-Speaker-2026!
EVENT_DEMO_SPONSOR_CODE=Demo-Sponsor-2026!
EVENT_DEMO_VIP_CODE=Demo-VIP-2026!
```

V5_ACCESS_COOKIE_SECRET must be a generated 32+ character secret.


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

