# Artifact Manifest — agency-event-os

Artifact: `agency-event-os-main_BASELINE_06-12-26_2d608beb.zip`
Repo: `agency-event-os`
Packaged root: repository root
Artifact type: full baseline snapshot ZIP
Status: STRUCTURALLY CHECKED — LOCAL VALIDATION REQUIRED

## Source

Input artifact: `agency-event-os-main_BASELINE_06-12-26_d7595a6f.zip`
User-reported failing proof: Tier 4 real-provider journey still blocked at the deployed Operator Launchpad gate even when `E2E_OWNER_PASSWORD` was forced to `OPERATOR_LAUNCHPAD_PASSWORD`.

## Root cause addressed

The deployed Tier 4 browser journey was depending on App Router server-action form submission for production access gates. The browser proof showed the gate rendered and the form was filled, but no operator/owner session was established before the test navigated to `/admin/testing/<eventId>`.

This artifact moves the production access gates onto explicit POST route handlers so the Cloudflare/deployed path has a simple, inspectable request → redirect → Set-Cookie contract.

## Change summary

- Added explicit POST handlers for production access gates:
  - `/api/production-access/operator`
  - `/api/production-access/owner`
  - `/api/production-access/crew`
  - `/api/production-access/special-guest`
- Pointed gate forms at those POST handlers using standard `method="post"` form posts.
- Preserved owner/master universal authority:
  - owner/master can enter through operator, crew, and special-guest gates when a safe `next` target is supplied.
  - owner/master receives the owner cookie and can proceed to admin/app/crew/speaker/sponsor/client/VIP/venue surfaces according to existing route authorization.
- Preserved role-specific boundaries:
  - operator password only sets operator cookie.
  - crew password only sets crew cookie.
  - special-guest role codes only set special-guest cookie.
  - operator still cannot escalate into owner-only billing/settings or special-guest portals.
- Kept the prior owner-universal guard fixes across launchpad, operator packet, middleware authorization, crew capability actions, event-role actions, and logout cleanup.

## Changed files

- `app/api/production-access/operator/route.ts`
- `app/api/production-access/owner/route.ts`
- `app/api/production-access/crew/route.ts`
- `app/api/production-access/special-guest/route.ts`
- `lib/auth/accessGateResponse.ts`
- `app/production-access/operator/page.tsx`
- `app/production-access/owner/page.tsx`
- `app/production-access/crew/page.tsx`
- `app/production-access/special-guest/page.tsx`
- `app/operator-packet/page.tsx`
- `app/production-access/launchpad/page.tsx`
- `app/production-access/logout/route.ts`
- `lib/auth/requireCrewCapability.ts`
- `lib/auth/requireEventRole.ts`
- `lib/env/safeEnv.ts`
- `scripts/validate_access_boundary_contract.js`
- `scripts/validate_v7_operator_launchpad.js`
- `scripts/validate_v7_route_safety.js`
- `tests/unit/v5RouteAuthorization.test.ts`
- `ARTIFACT_MANIFEST.md`
- `_artifact_manifest.json`

## Validation performed in sandbox

- `npm run typecheck` — PASS
- `npm run lint` — PASS, no warnings/errors
- `npm run test -- --run tests/unit/v5RouteAuthorization.test.ts` — PASS, 9 tests
- `npm run validate:v7` — PASS
- `npm run validate:deploy-parity` — PASS
- `npm run validate` — PASS, including typecheck, lint, 64 unit test files / 146 tests, V5 hard validators, V7 validators, deploy-parity validators, Tier 4 contract validators
- `npm run validate:tier4-contract` — PASS
- `npm run validate:no-generated-artifacts` — PASS after cleanup

## Local HTTP proof performed in sandbox

A local Next server was started with demo Day 1 secrets. Direct HTTP POST checks proved the new boring auth contract:

- `POST /api/production-access/operator` with the operator password returned `303`, set `wpl_operator_access`, and allowed `GET /admin/testing/tier4-manual-event` to return `200`.
- `POST /api/production-access/operator` with the owner/master password returned `303`, set `wpl_owner_access`, and allowed `GET /admin/testing/tier4-manual-event` to return `200`.

## Browser/provider validation attempted but not proven in sandbox

- `npx playwright test tests/e2e/tier4-real-provider-journeys.spec.ts --trace on --workers=1` was attempted locally.
- The container blocked Chromium navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`, so browser Playwright proof is not claimed here.
- Full Tier 4 live-provider proof still must run on the user's local machine with encrypted `.env.local`, deployed Cloudflare env, and live provider credentials.

## Required local sequence

After applying this ZIP locally with the v3 updater, run the Tier 4 provider proof command locally:

```bash
npm run env:run -- -- bash -lc 'set -a; . ./.env.local; set +a; export POSTDEPLOY_BASE_URL=https://west-peek-live.seq-taylor.workers.dev PLAYWRIGHT_BASE_URL=https://west-peek-live.seq-taylor.workers.dev SMOKE_BASE_URL=https://west-peek-live.seq-taylor.workers.dev TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 TIER4_CONTROLLED_RTMP_BROADCASTER=1 TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER=1 TIER4_RESEND_SEND_APPROVED=1 STREAMYARD_REAL_PROVIDER_SMOKE=1 STREAMYARD_OPERATOR_CONFIRMED_BROADCAST=1 TIER4_STREAMYARD_LIVE_EVIDENCE_PATH=reports/tier4/streamyard-livekit-evidence.json TIER4_EMAIL_TEST_TO="${TIER4_EMAIL_TEST_TO:-${EMAIL_REPLY_TO:-}}"; npm run tier4:auto-controlled-livekit-proof'
```

- `SECURITY_DEPENDENCY_REMEDIATION_2026-06-13.md` — targeted high/critical dependency remediation, compatibility migration, and proof boundary.
