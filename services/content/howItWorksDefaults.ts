import type { HowItWorksAudience, HowItWorksPageRecord } from "@/types/howItWorks";

/**
 * The first drafts of the five instruction pages.
 *
 * These ship in the code so a page is never blank and never waits on a database row. The moment
 * somebody at West Peek edits one, the stored version wins and this text stops being used for that
 * slug. It stays here as the floor: delete every row and the pages still say something true.
 *
 * House style, which the validator enforces: plain sentences, no marketing language, no em-dashes
 * in body copy. Somebody is reading this an hour before a show.
 */
export interface HowItWorksDefault {
  slug: HowItWorksAudience;
  /** Who the instruction email goes to, in the words the workspace uses. */
  audienceLabel: string;
  title: string;
  intro: string;
  body: string;
}

export const HOW_IT_WORKS_DEFAULTS: Record<HowItWorksAudience, HowItWorksDefault> = {
  client: {
    slug: "client",
    audienceLabel: "The client",
    title: "How it works, for the client",
    intro: "You have booked West Peek to run your event. This page is what happens next, what we need from you, and who to ask when something changes.",
    body: `## What we do and what you do

We run the production. That means the run of show, the speaker rehearsals, the technical direction on the day, the failover plan, and the assets afterwards. You own the content and the guest list.

What we need from you, in this order:

1. The list of speakers with their email addresses. We invite them, not you.
2. Your sponsors, if there are any, with a contact at each one.
3. Anything that has to appear on screen: a logo, a title card, a deck you want played.
4. A date and time for the speaker rehearsal that your speakers can actually make.

## The dates that matter

- **Four weeks out.** We agree the run of show. This is the document that says who is on screen, when, and what happens if any of it fails.
- **Two weeks out.** Speaker rehearsals. Every presenter, on the real platform, with the real deck, from the place they will present from. This is the step that prevents most of what goes wrong live.
- **One week out.** Assets locked. Anything arriving after this is best effort.
- **The day before.** We do a full technical run with the crew.
- **Show day.** We are in the room an hour before the doors open.

## Your portal

You have a read-only view of the event: the run of show, the speaker list, the assets, and the approvals waiting on you. Approvals are the only thing there that needs you to act. If something is waiting on you it will say so at the top.

## Changing something

Tell us as early as you can. A change four weeks out is planning. The same change on the morning is a risk we have to price in time rather than money. Nothing is impossible, but after the technical run we will tell you what a change costs the show.

## When something goes wrong on the day

Nothing. You do nothing. There is a named person on our side for every failure we can think of, and a plan for each one. If a presenter drops, if a screen share dies, if the stream stops, we have already decided who does what. Watch the show.

## Who to contact

Reply to any email we have sent you about this event. It reaches the producer running it, not a shared inbox nobody reads.`,
  },

  crew: {
    slug: "crew",
    audienceLabel: "Their crew, if they bring their own",
    title: "How it works, for crew",
    intro: "You are running a show on West Peek Live. This page assumes you have never used it before. Read it once now and keep it open on show day.",
    body: `## Getting in

You need two things: the address of the crew deck, and the event's crew code. Both are in the email that sent you here.

1. Go to **westpeek.live/production-access/crew**.
2. Put in the event code and the crew code. Both are uppercase and both are in your email. Spaces and dashes do not matter.
3. Give your name once. That name is what the rest of the crew sees next to your actions.

If you were sent a host link instead, open that. It fills both codes in for you and you only press Continue.

## The deck

The crew deck is at **westpeek.live/crew/events/{event}** and it is where you run the show from. Everything below happens on that one page.

Top of the page, in order:

- **What to do now.** The next thing, in one line. If you read nothing else, read this.
- **Go live.** The card that starts and ends the broadcast.
- **Call sheet.** Who is on, when, and how to reach them.
- **Run of show.** The minute by minute. Follow it.
- **Tasks.** What is still outstanding before the doors open.

Times on the deck render in your own time zone. You do not have to convert anything.

## Going live

1. Press **Go live** on the go-live card. The event goes live and the stream credentials appear in that same card.
2. Copy both credentials into StreamYard. **Edit your existing Custom RTMP destination, do not add a second one.**
3. At the same time, add the Cloudflare fallback as a second destination. The RTMPS URL and key for it are on the deck's Fallback 1 card with copy buttons. Broadcast to both. This is what makes the fallback ladder work later.
4. The stage flips live within a few seconds. Confirm it on a second device, on a different network, before you believe it.

If the show has been ended before, the card will say the stream key was released. That is deliberate. Press **Get stream credentials** and it mints a fresh one.

## During the show

| Control | What it does |
| --- | --- |
| Stage requests: Open or Closed | One switch for camera and mic requests together. Closed means no hands up |
| Approve or revoke a raised hand | An approved attendee appears on stage with their mic off |
| Silence, Hide, Lock chat | Per person, or the whole room |
| Bring a speaker to the stage | From the speaker roster. Send them backstage the same way |
| Networking | Open or close the queue. The matcher pairs people into 1:1 rooms with a timer |
| Move down, Move back up | The fallback ladder, below |
| End the show | Deliberate, and it releases the feed |

Everyone can watch by default. You only ever approve people to come **on** the stage.

## Moderating

Chat moderation is per person and per room. Silence stops someone posting and they are not told. Hide removes a message that is already up. Lock chat stops the whole room. Every moderation action records who did it, so use your own login rather than sharing one.

Do not delete a hostile question that the speaker has already seen and started answering. Hide it after they finish, not during.

## The fallback ladder

When the feed dies, you move down a rung. This is the ladder:

1. **Primary, LiveKit.** The normal show. Attendees can be brought onto the stage.
2. **Fallback 1, Cloudflare Stream.** Keeps the StreamYard feed running. Attendees see the show in a Cloudflare player, watch only. This is the rung you will actually use.
3. **Fallback 2, Daily.** Only shows anything if a host turns a camera on.
4. **Fallback 3, Zoom embedded.** A Zoom meeting inside the page.
5. **Fallback 4, Google Meet.** Attendees leave the venue to watch.

When the primary fails, press **Move down: Cloudflare Stream** on the deck. Attendees swap over in about ten seconds on the same page. Chat, the roster and networking are untouched, and they do not have to click anything.

While you are on Cloudflare you cannot bring an attendee onto the stage. That needs LiveKit. When the primary is healthy again, press **Move back up**.

The card refuses to move down to a rung that is not configured rather than sending everyone to a blank player. If it refuses, that is the card doing its job.

## Ending the show

Press **End the show** on the go-live card. This is deliberate and it does three things: it releases the feed, it marks the event ended, and every viewer's stage says so instead of showing a frozen frame.

Ending a show releases the stream key on purpose, so a key left behind in somebody's StreamYard cannot work on the next show. Starting again later is one press of **Get stream credentials**.

## If you are stuck

Reply to the email that sent you here. It reaches the producer for this event.`,
  },

  speaker: {
    slug: "speaker",
    audienceLabel: "Speakers",
    title: "How it works, for speakers",
    intro: "You are speaking at an event West Peek is producing. Here is how you get in, what the rehearsal is for, and what happens on the day.",
    body: `## Getting in

Your invitation has an event code and a speaker code. Both are uppercase.

1. Go to **westpeek.live/production-access/special-guest**.
2. Put in both codes and give your name once.
3. You land in the green room for your event.

Keep the email. The same codes work every time, including on the day.

## Before the show

Your green room has your session, your slot time in your own time zone, and a place to upload your deck. Three things are asked of you:

1. **Send your deck early.** If you are screen sharing instead, say so, and tell us what you are sharing from.
2. **Run the tech check.** It takes two minutes and it tests the thing that actually fails: your camera, your microphone, and your connection from the room you will present from.
3. **Come to the rehearsal.** On the real platform, with the real deck, from the real place. If you rehearse from a different room than the one you present from, you have not rehearsed.

## Your cue cards

The run of show gives you a cue card: when you are on, who hands to you, who you hand to, and how long you have. It is in your green room and it updates if the plan changes, so read it again on the morning rather than trusting the version you read last week.

## On the day

Be in the green room thirty minutes before your slot. You will be able to see and hear the show but the audience cannot see or hear you.

When it is your turn, the crew brings you to the stage. You do not press anything. Your microphone comes on and you will see it come on.

When you are done the crew takes you back. Stay in the green room if there is a panel later, otherwise you are free to go.

## Questions from the audience

Questions come to the crew first, and the host reads them out or hands them to you. You do not have to watch the chat while presenting, and you should not.

## If something goes wrong

If your connection drops, rejoin with the same link. The crew has a plan for a missing presenter and it does not involve you panicking. If you cannot get back in, phone the number in your invitation.`,
  },

  sponsor: {
    slug: "sponsor",
    audienceLabel: "Sponsors",
    title: "How it works, for sponsors",
    intro: "You are sponsoring an event West Peek is producing. Here is how to set your booth up, what you get, and how leads reach you.",
    body: `## Getting in

Your invitation has an event code and a sponsor code. Both are uppercase.

1. Go to **westpeek.live/production-access/special-guest**.
2. Put in both codes and give your name once.
3. You land in your booth for this event.

More than one person from your team can use the same code. Everyone gives their own name.

## Setting the booth up

Do this at least a week out. A booth that goes up on the morning is a booth nobody finds.

- **Your logo.** A transparent PNG, wide rather than tall. This appears in the expo and usually on the stage frame.
- **One paragraph.** What you do, for whom, in plain words. Attendees are scanning, not reading.
- **One link.** Where you actually want people to go. Not your homepage unless your homepage is the right answer.
- **A file, if you have one.** A one pager beats a brochure.
- **Who is staffing it.** Names, so attendees know who they are talking to.

## The ready room

Your booth has a ready room, which is a private video room for your staff. Attendees who want to talk to you come into it one at a time. Somebody has to be in it for that to work, so agree in advance who is sitting there and when.

If nobody will be staffing the booth live, say so and we will set it to leave a message instead of ringing an empty room.

## Leads

An attendee who opts in at your booth becomes a lead. You see them in the booth as they arrive, with whatever they chose to share. You can export the list at any point during the event and after it.

Attendees who did not opt in are not in the list. We do not hand over the attendee list, and no sponsorship tier changes that.

## After the event

Your report lands within two working days: booth visits, leads, and how long people stayed. It is a real count, not an estimate.

## Who to contact

Reply to the email that sent you here. It reaches the producer for this event.`,
  },

  attendee: {
    slug: "attendee",
    audienceLabel: "Attendees",
    title: "How it works, for attendees",
    intro: "You are coming to an event West Peek is running. Here is how to get in, what is in the venue, and how to ask a question.",
    body: `## Getting in

Your invitation has a join code. It is uppercase, and spaces and dashes do not matter.

1. Go to **westpeek.live/join**.
2. Put the code in.
3. Register once, with your name and email. That is the whole of it.

You can come back with the same code as many times as you like, on any device.

## Before it starts

Join a few minutes early. The lobby tells you what is coming up and lets you check that your browser can play the stream before it matters.

You need a browser and a connection. Nothing to install, no plugin, no account with anyone.

## What is in the venue

- **The stage.** The main show.
- **Chat.** Next to the stage. Say hello.
- **Networking.** If it is open, you are put into a 1:1 video conversation with another attendee for a few minutes. Join the queue and leave it whenever you like.
- **Expo.** The sponsor booths. You choose whether to share your details with any of them, and nothing is shared unless you choose it.
- **Replay.** Appears after the event if the organiser publishes one.

## Asking a question

Type it in the chat. The crew collects questions and the host puts them to the speaker. You do not need to raise a hand to ask something.

If the organiser has opened stage requests, you can also ask to come on camera. Press the button in the stage panel. If the crew approves you, you appear on stage with your microphone off and you turn it on yourself when you are ready. You are never brought on without approving it first.

## If the video stops

Refresh the page first. That fixes most of it.

If it is still not playing, stay on the page. When the crew switches to a backup the page swaps over on its own in about ten seconds, and the chat and everything else carries on. You do not need a new link.

## Your details

You gave a name and an email to get in. Those are used for this event and for the replay. A sponsor gets your details only if you press the button at their booth that says so.`,
  },
};

export const HOW_IT_WORKS_DEFAULT_LIST: HowItWorksDefault[] = Object.values(HOW_IT_WORKS_DEFAULTS);

/** The shipped draft as a record, for a slug that has never been edited. */
export function defaultHowItWorksPage(slug: HowItWorksAudience): HowItWorksPageRecord {
  const draft = HOW_IT_WORKS_DEFAULTS[slug];
  return {
    slug,
    title: draft.title,
    intro: draft.intro,
    body: draft.body,
    updatedBy: "west-peek",
    updatedByLabel: "First draft, shipped with the app",
    updatedAt: "",
  };
}
