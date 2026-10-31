# Testing Console

## Purpose

The Testing Console is the operator-facing debug and preflight center for West Peek Live!.

It exists because a virtual event production agency cannot afford surprise video/audio failures during client events. If main stage, backstage, breakout, networking, or sponsor booth video fails, the production team needs a fast way to diagnose the issue and decide whether to continue in-platform or avoid any off-platform recovery.

## Route

```txt
/admin/testing
/admin/testing/[eventId]
```

## Primary Users

- Agency Owner
- Executive Producer
- Producer
- Technical Director
- Moderator

## Core Jobs

1. Confirm browser compatibility.
2. Confirm camera permission.
3. Confirm microphone permission and signal.
4. Confirm speaker/audio output.
5. Confirm network quality.
6. Confirm each room can be joined.
7. Confirm audio/video status per room.
8. Confirm recording readiness where relevant.
9. Surface debug incidents.
10. Recommend recovery when needed.

## MVP Behavior

The current console is seeded-backed and operator-facing. It does not yet run real browser media tests or provider API checks.

It provides:

- Overall go/no-go state.
- Recovery recommendation.
- Device diagnostic cards.
- Room diagnostic cards.
- Provider status operational surfaces.
- Incident/debug panel.
- Fast debug protocol.
- in-platform recovery decision support.

## Future Live Checks

The next implementation should add real browser-side checks:

- `navigator.mediaDevices.getUserMedia({ video: true, audio: true })`
- camera preview stream
- microphone input level meter
- audio output test tone
- permission-state checks
- browser/version checks
- network latency estimate
- packet-loss estimate where provider supports it
- provider room token generation test
- provider room join/leave test
- recording hook test
- websocket/realtime status check

## Provider Checks

When real video provider integration begins, the console should check:

- provider API health
- token generation
- room exists
- room join works
- room participant capacity
- recording enabled
- backstage room readiness
- breakout room readiness
- networking room readiness
- sponsor booth room readiness

## Recovery Protocol

If any critical check fails:

1. Identify failing room/device/network.
2. Retry once.
3. Switch browser/device/network if possible.
4. Prepare in-platform recovery.
5. Notify producer.
6. Notify client only if the recovery is likely.
7. Keep attendee-facing page stable while production decides.
8. Record incident and resolution.

## Guardrail

The testing console must never be a public attendee route. It should stay under `/admin/testing` or another protected agency-side route.


## Non-Negotiable Business Rule

The console is designed to prevent off-platform fallback. Resorting to Zoom or another external venue is treated as a catastrophic business-continuity failure, not a normal operating option.

The product should prioritize:

- early detection
- repeated preflight testing
- room isolation
- backup in-platform rooms
- device switching
- network switching
- producer intervention
- clear incident logging
- client-safe communication

The console should never casually recommend a generic Zoom/Google Meet fallback. It should surface Daily as the automatic in-platform fallback when enabled, then reserve Zoom or Google Meet for managed escalation after app-side recovery steps are exhausted or producer approval is required.


## White-Label Backup Provider

A white-label backup provider is allowed when appropriate.

Supported future backup provider options:

- Zoom
- Google Meet
- custom embedded provider
- phone bridge

Rules:

1. The client should experience the backup as part of the agency's event operating layer.
2. The console should say "Backup Room" or the agency/client-branded label, not "go to Zoom."
3. The backup room should be pre-created and tested before event day.
4. The backup URL should be controlled in event settings.
5. The producer must approve activation.
6. The incident log should record why the backup room was opened.
7. The report should capture whether recovery happened in-platform or through the white-label backup room.
8. Generic unmanaged external fallback remains a last-resort failure state, not normal operations.

## Daily Automatic Fallback Layer

Fallback order is now `LiveKit → Daily → Zoom → Google Meet`. Daily is the first automatic in-platform backup and does not require producer permission when `DAILY_FALLBACK_ENABLED=true`. Zoom and Google Meet remain managed emergency fallbacks after Daily.

Required backend-only environment/secrets:

```txt
DAILY_API_KEY=
DAILY_API_BASE_URL=https://api.daily.co/v1
DAILY_DOMAIN=westpeeklive.daily.co
DAILY_FALLBACK_ENABLED=true
```

Operational rules:

- Never expose `DAILY_API_KEY` in browser code.
- Daily room creation and meeting-token generation run server-side only.
- If `DAILY_FALLBACK_ENABLED=false`, the resolver skips Daily and falls through to Zoom, then Google Meet.
- Testing Console must show LiveKit, Daily, Zoom, Google Meet, Resend, D1 runtime store, route, OpenNext, and browser-console smoke status before production events.

## Master Plan v4

V4 Testing Console should show Route Health, Access Gate, Event Config, Publishing, Video Providers, Email/Resend, D1 Runtime, Run of Show, Attendee Experience, Security, Smoke Tests.
