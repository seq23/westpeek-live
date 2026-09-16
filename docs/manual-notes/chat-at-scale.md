# Manual note — chat at scale

Paragraphs for `docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md`. Not applied here: the manual is edited
by one owner so parallel branches do not collide. Each block below names its target section.

---

## Target: §6 "If you are CREW — step by step" → the **During the show** table

Add two rows to the control table, after the `Silence · Hide · Lock chat` row:

| Control | What it does |
| --- | --- |
| **Slow mode: Off / 5s / 10s / 30s** | Per room. An attendee waits that long between messages and sees the countdown on their Send button. You, the host, and speakers are exempt |
| **Clear chat** | Per room. Archives every message in it — gone for attendees *and* crew. The confirm names how many and there is no un-clear |

---

## Target: §6 "If you are CREW" → a new short block under the **During the show** table

**Slowing a room instead of closing it.** Lock is all-or-nothing: nobody but crew can post. Slow
mode is the dial between "open" and "locked" — the room keeps talking, just at a pace you can read.
Turn it on from the chat moderation queue on the crew console or the event command page; the
attendee's composer immediately shows `Slow mode · 10s between messages` and counts down after each
post. You, the host, and any speaker with a speaker code are exempt, so the people who have to
answer the room are never the ones waiting. Turn it back to **Off** the moment the surge passes.

**The flood limit you never switch on.** Independent of slow mode, and always running: one person
may post five messages in ten seconds, or twenty in a minute; past that they wait twenty seconds
and are told so in words, with the seconds left. Nothing they typed is thrown away and nothing is
silently dropped. It is enforced where the message is written, not in the browser, so a stuck Send
key, a stale tab, or a script gets the same answer. You do not need to do anything for this, and
there is no control for it — if someone is still drowning the room after it, silence them.

**Clear chat.** Use it between segments, or after something the room should not keep reading.
Pressing it asks you to confirm and names the number of messages; accepting empties the room for
everyone at once, crew included. The messages are **archived, not deleted** — the rows stay for the
audit trail and any later export — but there is no un-clear button on the page, so treat it as
final. New messages after a clear appear as normal.

---

## Target: §14 "Troubleshooting"

Add three rows:

| Symptom | What it is | What to do |
| --- | --- | --- |
| An attendee says Send is greyed out with a countdown | Slow mode is on for that room | Expected. Tell them the number of seconds, or turn slow mode down from the crew console |
| An attendee says "You are sending messages too quickly" | The per-person flood limit, always on | Expected after five messages in ten seconds. They can post again in twenty seconds |
| Chat shows "Live chat is unavailable right now" but the rest of the page is fine | A store read failed; the section fails soft on its own | The page is safe to leave open. Read the reason on `/api/runtime/health` |

---

## Target: §13 "Capacity, cost, and where the ceiling is"

**What a big room costs now.** An open chat no longer refetches its window: every few seconds it
asks only for what changed since the last message it holds, and gets back new messages plus the ids
of any that were hidden or cleared. A quiet room of five hundred therefore costs five hundred
near-empty responses per poll instead of five hundred copies of the whole conversation, and a hide
or a clear still reaches every open page within one poll.
