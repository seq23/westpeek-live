# Tier 4 Live Provider Operational Proof — agency-event-os

Status: ACTIVE
Date: 2026-06-12

## Purpose

Tier 4 proves the thing Tier 3 must not pretend to prove:

A real deployed production event operation using real credentials, real provider resources, real role boundaries, real persistence, real fallback behavior, and a safe evidence bundle.

## Tier 4 is intentionally expensive

Tier 4 may:

- use real StreamYard, LiveKit, Daily, Zoom, Resend, Supabase, and Cloudflare credentials
- create provider rooms, ingresses, tokens, messages, and persisted records
- require a human operator to start or confirm a private StreamYard broadcast
- require cleanup of provider resources
- produce reports that must be checked for secret leakage

Tier 4 is not a routine postdeploy smoke. It is the final operational proof lane.


## Automated controlled RTMP broadcaster lane

When the goal is to avoid manual StreamYard UI operation, Tier 4 may use the automated controlled RTMP broadcaster lane:

```bash
npm run tier4:auto-controlled-livekit-proof
```

This lane requires `TIER4_CONTROLLED_RTMP_BROADCASTER=1`, local ffmpeg, deployed base URL env, LiveKit env, V5 access env, Supabase env, and approved Resend recipient env when Resend is configured. It provisions/observes the deployed LiveKit ingress path, pushes synthetic audio/video through RTMP, records provider/API/state evidence without secrets, writes `reports/tier4/streamyard-livekit-evidence.json`, and then runs the normal Tier 4 live-provider proof runner.

This does not prove the StreamYard web UI itself. It proves the same Custom RTMP ingest path StreamYard uses by substituting a controlled broadcaster. Use manual StreamYard only when the requirement is specifically to prove StreamYard's UI/operator workflow.

## Required evidence packet

The StreamYard/LiveKit lane requires `TIER4_STREAMYARD_LIVE_EVIDENCE_PATH` pointing to JSON with this shape:

```json
{
  "providerLane": "streamyard-livekit",
  "deployedBaseUrl": "https://example.com",
  "eventId": "tier4-2026-06-12-001",
  "stageId": "main-stage",
  "operatorConfirmedBroadcast": true,
  "streamyardBroadcastStartedAt": "2026-06-12T00:00:00.000Z",
  "streamyardBroadcastEndedAt": "2026-06-12T00:10:00.000Z",
  "livekitIngressIdRedacted": "ingress_xxx...redacted",
  "livekitRoomNameRedacted": "tier4-event-main-stage",
  "appReportedStates": ["READY_FOR_STREAMYARD", "LIVEKIT_INGRESS_LIVE", "SWITCHING_TO_DAILY"],
  "operatorEvidenceFiles": ["reports/tier4/operator-streamyard-live.png"],
  "attendeeEvidenceFiles": ["reports/tier4/attendee-stage-live.png"],
  "secretsExposed": false,
  "cleanupStatus": "deleted_or_retained_with_reason",
  "notes": "No raw stream keys, API secrets, bearer tokens, or service role keys are stored here."
}
```

The evidence packet must never include raw RTMP stream keys, API keys, service-role keys, bearer tokens, OAuth secrets, webhook secrets, or cookies.

## Required Tier 4 lanes

The Tier 4 real provider journey probe must run through `npm run tier4:real-provider-journey-probe`. It performs deployed app route/provider checks for role boundaries, LiveKit ingress, D1 production write/readback, Daily fallback, Zoom authorization-gated signature readiness, and Resend provider email where configured.

Zoom signature route is server-side authorization gated. Unauthenticated/public callers must receive denial before any SDK signature is issued.

D1 production write/readback is mandatory for Tier 4 COMPLETE. A static env check does not satisfy persistence proof.

Resend sends exactly one approved test email only when `TIER4_RESEND_SEND_APPROVED=1` is set.

1. Real deployed runtime identity
2. Real StreamYard Custom RTMP or controlled broadcaster into LiveKit
3. Real LiveKit ingress/media/webhook state
4. Real Supabase persistence/readback when production store is enabled
5. Real Daily fallback when Daily is enabled
6. Real Zoom signature readiness when Zoom is enabled
7. Real Resend transactional send to approved test recipient when Resend is enabled
8. Role-boundary checks around private/provider surfaces
9. Evidence bundle no-secret scan
10. Cleanup/retention record

## Status rules

- `TIER 4 PASSED — REAL LIVE PROVIDER OPERATIONAL PROOF` only when all required lanes pass.
- `BLOCKED — TIER 4 LIVE PROVIDER EVIDENCE REQUIRED` when credentials/evidence/operator action are missing.
- `PARTIAL — DEPLOYED SAFE PROOF ONLY` when Tier 3 passes but Tier 4 does not run.

## Command

```bash
npm run tier4:live-provider-operational-proof
```

This command writes:

- `reports/tier4/tier4-provider-proof-report.json`
- `reports/tier4/tier4-provider-proof-report.md`
- `reports/tier4/tier4-real-provider-journey-report.json`
- `reports/tier4/tier4-real-provider-journey-report.md`

## LiveKit ingress cleanup proof

Controlled Tier 4 proof must clean up the generated LiveKit ingress after provider/media observation is captured. Evidence must show:

- `cleanupStatus: deleted` or `retained_with_explicit_reason:<reason>`
- `livekitProviderApi.cleanupAttempted`
- `livekitProviderApi.cleanupDeleted`
- trace phases `livekit_ingress_cleanup_start` and `livekit_ingress_cleanup_result`

If cleanup does not run, Tier 4 remains blocked because LiveKit ingress quota can be exhausted even when the app route and harness are otherwise correct.

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
