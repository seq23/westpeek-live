# E2E Required Test Matrix — Agency Event OS

Status: ACTIVE  
Date: 2026-06-11  
Purpose: repo-owned E2E coverage ledger for the Master Contract / Master Addendum.

## Completion rule

Agency Event OS cannot be called COMPLETE until every HARD FAIL lane below has passed or is explicitly reported as UNPROVEN with completion impact.

| Required lane | Required file / command | Current repo status | Completion impact |
|---|---|---:|---|
| Day 1 master gauntlet | `tests/e2e/day1-showtime-master-gauntlet.spec.ts` | PRESENT / NOT RUN | Blocks COMPLETE until run/pass. |
| Edge-case master lane | `tests/e2e/master-contract-edge-cases.spec.ts` | PRESENT / NOT RUN | Blocks COMPLETE until run/pass. |
| Route/CTA inventory crosswalk | `tests/e2e/route-cta-inventory-crosswalk.spec.ts` | PRESENT / NOT RUN | Blocks COMPLETE until run/pass. |
| Webhook security invalid/malformed/unknown event | `tests/e2e/provider-webhook-security.spec.ts` | PRESENT / NOT RUN | Blocks COMPLETE until run/pass. |
| Cross-event leakage with two created events | `tests/e2e/cross-event-scope-isolation.spec.ts` | PRESENT / NOT RUN | Blocks COMPLETE until run/pass. |
| Duplicate registration behavior | `tests/e2e/master-contract-edge-cases.spec.ts` | PRESENT / NOT RUN | Blocks COMPLETE until run/pass. |
| Invalid special guest/access code | `tests/e2e/master-contract-edge-cases.spec.ts` | PRESENT / NOT RUN | Blocks COMPLETE until run/pass. |
| Expired/revoked session replay | `tests/e2e/master-contract-edge-cases.spec.ts` | PRESENT / NOT RUN | Blocks COMPLETE until run/pass. |
| Mobile critical journeys | `tests/e2e/mobile-critical-journeys.spec.ts` | PRESENT / NOT RUN | Blocks COMPLETE until run/pass. |
| Real StreamYard Custom RTMP → LiveKit media proof | `tests/e2e/real-streamyard-livekit-media.spec.ts`; `npm run test:e2e:real-streamyard-livekit` | PRESENT AS LIVE PROOF LANE / UNPROVEN | Blocks production media claim until run with real provider. |
| Postdeploy role/provider critical lanes | `tests/e2e/postdeploy-role-provider-critical.spec.ts` | PRESENT AS POSTDEPLOY PROOF LANE / UNPROVEN | Blocks deployed-readiness claim until run. |

## Explicit UNPROVEN lanes until evidence exists

- REAL STREAMYARD CUSTOM RTMP TO LIVEKIT INGRESS
- ATTENDEE REAL LIVE MEDIA FROM LIVEKIT
- POSTDEPLOY ROLE FLOW
- POSTDEPLOY PROVIDER FLOW
- CLOUDFLARE WORKER DEPLOYMENT
- GITHUB ACTIONS RUN STATUS
- SUPABASE LIVE PERSISTENCE
- HEADED VISUAL HUMAN REVIEW

## Required Tier 4 E2E: Attendee Live Consumption

The live event outcome requires an attendee live-consumption gauntlet. A provider ladder test alone is not sufficient. The gauntlet must prove attendee entry, live token consumption, permit/revoke/re-permit, backend logs, refresh/re-entry-ready persistence surfaces, and no secret exposure.
