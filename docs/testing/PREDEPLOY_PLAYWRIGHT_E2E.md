# Predeploy Playwright E2E — Local Headed Diagnostics Flow

A deterministic local Playwright run, on a local server with demo data and no real provider, for
checking a branch in a real browser before it is pushed. Updated 31 Oct 2026: baseline ZIPs are
retired (a change is a PR, merged and deployed by `land`), and the runtime store is D1 in production
and a local file here.

## When to run it

Only when a change touches what the browser suites cover. The full browser suite also runs on `main`
after every merge (`.github/workflows/browser-e2e.yml`); per-PR CI is the fast gate.

```bash
npm run test:e2e:predeploy
```

Or double-click:

```text
Run Headed Local E2E Diagnostics.command
```

## What this does

- Opens a visible Chromium browser by default.
- Starts the local Next.js server automatically through Playwright `webServer`.
- Uses `http://127.0.0.1:3000` unless `PLAYWRIGHT_BASE_URL` is explicitly set.
- Forces local file runtime storage (`AGENCY_EVENT_OS_RUNTIME_STORE=file`, path in
  `AGENCY_EVENT_OS_RUNTIME_STORE_PATH`), never the production D1 database.
- Blanks LiveKit, Daily and other provider secrets and uses the mock video provider.
- Leaves traces, screenshots and the report in `test-results/` and `playwright-report/`.

## Safe environment boundary

Local diagnostics never depend on the production database, real provider secrets, or deployed
Cloudflare configuration. The runner sets:

- `AGENCY_EVENT_OS_RUNTIME_STORE=file`
- `VIDEO_PROVIDER=mock`
- `LiveKit provider env vars` are blanked
- `Daily provider env vars` are blanked
- `PLAYWRIGHT_LOCAL_E2E=1`
- `LOCAL_PLAYWRIGHT_GAUNTLET_AUTH=true`

Deployed checks remain separate and must be run with `PLAYWRIGHT_DEPLOYED=1` and `PLAYWRIGHT_SKIP_WEBSERVER=1`.

## Status language

A branch that changes browser-covered behaviour is not ready to merge until this runner has passed
or its failures have been fixed and rerun.
