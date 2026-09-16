# LiveKit webhooks and the polled reconcile

Status: ACTIVE
Owner: release operator

## Why this page exists

On 15/16 Sep 2026 a real RTMP feed ran into the LiveKit ingress for 12 minutes and the testing console read **"Last webhook: None yet"** the whole time. The LiveKit Cloud project had never been told where to send webhooks. The show was carried by the polled reconcile (`services/video/livekitIngressService.ts` → `reconcileIngressWithLiveKit`, called on every read of `/api/video/stage-stream-state`, which the stage player polls every ~10s and which is throttled to one LiveKit call per 5s per stage).

The webhook is the fast path. The poll is the floor. Both must be true for a show.

## Register the webhook (one time per LiveKit project)

1. Open **LiveKit Cloud → your project → Settings → Webhooks**.
2. **Add endpoint** and paste exactly:

   ```
   https://westpeek.live/api/video/livekit-webhook
   ```

   (The testing console shows this URL, derived from the request host, with a copy button: `/admin/testing/<eventId>` → StreamYard-compatible RTMP panel → *LiveKit webhook registration*.)
3. Leave the default event selection; the app acts on `ingress_started` and `ingress_ended` and ignores the rest safely (`{ ok: true, ignored: true }`).
4. Save. The next ingress start/stop should flip **Last webhook** on the testing console from *None yet* to the event name and time.

## How the app verifies a webhook

`app/api/video/livekit-webhook/route.ts` fails closed (401) unless one of these holds:

- **LiveKit's own token** — LiveKit sends `Authorization: <JWT>` signed with the project's API secret. The route verifies it with `LIVEKIT_API_SECRET` (and, when `LIVEKIT_API_KEY` is set, requires `iss` to match). This is the path LiveKit Cloud uses; no extra secret is needed.
- **An HMAC header** — `x-livekit-signature` (or `x-west-peek-live-signature`) = hex HMAC-SHA256 of the raw body with `LIVEKIT_WEBHOOK_SECRET`. Used by the e2e suites and any relay.

Secrets are never echoed in a response. `tests/e2e/provider-webhook-security.spec.ts` proves the fail-closed cases.

## Reading the testing console

| "Last webhook" reads | Meaning |
| --- | --- |
| `ingress_started · 8:02:11 PM` | The webhook is registered and arriving. |
| `None yet — polling is carrying the state (every ~10s)` | No webhook has ever arrived for this stage, but the reconcile has asked LiveKit and is carrying the state. Register the webhook. |
| `None yet` | Nothing has arrived and nothing has polled (no ingress yet, or LiveKit credentials missing). |

## Intentional end vs dropped feed

When the ingress stops publishing the ladder steps down to Daily — right for a dropped feed, wrong at the end of a show. Two signals say "over", in either order:

- **End the show** (crew console, command page, publish page, testing console) marks the stage intentionally ended and sets the event to `ended`.
- The event already being `ended` (the publish page's *End event*).

With either present, `ingress_ended` — from the webhook or the poll — becomes `ENDED`, not a Daily failover. `tests/unit/endShowOrdering.test.ts` and `tests/e2e/end-the-show.spec.ts` prove both orders and the dropped-feed control.
