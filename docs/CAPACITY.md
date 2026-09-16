# Capacity — what the plans include, what runs out first, and what to buy next

Read off the provider dashboards on **16 September 2026**. The numbers below are the same ones the
code uses: they live in `lib/capacity/capacityPlans.ts` and are imported everywhere else, so nothing
here is a retyped copy that can drift. The live readout is at **`/app/capacity`** (owner and
operator), linked from the operator launchpad under *Plans & capacity*.

## The plans

| Plan | Cost | Included each month | Past the allowance |
| --- | --- | --- | --- |
| **LiveKit Ship** | $50/mo | **600 transcode minutes** · 150,000 WebRTC participant-minutes · 250 GB downstream · 1,000 concurrent connections | $0.02 / transcode minute (video) · $0.0005 / participant-minute · $0.12 / GB · concurrency is a ceiling, not a meter — the 1,001st connection is refused |
| **Cloudflare Workers Paid** | $5/mo | 10,000,000 requests · 30 s CPU per invocation · 128 variables per Worker | Requests bill per million; the variable cap is hard. We declare 49 variables and a validator holds the manifests at 60 |
| **Cloudflare Stream** | pay-as-you-go | nothing included | $5 per 1,000 minutes stored · $1 per 1,000 minutes delivered. Live input `westpeek-fallback` |
| **Supabase Free** | $0 | 500 MB database · shared compute · 5 GB egress | No overage — it **auto-pauses after 7 idle days** and there are no backups |

LiveKit **Build** and **Scale** are named in the module but their allowances were never read from
the dashboard, so they report `unknown` rather than a made-up number. If we ever move off Ship, put
that plan's figures into `capacityPlans.ts` first — the readout will draw honest bars the moment
they are real, and refuse to draw a comfortable one until then.

## What each cliff means in practice

**Transcode minutes are the first cliff, and they are the only one a normal show gets near.** Every
minute of StreamYard feed pushed into a LiveKit ingress burns one transcode minute, whether five
people watch or five hundred. 600 a month is **about six and a half 90-minute shows** — and that
counts rehearsals, tech checks and the ingress somebody left publishing after the room emptied.

Work a typical show through all four:

> **A 90-minute show with 200 attendees.** Transcode: 90 minutes — 15% of the month's 600.
> Participant-minutes: 200 × 90 = 18,000 — 12% of 150,000. Downstream: a 1.5 Mbps stream to 200
> people for 90 minutes is roughly 200 GB… which is 80% of the 250 GB, and the one to watch on a
> big room. Concurrency: 200 against a 1,000 ceiling. Cloudflare: a few thousand requests against
> 10 million. Supabase: a few MB. **On these plans that show costs roughly nothing — the $50 and
> the $5 we were paying anyway.**

So the order the ceilings actually arrive in:

1. **Transcode minutes (600)** — hit by *doing many shows*, or by leaving ingresses publishing. Six
   or seven 90-minute shows a month is the limit. Overage is cheap ($0.02/min ≈ $1.80 for an extra
   90-minute show), so this is a bill, not a wall.
2. **Downstream bandwidth (250 GB)** — hit by *one big audience*. Two 200-person shows in a month
   will pass it. $0.12/GB, so a third such show adds roughly $24.
3. **Participant-minutes (150,000)** — needs about 1,650 attendee-hours a month. Far away.
4. **Concurrent connections (1,000)** — a hard wall, not a bill. A 1,001-person audience is turned
   away. Nothing we run is near it.
5. **Supabase's 7-day idle pause** — not a quota at all, and the one that has actually bitten. See
   below.
6. **Workers requests / CPU** — not reachable at our traffic. The real Workers constraint is the
   **variable cap**, which we manage in `deployment/cloudflare-required-secrets.json`.

## The Supabase auto-pause, and the keep-alive

Supabase Free pauses a project after **seven idle days**. Paused means the runtime store — every
event, attendee, access code and stage state — is offline until somebody opens the dashboard and
clicks Restore. Between shows this repo can easily go a fortnight without a real query.

`.github/workflows/supabase-keep-alive.yml` runs daily at 07:17 UTC and GETs
`/api/runtime/keep-alive` on the deployed Worker. That route does exactly one thing: a single-row
indexed `SELECT` for a contact key that does not exist. It writes nothing, so it is idempotent by
construction; it logs nothing, so it does not bury a real show-day error in the tail; and it costs
about 30 Worker requests a month out of ten million.

The response carries `store`. If the deployment is ever running on the file store the workflow
**fails loudly** rather than reporting a green run that kept nothing awake.

*Why not a Cloudflare Cron Trigger?* The Worker's entrypoint is the generated
`.open-next/worker.js`, which exports `fetch()` and nothing else, and both
`scripts/read-wrangler-config.mjs` and the deploy workflow pin `main` to it. A cron trigger against
a Worker with no `scheduled()` handler fails silently every day — the exact "runs but inert" defect
this repo keeps finding. Going in the front door is the mechanism that can be proved.

## What to upgrade first, and when

| When this happens | Do this | Why |
| --- | --- | --- |
| Transcode minutes pass **450 (75%)** before the 20th | Nothing. Let it run over. | $0.02/min. A whole extra 90-minute show is $1.80 — cheaper than the next plan tier by two orders of magnitude. |
| We are booking **more than eight shows a month, every month** | Move LiveKit to **Scale**, and read its allowances into `capacityPlans.ts` on the way | At that rate the transcode and bandwidth overage together start to approach the tier difference. |
| Downstream passes **200 GB (80%)** with a show still to come | Nothing to change, but expect ~$0.12/GB on the invoice | Bandwidth is the one a big audience moves, and it is billed, not capped. |
| An audience is forecast over **800 concurrent** | Upgrade LiveKit **before** the show | 1,000 is a wall, not a bill. There is no graceful version of turning attendees away. |
| Supabase database passes **400 MB**, or we want backups | **Supabase Pro, $25/mo** — and do it before the first client with a retention expectation | Free has no backups at all. That, not the 500 MB, is the reason to leave Free. |
| Worker variables reach **60** | Delete what nothing reads; only then raise the budget toward the plan's 128 | `scripts/validate_worker_variable_budget.js` holds the line at 60 so a show-day secret always has a slot. |
| Cloudflare Stream appears on the bill at all | Nothing — check the live input is not recording when it should not be | Pay-as-you-go at $5/1,000 stored minutes; only a forgotten recording makes it visible. |

**The single upgrade to make first, if one has to be made: Supabase Pro.** Not because of a quota,
but because Free has no backups, and the runtime store is the only thing here that cannot be
rebuilt from the repo.

## Where a number cannot be read

LiveKit Cloud reports month-to-date transcode minutes, participant-minutes, bandwidth and the
concurrency peak **in its billing dashboard only** — the project API key cannot read them. The same
goes for Cloudflare's request counts (they need an account API token the Worker does not carry) and
Supabase's database size and egress (management API, personal access token).

Those rows on `/app/capacity` say **unknown** and name the dashboard that knows. They never show a
zero. A zero on the 28th of a busy month reads as "600 minutes left", and that is the most expensive
thing this page could tell you.

What the readout *can* read live, and does, is the picture this instant, straight off LiveKit's
server API with the credentials the ingress provisioner already uses: **how many ingresses are
publishing right now** (each one burning a transcode minute a minute), how many participants are
connected against the 1,000 ceiling, and how many rooms are open.
