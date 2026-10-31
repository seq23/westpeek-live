# The top of a venue page — notes for the operator manual

Written 16 Sep 2026 from the owner's own screen on `/venue/{eventId}/stage`. These are the facts
the manual has to state; the manual itself is not edited here.

## What was wrong

Two sticky bars, built separately, both pinned to the top of the page with no shared offset:

- the **Event Command Bar** (owner and operator only), and
- the **venue nav** (`West Peek Live! · 45 Minute AI workshop · LIVE NOW · Lobby · Stage · ...`).

At rest they stacked and the nav landed on top of the **Stream credentials** heading between them.
On scroll the nav slid up over the command bar and hid its controls. The nav itself ran off the
right of a phone, ending mid-word at "Run of Sh" with **Help** unreachable and nothing to suggest
it scrolled. The event name was printed twice, once in each bar, and the nav read **LIVE NOW**
beside a command bar reading **ENDED**.

## What is true now

**There is exactly one pinned region on an event page**, and everything in the chrome is inside it,
in order. `components/command/EventChromeStack.tsx` owns that pin; every event area mounts its
command bar through it, and the venue layout mounts the whole venue stack through
`components/venue/VenueChrome.tsx`.

**The command bar is the top of the stack and the venue nav is the level below it.** The nav is
shorter and lighter, sits on a slightly lifted black, and is separated by a hairline. When there is
no command bar (which is everyone except an owner or an operator) the nav is the whole stack and
sits alone at the top.

**Nothing else on a venue page is pinned.** The stream credentials scroll with the page below the
stack. The "register to take part" card no longer pins itself to the bottom of the screen either.

**The event name appears once.** With a command bar above it, the nav drops both the wordmark and
the event name, because the bar already names the event and the switcher is how you change it.
Alone, the nav keeps both.

**One component says what is live.** The nav's **Stage** marker is the venue's live signal; the
command bar's status pill is the operator's statement of what the event's status actually is. The
nav's separate `LIVE NOW` pill is gone, which is what used to contradict an `ENDED` command bar.
The marker's own correctness on an ended event is owned by the speed-networking branch's activity
work, not by this one.

**The chrome cannot clip in silence.** The venue nav fits whole from 1440px down to about 1280px.
Below that it scrolls sideways, and at exactly those widths it shows a fade at the right edge, a
thin scrollbar and a spoken hint. The command bar behaves the same way: one row that scrolls, with
the same fade.

**A menu on the command bar opens as a sheet on a phone.** Below 1280px the bar is a scrolling row,
and a scrolling row clips a dropdown, so the event switcher, the health panel, "Enter the room" and
"Codes" open as a panel at the bottom of the screen instead. From 1280px up they are the dropdowns
they always were.

## Measured heights

Both bars together, at rest, with the demo event:

| Viewport | Owner (command bar + nav) | Attendee (nav only) |
| --- | --- | --- |
| 414 x 896 | **73px** | 36px |
| 1440 x 900 | **73px** | 37px |

The budget is 96px on a 414px phone, so the stage player still lands on the first screen. Before
this change the owner's two bars measured 135px on the same phone.

## What holds it shut

- `npm run validate:venue-chrome-stack` — one sticky element in the chrome, the stack ordered, the
  credentials outside the pin, the name and the live claim owned once each, the nav's overflow
  affordance, and every bar control sized from the one chip recipe in
  `components/command/commandChrome.ts`. It hard-fails if it examines nothing.
- `tests/e2e/venue-chrome-stack.spec.ts` — measured in a real browser at 414px and 1440px, as an
  attendee and as the owner: one pinned element, the bars never intersecting, content starting
  below the stack at rest and after a scroll, the stack under the phone budget, and a menu opening
  off the scrolling bar landing on screen rather than clipped by it.
