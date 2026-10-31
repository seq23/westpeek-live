# Hostile Review — Tier 4 Attendee Surface Final Pass

Repo: `agency-event-os`
Artifact reviewed: `agency-event-os-main_BASELINE_06-12-26_tier4_attendee_surface_final.zip`
Review mode: senior hostile code review / deployed Tier 4 attendee live-consumption path
Date: 2026-06-12

## Executive finding

The prior artifact fixed the large root blockers, but the final hostile pass found one remaining validator-theater risk: the browser proof could pass on the mere presence of the attendee LiveKit surface wrapper, even if the browser never actually received a LiveKit token or the surface stayed in `loading` / `token-error` state.

This pass closes that gap. The browser gauntlet now requires all of the following before claiming attendee browser live-stage success:

1. Stage player is mounted for the requested runtime event.
2. Stage player reports `LIVEKIT_INGRESS` + `LIVEKIT_INGRESS_LIVE`.
3. The attendee LiveKit surface exists.
4. The attendee LiveKit surface reports `data-livekit-consumption-state="token-issued"`.
5. The browser itself observes `/api/video/livekit-token` return status `200`, `ok: true`, a token, and a LiveKit URL.

## What was already correct

- The stage-stream fallback route no longer returns raw provider/private stage state. It returns `toPublicStageStreamState(state)`.
- Unknown Tier 4 runtime event IDs no longer silently fall back to the Nova demo event.
- The attendee LiveKit component keeps a stable surface wrapper mounted across loading, token-issued, and token-error states so browser diagnostics can see the live-consumption surface lifecycle.
- The controlled RTMP bearer scanner no longer treats safe prose as a bearer secret.

## Hostile finding fixed in this pass

### Finding: Surface-count proof could go green without token-issued state

The prior final artifact made the LiveKit surface wrapper stable. That is correct for diagnostics and attendee UX, but the gauntlet still accepted `livekitSurface > 0` as enough for browser proof. A stable wrapper can exist during `loading` or `token-error`, so that assertion could mask a broken attendee token/browser path.

### Fix

Updated `scripts/tier4_attendee_live_consumption_gauntlet.mjs` so the browser proof:

- waits for `[data-testid="stage-player"][data-active-stream-source="LIVEKIT_INGRESS"][data-stream-status="LIVEKIT_INGRESS_LIVE"]`
- waits for `[data-testid="attendee-livekit-room-surface"][data-livekit-consumption-state="token-issued"]`
- explicitly captures the browser `/api/video/livekit-token` response
- requires `browserLivekitTokenIssued === true`
- requires `livekitSurfaceTokenIssued === true`
- requires `stagePlayerLiveKitLive === true`
- writes those fields into the Tier 4 report

Updated validators:

- `scripts/validate_tier4_attendee_live_consumption_contract.mjs`
- `scripts/validate_stage_player_ux_contract.js`

These now guard against reverting to surface-count-only proof.

## Senior-risk review

### Risk: Stable wrapper masks real user failure

Mitigated. The wrapper remains for lifecycle visibility, but proof now requires `token-issued` and browser token response success.

### Risk: Unknown event IDs become public pseudo-events

Partially accepted. The runtime identity fallback is necessary for generated Tier 4/deployed event IDs and prevents accidental cross-event proof against the Nova demo. The product may later want a stricter allowlist for arbitrary user-facing unknown IDs, but that is not a Tier 4 blocker because access-gated production paths and demo mapping remain separate.

### Risk: Operator route response might need private operator state

Accepted. The signal route is mutating state and returning confirmation. Returning public-safe state is safer than returning raw state. Operator surfaces can fetch operator state through dedicated operator-safe read routes when needed.

### Risk: Headless browser media limitations cause false failures

Mitigated to the correct layer. The gauntlet no longer requires audible media playback or a browser media connection to stay open after screenshot. It does require token-issued surface and browser-observed token issuance. Same-room media still comes from controlled broadcaster/provider evidence.

### Risk: Real deployed Tier 4 proof still needs local env

Unproven here. The artifact is structurally and statically checked in sandbox. Real deployed proof still requires local encrypted env and provider credentials.

## Validation performed in sandbox

- `node --check scripts/tier4_attendee_live_consumption_gauntlet.mjs` — PASS
- `node --check scripts/validate_tier4_attendee_live_consumption_contract.mjs` — PASS
- `node --check scripts/validate_stage_player_ux_contract.js` — PASS
- `npm run validate:stage-player-ux` — PASS
- `npm run validate:tier4-attendee-live-consumption-contract` — PASS
- `npm run validate:tier4-live-event-fallback-runtime` — PASS
- `npm run validate:tier4-provider-ladder-contract` — PASS

## Validation not claimed

- `npm run validate` was not rerun in sandbox because dependency install timed out in this environment.
- Deployed Tier 4 live-provider proof was not run in sandbox because it requires local encrypted env/provider credentials.
- Cloudflare deployment status was not checked from sandbox.

## Final hostile status

PASS FOR PATCH QUALITY / STRUCTURAL PROOF.

DEPLOYED LIVE E2E remains local-validation required.
