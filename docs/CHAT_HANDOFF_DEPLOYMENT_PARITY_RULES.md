# Chat Handoff Deployment Parity Rules

These rules are mandatory for West Peek Live work.

## Core rule

Repo validation is not enough.

The deployed product includes Cloudflare Worker runtime behavior, OpenNext output, secrets, runtime persistence, role gates, and front-door demo routes. Any chat working on this repo must validate deployment parity before delivery.

## Pull request rules

Baseline ZIPs are retired (31 Oct 2026). Do not merge a PR unless its exact head passes:

1. a branch cut from `origin/main`
2. npm ci
3. npm run validate
4. npm run build
5. npm run cf:build
6. deploy-parity validators
7. smoke-test freshness checks

## Deploy completion rules

Do not call Cloudflare deploy complete until the live Worker passes:

```bash
SMOKE_BASE_URL=https://west-peek-live.seq-taylor.workers.dev node scripts/post_deploy_smoke_test.js
```

## Front-door route rule

These routes must never render generic server errors:

- /
- /join
- /production-access
- /production-access/crew
- /production-access/special-guest
- /production-access/launchpad
- /venue/demo/lobby
- /admin/testing
- /app
- /app/events/new

If configuration is missing, render a branded setup state naming the missing variable and where to set it.

## Smoke-test freshness rule

The smoke test must use current product routes and current visible labels.

Canonical demo venue route:

```text
/venue/demo/lobby
```

Forbidden stale smoke route:

```text
/venue/event-summit/lobby
```

Canonical special guest label:

```text
Special guest password
```

Forbidden stale marker:

```text
role access code
```

## Env contract rule

Every runtime env key used by code, event access config, docs, and smoke tests must be represented in:

- deployment/cloudflare-required-secrets.json
- .env.example
- docs/DEPLOYMENT_ENV_CHECKLIST.md or docs/DEPLOYMENT_PARITY_CHECKLIST.md

## Runtime persistence rule

Front-door demo, venue, and admin/testing routes must not hard-crash if runtime persistence is unavailable or misconfigured. They must degrade safely or be protected before rendering.


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

