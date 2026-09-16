# Manual notes — preview personas, Enter the room, Diagnose

Paragraphs for `docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md`, written to drop in as-is. Not applied
here: the manual is owned by another branch this week, so these are the paragraphs and their target
sections. Plan reference: `docs/plans/OWNER_ONE_PLACE_AND_VIEW_AS.md` §2.2, §2.4, §2.5.

---

## → §3 (Running a show), after the Go-live card

**Enter the room as anybody, including yourself.** Every event row on the Owner Console, and the
header of every event workspace, carries **Enter the room ▾**. The first entry, **Myself (host)**,
opens `/venue/{id}/stage` with your own identity and your full controls — no code, no registration.
Your owner key already authorised the venue; until now there was simply no link, so checking your
own room meant typing the URL.

Below that are five **preview personas** — An attendee, A VIP, A speaker, A sponsor, The client.
Each opens the real page that role uses, reading the event's real configuration and content, with a
banner across the top reading *"Preview — you are seeing this as a VIP would. Nothing you do here is
saved."* and a one-click **Leave preview**.

The personas are the answer to a question the app could not answer before: *what will a speaker see
when they arrive?* A guest row only exists after a real human has entered a role code and typed
their name, so on a brand-new event there was nobody to view as. A persona is synthetic and always
available.

Below a divider, the event's **real guests** appear, exactly as before: opening one shows that
person's real state, which is the different question of *what is this particular person seeing right
now*.

**A preview writes nothing, and that is enforced where it counts.** A persona cannot post in chat,
raise a hand, register, submit a form, join networking, or raise a help request. The refusal is in
the services, not the buttons, so a stale page, a replayed form or a hand-made request is refused
too. A preview appears in no attendee count, no roster, no People directory, no networking pairing
and no export.

**Who may preview is unchanged.** The owner, the event's operator, and producer or executive-producer
crew for that event. Adding the venue to the previewable surfaces added surfaces, not people;
anybody else putting `?viewAs=preview-vip` on a venue URL is refused at the door.

---

## → §6 (Show-day troubleshooting), as a new subsection

**"I can't see the stream" — answered from the roster in one click.** Every attendee row on the
crew deck and the event command page has **Diagnose**. It separates the three failures that look
identical to the person complaining:

| What you see | What it means | Whose it is |
| --- | --- | --- |
| **Never connected** | LiveKit has no participant for them | ask them to reload; check their watch permit |
| **Receiving nothing** | in the room, subscribed to no tracks | **ours** — reload, then check the permit and the room token |
| **Poor connection** | subscribed, but their client reports poor or lost | **theirs** — wired over wi-fi, close other tabs |
| **Nothing on air** | in the room, but nothing is being published | the feed is not up; get credentials and start it |
| **Unknown** | a probe did not run | never read as "fine" — LiveKit was unreadable, or they have not reported yet |

The panel lists, each against its source and the time it was read: whether they are in the stage
room, their connection quality, how many tracks they are actually subscribed to, how many are on air
for them to receive, their app build against the current one, their browser and device, our own
roster state, and their last heartbeat and chat poll.

Two sources, never blurred. LiveKit's RoomService tells us who is connected and what is on air; it
does **not** expose connection quality or what a viewer is subscribed to, because LiveKit keeps both
on the client. So the attendee's own stage page reports its half on a small heartbeat. Where a probe
did not run, the field reads *Not reported* and the verdict reads **Unknown** — never green.

**It is their state, not their screen.** We cannot see their monitor, and the panel says so in one
line rather than implying otherwise. In practice the state is what you need: it shows the permit
nobody set, the stale build, the subscription that never happened.

**See their view** opens the stage page rendered with *their* real state — their permit flag, their
VIP standing, their silenced state, their agenda, their chat visibility — read-only, with the same
banner and the same write refusal as a persona.

**Privacy.** Diagnose and See their view are visible to owner, operator and producers only. Both are
recorded in the audit log as a diagnosis of that attendee. Neither shows, or stores, an IP or a
location: the browser and device line is a derived label ("Chrome 140 on macOS") and the raw
user-agent string is never kept.

---

## → §7 (What the validators hold), as a new row

`npm run validate:preview-personas` — preview personas and the attendee diagnosis. Every service
that writes something another human could see refuses a preview identity at its top; every list a
person reads (roster, count, People directory, networking, venue model) filters them out; `/venue/`
is a view-as surface guarded by the unchanged `canViewAsGuest`; the Diagnose panel names a source per
field, reads Unknown rather than green when a probe did not run, and can display neither an IP nor a
location. Proof behind it: `tests/unit/previewPersonas.test.ts`.
