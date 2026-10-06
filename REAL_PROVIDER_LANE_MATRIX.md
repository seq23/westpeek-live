# Real Provider Lane Matrix — agency-event-os

Status: ACTIVE
Date: 2026-06-12

Tier 4 is the final live-provider operational proof gate. Every row below must be passed, blocked with owner acceptance, or explicitly ruled not applicable before COMPLETE.

Tier 3 may prove deployed safe-failure behavior for these lanes, but Tier 3 does not satisfy live-provider operational proof.

| Provider lane | Provider | Runtime/surface | Env keys / inputs | Tier 3 proof | Tier 4 proof required | Status |
|---|---|---|---|---|---|---|
| LiveKit media lifecycle | LiveKit | Stage media rooms, ingress/webhook/media state | LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WEBHOOK_SECRET, LIVEKIT_INGRESS_RTMP_BASE_URL | Routes fail safely or render provider readiness without secret leak. | Real provider room/ingress/webhook/media-state lane passes through the deployed app route with redacted room/ingress IDs, media connection observation, and cleanup/retention record. | REQUIRED FOR TIER 4 |
| StreamYard live broadcast | StreamYard | Primary operator broadcast source into LiveKit stage pipeline | STREAMYARD_REAL_PROVIDER_SMOKE, STREAMYARD_OPERATOR_CONFIRMED_BROADCAST, TIER4_STREAMYARD_LIVE_EVIDENCE_PATH, StreamYard Custom RTMP evidence | StreamYard/LiveKit surfaces render safely. | Real StreamYard Custom RTMP broadcast or controlled real broadcaster feeds LiveKit ingress; operator evidence packet proves timestamps/state/screenshots without secrets. | REQUIRED FOR TIER 4 |
| Daily fallback | Daily | Fallback stage/meeting provider | DAILY_API_KEY, DAILY_DOMAIN, DAILY_API_BASE_URL, DAILY_FALLBACK_ENABLED | Daily endpoints fail safely or return controlled unavailable state. | Real Daily room/token/fallback lane proves fallback activation, role scope, attendee/operator behavior, and cleanup. | REQUIRED WHEN CONFIGURED |
| Zoom manual escalation | Zoom | Manual escalation / embedded meeting fallback | ZOOM_MEETING_SDK_KEY, ZOOM_MEETING_SDK_SECRET | Zoom endpoint fails safely if missing/malformed. | Real SDK signature readiness proof, unauthenticated denial, event-scoped server-side authorization, malformed request denial, and no private credential exposure. | REQUIRED WHEN CONFIGURED |
| D1 persistence | Cloudflare D1 + R2 | Production persistence, self-serve accounts, event assets | wrangler.jsonc bindings DB and ASSETS_BUCKET (no env secrets); CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID for the Tier 4 write/readback |  Static/env/deploy route proof only. | Newly-created event lifecycle or Tier 4 proof record performs production write/readback with real scoped data, refresh/re-entry evidence, no demo fallback, and cleanup/labeling. | REQUIRED FOR TIER 4 |
| Email / Resend | Resend | Transactional notifications and event comms | RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO, TIER4_EMAIL_TEST_TO | Email surfaces do not crash/leak secrets. | Email workflow sends only one approved test message and records provider message id; no PII or key leakage. | REQUIRED WHEN CONFIGURED |
| Cloudflare/OpenNext Worker | Cloudflare/OpenNext | Deployed runtime and edge middleware | NEXT_PUBLIC_APP_URL, deployed Worker env/secrets | Fresh deploy + explicit postdeploy smoke + role/provider critical E2E pass. | Deployment identity is included in Tier 4 evidence and all live-provider checks target that URL. | REQUIRED FOR TIER 4 |

## Rule

A mocked/local provider test may support Tier 2.

A deployed safe-failure provider route may support Tier 3.

Only Tier 4 may satisfy real live provider operational proof.

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
