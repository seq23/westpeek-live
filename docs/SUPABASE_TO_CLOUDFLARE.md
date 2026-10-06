# Supabase → Cloudflare (D1 + R2 + app-owned auth), $0 incremental

Written 6 Oct 2026, the day the free Supabase organisation (project `lqxzpwtvolojashknseb`) was deleted.
Status: **plan only — nothing below is built yet.** Branch `work/supabase-to-cloudflare`.

## 1. What Supabase did for this repo (evidence)

| Capability | Used? | Where | Evidence |
|---|---|---|---|
| **Relational data (Postgres)** | **Yes — the whole runtime store** | `services/runtime/supabaseRuntimeStore.ts` (1,457 lines) behind the `RuntimeStore` interface; `services/supabase-query/*`; 5 files create a client | 46 SQL files in `db/migrations` (0001–0046, 0039–0042 never existed); `supabase/migrations` is a 1:1 mirror of 0023–0046 (20 files). 118 tables created, **51 actually read/written by code** (list in §4). Query shapes: 82 `.select`, 30 `.upsert`, 13 `.update`, 11 `.delete`, 4 `.insert`, 96 `.eq`, 32 `.order`, 26 `.or/.ilike`. No `.rpc`, no SQL functions, no triggers, no enums. |
| **Row-level security** | Nominal only | 75 `enable row level security`, 9 policies | Every policy is `to service_role using (true)`. The Worker always connects with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS; the browser client (`lib/supabase/client.ts`) is imported by nothing. **All real authorisation already lives in Worker code** (middleware + V5 signed cookies). Nothing to port. |
| **Auth (Supabase Auth)** | Yes, narrow | `lib/auth/actions.ts` (`signUp`, `signInWithPassword`, `resetPasswordForEmail`), `app/auth/callback/route.ts` (`exchangeCodeForSession`), `lib/auth/getCurrentUser.ts` (`getUser`) | Only the self-serve `/login` path. Owner, operator, crew and special-guest access is **already app-owned**: passwords/codes in Worker secrets + HMAC cookies (`V5_ACCESS_COOKIE_SECRET`). Attendee sessions are a table (`attendee_sessions`), not Supabase Auth. |
| **File storage** | Yes | `services/assets/eventAssetService.ts`, `services/assets/signedUrlService.ts`, `components/assets/AssetUploader.tsx`, `components/settings/HouseLogoUploader.tsx` | Private bucket `event-assets` (auto-created by `createBucket`); `createSignedUploadUrl` (browser PUTs direct) and `createSignedUrl` (time-limited download). Event assets + house logo. |
| **Realtime** | **No** | — | Zero `.channel(` / `postgres_changes`. Live chat polls every 4 s (`LiveRoomChatStream.tsx`), stage status every 5 s, stage player 10 s, teleprompter 5 s, heartbeat 20 s — all plain HTTP to the Worker, which reads the DB. |
| **Edge/scheduled functions, cron** | No | — | None in Supabase. The only schedule is GitHub's `supabase-keep-alive.yml` (daily 07:17 UTC), which exists **solely** to stop a free project pausing. |
| **Anything else** | No | — | No pgvector, no pg_cron, no webhooks, no Supabase email. Email is Resend; video is LiveKit/Daily/Cloudflare Stream. |

## 2. Live impact now (probed 6 Oct 2026 ~16:30 UTC)

- **CONFIRMED: Supabase was alive at 07:39 UTC today** — keep-alive run returned `{"ok":true,"store":"supabase"}`.
- **CONFIRMED: it is gone now.** `GET /api/runtime/keep-alive` → **503** `{"ok":false,"store":"supabase","detail":"Supabase runtime store failed: contacts: error code: 1016"}` (1016 = the project hostname no longer resolves). `/api/runtime/health` → `ok:false`, all 60 migration-coverage objects missing.
- **CONFIRMED: static pages still serve**: `/` 200, `/login` 200, `/request-event` 200. Every action that reads or writes the store (request-an-event submit, event console, attendee entry/chat, asset upload, self-serve login) now fails. Tomorrow's 07:17 keep-alive run will go red.
- **CONFIRMED defect found in passing:** `services/events/crewPageReadsProbe.ts:18` swallows the store error (`.catch(() => [])`) and reports `ok:true, "no runtime event to probe yet"` while the database is gone — a Rule 0 "green while inert" probe. Fixed in the build (§6).
- **CONFIRMED: deploys are manual** (`deploy-cloudflare-worker.yml` is `workflow_dispatch` only; last dispatch 27 Aug 2026), not self-deploy on green `main`. The build adds the D1 migration step to that workflow and makes it run on green `main`.

### What the deleted account took
- **SUSPECTED: test/rehearsal data, not client events.** No real-event evidence: the repo had 2 commits since 18 Sep; the event data in-repo is demo/seed (`data/events/*`); no "Your event with West Peek" / request-intake mail in her Gmail since 1 Sep; Supabase Free has no backups and the org was deleted, so nothing is recoverable to check. Could have held: any `request_event_intake` rows submitted on westpeek.live, contacts, self-serve accounts, uploaded assets. **No export exists** (searched `~` to depth 4 for `*.dump` / `*.sql` exports: none).
- **CONFIRMED lost regardless:** the Supabase Auth user list and every file in the `event-assets` bucket.

## 3. Cloudflare mapping and the $0 check

The account is already on **Workers Paid** (since 16 Sep 2026), so "$0" means no new subscription and staying inside the allowances that plan already includes.

| Supabase capability | Cloudflare replacement | Allowance in Workers Paid (already paid) | This app's shape | Bills? |
|---|---|---|---|---|
| Postgres (51 live tables) | **D1** `west-peek-live` (binding `DB`) | 25 B rows read / mo, 50 M rows written / mo, 5 GB storage | A 500-attendee, 3-hour event polling chat every 4 s = ~1.35 M requests; at ≤50 rows read each (LIMITed, indexed) ≈ 70 M rows read — **0.3 % of the allowance**. Heartbeats every 20 s ≈ 270 K writes/event — 0.5 %. Data size: KBs–MBs. | **$0** |
| RLS (service-role only) | Nothing — checks already in Worker code | — | — | $0 |
| Storage bucket `event-assets` | **R2** bucket `west-peek-live-assets` (binding `ASSETS_BUCKET`), private | 10 GB-month, 1 M Class A, 10 M Class B, **no egress fees** | Event decks, logos, images: well under 1 GB | **$0** |
| Signed upload / download URLs | Worker routes: `POST /api/assets/upload` streams the body into R2 via the binding (no S3 keys needed); downloads via `/api/assets/file/<id>?exp=&sig=` HMAC-signed with the existing `V5_ACCESS_COOKIE_SECRET` pattern | Worker requests (10 M/mo included) | Request body cap 100 MB per upload (zone plan) — enough for decks/logos; video recordings already go to LiveKit/Stream, not here | $0 |
| Supabase Auth (self-serve email+password, reset) | **App-owned**: `auth_users` + `auth_sessions` tables in D1; PBKDF2-SHA256 (Web Crypto, 100 000 iterations — the Workers maximum) + per-user salt; session = random token in an HttpOnly cookie, hashed in D1; reset = single-use token emailed through the existing Resend path | D1 + Worker CPU | Self-serve is gated behind `NEXT_PUBLIC_SELF_SERVE_ENABLED`; handful of users | $0 |
| Keep-alive cron | **Delete it** — D1 never pauses | — | — | $0 |
| Realtime (unused) | Not needed. Optional later: a **Durable Object** per live room (SQLite-backed, WebSocket hibernation) to replace 4 s polling | 1 M DO requests + 400 K GB-s / mo included | Hibernating sockets bill only on messages; would fit, but polling already fits D1 with ~300× headroom — **not in this build** | $0 if ever built |
| Cron, Queues | Not used by the app; **Queues are not needed** | — | — | — |

**Verdict: yes — Cloudflare replaces everything Supabase did, at $0 incremental.** Nothing is left that needs a paid alternative. The two hard parts:
1. **Rewriting the store**: `SupabaseRuntimeStore` (1,457 lines, PostgREST builder chains incl. 26 `.or/.ilike` filters) → `D1RuntimeStore` with SQL, plus 4 smaller files using the client directly (`supabase-query`, `coreReadModel`, `eventRepository`, `clientService`…).
2. **Porting the schema to SQLite**: 322 `timestamptz`, 89 `gen_random_uuid()` defaults, 78 `jsonb`, 19 array columns, 318 foreign keys, 12 `do $$` blocks, 138 `alter table`s.

## 4. D1 migration list

Rule: **one fresh, flattened D1 schema, not a replay of 46 Postgres files.** Production data is gone, so there is nothing to migrate row-by-row; the schema is rebuilt from what the code reads.

`migrations-d1/0001_core.sql` … `0006_*.sql` (wrangler `migrations_dir: "migrations-d1"`), grouped by domain. Only the **51 tables the code touches** are created; the other 67 (e.g. `vendors`, `sponsor_booths`, `video_rooms`, v4 analytics) are dead Postgres-era tables and are dropped, recorded in `docs/SUPABASE_TO_CLOUDFLARE.md` §4 and guarded (§6).

| D1 file | Tables (source Postgres migration) |
|---|---|
| 0001_core | agencies, agency_members, profiles, clients, contacts, events, audit_logs (0001, 0030) |
| 0002_approvals_inbox | approval_requests, approval_comments, production_inbox_items, last_minute_change_requests (0001, 0002) |
| 0003_runtime | runtime_events, runtime_clients, runtime_agency_settings, runtime_event_templates, runtime_house_defaults, request_event_intake, how_it_works_pages, event_assets, event_backup_rooms, event_code_history, suppliers, supplier_event_links (0023, 0024, 0031, 0033, 0035, 0036, 0043, 0045, 0046) |
| 0004_attendees_live | attendee_profiles, attendee_sessions, attendee_permissions, attendee_live_capabilities, attendee_live_control_states, attendee_agenda_intents, special_guest_profiles, event_guest_states, sponsor_lead_opt_ins, stage_stream_states, stage_stream_events, live_chat_messages, live_chat_moderation_states, live_chat_post_rates (0021, 0022, 0025, 0026, 0029, 0034, 0037, 0038) |
| 0005_networking_email | networking_queue_entries, networking_queue_matches, runtime_email_sends, runtime_email_group_sends, runtime_email_unsubscribes (0027, 0028, 0032, 0044) |
| 0006_events_audit_auth | v5_access_attempt_events, v5_analytics_events, v5_runtime_fallback_events, v6_email_events, v6_incident_events, v6_registration_events, v6_room_fallback_states, v6_run_of_show_runtime_events, v6_support_requests (0019, 0020) + **new** auth_users, auth_sessions, auth_password_resets |

Type translation (enforced by a validator, §6):
- `uuid` → `TEXT` (ids from `crypto.randomUUID()` in Worker code; drop `gen_random_uuid()` defaults).
- `timestamptz` / `now()` → `TEXT` ISO-8601 UTC, default `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`.
- `jsonb` → `TEXT` with `CHECK (json_valid(col))`; reads via `JSON.parse` in the row mappers that already exist.
- `text[]` → `TEXT` JSON array.
- `boolean` → `INTEGER` 0/1 (mappers coerce).
- `check (...)`, `references`, indexes: kept (D1 enforces FKs). `do $$` / `exception when duplicate_object` blocks → plain `CREATE … IF NOT EXISTS`.
- `.ilike` → `LIKE` (SQLite LIKE is case-insensitive for ASCII); `.or()` → explicit `OR` SQL.
- RLS: **75 `enable row level security` + 9 service-role policies are dropped**; no check moves, because the service-role key bypassed them — the authorisation that ran in production is the Worker middleware/V5 cookie code, which is unchanged.

## 5. Env / secret changes

Removed (Worker secrets + `lib/env.ts` + `.env.example` + `_env_contract.json` + `ENVIRONMENT_VARIABLES.md`):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROOF_TABLE`, `SUPABASE_PLAN`, and `AGENCY_EVENT_OS_RUNTIME_STORE` value `supabase` (becomes `d1`).

Added — **bindings, not secrets** (wrangler.jsonc), so nothing is pasted anywhere:
- `d1_databases: [{ binding: "DB", database_name: "west-peek-live", migrations_dir: "migrations-d1" }]`
- `r2_buckets: [{ binding: "ASSETS_BUCKET", bucket_name: "west-peek-live-assets" }]`

No new secrets: signed asset URLs and auth sessions reuse `V5_ACCESS_COOKIE_SECRET`; reset emails reuse `RESEND_API_KEY`. No reserved names used.

## 6. Code, tests and validators that change

Code (~35 files):
- **New** `services/runtime/d1RuntimeStore.ts` implementing `RuntimeStore`; `runtimeStoreFactory.ts` picks `d1` when `DB` is bound (via `getCloudflareContext()`), `file` locally.
- **Delete** `services/runtime/supabaseRuntimeStore.ts`, `supabaseKeepAlive.ts`, `services/supabase-query/*`, `lib/supabase/*`, `app/api/runtime/keep-alive/route.ts`, `.github/workflows/supabase-keep-alive.yml`, `.github/workflows/supabase-migration-apply.yml`, `supabase/` (config + mirror), `scripts/supabase_apply_verdict.js`; drop `@supabase/supabase-js` from package.json.
- Port direct-client users: `services/persistence/coreReadModel.ts`, `services/events/eventRepository.ts`, `services/clients/clientService.ts`, `services/agencies/agencyService.ts`, `services/attendees/peopleDirectoryService.ts`, `services/event-intake/inboxPersistenceService.ts`, `services/approval-ops/approvalPersistenceService.ts`, `services/change-control/changePersistenceService.ts`, `services/capacity/capacityReadingService.ts`, `lib/actions/*` (5).
- Assets: `eventAssetService.ts`, `signedUrlService.ts` → R2 binding; `AssetUploader.tsx`, `HouseLogoUploader.tsx` → POST to the Worker instead of PUT to Supabase.
- Auth: `lib/auth/actions.ts`, `getCurrentUser.ts`, `authService.ts`, `app/auth/callback/route.ts` → app-owned D1 auth. While here: `middleware.ts:60` lets `/app` and `/admin` through on the **presence** of the auth cookie; it will verify the session token instead.
- `services/runtime/migrationCoverageProbe.ts` + `crewPageReadsProbe.ts` → probe D1 (`sqlite_master`); the probe stops swallowing store errors (`ok:false` when the store throws).
- UI copy that names Supabase (`SupabaseRuntimePanel.tsx`, `RuntimeSchemaStop.tsx`, `RealDataStatusPanel.tsx`, `OperationalPersistencePanel.tsx`, `lib/manual/*`, `lib/capacity/capacityPlans.ts`) → D1/R2.

Tests and validators (strengthened, never weakened):
- `tests/unit/supabaseQueryIntegration.test.ts` → `d1RuntimeStore.test.ts` against Miniflare D1 (`@cloudflare/vitest-pool-workers` or `wrangler`'s `getPlatformProxy`), covering every `RuntimeStore` method at least as strictly.
- `scripts/validate_supabase_schema_parity.js` (`validate:supabase-schema`, in `deploy:doctor`) → `validate_d1_schema_parity.js`: every table/column the D1 store reads exists in `migrations-d1`; hard-fail on zero tables; forbids `jsonb|timestamptz|gen_random_uuid|do \$\$` in D1 SQL.
- New validator: **no `supabase` string in `src` paths, workflows, env contract or package.json** (break → watch fail → restore), registered in `_validator_admission_register.json`.
- New unit tests: auth (hash/verify, session expiry, reset token single use), signed asset URL (expired / tampered signature rejected), probe returns `ok:false` when the store throws.
- 47 scripts mention Supabase; each is either deleted (Supabase-only) or re-pointed; the e2e suites that hit persistence run once against a local D1 at the end of the batch, not per change.

## 7. Deploy sequence

1. `npx wrangler d1 create west-peek-live` and `npx wrangler r2 bucket create west-peek-live-assets` (local OAuth already has `d1 (write)` and R2; **no dashboard step**). Put the D1 id in wrangler.jsonc.
2. Merge the build PR on a green fast gate.
3. `deploy-cloudflare-worker.yml`: add `npx wrangler d1 migrations apply west-peek-live --remote` **before** `cf:deploy`, and trigger the workflow on green `main` (push) as well as dispatch. If the CI `CLOUDFLARE_API_TOKEN` lacks D1/R2 edit, the step fails loudly with a named stop; the token is re-scoped through the API from her logged-in wrangler session, not by her.
4. Deploy; `wrangler secret delete` the five SUPABASE_* secrets; set `AGENCY_EVENT_OS_RUNTIME_STORE=d1`.
5. Prove live: `/api/runtime/health` `ok:true` with D1 coverage; submit one request-event intake, upload one asset, read it back via a signed URL, post one chat message, sign up + reset one self-serve test account; delete the test rows.
6. Watch `main` to green.

## 8. Size

- **~35 code files touched, ~15 deleted, 6 D1 migrations, 2 workflows removed, 1 changed, 3 validators/tests replaced + 3 new.**
- **≈ 2–3 days of agent work**, one agent in this repo (store rewrite ≈ 1.5 days; auth + R2 ≈ 0.5 day; validators, deploy, live proofs ≈ 0.5 day).

## 9. What needs Sequoia

**Nothing.** D1 and R2 are created from the CLI session already logged in; no new account, no dashboard click, no secret to hand over.
