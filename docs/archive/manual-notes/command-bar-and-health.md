# Manual notes — the Event Command Bar and the health dot

Paragraphs for `docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md`, written on branch `work/command-bar-and-health`.
The manual itself is **not edited here**: several agents are working this repo today and the manual is a
collision slot. Whoever lands the manual edit should paste these into the sections named below, verbatim.

---

## → Manual §3 (Show day, before the sections on Publish and the crew deck)

**The bar at the top of every event page.** If you are signed in with the owner password or as the
operator, a black bar sits at the top of every page that belongs to an event — the event workspace,
the crew deck, the room itself, the speaker pages and the sponsor pages. It carries, left to right:
the event's name with a menu of your other events, the status, a health dot, **Go live** (or **End
show** once you are live), **Stage requests: Open / Closed**, **Enter the room**, **Codes**, **Crew
deck** and **Manual**. Everything on it except Crew deck and Manual acts where you are standing: you
do not leave the page, and the page refreshes itself with the new state. That is the whole point of
it — running a show used to cost four page loads and it now costs none.

**Nobody else sees it.** The bar carries go live, the access codes and the stream key, so it renders
only for an owner or operator cookie. An attendee in the room sees nothing of it; neither does crew
signed in with a crew code, who work from the crew deck with their own permissions.

**The event switcher.** The `▾` beside the event name lists your other events, and jumping lands you
on the *same kind of page* for that event — crew deck to crew deck, stage to stage. Where the page
you are on belongs to a row of this event (a booth, a session), it lands on that event's overview
instead, because the row does not exist on the other one.

**Codes.** The `Codes ▾` menu shows this event's six codes, masked, each with **Copy** — masked
because the menu is most often open on show day, which is exactly when you are sharing your screen.
Setting a code, regenerating one and the join links are still on the event's Access codes page,
linked at the bottom of the menu.

**Enter the room.** `Enter the room ▾ → Myself (host)` puts you on your own stage with your own
identity and the host controls. You never type a code to get into your own room. Seeing the room as
an attendee, a VIP, a speaker, a sponsor or the client is being built and appears in this same menu.

---

## → Manual §6 (Going live — replace the paragraph that sends the producer to the crew deck)

**Going live from the bar.** Press **Go live** on the bar. One press sets the event live *and* mints
or reuses the LiveKit ingress, and the **Stream credentials** row under the bar opens on its own with
the RTMP URL and the stream key. The key is masked until you press **Reveal**, and **Copy both for
StreamYard** puts two labelled lines on your clipboard together with the instruction that matters:
*edit* the existing Custom RTMP destination, do not add a second one.

**Getting a key, and replacing one.** When there is no key the button reads **Get stream
credentials**. When there is a working one it reads **New stream key**, and it asks you to confirm
first, because the destination currently set up in StreamYard stops working the moment you press it
and you will have to paste the new pair in. There is no longer a control called "Generate / Refresh
Primary RTMP" — that was the same thing wearing jargon.

**Ending a show.** **End show** on the bar marks the show intentionally ended and releases the
ingress, which is deliberate: a stream key left behind in somebody's StreamYard must not work on your
next show. The card then reads *"This show has ended. Its stream key was released — get a new one
when you are ready to go live again"*, with one button to do exactly that. That is not a fault; it is
the system closing the door behind you.

---

## → Manual §7 (new subsection: Is anything wrong?)

**The health dot.** The dot on the bar is the **worst** of nine signals — feed, stage, webhook,
fallback, database, chat, attendees, build and capacity — so it can never read green while something
is red. Click it and each signal opens with what is true right now, **where that answer came from**,
and when it was last checked.

**Grey is not green.** A signal whose probe did not run reads **grey**, never green. Two of them are
grey on every deployment and will stay that way until the probes exist: **capacity** (LiveKit does
not tell this Worker how much of your tier or your transcode minutes you have used — read it in the
LiveKit dashboard before a big show) and, while an event is live, **attendees** (we know how many are
registered; how many are actually *connected* is what the per-attendee Diagnose panel on the roster
reads). A grey dot means "some of this is not measured", and the panel names which. It does not mean
anything is broken, and it must never be read as "fine".

**A yellow or red signal gives you the button.** Clicking one shows the thing to do about it with the
control right there — "Nothing is publishing. Get stream credentials → paste into StreamYard → go
live", with **Get stream credentials** inline — rather than a description you then go hunting to act
on.

**The show log.** Below the signals is a short log of what has happened to this show: credentials
minted, went live, feed dropped, moved to Cloudflare Stream, ended. Times are in **your** clock, not
the server's. That is the thing to read afterwards when you want to know what actually happened.

**One request.** Everything in the panel arrives on a single poll (`/api/venue/tick`) every fifteen
seconds, not one request per signal. If a poll fails the panel says so and keeps the last good
reading on screen rather than going blank.
