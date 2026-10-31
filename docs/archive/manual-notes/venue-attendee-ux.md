# Venue, attendee side — notes for the operator manual

Written 16 Sep 2026 from a live show the owner sat in. These are the facts the manual has to
state; the manual itself is not edited here.

## Who can watch

**Anyone holding the link can watch and read the chat.** No account, no registration, no code
re-entry. Registering is only what lets a person take part: post in the chat, join networking,
appear on the People page, or ask the crew to bring them on stage.

This was not true before this change. `app/api/video/livekit-token/route.ts` returned
**403 "Registered attendee session required for attendee video token."** to any viewer with no
attendee session, so an unregistered person who followed a join link sat on "Stage is getting
ready. Live stream will begin shortly." for the whole show. The guard in
`lib/auth/videoTokenRequestGuard.ts` refused them before the route ever ran. There is **no
per-event "require registration to watch" setting** — it was a single hard-coded refusal, not a
policy, and it is gone. An anonymous viewer now gets a subscribe-only token as "Guest", with
publishing off, and only for the rooms anyone may watch: `main_stage`, `session`, `breakout`.
A green room and a 1:1 networking room still require the session.

## How people arrive

`westpeek.live/join?code=WPL-XXXXXX` **redirects straight to the show.** A live event lands on the
stage, an open one on the event page, an ended one on the replay. The form is only for someone who
arrives with no code; the card is only for a code that cannot resolve (not found, doors not open,
archived) and it says what to do next in plain words.

## What is on every venue page

- **One sticky toolbar**, about 56px: wordmark, event name, a LIVE pill when the stage is live, the
  nav, and the attendee's own name as a chip. The four stat tiles are gone.
- **Nav markers** come from `services/venue/venueActivityService.ts` and appear only where the
  signal is genuinely true right now: Live on the stage, Open or "N waiting" on networking when the
  crew has networking open, and counts on Expo, Breakouts, Replay and People only when non-zero.
- **The run of show strip**, directly under the nav: two rows open, one row collapsed, the choice
  remembered per viewer. It reads `services/run-of-show/attendeeRunOfShow.ts`, which is the only
  attendee-safe projection of the schedule and carries no producer notes, cues, backup plans or
  emergency notes. If the schedule cannot be read the strip does not render at all.
- `/venue/{id}/run-of-show` still works for a direct hit and is still in the route ledger.

## Times

**Every attendee-facing time renders in the viewer's own zone.** The Worker's clock is UTC, so a
server-formatted time was silently wrong; `components/shared/LocalTime.tsx` and
`components/shared/LocalTimeWindow.tsx` own this and nothing else in the venue may format a time.
`lib/utils/format.ts` `formatSessionWindow` is no longer called from any attendee surface.

## Sound on the stage

The player asks for unmuted playback the moment the room exists. Where the browser allows it,
sound starts with nothing to press. Mobile Safari and Chrome usually refuse on a first visit: the
video still plays, the speaker icon shows a slash and "Tap for sound" appears beside it, and that
one tap both satisfies the browser's gesture requirement and unmutes. **The control is an icon**,
speaker or speaker-with-slash, with an aria-label of Mute / Unmute. The volume slider is desktop
only; on a phone the OS volume is what people use.

## Registering is asked for, never enforced

Three moments, and all of them disappear once the person is registered:
1. a panel beside the chat from arrival, saying what registering unlocks;
2. one prominent lift of that same panel after about 45 seconds of **visible-tab** watching, in the
   chat column and never over the video, dismissible, once per person ever;
3. the same words at the chat composer, the networking join and the raise-hand control.

There is no modal over the video, no delay before watching, and no undismissable ask. If anyone
asks for one, the answer is no.

## Copy rule

Every sentence says what the person can do, never what the system does. Banned in guest copy and
enforced by `scripts/validate_venue_attendee_ux_contract.js`: "identity state", "access
permission", "room-scoped", "attendee-safe", "resolver", "Resolve Event", and em-dashes in body
copy. People's names render exactly as the person typed them; labels may be uppercase, names never.

## One component per repeated thing

`VenueSection` (collapsible, chevron, remembered per viewer, respects reduced motion),
`VenueEmptyState`, `VenueBrowse` (the list-page archetype), `RegisterToTakePart`, `LivePill`,
`VenueWelcome` (the single dismissible orientation card, which replaced `FirstVisitCoachStrip`),
`RunOfShowStrip`, `LocalTimeWindow`.
