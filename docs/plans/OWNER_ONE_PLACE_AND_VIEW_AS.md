# Plan — one place for the owner, and seeing the room as anyone

Status: **APPROVED and locked** by the owner, 16 Sep 2026. Build in the Part 3 order.

Two complaints, one root cause:

> "make this all less confusing and having to page hop to do things if u have an owner master key"
> "how to get right into the room and view the room as a specific guest — that part isnt done"

The root cause is that the app is organised around **which role a page belongs to** (`/app`, `/crew`, `/speaker`, `/venue`), not around **what the owner is trying to do**. An owner holding the master key has access to all of it, so every role boundary they cross is a page hop that buys them nothing.

---

## Part 1 — What is actually wrong today (verified, not assumed)

### 1.1 Running a show costs four page loads

| Step | Page | Why it is a separate page |
| --- | --- | --- |
| Set the event live | `/app/events/{id}/publish` | status lives on the event record |
| Get RTMP credentials | `/crew/events/{id}` | the ingress lives on the stage state |
| Open stage requests | `/crew/events/{id}` | crew surface |
| Check what attendees see | `/venue/{id}/stage` | attendee surface |

The unified Go-live card (already queued) fixes steps 1–2. Steps 3–4 remain hops.

### 1.2 "View as" exists but is unusable in the case that matters

`lib/auth/viewAsGuard.ts` — verified:

- **`VIEW_AS_PATH_PREFIXES = ["/speaker/events/", "/sponsor/events/", "/client/"]`.** `/venue/` is **not** in the list, so **you cannot view the room as an attendee at all**, and VIP preview only half-works (the lobby reads the param for the VIP panel; nothing else does).
- **A guest row only exists after a real human entered a role code and typed their name.** `GuestPreviewLinks` renders "No special guests yet for this event" until then. On a new event — the exact moment you want to check what a speaker will see — there is nobody to view as.
- Therefore view-as answers "what is this particular person seeing right now" and cannot answer "what will a speaker see when they arrive", which is the question an owner asks before a show.

### 1.3 There is no way into the room from the owner surfaces

No "enter the venue" control on the Owner Console or the event workspace. The owner types the venue URL or goes via the join page like a stranger.

---

## Part 2 — What we build

### 2.1 The Event Command Bar (kills the page hopping)

One bar, rendered at the top of **every** page belonging to an event — `/app/events/**`, `/crew/events/**`, `/venue/**`, `/speaker/events/**`, `/sponsor/events/**` — for owner and operator only. Never rendered for attendees or plain crew.

It carries, always in the same order:

`[Event name ▾]  [status pill]  [Go live / End show]  [Stage requests: Open|Closed]  [Enter the room ▾]  [Codes ▾]  [Crew deck]  [Manual]`

- **Event switcher** (`▾`) — jump to any other event without going back to a list.
- **Go live / End show** — the unified card's primary action, inline. Provisions credentials in the same click; expands in place to show RTMP URL + key. Never navigates away.
- **Stage requests** — the existing one-switch control, inline.
- **Enter the room ▾** — see 2.2.
- **Codes ▾** — this event's six codes, masked with Copy, plus "All codes".
- Every control acts **in place** and revalidates; nothing in the bar is a link to another page except Crew deck and Manual.

Result: going live, opening stage requests, grabbing codes and entering the room stop being four destinations. They are four controls on the page you are already on.

### 2.2 "Enter the room as…" (the missing thing)

A single menu on the command bar. Every entry opens the **real page** that person would use, with a banner saying whose view it is.

| Entry | Opens | Identity used |
| --- | --- | --- |
| **Myself (host)** | `/venue/{id}/stage` | your owner identity, host banner, full controls |
| **An attendee** | `/venue/{id}/lobby` | a **preview persona** — registered, no VIP, no crew |
| **A VIP** | `/venue/{id}/lobby` | preview persona with the VIP flag |
| **A speaker** | `/speaker/events/{id}/green-room` | preview persona |
| **A sponsor** | `/sponsor/events/{id}` | preview persona |
| **The client** | `/client/{slug}/events/{id}` | preview persona |
| *(then a divider)* | | |
| **Real guests** | their actual pages | today's `?viewAs={guestId}` behaviour, unchanged |

**Preview personas** are the new idea and the fix for 1.2. A persona is a synthetic, event-scoped identity with a fixed id (`preview-attendee`, `preview-vip`, `preview-speaker`, …) that:

- renders the page exactly as that role sees it, reading the event's **real** configuration and content;
- is **read-mostly**: it cannot post chat, raise a hand, submit a form, register, or write anything another human would see. Writes are refused at the service layer, not merely hidden in the UI;
- never appears in the People directory, the attendee count, the roster, networking, or any export;
- is visible only to owner/operator/producer, via the existing `canViewAsGuest` rule;
- carries a persistent banner: *"Preview — you are seeing this as a VIP would. Nothing you do here is saved."* with a one-click **Leave preview**.

Implementation: extend `VIEW_AS_PATH_PREFIXES` to include `/venue/`, and teach the resolver that a `viewAs` value beginning `preview-` resolves to a persona rather than a stored guest profile. The permission check (`canViewAsGuest`) is unchanged — same people, more surfaces.

### 2.3 The health signal — one eyeball, green / yellow / red

A single dot on the Event Command Bar, always visible, that answers "is anything breaking right now" without opening anything. Click it and it expands into the panel below.

**The dot is the worst state of its signals**, so it never reads green while something is red.

| Signal | Green | Yellow | Red |
| --- | --- | --- | --- |
| **Feed** | ingress publishing, bitrate steady | publishing but reconnected in the last 2 min, or bitrate dropped >40% | event is live and nothing is publishing |
| **Stage** | room active, a publisher present | room active, no publisher yet (pre-show) | attendees present and no room |
| **Webhook** | a LiveKit webhook in the last 5 min | none yet, polling carrying it | polling also failing |
| **Fallback** | rung 1 configured and reachable | rung 1 configured, untested this show | rung 1 unconfigured while live |
| **Database** | every runtime read ok | a non-critical table failing soft | chat or roster reads failing |
| **Chat** | messages flowing, no poll errors | slow mode on, or poll latency high | posting refused |
| **Attendees** | connected ≈ expected | >20% of joiners disconnected in 5 min | everyone dropped at once |
| **Build** | every client on the current build | someone on an older bundle | — |
| **Capacity** | under 60% of the LiveKit tier | 60–85% | over 85%, or transcode minutes nearly gone |

Rules that keep it honest:

- **Every signal names its source and its last-checked time.** No dot may be derived from an assumption; if a probe did not run, the signal reads **grey / unknown**, never green.
- Clicking a yellow or red signal shows **what to do about it**, not just what is wrong — the same sentence a producer needs at that moment (e.g. "Nothing is publishing. Get stream credentials → paste into StreamYard → Go live", with the button inline).
- The panel keeps a **short event log** for this show — went live, feed dropped, moved to Cloudflare, ended — with times in the viewer's zone. That is the thing you read afterwards to find out what happened.
- Polling is one combined request on the existing `/api/venue/tick`, not one per signal.

### 2.4 "What is this attendee seeing?" — troubleshooting a real person

When someone says "I can't see it", the owner needs an answer in ten seconds. Two different things, both needed:

**(a) Their reported state — from the attendee roster.** Every row gets a **Diagnose** control showing what their browser has told us:

| Field | Source |
| --- | --- |
| Connected / disconnected, and for how long | LiveKit participant state for the stage room |
| **Connection quality** (excellent / good / poor) | LiveKit per-participant quality |
| Which tracks they are actually subscribed to | LiveKit participant track list — this is the real answer to "is the video reaching them" |
| Their app build vs the current build | build-version heartbeat (already exists for the watchdog) |
| Browser and device | user agent, captured at registration |
| Permitted to watch / on stage / silenced / hidden | our own roster state |
| Last chat poll, last page seen | our own telemetry |

That table distinguishes the three failures that look identical to the user: **they never connected**, **they connected but are subscribed to nothing** (our bug), and **they are subscribed but their connection is poor** (their network).

**(b) Their actual view — read-only mirror.** A **"See their view"** button next to Diagnose opens the venue page they are on, rendered with **their** state: their permitted flag, their VIP status, their silenced state, their agenda, their chat visibility. Read-only, banner, no writes — the same persona machinery as 2.2, pointed at a real attendee instead of a synthetic one.

It is **their state, not their screen** — we cannot see their monitor, and the panel says so in one line rather than implying otherwise. In practice their state is what you need: it shows the "permit to watch" flag nobody set, the stale build, the subscription that never happened.

**Privacy line:** this is visible to owner, operator and producers only; it is recorded in the audit log as a diagnosis of that attendee; and it never exposes anything the attendee did not give us (no location, no IP shown in the UI).

### 2.5 Enter the room as yourself, properly

**Myself (host)** is the default entry and must not require a code or a registration. The owner cookie already authorises `/venue/**`; today there is simply no link. Add it, and make the host banner and the event command bar both present so the owner can moderate from inside the room instead of bouncing to the crew deck.

### 2.6 One rule, written down

Add to the manual and enforce with a validator: **an owner holding the master key never needs to enter a code, and never needs a second page to finish one intention.** The validator walks the owner-reachable surfaces and fails if a primary action (go live, end show, stage requests, codes, enter the room) is reachable from only one of them.

---

## Part 3 — Order of work

| # | Item | Depends on |
| --- | --- | --- |
| 1 | Unified Go-live card (already queued) | — |
| 2 | Event Command Bar shell + event switcher + Codes + Crew deck + Manual | 1 |
| 3 | Go live / End show / Stage requests inline in the bar | 1, 2 |
| 4 | Preview personas: service layer, write refusal, exclusion from counts/directory/exports | — |
| 5 | `/venue/` added to view-as prefixes; persona resolver; banner and Leave preview | 4 |
| 6 | "Enter the room as…" menu wired to personas and to real guests | 2, 5 |
| 7 | Health signal: probes, combined poll, dot + panel, event log | 2 |
| 8 | Attendee Diagnose panel (LiveKit participant state, subscriptions, build, quality) | 4 |
| 9 | "See their view" for a real attendee | 5, 8 |
| 10 | Validator + manual §3/§6/§7 updates | all |

Each ships as its own PR.

---

## Part 4 — What this does not do

- It does not merge the crew deck into `/app`. Crew still have their own surface with their own permissions; the bar simply means the owner rarely needs to go there.
- It does not give operators or crew the preview personas beyond what `canViewAsGuest` already allows.
- It does not change what attendees see. Personas are invisible to them by construction.
- It does not touch the access-code scheme, which is settled.
- It does not show an attendee's literal screen. It shows their state, which is the part that is actionable.

---

## Part 5 — How we will know it worked

- Going live on a fresh event: **one page, one click**, credentials in hand.
- Checking what a speaker sees before anyone has entered a code: **possible**, which it is not today.
- Entering your own room as host: **one click from anywhere**.
- No owner action requires typing a code.
- A glance at the bar says whether anything is wrong, and a red signal tells you what to do about it.
- "I can't see the stream" is answered from the roster in one click, and the answer distinguishes our fault from their network.
