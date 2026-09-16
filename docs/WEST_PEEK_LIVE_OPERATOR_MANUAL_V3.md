# West Peek Live — Owner + Operator Manual (v3)

Status: ACTIVE. Supersedes `docs/archive/superseded/docs__West_Peek_Live_Day1_Complete_Product_Operator_Manual_v2.md`.

| Field | Value |
| --- | --- |
| Canonical domain | https://westpeek.live |
| Worker fallback URL | https://west-peek-live.seq-taylor.workers.dev |
| Hosting | Cloudflare Workers (**Paid**, $5/mo — 30 s CPU, 10M req/mo, 128 variables) |
| Database | Supabase (Free tier — see §11 Capacity) |
| Video | LiveKit Cloud, project `westpeek-live` (**Ship**, $50/mo) |
| Backup video | Cloudflare Stream Live (pay-as-you-go) |
| Last revised | 16 September 2026 |

**No access codes appear in this document.** They live behind the owner gate in the app — see §4.

---

## 1. What this is, in plain terms

West Peek Live runs a virtual event end to end: the public page people register on, the venue they sit in, the stage they watch, the chat they talk in, the networking that pairs them up, and the console the crew runs it all from.

Everybody does not get the same door. Attendees attend. Crew executes. Speakers prepare and appear. Sponsors work their booth. Clients review. VIPs get a lounge. Operators run the show. The owner sees and overrides everything.

The video model is layered on purpose:

- **StreamYard** is where the show is produced (the source).
- **LiveKit** takes that feed and distributes it to everyone in the venue, and is the only layer that can put an attendee *on* the stage.
- **Cloudflare Stream** is the backup that still accepts the StreamYard feed if LiveKit fails — watch-only.
- **Daily / Zoom / Google Meet** are continuity rooms below that. They cannot take a StreamYard feed; somebody has to turn a camera on.

---

## 2. Creating an event — there is one page

**`/app/events/new`** is where every event is created, whether it starts in ten seconds or next month.

- **Now** — a Room that starts immediately. You get a join code (`WPL-XXXXXX`), an access page, and a crew deck right away.
- **Later** — a scheduled event: date, time, time zone. It sits in Drafts until you publish it.

Events are real rows in the database, created at runtime. Nothing needs a deploy, a JSON file, or an engineer. The seed/demo events that ship with the code are hidden from your lists.

Events are **archived, never deleted**. An archived event can be restored.

---

## 3. The doors

| Door | URL | Who uses it |
| --- | --- | --- |
| Production Access hub | `/production-access` | Start here if you don't know which door |
| **Owner Access** | `/production-access/owner` | You. Master key. Everything, everywhere |
| Operator | `/production-access/operator` | Show runner / producer command center |
| Crew | `/production-access/crew` | The people executing the show |
| Special guest | `/production-access/special-guest` | Speaker, sponsor, client, VIP |
| Public join | `/join` | Attendees, with the event code |
| Public event page | `/events/{eventId}` | Registration |

**Owner = host everywhere.** Entering with the master key makes you a host on any event, gives you the crew deck, the operator launchpad, and every special-guest surface, without collecting another password. A crew member with the `executive_producer` role is also a host.

There are **two master passwords** (`OWNER_MASTER_ACCESS_PASSWORD` and `..._2`). Both work on every gate.

---

## 4. Where the codes live

Access codes are **not written down in this file on purpose**. They are shown in the app, behind the owner gate:

- **Owner Console → Crews / Guests** — per event: crew code, host link, speaker/sponsor/VIP/client codes, each with a copy button and a Rotate action.
- Rotating a code **invalidates the old one and anyone holding a link built from it**.
- The global crew and operator passwords are Cloudflare secrets. The console tells you whether each is *set*; it never prints the value.

**Code convention:** every code is **UPPERCASE** (`WPL-VXCKX6`, `CREW-93H7SD`, `SPK-WYGJMY`, `VIP-XXXXXX`). Matching is case-insensitive and tolerates a missing prefix, so a guest typing `vxckx6` still gets in.

---

## 5. Running a show

### Before

1. Create the event (`/app/events/new`), publish it if it was a Later event.
2. Hand out the join code or the public event link. Registration asks for **Name, Email, Company** (Title optional).
3. Send the **host link** to whoever is running the show (Owner Console → Crews → Copy host link). It prefills the crew gate.
4. Speakers get the speaker code; they land in the **green room** for tech check and cue cards.

### Going live

1. Crew deck (`/crew/events/{code}`) → **Go live** section → generate RTMP credentials.
2. Paste the RTMP URL + stream key into **StreamYard → Custom RTMP**, start broadcasting.
3. The stage flips live within seconds. LiveKit's webhook confirms it; a poll reconciles if the webhook is late.
4. Attendees land **on the stage**, not the lobby, when they join a live event.

### During

| Control | Where | What it does |
| --- | --- | --- |
| **Stage requests: Open / Closed** | Crew deck header + each Live-now row in the Owner Console | One switch for camera and mic requests together |
| Approve / revoke a raised hand | Live moderation roster | Approved attendee appears on stage, mic off by default |
| Silence / hide / lock chat | Live moderation | Per person or the whole room |
| Make someone the host | Owner Console → Crews | Hands off the host banner and all controls for that event |
| VIP lounge | Venue | Open by default; VIPs enter with a VIP code |
| Networking | Crew deck | Real speed networking: queue, matcher, 1:1 rooms, timer |
| **End the show** | Crew deck | Deliberate. Releases the ingress, marks the event ENDED, and every viewer's stage says so |

Everyone is **permitted to watch by default**. You only approve people to come *on* the stage.

### If the feed dies

See §7.

---

## 6. Who sees what

| Role | Gets |
| --- | --- |
| Attendee | Public page, registration, lobby, stage, chat, agenda, people directory, networking, replay, help. Can hide themselves from the directory |
| VIP | All of the above plus the VIP lounge and badge |
| Speaker | Green room, tech check, cue cards / teleprompter, backstage, stage |
| Sponsor | Booth, leads, ready room, report |
| Client | Approvals, assets, reports, run of show, timeline |
| Crew | Crew deck: call sheet, run of show, tasks, live moderation, go-live, fallback ladder, networking, end the show |
| Operator | The launchpad, testing console, every event's setup spine |
| Owner | All of it, plus the Owner Console, billing, and "view as" any guest |

Every area URL is **password-gated** — a crew URL is not readable by a stranger who guesses the slug.

---

## 7. The fallback ladder

| Rung | Attendees see | Keeps the StreamYard feed? | Configured |
| --- | --- | --- | --- |
| **Primary — LiveKit ingress** | The show, and attendees can be brought on stage | Yes | Yes |
| **Fallback 1 — Cloudflare Stream** | The show in a Cloudflare player, watch-only | **Yes** | Yes (live input `westpeek-fallback`) |
| Fallback 2 — Daily | Only if a host turns a camera on | No | Yes |
| Fallback 3 — Zoom embedded | Zoom meeting in the page | No | Yes |
| Fallback 4 — Google Meet | Leaves the venue | No | Yes |

**How to use Fallback 1 on show day**

1. Before the show, add Cloudflare as a **second destination** in StreamYard (Destinations → Add → Custom RTMP). The RTMPS URL and key are on the crew deck's Fallback 1 card with copy buttons.
2. Broadcast to **both** destinations.
3. If LiveKit fails: crew deck → **"Move down: Cloudflare Stream"**. Attendees swap in about ten seconds, same page, chat and roster untouched.
4. While on Cloudflare you **cannot bring an attendee onto the stage** — that is WebRTC, LiveKit only.
5. When LiveKit is healthy: **"Move back up"**.

The card refuses to move down if the rung is not configured, rather than sending everyone to a blank player.

---

## 8. Day-of runbook

| When | Do |
| --- | --- |
| T-24h | Event published. Codes handed out. Speakers confirmed in the green room |
| T-60m | Crew in the deck. StreamYard open, both destinations set |
| T-30m | Go live to StreamYard privately, confirm the stage shows the feed, then stop |
| T-10m | Stage requests **Closed** until you want hands up. VIP lounge open. Chat unlocked |
| T-0 | Go live. Confirm the stage from a second device |
| During | Moderate; approve raised hands; watch the ladder |
| End | **End the show** from the crew deck. Confirm attendees see the ended state |
| After | Replay appears when ready. Export contacts from `/app/people` |

---

## 9. The workspace

- **`/app/owner`** — Owner Console. Folding sections with a table of contents: Live now, Events, Crews, Operators, Guests, Networking, Replays, Settings, Contacts.
- **`/app/people`** — everybody who ever registered, one row per person across events, CSV export. People who registered before 16 Sep 2026 have no email on file until they register again.
- **`/app/events`** — every event; each opens a workspace with setup, agenda, run of show, access, speakers, sponsors, comms, publish, show-day and reporting pages.
- **`/admin/testing`** — route health, runtime readiness, security smoke tests, video provider checks.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Code not ready" on join | Code typed without the `WPL-` prefix, or an unpublished event | Matching is now case-insensitive and prefix-tolerant; if it persists the event is a draft — publish it |
| Attendees stuck on "Connecting…" | Stale browser bundle after a deploy | Hard refresh (⌘⇧R) |
| Stage black, StreamYard says live | Feed not reaching LiveKit, or ingress not provisioned | Crew deck → Go live → regenerate credentials; check the Fallback 1 card |
| Crew page 500s | A runtime table is missing (migration not applied) | Sections fail soft and say "unavailable"; check Supabase migrations |
| Timestamps look wrong | — | Every time renders in the **viewer's** time zone |
| "Event ended" after going live again | — | Fixed: taking an ended event live resets its stage |

---

## 11. Capacity and cost

| Service | Plan | Included | First cliff |
| --- | --- | --- | --- |
| LiveKit | **Ship** $50/mo | 600 transcode min, 150,000 participant-min, 1,000 concurrent | Transcode minutes — every minute of StreamYard feed burns one |
| Cloudflare Workers | **Paid** $5/mo | 10M requests, 30 s CPU, 128 variables | Variable count (128) |
| Cloudflare Stream | Pay as you go | — | $5 / 1,000 min stored, $1 / 1,000 min delivered |
| Supabase | Free | 500 MB, shared compute, 5 GB egress | **Pauses after 7 days idle**; no backups |

A 90-minute Room with 200 people costs roughly **$0 extra** on these plans. The practical ceiling today is Supabase's shared compute at around a thousand simultaneous chatters.

---

## 12. Rules that do not bend

- Events are **archived, never deleted**.
- Nothing is ever emailed to an attendee automatically without a crew click.
- Seed and demo data never appear as real data on an `/app` page.
- Access codes are shown in the app, never written into a document or a repo.
- A rotated code kills every link built from the old one.
- Test rows (example.com / example.invalid / playwright fixtures) are hidden from real people lists.
