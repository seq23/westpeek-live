# Environment Variables — Agency Event OS

Status: ACTIVE
Date: 2026-06-11

Purpose: safe env contract for local, CI, Cloudflare Worker, postdeploy, and provider proof operations. This file records names and handling rules only. It must never contain real secret values.

## Secret handling law

- Real `.env`, `.env.local`, `.env.production`, backup env files, Cloudflare secret exports, API tokens, private keys, and provider credentials are forbidden in source artifacts.
- Local restoration must use `npm run env:restore`; cleanup must use `npm run env:remove`.
- Cloudflare/GitHub/provider values live in their platforms or owner vault, not this repo.
- Real StreamYard/LiveKit media proof requires operator confirmation and real provider credentials.

## Runtime env categories

### Required production / Cloudflare secrets

| Key | Handling |
|---|---|
| `AGENCY_EVENT_OS_RUNTIME_STORE` | Required production/Cloudflare secret or env value. |
| `ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION` | Required production/Cloudflare secret or env value. |
| `AUTH_SESSION_COOKIE_NAME` | Required production/Cloudflare secret or env value. |
| `BILLING_REQUIRED_FOR_SELF_SERVE` | Required production/Cloudflare secret or env value. |
| `CREW_ACCESS_PASSWORD` | Required production/Cloudflare secret or env value. |
| `DAILY_API_BASE_URL` | Required production/Cloudflare secret or env value. |
| `DAILY_API_KEY` | Required production/Cloudflare secret or env value. |
| `DAILY_DOMAIN` | Required production/Cloudflare secret or env value. |
| `DAILY_FALLBACK_ENABLED` | Required production/Cloudflare secret or env value. |
| `DAILY_STAGE_FALLBACK_REQUIRES_TOKEN` | Required production/Cloudflare secret or env value. |
| `EMAIL_FROM` | Required production/Cloudflare secret or env value. |
| `EMAIL_REPLY_TO` | Required production/Cloudflare secret or env value. |
| `EVENT_DEMO_CLIENT_CODE` | Required production/Cloudflare secret or env value. |
| `EVENT_DEMO_CREW_LITE_CODE` | Required production/Cloudflare secret or env value. |
| `EVENT_DEMO_SPEAKER_CODE` | Required production/Cloudflare secret or env value. |
| `EVENT_DEMO_SPONSOR_CODE` | Required production/Cloudflare secret or env value. |
| `EVENT_DEMO_VIP_CODE` | Required production/Cloudflare secret or env value. |
| `LIVEKIT_API_KEY` | Required production/Cloudflare secret or env value. |
| `LIVEKIT_API_SECRET` | Required production/Cloudflare secret or env value. |
| `LIVEKIT_INGRESS_RTMP_BASE_URL` | Required production/Cloudflare secret or env value. |
| `LIVEKIT_URL` | Required production/Cloudflare secret or env value. |
| `LIVEKIT_WEBHOOK_SECRET` | Required production/Cloudflare secret or env value. |
| `NEXT_PUBLIC_APP_URL` | Required production/Cloudflare secret or env value. |
| `NEXT_PUBLIC_BUILD_ID` | Build-time stamp set by `next.config.js` (never a secret, never set by hand): `WORKERS_CI_COMMIT_SHA` on Workers Builds, else the git head, else the clock; `dev` under `next dev`. Inlined into the client bundle and the Worker so the venue polls can tell a stale page a new version is live and reload it (build-version watchdog). |
| `NEXT_PUBLIC_SELF_SERVE_ENABLED` | Required production/Cloudflare secret or env value. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required production/Cloudflare secret or env value. |
| `NEXT_PUBLIC_SUPABASE_URL` | Required production/Cloudflare secret or env value. |
| `OPERATOR_LAUNCHPAD_PASSWORD` | Required production/Cloudflare secret or env value. |
| `OWNER_MASTER_ACCESS_PASSWORD` | Required production/Cloudflare secret or env value. |
| `OWNER_MASTER_ACCESS_PASSWORD_2` | Optional second owner master password (≥12 chars, must differ from every other production password). Honoured everywhere the first is: /production-access/owner and the owner override on the operator, crew, and special-guest gates. The owner cookie records `ownerKey: "primary" \| "secondary"` so the access audit can tell them apart; both are full owners. Set with `npx wrangler secret put OWNER_MASTER_ACCESS_PASSWORD_2`; absent means only the first works. |
| `RESEND_API_KEY` | Required production/Cloudflare secret or env value. |
| `SELF_SERVE_EVENT_CREATION_ENABLED` | Required production/Cloudflare secret or env value. |
| `STAGE_STREAM_DEFAULT_SOURCE` | Required production/Cloudflare secret or env value. |
| `STREAMYARD_PRIMARY_ENABLED` | Required production/Cloudflare secret or env value. |
| `SUPABASE_SERVICE_ROLE_KEY` | Required production/Cloudflare secret or env value. |
| `V5_ACCESS_COOKIE_SECRET` | Required production/Cloudflare secret or env value. |
| `V5_CREW_COOKIE_NAME` | Required production/Cloudflare secret or env value. |
| `V5_OPERATOR_COOKIE_NAME` | Required production/Cloudflare secret or env value. |
| `V5_OWNER_COOKIE_NAME` | Required production/Cloudflare secret or env value. |
| `V5_SPECIAL_GUEST_COOKIE_NAME` | Required production/Cloudflare secret or env value. |
| `VIDEO_PROVIDER` | Required production/Cloudflare secret or env value. |
| `ZOOM_MEETING_SDK_KEY` | Required production/Cloudflare secret or env value. |
| `ZOOM_MEETING_SDK_SECRET` | Required production/Cloudflare secret or env value. |

### Local-only / test controls

| Key | Handling |
|---|---|
| `AGENCY_EVENT_OS_ENV_BACKUP` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `E2E_CREW_PASSWORD` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `E2E_EVENT_CODE` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `E2E_OPERATOR_PASSWORD` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `E2E_OWNER_PASSWORD` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `E2E_SPEAKER_CODE` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `E2E_SPONSOR_CODE` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `E2E_VIP_CODE` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `LOCAL_PLAYWRIGHT_GAUNTLET_AUTH` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `NODE_OPTIONS` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `PLAYWRIGHT_BASE_URL` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `PLAYWRIGHT_DEPLOYED` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `PLAYWRIGHT_DISABLE_VIDEO` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `PLAYWRIGHT_HEADED` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `PLAYWRIGHT_LOCAL_E2E` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `PLAYWRIGHT_RETRIES` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `PLAYWRIGHT_SKIP_WEBSERVER` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `PORT` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `POSTDEPLOY_BASE_URL` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `SMOKE_BASE_URL` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `STREAMYARD_E2E_EVENT_ID` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `STREAMYARD_OPERATOR_CONFIRMED_BROADCAST` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `STREAMYARD_REAL_PROVIDER_SMOKE` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `VALIDATE_ENV_STRICT` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |
| `WEST_PEEK_LIVE_PROVIDER_PROOF` | Local/test-only control. Do not configure as production runtime secret unless explicitly documented. |

### Optional development values

| Key | Handling |
|---|---|
| `AGENCY_EVENT_OS_RUNTIME_STORE_PATH` | Optional development/config helper. |
| `ALLOW_MOCK_VIDEO_PROVIDER_IN_PRODUCTION` | Optional development/config helper. |
| `CLOUDFLARE_PROJECT_NAME` | Optional development/config helper. |
| `CLOUDFLARE_WORKER_NAME` | Optional development/config helper. |
| `GITHUB_EVENT_CONFIG_OWNER` | Optional development/config helper. |
| `GITHUB_EVENT_CONFIG_REPO` | Optional development/config helper. |
| `GITHUB_EVENT_CONFIG_TOKEN` | Optional development/config helper. |
| `GITHUB_EVENT_CONFIG_WORKFLOW` | Optional development/config helper. |
| `GOOGLE_MEET_EMERGENCY_URL` | Optional development/config helper. |
| `NEXT_PUBLIC_ENABLE_ZOOM_EMBEDDED_FALLBACK` | Optional development/config helper. |
| `V4_ACCESS_COOKIE_SECRET` | Optional development/config helper. |
| `V4_CREW_COOKIE_NAME` | Optional development/config helper. |
| `V4_SPECIAL_GUEST_COOKIE_NAME` | Optional development/config helper. |
| `ZOOM_SDK_KEY` | Optional development/config helper. |
| `ZOOM_SDK_SECRET` | Optional development/config helper. |

## Proof commands

- `npm run validate:env` — static env contract validation.
- `npm run env:trace` — local/example/registry/Cloudflare manifest parity trace.
- `npm run env:restore` — restore local env from the canonical encrypted vault when available.
- `npm run env:remove` — remove/sanitize local env after live proof.
- `npm run cf:secrets:audit` — compare required secret names with Cloudflare/project manifests.
- `npm run cf:secrets:sync` — operator-facing sync helper; no secret values committed.

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

## Tier 4 proof-only controls


| `TIER4_LIVE_PROVIDER_OPERATIONAL_PROOF` | Local/operator-run proof control. Set to `1` only when intentionally running Tier 4 real-provider proof. Do not configure as a production runtime secret. |
| `TIER4_STREAMYARD_LIVE_EVIDENCE_PATH` | Local/operator-run proof control. Path to redacted StreamYard/LiveKit evidence JSON. Do not include stream keys or provider secrets. |
| `TIER4_EMAIL_TEST_TO` | Local/operator-run proof control. Approved test recipient for Tier 4 Resend proof. Do not use a production attendee blast list. |
| `TIER4_EVENT_ID` | Local/operator-run proof control. Event id used for Tier 4 deployed provider/persistence/user-journey proof. |
| `TIER4_STAGE_ID` | Local/operator-run proof control. Stage id used for Tier 4 StreamYard/LiveKit and fallback proof. |
| `TIER4_ZOOM_MEETING_NUMBER` | Local/operator-run proof control. Non-secret Zoom meeting number used for authorized SDK signature proof. |
| `TIER4_SUPABASE_PROOF_TABLE` | Local/operator-run proof control. Supabase table used for production write/readback proof; default is v5_analytics_events. |
| `TIER4_RESEND_SEND_APPROVED` | Local/operator-run proof control. Must be 1 before Tier 4 sends exactly one approved Resend test email. |
| `TIER4_CONTINUE_AFTER_FAILURE` | Local/operator-run diagnostic control. Set to 1 only when intentionally harvesting all Tier 4 failures in one run. |

| STREAMYARD_E2E_STAGE_ID | Local/test-only Tier 4 stage identifier. Do not configure as production runtime secret unless explicitly documented. |

| TIER4_CONTROLLED_RTMP_BROADCASTER | Local/test-only guard for the automated controlled RTMP broadcaster Tier 4 proof. |

| TIER4_FFMPEG_BIN | Local/test-only optional ffmpeg binary path for controlled RTMP proof. |

| TIER4_CONTROLLED_RTMP_SECONDS | Local/test-only duration for controlled RTMP proof broadcast. |

| TIER4_CONTROLLED_RTMP_POLL_TIMEOUT_MS | Local/test-only provider polling timeout for controlled RTMP proof. |

| TIER4_CONTROLLED_RTMP_RETAIN_INGRESS | Local/test-only override. Set to `1` only when intentionally retaining a LiveKit ingress after Tier 4 proof. Requires `TIER4_CONTROLLED_RTMP_RETAIN_REASON`. |

| TIER4_CONTROLLED_RTMP_RETAIN_REASON | Local/test-only required reason when retaining a controlled Tier 4 LiveKit ingress. Silent retention is not allowed. |

| TIER4_LIVEKIT_CLEANUP_APPROVED | Local/test-only cleanup guard. Set to `1` to approve deletion of stale Tier 4 LiveKit ingress objects through `tier4:cleanup-livekit-ingress`. |

| TIER4_LIVEKIT_CLEANUP_INGRESS_IDS | Optional comma-separated LiveKit ingress ids for explicit cleanup. Default cleanup deletes only safe `tier4-auto-` ingress resources. |

| CLOUDFLARE_DEPLOYMENT_ID_REDACTED | Local/test-only optional redacted deployment id for Tier 4 evidence. |

| GITHUB_ACTIONS_STATUS_VERIFIED | Local/test-only optional deploy status marker for Tier 4 evidence. |

| `TIER4_GOOGLE_MEET_NOT_APPLICABLE_REASON` | Explicit owner disposition when Google Meet is intentionally out of scope for Tier 4. |
| `GOOGLE_MEET_MANAGED_FALLBACK_URL` | Optional Google Meet manual fallback continuity URL for Tier 4 proof. |


## Cloudflare Stream Live fallback / Tier 4

| Variable | Purpose |
| --- | --- |
| `CLOUDFLARE_STREAM_FALLBACK_ENABLED` | Enables the automated Cloudflare Stream Live fallback proof between StreamYard-compatible LiveKit RTMP and Daily. |
| `CLOUDFLARE_STREAM_ACCOUNT_ID` / `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id used for Stream Live Inputs API proof. |
| `CLOUDFLARE_STREAM_API_TOKEN` / `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Stream Live Inputs create/read/delete permissions. |
| `CLOUDFLARE_STREAM_FALLBACK_ENABLED` | Fallback 1 armed (`1`). Configured in production 16 Sep 2026. |
| `CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL` | The iframe embed attendees see when the stage moves to Cloudflare Stream. |
| `CLOUDFLARE_STREAM_FALLBACK_RTMPS_URL` | RTMPS ingest URL the producer pastes into StreamYard → Destinations → Custom RTMP. |
| `CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY` | RTMPS stream key for that destination. Secret: masked in the UI until Reveal, never logged. |
| `CLOUDFLARE_STREAM_LIVE_INPUT_ID` | The Cloudflare Stream live input behind the pair. |
| `CLOUDFLARE_STREAM_API_BASE_URL` | Must be `https://api.cloudflare.com/client/v4` unless Cloudflare changes the API host. |
| `TIER4_CLOUDFLARE_STREAM_CONTROLLED_BROADCASTER` | Local/operator Tier 4 approval flag. Must be `1` to push a controlled ffmpeg RTMP media stream into Cloudflare Stream. |
| `TIER4_CLOUDFLARE_STREAM_SECONDS` | Local/operator Tier 4 duration for the controlled Cloudflare Stream RTMP proof. |
| `STREAMYARD_ENTERPRISE_API_BASE_URL` / `STREAMYARD_ENTERPRISE_API_TOKEN` | Reserved for future StreamYard Enterprise API automation. Current Tier 4 uses manual/operator evidence plus StreamYard-compatible controlled RTMP proof because normal StreamYard API access is enterprise-only. |

## Workers Free variable cap

A Worker on the Workers Free plan may carry at most **64** variables and secrets. On 16 Sep 2026 we hit the cap; the 20 `EVENT_{LEADERSHIP_RESET_WEBINAR,PREMIUM_WORKSHOP_INTENSIVE,PROVIDER_INNOVATION_EXPO,SEED_DEMO_DAY}_*_CODE` secrets were deleted (no runtime code read them — only manifests and docs; `EVENT_DEMO_*` stay because `lib/env/safeEnv.ts` reads them). `validate:worker-variable-budget` keeps the required-secrets manifest at 60 or fewer entries so there is always headroom under the 64 cap.
