# West Peek Live!

The virtual-event platform behind **westpeek.live**: public event pages, the attendee venue (lobby,
stage, sessions, breakouts, expo, speed networking, replay), and the production workspace where the
owner, operators and crew build and run a show. It runs West Peek Ventures live events and agency
events for clients. Video comes in from StreamYard (or any RTMP tool) through LiveKit, with
Cloudflare Stream, Daily, Zoom and Google Meet as the fallback ladder.

One Next.js app, built with OpenNext into one Cloudflare Worker, on Cloudflare D1 and R2.

## Where to start

| You want to | Read |
|---|---|
| Run an event (owner, operator, crew, guest) | [`docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md`](docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md), also in the app at `/manual` |
| Know which accounts, domains, services and secret names the app uses | [`docs/SETUP_AND_ACCOUNTS.md`](docs/SETUP_AND_ACCOUNTS.md) |
| Change the code, test it, ship it | [`RUNBOOK.md`](RUNBOOK.md) |
| Every environment variable, by name | [`ENVIRONMENT_VARIABLES.md`](ENVIRONMENT_VARIABLES.md) |
| Plans, limits and what to buy next | [`docs/CAPACITY.md`](docs/CAPACITY.md) |
| The full list of docs and which are history | [`docs/README.md`](docs/README.md) |

## Quick commands

```bash
npm ci
npm run dev                          # local app
npm run typecheck && npm run test    # fast loop
npm run release:prepush:container    # exactly what CI runs
```

Production deploys itself from green `main` (see `RUNBOOK.md`, "How it deploys"). Never run a bare
`wrangler deploy`. The release lifecycle and its closure command are in
[`REPO_UPDATE_LIFECYCLE.md`](REPO_UPDATE_LIFECYCLE.md).

## Brand

[`WEST_PEEK_BRAND_SYSTEM.md`](WEST_PEEK_BRAND_SYSTEM.md) is the locked visual system.

## Secrets

No secret values live in this repository. Names only: `deployment/cloudflare-required-secrets.json`
and `docs/SETUP_AND_ACCOUNTS.md`. Local values are restored with `npm run env:restore`
(`ENV_RESTORE_POLICY.md`); never commit `.env.local`.
