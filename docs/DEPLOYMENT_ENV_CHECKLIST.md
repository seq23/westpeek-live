# West Peek Live! Deployment Env Checklist

## Required env vars

```txt
NEXT_PUBLIC_APP_URL=
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
RESEND_API_KEY=
EMAIL_FROM=
EMAIL_REPLY_TO=
AUTH_SESSION_COOKIE_NAME=
VIDEO_PROVIDER=livekit
```

## Expected values

```txt
EMAIL_FROM="Scooter (CEO of West Peek) <notifications@events.westpeek.live>"
EMAIL_REPLY_TO=hello@westpeek.live
VIDEO_PROVIDER=livekit
```

## Rules

- Never commit `.env.local`.
- Deployment env vars must be added to the hosting provider separately.
- Local env backup does not configure production.
- Service role key must remain server-side.
- `LIVEKIT_URL` should start with `wss://`.
- `RESEND_API_KEY` should start with `re_`.

## Verification command

Run locally after restoring `.env.local`:

```zsh
python3 - <<'PY'
from pathlib import Path

path = Path(".env.local")
required = [
    "NEXT_PUBLIC_APP_URL",
    "LIVEKIT_URL",
    "LIVEKIT_API_KEY",
    "LIVEKIT_API_SECRET",
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "EMAIL_REPLY_TO",
]
text = path.read_text()
missing = [key for key in required if not any(line.startswith(key + "=") for line in text.splitlines())]
print("missing:", missing)
print("env_check:", "OK" if not missing else "NEEDS_FIX")
PY
```


## Optional white-label fallback video env vars

Required only if embedded Zoom fallback is enabled:

```txt
ZOOM_MEETING_SDK_KEY=
ZOOM_MEETING_SDK_SECRET=
NEXT_PUBLIC_ENABLE_ZOOM_EMBEDDED_FALLBACK=true
```

Emergency managed fallback only:

```txt
GOOGLE_MEET_MANAGED_FALLBACK_URL=
```

## Canonical Deployment Authority

- GitHub repo: `agency-event-os`
- Framework: `Next.js`
- Adapter: `OpenNext for Cloudflare`
- Host: `Cloudflare Workers / Cloudflare platform`
- App domain: `westpeek.live`
- Email sending domain: `events.westpeek.live`
- Outbound sender: `notifications@events.westpeek.live`
- Reply-to: `hello@westpeek.live`

### Domain Separation Rule

`westpeek.live` is the West Peek Live! app and public product domain.

`events.westpeek.live` is reserved for Resend email sending infrastructure only.

Do not deploy the app to `events.westpeek.live` unless this deployment authority document is explicitly changed.

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
- Testing Console must show LiveKit, Daily, Zoom, Google Meet, Resend, Supabase, route, OpenNext, and browser-console smoke status before production events.

## Master Plan v4

V4 env adds CREW_ACCESS_PASSWORD, V4_ACCESS_COOKIE_SECRET, V4 cookie names, LiveKit/Daily/Zoom/Google Meet keys, and GitHub event config workflow variables.


## Operator Launchpad Secret Split

- CREW_ACCESS_PASSWORD gates limited crew workspace access only.
- OPERATOR_LAUNCHPAD_PASSWORD gates the Operator Launchpad and high-trust show-control diagnostics.
- V5_OPERATOR_COOKIE_NAME stores the operator-gate cookie name.
- CREW_ACCESS_PASSWORD and OPERATOR_LAUNCHPAD_PASSWORD must never match.
