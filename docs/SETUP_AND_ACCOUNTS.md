# Setup and accounts — westpeek.live

Status: ACTIVE. The one page that says which outside accounts, domains and services this app depends
on, and the **names** of every secret it needs. No values appear here or anywhere in the repo.
Checked against the code and live DNS on 31 Oct 2026.

## Accounts and services

| Service | What it does here | Identifier (not secret) | Config names |
|---|---|---|---|
| GitHub | Source, CI, PR checks, deploy trigger | repo `seq23/westpeek-live` (public); workflows in `.github/workflows/` | Actions secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` |
| Cloudflare Workers (Paid) | Hosts the app | Worker `west-peek-live`; fallback URL `west-peek-live.seq-taylor.workers.dev`; Workers Builds uploads a preview version per branch | `wrangler.jsonc` |
| Cloudflare D1 | The database | database `west-peek-live`, binding `DB`; schema in `migrations-d1/` | applied by `deploy-cloudflare-worker.yml` |
| Cloudflare R2 | Uploaded files, private | bucket `west-peek-live-assets`, binding `ASSETS_BUCKET` | signed links only |
| Cloudflare DNS | `westpeek.live` zone (Cloudflare nameservers) | see DNS below | dashboard |
| Cloudflare Stream Live | Fallback rung 2 | live input `westpeek-fallback` | `CLOUDFLARE_STREAM_*` |
| LiveKit Cloud (Ship plan) | Main stage, rooms, RTMP ingress from StreamYard | project `westpeek-live`; webhooks: `docs/LIVEKIT_WEBHOOKS.md` | `LIVEKIT_*` |
| StreamYard | Production switcher, sends RTMP into LiveKit | operator account; **no API**, set up by hand per show (manual §14–15) | `STREAMYARD_PRIMARY_ENABLED`, `STAGE_STREAM_DEFAULT_SOURCE` |
| Daily | Fallback rung 3 (rooms + tokens) | | `DAILY_*` |
| Zoom Meeting SDK | Fallback rung 4 | | `ZOOM_MEETING_SDK_KEY`, `ZOOM_MEETING_SDK_SECRET` |
| Google Meet | Fallback rung 5, a static continuity link set per event | | none |
| Resend | All outgoing email | sending domain `events.westpeek.live`; sender `notifications@events.westpeek.live` | `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` |

Plans, limits and costs: `docs/CAPACITY.md`. Deploy procedure: `RUNBOOK.md`.

## Domains and DNS (checked with `dig`, 31 Oct 2026)

| Name | Record | Purpose |
|---|---|---|
| `westpeek.live` | Cloudflare custom domain on the Worker | the app (`/app` is the workspace, `/manual` the manual) |
| `westpeek.live` | MX `route1-3.mx.cloudflare.net` + SPF `include:_spf.mx.cloudflare.net` | Cloudflare Email Routing for inbound mail |
| `events.westpeek.live` | Resend sending domain: SPF on `send.events.westpeek.live`, DKIM at `resend._domainkey.events.westpeek.live` | outgoing email only; never deploy the app here |
| `_dmarc.westpeek.live`, `_dmarc.events.westpeek.live` | TXT DMARC `p=none`, reports to the house inbox | deliverability; tighten to `p=quarantine` after a clean week of reports |

## Secret and variable names

Source of truth: `deployment/cloudflare-required-secrets.json` (Worker secrets, kept at 60 or fewer by
`npm run validate:worker-variable-budget`) and `_env_contract.json`. Every name is explained in
`ENVIRONMENT_VARIABLES.md`.

- **Access**: `OWNER_MASTER_ACCESS_PASSWORD`, `OPERATOR_LAUNCHPAD_PASSWORD`, `CREW_ACCESS_PASSWORD`, `V5_ACCESS_COOKIE_SECRET`, `V5_OWNER_COOKIE_NAME`, `V5_OPERATOR_COOKIE_NAME`, `V5_CREW_COOKIE_NAME`, `V5_SPECIAL_GUEST_COOKIE_NAME`, `AUTH_SESSION_COOKIE_NAME`
- **Demo event codes**: `EVENT_DEMO_SPEAKER_CODE`, `EVENT_DEMO_SPONSOR_CODE`, `EVENT_DEMO_VIP_CODE`, `EVENT_DEMO_CLIENT_CODE`, `EVENT_DEMO_CREW_LITE_CODE`
- **LiveKit**: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_INGRESS_RTMP_BASE_URL`, `LIVEKIT_WEBHOOK_SECRET`, `VIDEO_PROVIDER`
- **Cloudflare Stream**: `CLOUDFLARE_STREAM_ACCOUNT_ID`, `CLOUDFLARE_STREAM_API_TOKEN`, `CLOUDFLARE_STREAM_API_BASE_URL`, `CLOUDFLARE_STREAM_FALLBACK_ENABLED`, `CLOUDFLARE_STREAM_LIVE_INPUT_ID`, `CLOUDFLARE_STREAM_FALLBACK_PLAYBACK_URL`, `CLOUDFLARE_STREAM_FALLBACK_RTMPS_URL`, `CLOUDFLARE_STREAM_FALLBACK_RTMPS_KEY`
- **Daily**: `DAILY_API_KEY`, `DAILY_API_BASE_URL`, `DAILY_DOMAIN`, `DAILY_FALLBACK_ENABLED`, `DAILY_STAGE_FALLBACK_REQUIRES_TOKEN`
- **Zoom**: `ZOOM_MEETING_SDK_KEY`, `ZOOM_MEETING_SDK_SECRET`
- **StreamYard / stage**: `STREAMYARD_PRIMARY_ENABLED`, `STAGE_STREAM_DEFAULT_SOURCE`
- **Email**: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`
- **App**: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SELF_SERVE_ENABLED`, `SELF_SERVE_EVENT_CREATION_ENABLED`, `BILLING_REQUIRED_FOR_SELF_SERVE`, `AGENCY_EVENT_OS_RUNTIME_STORE`, `ALLOW_FILE_RUNTIME_STORE_IN_PRODUCTION`

## Where the values live

- **Production**: Cloudflare Worker secrets on `west-peek-live` (dashboard → Workers → Settings →
  Variables). The deploy uses `--keep-vars`, so a deploy never wipes them.
- **CI**: GitHub Actions secrets (the two Cloudflare names above).
- **Local**: `.env.local`, restored by `npm run env:restore` from a private source outside the repo
  (`ENV_RESTORE_POLICY.md`). Never committed. The local browser suite runs on demo defaults from
  `deployment/env-var-registry.json` and needs no production value.

## Rollback

- **Code**: Cloudflare dashboard → Workers → `west-peek-live` → Deployments → roll back to the last
  good version (or `npx wrangler rollback <version-id>`), then fix forward on `main`.
- **Data**: D1 Time Travel (`npx wrangler d1 time-travel restore west-peek-live --timestamp=<ISO>`).
  A schema change is always a new file in `migrations-d1/`, never an edit.
- **Video during a show**: the fallback ladder, manual §14.
