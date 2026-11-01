# West Peek Live! Docs

The doc map. Current as of 31 Oct 2026. Anything under `docs/archive/` is history only.

## For people running events

- `WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md` — **the operator guide**: the five doors, owner, operator,
  crew, special guests, attendees, codes, email, templates, fallback ladder, show-day runbook (§15),
  troubleshooting. Screenshots in `images/manual/` (retaken 31 Oct 2026 from the current app, demo event).
  Also served in the app at `/manual`.
- `AGENCY_EVENT_OS_DAY1_OPERATOR_PACKET.md` — the private day-1 packet served at `/operator-packet`.
- `CAPACITY.md` — what each plan includes, what runs out first, what to buy next.

## For setting up and keeping it running

- `SETUP_AND_ACCOUNTS.md` — accounts, domains and DNS, integrations, secret names, rollback.
- `DEPLOYMENT_ENV_CHECKLIST.md`, `POST_DEPLOYMENT_SMOKE_TEST.md`, `runbooks/deployment-cloudflare.md`,
  `runbooks/postdeploy.md` — deploy and post-deploy checks.
- `LIVEKIT_WEBHOOKS.md` — how LiveKit tells the app a show started or ended.
- `DAILY_AUTOMATIC_FALLBACK.md`, `WHITE_LABEL_BACKUP_ROOMS.md`, `WHITE_LABEL_FALLBACK_VIDEO_19A.md`,
  `VIDEO_PROVIDER_ABSTRACTION_7.md` — the video fallback design.
- `manual-notes/` — five notes still read by validators (capacity, migration assurance, networking
  fairness, speed-networking privacy, preview personas). Their content is in the manual.
- `SUPABASE_TO_CLOUDFLARE.md` — history of the October 2026 move to D1 + R2 (validator-pinned).

## For changing the code

Start at `../RUNBOOK.md`. Validation and proof matrices (`VALIDATION_*`, `*_E2E_MATRIX.md`,
`PERSONA_ROUTE_OUTCOME_MAP.md`, `E2E_OUTCOME_TESTING_STANDARD.md`, `testing/`, `product/`) are read by
validators in `../scripts/`; keep them in place.

## Indexes

- `ACTIVE_DOCS.md` — active documents, by lane.
- `DOCS_CONSOLIDATION_MAP.md` — every Markdown file and its status.
- `archive/ARCHIVE_INDEX.md` — every archived file and what replaced it.

Canonical deployment authority: app domain `westpeek.live`; email sending domain `events.westpeek.live`.
