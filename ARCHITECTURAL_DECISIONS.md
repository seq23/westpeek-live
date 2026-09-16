# Architectural Decisions — Agency Event OS

Status: ACTIVE  
Date: 2026-06-11

## Decision ID: ADM-2026-06-11-001
Date: 2026-06-11  
Status: Accepted

Context: Agency Event OS has many validators and phase docs, but needs a single Master Addendum validation surface.

Decision: `_repo_validation_matrix.json`, `_env_contract.json`, `REPO_PRODUCT_PROMISE_LEDGER.md`, and active runbooks govern future validation/deploy/env work. Legacy docs remain historical/supporting unless validators prove they can be archived.

Alternatives Considered: Continue adding phase docs; delete legacy docs immediately.

Reasoning: Immediate deletion risks breaking existing validators and losing source history. The active-doc index prevents new sprawl without destabilizing the repo.

Tradeoffs: Legacy docs remain physically present for now.

Risks Accepted: Some doc volume remains until validator-safe archival is run.

Validation Impact: `npm run validate:everything` becomes the canonical orchestrator.

Future Reversal Conditions: Once validators no longer reference legacy docs, move them to `docs/archive/` or remove duplicates.

## Decision ID: ADM-2026-06-11-002
Date: 2026-06-11  
Status: Accepted

Context: StreamYard and LiveKit cannot be honestly proven by static contract tests alone.

Decision: Real StreamYard Custom RTMP to LiveKit ingress proof is a separate Tier 3 provider lane and remains UNPROVEN until `npm run smoke:streamyard-livekit:real` runs against a deployed URL with real provider credentials and operator-confirmed private broadcast.

Alternatives Considered: Treat mock probe as sufficient; remove provider proof from completion.

Reasoning: Static/model tests prove app logic only, not real media flow.

Tradeoffs: Production readiness requires manual/provider coordination.

Risks Accepted: Local/CI may report partial readiness while live-media readiness remains blocked.

Validation Impact: Real provider lane is in `_repo_validation_matrix.json` and provider proof matrix.

Future Reversal Conditions: Replace manual StreamYard step with controlled RTMP broadcaster automation that proves media ingress without human confirmation.

### Decision ID: ADM-2026-06-13-SEC-01
* **Date:** 2026-06-13
* **Status:** Accepted
* **Context:** The Agency Event OS lockfile contained 10 high and 2 critical npm advisories, including production-reachable Next.js findings and critical/high development-tool chains.
* **Decision:** Upgrade Next.js to 15.5.18 with OpenNext 1.19.11, Playwright to 1.60.0, Vitest to 4.1.8, and force patched esbuild 0.28.1 through the nested toolchain. Migrate source code to Next 15 async cookies and route-prop contracts.
* **Alternatives Considered:** Stay on vulnerable Next 14; run `npm audit fix --force`; suppress audit findings; upgrade the entire toolchain indiscriminately.
* **Reasoning:** Targeted upgrades remove all high/critical findings while preserving controlled regression scope and avoiding unbounded package churn.
* **Tradeoffs:** Next 15 required broad but mechanical page/auth compatibility changes; nine lower-severity advisories remain.
* **Risks Accepted:** Deployed Cloudflare behavior and live provider behavior remain local-validation and postdeploy gates.
* **Validation Impact:** Tier 1 build, Tier 2 unit/integration, local OpenNext bundle, then Tier 3/4 post-update proof.
* **Future Reversal Conditions:** Reconsider versions only if Cloudflare deployment or authenticated browser proof identifies a concrete incompatibility.

## Decision ID: ADM-2026-09-15-RUNTIME-EVENTS
Date: 2026-09-15  
Status: Accepted

Context: Every event the app could serve was compiled JSON under `data/events/*`; creating one meant a PR and a redeploy. `/app/events/new` wrote a 30-minute cookie draft through a filesystem write that cannot work on the Worker, a second "Create event" form on `/app/events` required a Supabase Auth session the owner never has, and per-event crew/speaker/sponsor/VIP/client codes were Cloudflare secrets per seed event — impossible for events created after deploy.

Decision: One runtime-first event repository (`services/events/eventRepository.ts`) reads the runtime store first (Supabase `runtime_events` via migration `db/migrations/0024_runtime_events.sql` in production, the file store locally/e2e) and the compiled seed JSON second. `/app/events/new` is the single create page (NOW → live Room with a join code; LATER → draft with a guided spine). The owner cookie is the actor for every workspace mutation (`lib/auth/workspaceActor.ts`); a Supabase session is still accepted for future staff. Access codes are minted at creation and stored on the row; the crew/special-guest gates check them alongside the legacy env secrets for seed events. Seed events stay in JSON, are marked `source: "seed"`, and are hidden from the owner's lists behind "Show demo events". Sync read-model helpers see runtime events through a request-time overlay (`runtimeEventOverlay.ts`) that every event-scoped page hydrates first.

Alternatives Considered: Converting every sync consumer to async (large ripple for no behavioural gain); reusing the 0001 `events` table (UUID ids with FKs to agencies/clients/profiles that require Supabase Auth users the owner's path never creates); keeping the cookie draft and adding a file write (cannot persist on Workers).

Reasoning: Text ids matching the existing `event_id text` runtime tables keep the whole v5/v6 runtime layer working for created events without a second identity scheme. The overlay keeps ~60 pages unchanged in shape while making them runtime-first.

Tradeoffs: The overlay is process-local; a page that renders an event must hydrate it (`ensureRuntimeEvent`) first. Two event vocabularies coexist (compiled seed packages and runtime rows) until the seeds are retired.

Risks Accepted: Migrations reach the live Supabase project through the Supabase GitHub integration connected to this repository: the SQL under `supabase/migrations/` (a byte-identical mirror of `db/migrations/0024_runtime_events.sql`, guarded by `validate:runtime-events-contract`) is applied on merge to `main`. Verified 2026-09-16: `/api/runtime/health` on the deployed Worker reported `store: "supabase"` and no missing tables immediately after the merge. If a future migration is not applied, the workspace shows a named stop (`RuntimeSchemaStop`) naming the SQL file instead of failing silently, the post-deploy smoke fails on `/api/runtime/health`, and seed events keep resolving.

Validation Impact: `tests/unit/eventRepository.test.ts`, `tests/e2e/owner-real-events-journey.spec.ts`; `validate_v7_frontdoor_labels.js` now asserts real persistence and refuses the draft store; `validate_access_boundary_contract.js` follows the crew password into the resolver that also honours per-event crew codes.

Future Reversal Conditions: When the five seed events are recreated as runtime rows, delete `data/events/*`, the config-package PR flow, and the overlay.

## Decision ID: ADM-2026-09-16-CHAT-MODERATION

Status: Accepted

Context: The first production e2e (15/16 Sep 2026) proved live chat works and that nothing could moderate it. `LiveChatMessage.moderationStatus` existed but nothing set it; the command page's "Chat moderation queue" was a sentence; the attendee chat promised "Crew can moderate or lock this room" with no crew control anywhere.

Decision: Three reversible crew decisions, all enforced on the write path in `services/venue/liveChatService.ts` (not only in the UI): hide/restore a message (`live_chat_messages.moderation_status`, plus `moderated_by`/`moderated_at` so the crew see "Hidden by <role>"), silence/unsilence an attendee in a room, and lock/unlock a room. Silence and lock live in one new table, `live_chat_moderation_states` (`db/migrations/0025_live_chat_moderation.sql`, mirrored under `supabase/migrations/` for the GitHub integration), keyed `event:roomKind:roomId[:attendeeId]`. The attendee listing excludes hidden messages by default; the crew listing passes `includeHidden`. Every crew server action runs `requireLiveEventControlAccessForRequest` (owner, operator, or event-scoped crew cookie). One server component, `components/moderation/ChatModerationQueue.tsx`, is the queue on the command page, the crew console, and the testing console.

Alternatives Considered: Storing silence on the `attendee_live_capabilities` JSON and lock on `attendee_live_control_states` (three existing writers overwrite those records wholesale; a silence would be lost on the next permit). Client-side hiding (an attendee with a stale page could still post; hidden text would still ship to the browser).

Reasoning: A dedicated table with one row per standing decision is the only shape where "is this attendee silenced" is a key lookup that no other feature can clobber. Enforcing in the service means the same rule covers the form, a replay, and any future API.

Tradeoffs: One more migration to apply; until it lands, moderation actions throw `RuntimeSchemaMissingError` naming the table and `/api/runtime/health` reports it as a named stop (the diagnostic snapshot tolerates the missing table so the testing console stays up).

Risks Accepted: Same migration path as ADM-2026-09-15-RUNTIME-EVENTS; guarded by `validate:live-chat-moderation-contract` (mirror parity, both stores, write-path enforcement, guards, surfaces, proofs).

Validation Impact: `tests/unit/liveChatModeration.test.ts`, `tests/e2e/crew-chat-moderation.spec.ts`, `scripts/validate_live_chat_moderation_contract.js`, `scripts/validate_supabase_schema_parity.js` (new columns and table).

Future Reversal Conditions: If chat moves to a real-time provider with its own moderation, keep the decision table as the source of truth and mirror it outward.

## Decision ID: ADM-2026-09-16-ATTENDEE-ROSTER

Status: Accepted

Context: Permit and revoke lived only on `/admin/testing/[id]` and needed an attendee id typed by hand, copied out of the fallback event log. A stage request from an attendee was recorded as a capability row with every flag false — indistinguishable from "revoked then re-permitted with nothing" — so there was no queue to work.

Decision: `AttendeeLiveCapability` carries `requestStatus` (`requested` | `approved` | `declined`) with `requestedAt`/`decidedAt`; "Request to Join Stage" records `requested` and grants nothing. One pure function, `decideCapability`, defines the five one-click decisions (permit, approve_publish, revoke, decline, reset) and is shared by the server action and the `/api/attendee-live/access` route. `services/venue/attendeeRosterService.ts` joins the latest 200 registered profiles with their capability, chat silence, and last chat time, and surfaces pending requests oldest first. One deck (`components/moderation/CrewLiveModerationDeck.tsx` = roster + chat queue + room controls) renders on `/crew/events/[id]`, `/app/events/[id]`, and the testing console; the by-id form stays folded away on the testing console as the fallback for someone not on the roster.

Alternatives Considered: Deriving "pending" from all-false flags (ambiguous); a separate requests table (a second source of truth for the same attendee/room); a new crew route for moderation (adds a route to every ledger for no user gain — the crew home is where the crew already is).

Reasoning: The capability row is already keyed event/room/attendee and read by the token route; adding the request status to it means the token path, the roster, and the attendee's own stage page all read one record.

Tradeoffs: The legacy permit/revoke paths (manual form, API route) must carry `requestStatus` through their overwrite; both do, and the unit tests pin it.

Risks Accepted: The roster reads the latest 500 chat messages to compute "last chat at"; at larger events that becomes a per-attendee column. Search is server-rendered via `?roster=`.

Validation Impact: `tests/unit/attendeeLiveRoster.test.ts`, `tests/e2e/crew-attendee-roster.spec.ts`, `scripts/validate_attendee_roster_contract.js`.

Future Reversal Conditions: If attendees get a real-time presence channel, the roster should read presence from it and keep this decision record as the authority.
