# Manual note — your own event's pages show your own event

*For the next edit of `docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md`. Added 16 Sep 2026; not merged
into the manual here because the manual is owned by another lane this week.*

## What changed

Eleven pages inside an event — Command, Overview, Builder, Speakers, Sponsors, Tasks, Run of Show,
Approvals, Publish, Analytics, Report — used to render the **demo summit's** speakers, sponsors,
tasks, cues and readiness on *every* event, your own included. An event created ninety seconds ago
listed Drake Speaker, Clarity AI and a keynote it was supposedly mid-way through, and scored **87%
ready**.

They now read the event's own rows. Where there is nothing yet, the page says so in plain words and
points at the one action that changes it. **The demo and the seeded training events keep their
fixtures** — that is what they are for — and each of those pages now says *demo event* at the top.

## What each page shows for a real event

| Page | What it reads |
| --- | --- |
| **Command** | The session the clock is actually inside (nothing, before the show), the speakers who entered with the speaker code, open incidents, open support requests, the rooms on your own timeline. |
| **Overview / Builder** | Counts of your speakers, sponsors, segments and files, plus readiness as **"3 of 7 ready"** — never a percentage. |
| **Speakers** | Everyone who entered with the speaker code: where they are (backstage / invited / on stage), their recorded tech check, whether their cue deck is approved. |
| **Sponsors** | Everyone who entered with the sponsor code, and the booth each has written. A sponsor with no booth says so. |
| **Run of Show** | Your own sessions, in order, with the speakers who have arrived beside them. |
| **Approvals** | The two things that really wait on you: files somebody sent that are still in review, and speaker cue decks with a version pending. |
| **Publish** | The same counted readiness. It used to say "0 speaker profile(s) connected" with three speakers in your green room. |
| **Analytics / Report** | Unchanged in substance — they always counted real rows — but they now take the event's *name* from the event record, so an unknown id no longer gets the demo's title over someone else's numbers. |
| **Tasks** | See below. |

## Tasks is honest, not built

**There is no task or milestone table in the store.** Nothing keeps a task you type. Rather than
invent one or keep showing the demo's list, the Tasks page says that plainly and then shows what the
event is genuinely waiting on, counted: files in review, cue decks pending, tech checks not
recorded, booths not published. Each line links to the page where you act on it.

A real task board would need a `runtime_event_tasks` table (event, title, owner, due date, status,
client-visible flag), a migration and mirror, create/edit/complete actions, and a place in the
approval queue. It is a day of work, not an afternoon, and it has not been asked for.

## Readiness: why there is no percentage any more

The old score came from `calculateEventReadiness()` over the compiled fixtures. On a real event
every list it filtered came back empty, and **an empty list scored full marks** — approvals 100%,
speakers 100%, sponsors 100%. Hence 87% on an event with nothing in it. Readiness is now a count of
checks that have a real signal behind them. A page that says "3 of 7 ready" is finished; a page that
says 87% off fixtures is not.

## If a page ever goes wrong

Every one of the eleven now renders inside a fail-soft section. A store problem turns that one
section into a named amber card and the rest of the page still works; the reason is on
`/api/runtime/health`.
