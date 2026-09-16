# West Peek Live! Post-Deployment Smoke Test

## Build/load

- Deployed URL loads.
- No server error on home page.
- App metadata shows West Peek Live!.
- Public brand uses black/white/orange styling.
- Wordmark shows orange skewed `Live!`.

## App routes

Check:

- `/`
- `/app`
- `/app/clients`
- `/app/events`
- `/app/email`
- `/app/reports`
- `/admin/testing`

## Venue routes

Check with a known test event id:

- `/venue/<eventId>/lobby`
- `/venue/<eventId>/stage`
- `/venue/<eventId>/sessions`
- `/venue/<eventId>/breakouts`
- `/venue/<eventId>/expo`
- `/venue/<eventId>/networking`
- `/venue/<eventId>/people`
- `/venue/<eventId>/replay`
- `/venue/<eventId>/help`

## Supabase

- Create/read a client.
- Create/read an event.
- Confirm no browser console exposes service-role data.
- Confirm email log tables exist.

## LiveKit

- Token route responds.
- Room join state renders.
- Disconnect/fallback state is understandable.
- Backup room links remain secondary.

## Resend

- Send one safe test email.
- Confirm sender domain is `events.westpeek.live`.
- Confirm reply-to is `hello@westpeek.live`.
- Confirm email log/status behavior.

## Mobile/tablet

Check at:

- 375px
- 390px
- 430px
- 768px
- 1024px

Confirm:

- no trapped navigation
- venue nav scrolls horizontally where needed
- forms are tappable
- cards stack cleanly
- primary live-event actions remain visible


## White-label fallback video

- Confirm LiveKit room still loads as the primary room engine.
- Confirm embedded Zoom room can open inside the West Peek Live! wrapper when enabled.
- Confirm attendee copy does not expose provider failure language.
- Confirm emergency alternate room link is clearly branded and operator-controlled.

## Daily Automatic Fallback Layer

Fallback order is now `LiveKit + StreamYard → Cloudflare Stream → Daily → Zoom → Google Meet`. Cloudflare Stream is the first automatic in-platform backup after the StreamYard-compatible RTMP primary, and Daily is the next embedded fallback and does not require producer permission when `DAILY_FALLBACK_ENABLED=true`. Zoom and Google Meet remain managed emergency fallbacks after Daily.

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
- Testing Console must show LiveKit + StreamYard, Cloudflare Stream, Daily, Zoom, Google Meet, Resend, Supabase, route, OpenNext, and browser-console smoke status before production events.



## Runtime-event live check (required after every deploy — 16 Sep 2026)

The local file store cannot see Supabase schema drift: migration 0027's `create table if not exists` was a no-op against a legacy table of the same name and every crew page 500'd during a live workshop while unit and Playwright were green.

1. `curl -s https://westpeek.live/api/runtime/health` — `ok` must be `true`; `crewPageReads` lists each read the crew deck and the networking page make against the newest real runtime event, and names any that failed. `npm run postdeploy:smoke` turns a failure into a named stop.
2. In a browser with an owner or operator cookie, load `/crew/events/<a runtime event>` and `/venue/<the same event>/networking`. Every deck section renders (a section that cannot read renders an amber "… is unavailable right now" card instead of a 500 — that is a named stop, not a pass).
3. Archive the throwaway event afterwards.
