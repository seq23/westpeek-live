# Validation Matrix — agency-event-os

Status: ACTIVE
Date: 2026-06-12

Machine-readable matrix: `_repo_validation_matrix.json`.

Canonical orchestrator:

```bash
npm run validate:everything
```

Tier 1 CI/static path:

```bash
npm run validate:everything -- --tier=1
```

Current container proof: Tier 1 contract validators may run without provider credentials. Build/Playwright/postdeploy/real StreamYard→LiveKit are not proven unless the named tier command has actually run.

Postdeploy and live provider lanes are separate proof layers and must not be implied by local/static validation.

## Zero-Noise Validation Contract

This repo no longer uses advisory severities as release signals. Every validator is assigned into one of two operating states:

| State | Meaning | Release behavior |
|---|---|---|
| HARD FAIL | Real product, security, build, browser, provider, deploy, or governance risk | Blocks the selected tier/profile until fixed |
| INFO / NO VALIDATION | Diagnostic, trace, helper, or non-proof script | Does not block release; cannot be reported as a warning |

`BLOCKED UNTIL PREREQUISITE` is not an advisory warning and not a repo failure. It is a deterministic external-proof state used only when a selected validation lane requires a deployed URL, provider account, real credential, or operator-confirmed action that is not present in the command environment.

## Tier 1 — Static/source/contract

Proves static source contracts only.

Representative commands:

```bash
npm run validate:final-tier-contract
npm run validate:tier4-contract
npm run validate:everything -- --tier=1
```

## Tier 2 — Local runtime/browser

Proves local runtime/browser/self-spawn layers only.

```bash
npm run validate:everything -- --tier=2
```

## Tier 3 — Deployed safe postdeploy proof

Tier 3 proves deployed runtime and safe provider boundaries.

It does not prove real live provider operations.

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
npm run validate:everything -- --tier=3
```

Rules:

- Missing deployed URL is `BLOCKED`, not an app failure.
- Once the deployed URL is supplied, failed commands are hard blockers.
- Passing Tier 3 means deployed-safe postdeploy proof only.
- COMPLETE remains blocked when real providers are in scope until Tier 4 passes or lanes are explicitly accepted as out of scope.

## Tier 4 — Real live-provider operational proof

Tier 4 proves real credential-dependent provider/user journeys:

- real StreamYard Custom RTMP or controlled broadcaster into LiveKit
- real LiveKit ingress/media/webhook state evidence
- real Supabase persistence/readback where configured
- real Daily fallback where configured
- real Zoom signature readiness where configured
- real Resend approved test send where configured
- role-boundary checks around private/provider surfaces
- no-secret evidence bundle scan
- cleanup/retention record

```bash
POSTDEPLOY_BASE_URL="https://<fresh-deployment-url>" \
PLAYWRIGHT_BASE_URL="https://<fresh-deployment-url>" \
TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF=1 \
STREAMYARD_REAL_PROVIDER_SMOKE=1 \
STREAMYARD_OPERATOR_CONFIRMED_BROADCAST=1 \
TIER4_STREAMYARD_LIVE_EVIDENCE_PATH="reports/tier4/streamyard-livekit-evidence.json" \
npm run validate:everything -- --tier=4
```

Focused live-provider command:

```bash
npm run tier4:live-provider-operational-proof
```

Rules:

- Missing credentials/evidence/operator confirmation are `BLOCKED`, not false passes.
- Once prerequisites are supplied, provider failures are hard blockers.
- Tier 4 evidence must be redacted and must not contain provider secrets, stream keys, service-role keys, cookies, or bearer tokens.
- Only Tier 4 can support `TIER 4 PASSED — REAL LIVE PROVIDER OPERATIONAL PROOF`.

## Completion boundary

Allowed proof labels:

- TIER 1 PASSED — STATIC/SOURCE ONLY
- TIER 2 PASSED — LOCAL BUILD/BROWSER ONLY
- TIER 3 PASSED — DEPLOYED SAFE POSTDEPLOY PROOF ONLY
- TIER 4 PASSED — REAL LIVE PROVIDER OPERATIONAL PROOF
- BLOCKED — TIER 4 LIVE PROVIDER EVIDENCE REQUIRED
- PARTIAL — STATIC/LOCAL/POSTDEPLOY PASSED, LIVE PROVIDER FINAL TIER UNPROVEN

Forbidden:

- COMPLETE from Tier 1
- COMPLETE from Tier 2
- COMPLETE from Tier 3 when real provider proof is required
- COMPLETE from mocked provider tests
- COMPLETE from postdeploy smoke without Tier 4 provider proof
- COMPLETE while any Tier 4 provider lane is unproven

## LiveKit Twirp URL Contract — 2026-06-12

- Validator: `npm run validate:livekit-twirp-url-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: prevent both deployed app code and Tier 4 proof harnesses from using a `wss://` LiveKit client URL for server-side Twirp `fetch()` calls.
- Required trace: Tier 4 controlled proof reports classify failures as harness/env/provider/deployed-app failures and retain sanitized phase trace.


## Tier 4 cleanup lane — LiveKit ingress resources

Tier 4 cleanup is an explicit validation lane, not narrative evidence.

Required proof:

- controlled Tier 4 creates or observes real LiveKit ingress through the deployed app route
- controlled RTMP proof captures provider/media observation before cleanup
- controlled Tier 4 calls LiveKit `Ingress/DeleteIngress` for the generated ingress unless explicitly retained
- evidence records `cleanupStatus`, `cleanupAttempted`, and `cleanupDeleted`
- `validate:tier4-cleanup-contract` blocks if cleanup is not represented in the harness, evidence template, matrix, and runbook

Provider quota failures such as `resource_exhausted`, `total ingress object limit exceeded`, or `concurrent ingress` are classified as real provider cleanup/quota failures. They are not app smoke failures and they are not allowed to be hidden inside generic Tier 4 failure language.

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

| Tier | Lane | Command | Proof | Status |
| --- | --- | --- | --- | --- |
| Tier 4 | Attendee live consumption + access control | `npm run tier4:attendee-live-consumption-gauntlet` | Proves an event goer can enter the live stage, receive live token access when permitted, lose access when revoked, recover when re-permitted, and that owner/showrunner/crew logs record the decisions. Requires generated controlled RTMP evidence and forbids provider secret exposure. | Required for live-event COMPLETE |

## 2026-06-12 hostile attendee live-consumption review addendum

- Added same-room LiveKit ingress/attendee token proof.
- Added browser-stage proof to Tier 4 attendee consumption gauntlet.
- Added explicit generated-evidence run id matching.
- Added owner/showrunner/crew authorization and backend logging for permit/revoke/re-permit controls.
- Added best-effort LiveKit participant removal during revocation.
- Added hostile review artifact: `HOSTILE_CODE_REVIEW_TIER4_ATTENDEE_LIVE_CONSUMPTION_2026-06-12.md`.


## Crew role permissions contract — 2026-09-16

- Validator: `npm run validate:crew-role-permissions-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: one crew permission map (`lib/auth/crewRolePermissions.ts`) covers every role; the live-control guard checks the named action against the role (owner/operator bypass) and refuses with the sentence the deck shows; every deck control is a `GatedForm` rendered disabled with the reason; every crew page shows the role badge with Switch role; the crew gate describes every role and accepts `event`/`role`/`code` prefill.
- Proof behind it: `tests/unit/crewRolePermissions.test.ts` (map + guard + viewer), `tests/unit/crewServerActionsByRole.test.ts` (real server actions, real signed cookie: moderator refused, TD allowed), `tests/e2e/crew-roles-mean-something.spec.ts` (badge, disabled controls, hide works, TD generates/ends).

## View-as contract — 2026-09-16

- Validator: `npm run validate:view-as-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: `?viewAs=<guestId>` opens a special guest's real pages for an owner / operator / producer cookie only (`lib/auth/viewAsGuard.ts`, shared by the middleware and `resolveViewAs`); the banner and the disabled guest actions on every guest surface; the open-as links on the deck and the Access page; the special-guest gate's owner override landing on `/production-access/special-guest/preview`, registered in every route ledger.
- Proof behind it: `tests/unit/viewAsGuard.test.ts`, `tests/e2e/view-as-and-preview.spec.ts`.

## Venue follows event state — 2026-09-16

- Validator: `npm run validate:venue-follows-event-state`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: one pure gate (`services/venue/venueStateGate.ts`) applied by `VenuePageShell`, which every `app/venue/[eventId]/*` page renders through: ended / replay_available (or the stage marked ENDED) → the ended state with the replay center; archived → the archived notice; draft → not open unless the host previews. `VenueStatePoller` refreshes an open page when the gate changes (End the show reaches an open attendee tab within one poll).
- Proof behind it: `tests/unit/venueStateGate.test.ts`, `tests/e2e/venue-follows-event-state.spec.ts`.

## Real speed networking — 2026-09-16

- Validator: `npm run validate:speed-networking-real-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: migration `0027_speed_networking.sql` and its Supabase mirror byte-identical and probed by `/api/runtime/health`; both runtime stores implement `networking_queue_entries` / `networking_queue_matches`; the matcher (`services/speed-networking/speedNetworkingService.ts`) runs on every read through the existing pure engine with the match history (no repeats), one LiveKit room `<eventId>-net-<matchId>` per match with a crew-set window (default 4 min); the token route issues a networking-room token only to the two matched attendees; the networking page states and the crew Networking card.
- Proof behind it: `tests/unit/speedNetworkingReal.test.ts`, `tests/e2e/speed-networking-real.spec.ts` (two browsers).

## Schema drift and fail-soft sections — 2026-09-16 (after the speed-networking incident)

- `npm run validate:runtime-events-contract` now refuses any migration from 0024 on that creates a table name an earlier migration already created unless the same migration renames that table aside (or drops it): 0027's `create table if not exists speed_networking_entries` was a no-op against 0010's uuid table and every crew page 500'd during a live workshop.
- `npm run validate:fail-soft-sections` (in `validate:deploy-parity`): every store-reading async server component under `components/moderation` and `components/venue` (plus `HostPanel`, `StreamYardIngressPanel`) renders through `SafeSection` (`components/system/SafeSection.tsx`, core `lib/ui/renderSafely.ts`) or catches its own failure; `VenuePageShell` catches its own reads. Proof: `tests/unit/safeSection.test.ts`.
- Live verification: `/api/runtime/health` now carries `crewPageReads` — the crew deck's and networking page's reads run against the newest real runtime event with the real store — and `post_deploy_smoke_test.js` names the stop when any read fails. After every deploy, also load `/crew/events/<runtime event>` and `/venue/<runtime event>/networking` in production; the file store cannot see Supabase schema drift.

## Access codes contract — 2026-09-16

- Validator: `npm run validate:access-codes-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: one case convention for every code (`lib/access/accessCodes.ts`: uppercase display, `codesMatch` ignoring case, spaces, dashes) at both gates and resolvers; guest links (`guestGatePath`) prefill the right gate and never auto-submit; custom codes (`services/events/accessCodeService.ts`) validated and unique, a change rotating the old code out (crew → host-link version; guest roles → `access_code_versions`, checked by the speaker / sponsor / client layouts and the VIP panel); every gated area in the middleware matcher.
- Proof behind it: `tests/unit/accessCodes.test.ts`, `tests/unit/accessCodeService.test.ts`, `tests/e2e/access-codes-and-links.spec.ts` (incl. "every gated area sends a fresh browser to its gate").

## People hash-only heal contract — 2026-09-16

- Validator: `npm run validate:people-hash-only-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: `/app/people` must read hash-only attendee rows (registered before 16 Sep 2026, email null) as well as `contacts` — grouped by hash across events (`groupHashOnlyProfiles`), masked email + "not captured", counted, exported with a blank email column; the one heal-on-match contact write (`upsertContactFromProfile`, run by registration, profile save, and the networking gate) backfills the email onto every hash sibling and builds one contact from the union of their events with the earliest `first_seen`; `listAttendeeProfilesByEmailHash` / `listAttendeeProfilesWithoutEmail` implemented by both stores.
- Proof behind it: `tests/unit/hashOnlyPeopleHeal.test.ts`, `tests/e2e/people-hash-only-heal.spec.ts`.

## Cloudflare Stream fallback contract — 2026-09-16

- Validator: `npm run validate:cloudflare-stream-fallback-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: Fallback 1 is real in production, so the crew deck's Go-live section carries a self-contained card for the producer — RTMPS URL and stream key (masked until Reveal, never logged) with click-to-copy, the five numbered StreamYard steps, "Test the fallback player"; every ladder rung shows readiness read from the environment (`lib/video/fallbackReadiness.ts`) and a "Move down" to an unconfigured rung is disabled with the reason AND refused by `applyStageStreamOperatorSignal`; the five Cloudflare Stream secrets are declared in every manifest, `.env*.example` and `ENVIRONMENT_VARIABLES.md`.
- Proof behind it: `tests/unit/fallbackReadiness.test.ts`.

## Worker variable budget — 2026-09-16

- Validator: `npm run validate:worker-variable-budget`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: Workers Free caps a Worker at **64** variables and secrets. On 16 Sep 2026 we were at 64 and could not add the Cloudflare Stream fallback secrets until the 20 unread `EVENT_{LEADERSHIP_RESET_WEBINAR,PREMIUM_WORKSHOP_INTENSIVE,PROVIDER_INNOVATION_EXPO,SEED_DEMO_DAY}_*_CODE` secrets were deleted. Every secret manifest now stays at 60 or fewer names, free of duplicates, never re-adds the deleted 20 (`EVENT_DEMO_*` stay: `lib/env/safeEnv.ts` reads them), and declares the five Cloudflare Stream fallback secrets.
- Proof behind it: the manifests themselves; live name parity remains `scripts/audit_cloudflare_secret_parity.js`.

## People: real rows first — 2026-09-16

- Validator: `npm run validate:people-real-rows-first`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: the owner opened `/app/people` and found 40 people of whom 34 were our Playwright and Tier-4 fixtures. Test rows are now computed (`services/attendees/testRowClassifier.ts`: reserved test domains, seed and automation events — never a hard-coded name list), counted apart, hidden behind a remembered "Show test rows" toggle, left out of the CSV unless `?includeTest=1`, and archived — never hard-deleted — by an owner-only action that cannot touch a row from a real event (migration 0030 adds `contacts.archived_at`; attendee rows use the existing `status = 'revoked'`).
- Proof behind it: `tests/unit/peopleTestRows.test.ts`, `tests/e2e/people-test-rows.spec.ts`.

## Access codes vault — 2026-09-16

- Validator: `npm run validate:access-codes-vault-contract`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: the owner asked for one place to look codes up, replacing the v2 manual that printed them in a document. The Owner Console's "Access codes" fold is owner-only (`components/owner/AccessCodesVault.tsx` refuses any other actor), lists every code for every event masked until Reveal with Copy, "Copy all codes for this event", a search across events by code or name, and Rotate (confirmed, and it warns that every link and session handed out with the old code stops working). Reveal and Copy write an audit row (`access_code_revealed` / `access_code_copied`) that never carries the value. The four global gates render SET / NOT SET with `npx wrangler secret put …`; the validator walks `app/`, `components/` and `lib/actions` and fails if any file renders the VALUE of `OWNER_MASTER_ACCESS_PASSWORD`, `OPERATOR_LAUNCHPAD_PASSWORD` or `CREW_ACCESS_PASSWORD`.
- Proof behind it: `tests/e2e/access-codes-vault.spec.ts` (operator refused, reveal, search by a handed-over code, rotate → the old code fails the gate, and the response body never contains a gate password).

## Migration mirror parity — 2026-09-16

- Validator: `npm run validate:migration-mirror-parity`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: the Supabase GitHub integration applies `supabase/migrations/` only. Every mirror check in the repo used to name one migration by hand, so a new migration with no mirror passed everything — which is how `0030_contact_archive.sql` shipped unapplied and "Archive test rows" silently did nothing. From `MIRROR_FLOOR = 24` on (0001–0023 predate the integration), every canonical migration must have exactly one byte-identical mirror, and the mirror filenames must sort in canonical order. Hard-fails on zero migrations examined.
- Proof behind it: negative proof on 16 Sep 2026 (removing the 0030 mirror fails by name); `tests/unit/migrationMirrorAndWatchdog.test.ts`.

## Production workspace spine — 2026-09-16

- Validators: `npm run validate:event-workspace-spine`, `npm run validate:v7-operator-launchpad`
- Included in: `npm run validate` through `validate:deploy-parity`
- Purpose: the operator launchpad leads with the operator's real events and one collapsible section per job (Your events / Run a show / Set up an event / People & data / Diagnostics — exactly two cards / Demo & training, collapsed by default), with no two cards sharing an href and no hard-coded demo event id. Every event page is reachable from the left spine exactly once (`lib/navigation/eventWorkspaceSpine.ts` versus a filesystem walk), the pages that existed twice (`/producer`, `/timeline`, `/approvals`) are redirect stubs, readiness dots exist only where the store can really answer (speakers named, sessions planned, published), and the spine is mounted fail-soft in the event layout with a mobile drawer.
- Note: `validate_v7_operator_launchpad` previously asserted the page's exact card titles and demo links — client-facing prose that froze the launchpad in the shape the owner asked us to fix. It now asserts structure and behaviour.
- Proof behind it: `tests/e2e/workspace-spine.spec.ts`, `tests/unit/eventWorkspaceSpine.test.ts`.
