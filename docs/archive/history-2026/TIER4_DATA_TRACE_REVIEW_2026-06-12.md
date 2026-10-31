# Tier 4 Data Trace Review — LiveKit RTMP/Twirp Failure Class

## Purpose

This note locks the Tier 4 validation matrix distinction between:

- **Tier 4 harness/test failures** — the proof runner, local env restore, ffmpeg broadcaster, evidence writer, or test orchestration fails before exercising the deployed app.
- **Real deployed app failures** — the deployed Worker/API route executes and returns an error from app code, runtime API usage, provider integration, persistence, authorization, or fallback handling.

The controlled RTMP proof must trace both. A quiet test harness pass is not enough. A test harness failure is also not automatically an app failure.

## Hostile finding

Two LiveKit Twirp callers existed:

1. `services/video/livekitIngressService.ts` — real deployed app path: `/api/video/livekit-ingress`
2. `scripts/tier4_controlled_rtmp_broadcaster_proof.mjs` — Tier 4 harness/provider observation path

Both can receive `LIVEKIT_URL=wss://...` because the same value is also valid for browser/client LiveKit connections. Server-side Twirp `fetch()` must use the HTTP API base URL instead.

Required normalization:

- `wss://host` → `https://host`
- `ws://host` → `http://host`
- `https://host` remains unchanged

## Contract added

`validate:livekit-twirp-url-contract` now hard-fails if a LiveKit Twirp caller builds `/twirp/livekit...` from a raw LiveKit URL without explicit WebSocket-to-HTTP normalization. It also requires Tier 4 controlled proof reports to include:

- `failureClass`
- `tier4DataTrace` / `trace`
- deployed app ingress request/response phase
- harness LiveKit Twirp request phase

## Resulting validation model

- `npm run validate` catches this URL-normalization class before deploy.
- `npm run postdeploy:full` proves the deployed public/runtime route bundle is still safe.
- `npm run tier4:auto-controlled-livekit-proof` distinguishes harness failures from deployed app failures and preserves the trace in `reports/tier4/tier4-controlled-rtmp-broadcaster-proof.json`.

## Hostile-review conclusion

This patch fixes both the real app LiveKit Twirp path and the Tier 4 harness LiveKit Twirp path. It also changes the harness output so the next Tier 4 result exposes whether the blocker is env/operator gate, test harness, provider, or deployed app behavior.

## Remaining proof boundary

This patch does not claim real Tier 4 pass. It removes a known failure class and improves proof traceability so the next Tier 4 run can expose the next true blocker, whether harness-side or app-side.

## 2026-06-12 cleanup addendum

The Tier 4 data trace revealed a real LiveKit provider quota failure: `total ingress object limit exceeded`. This was caused by retained controlled-test ingress objects. The fix is not another route smoke; the fix is a cleanup lane.

New required trace phases:

- `livekit_ingress_cleanup_start`
- `livekit_ingress_cleanup_result`

New failure class:

- `REAL_PROVIDER_RESOURCE_QUOTA_OR_CLEANUP_FAILURE`

New scripts:

- `tier4:cleanup-livekit-ingress`
- `validate:tier4-cleanup-contract`

Tier 4 cannot be marked complete if the cleanup lane is absent, if cleanup fields are default narrative text, or if provider quota is exhausted by stale Tier 4 ingress objects.

## Tier 4 Expanded Provider Ladder Data Trace — 2026-06-12

Tier 4 is not only StreamYard/LiveKit. The live-provider proof must trace the full production fallback ladder:

1. LiveKit-only deployed app ingress creation and cleanup via `Ingress/DeleteIngress`.
2. StreamYard-compatible controlled RTMP path through LiveKit ingress, with cleanup.
3. Daily fallback room creation, token issuance, and mandatory room deletion.
4. Zoom fallback authorization proof through the deployed signature route; no provider resource is created, so cleanup status must be `not_required_stateless_signature`.
5. Google Meet manual continuity proof through `GOOGLE_MEET_MANAGED_FALLBACK_URL` or `GOOGLE_MEET_EMERGENCY_URL`; if intentionally out of scope, `TIER4_GOOGLE_MEET_NOT_APPLICABLE_REASON` must be explicit.

A Tier 4 report that omits Daily, Zoom, or Google Meet is incomplete for this product promise. Cleanup must be machine-readable, not narrative-only.

## Final Hostile Pass — Provider Ladder / Cleanup / Stale Cache Guard

This pass verifies the failure classes observed during Tier 4 are not limited to the StreamYard + LiveKit route and do not silently recur in fallback lanes.

### Guarded failure classes

- **LiveKit Twirp URL class:** every LiveKit Twirp caller must normalize `wss://` / `ws://` to HTTP(S) before server-side `fetch()`.
- **Test harness parity class:** Tier 4 harness Twirp calls use the same normalization class as deployed app code.
- **Provider quota class:** controlled RTMP proof auto-deletes LiveKit ingress via `Ingress/DeleteIngress`; stale inactive `tier4-auto-*` cleanup is available through `tier4:cleanup-livekit-ingress`.
- **Stale app cache class:** deployed app verifies cached LiveKit ingress ids through `Ingress/ListIngress` before returning existing RTMP credentials. Deleted ingress credentials are not treated as valid app state.
- **Daily fallback cleanup class:** Daily room creation/token proof is wrapped with cleanup; created rooms must return `cleanupStatus=deleted` even when the token lane fails.
- **Zoom fallback cleanup class:** Zoom Meeting SDK is stateless; Tier 4 must prove unauthorized denial, authorized signature issuance, and `cleanupStatus=not_required_stateless_signature`.
- **Google Meet fallback cleanup class:** Google Meet is manual continuity; Tier 4 must prove valid HTTPS Meet/Google URL or explicit not-applicable reason, with `cleanupStatus=not_required_manual_static_link` / `not_required_not_applicable`.

### Trace phases now expected

- `deployed_app_livekit_ingress_request`
- `deployed_app_livekit_ingress_response`
- `harness_livekit_twirp_request`
- `livekit_ingress_cleanup_start`
- `livekit_ingress_cleanup_result`
- `daily_room_create_start`
- `daily_token_create_result`
- `daily_room_cleanup_result`
- `zoom_unauth_signature_result`
- `zoom_auth_signature_result`
- `google_meet_url_check_result`
- `provider_lane_result`

### Verdict

Tier 4 COMPLETE cannot be claimed unless provider evidence shows app path, harness path, provider fallback path, authorization boundary, and cleanup/teardown semantics for every configured lane.
