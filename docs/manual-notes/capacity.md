# Manual note — Plans & capacity

*For the next edit of `docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md`. Added 16 Sep 2026; not merged
into the manual here because the manual is owned by another lane this week.*

## New door

**Plans & capacity — `/app/capacity`.** Owner and operator. Reachable from the operator launchpad,
section *Plans & capacity*. Shows the month against the four plans we pay for, transcode minutes
first and largest, because that is the ceiling a busy month reaches first.

Anything the provider will not tell the app prints **unknown** and names the dashboard that knows.
Nothing on the page is estimated, and no unread number is ever drawn as a zero or as a bar.

## What an operator needs to know from it

- **600 transcode minutes a month on LiveKit Ship**, and every minute of StreamYard feed pushed
  into an ingress burns one. That is about six and a half 90-minute shows. Going over costs $0.02 a
  minute — a bill, not a wall.
- **An ingress left publishing after a show costs the same as a show.** The "Ingresses publishing
  right now" reading on the page is the one to glance at after you end a stream.
- **1,000 concurrent connections is a hard ceiling.** Forecast over 800 and the plan has to go up
  *before* the show; there is no graceful way to turn attendees away.
- The full table, the worked example and the upgrade order are in `docs/CAPACITY.md`.

## Keep-alive (background, nothing to operate)

Supabase Free pauses after seven idle days and takes the runtime store with it. A scheduled job
(`.github/workflows/supabase-keep-alive.yml`, daily 07:17 UTC) reads a single row through
`/api/runtime/keep-alive` so the clock never gets there. It writes nothing and logs nothing. If it
ever fails, the GitHub Actions run goes red — that is the signal the project is paused or the
service role key is wrong.
