# How long a registration lasts, and what happens on a second device

Written for the operator manual. 17 September 2026.

## The question

After attending her own show from a phone, the owner asked: "what if i registered already and was
out, do i have to register again when i come back, how long does my registration last if i exit?
both on mobile and desktop?"

Nothing in the product answered it, and the second-device case looked like a bug.

## The answer a guest now gets

Registration is per event and per browser. It always was; now the product says so.

| Situation | What happens |
| --- | --- |
| Close the tab, come back on the same phone or laptop | Still registered. Nothing to fill in. |
| How long that lasts | 14 days by default, and the venue says the number out loud. |
| Open the same link on a second device | Type the email you registered with. Name, company, title and your answers come back. |
| Registration on this device about to run out | The venue says so a day ahead and offers the one field. |
| Registration on this device already ran out | The venue says so and offers the one field, not a blank form. |
| An email that does not match | The ordinary registration form, with the address already typed in. It never says whether an address is registered. |

The line lives quietly in the identity area of the lobby and again on the registration form. It is
not a toast that vanishes.

## What an unverified email may claim

The second-device path asks for an email and nothing else, so it is treated as an identity claim
that has not been checked. It restores **only what the person typed into the registration form**:
name, company, title, website, social links, their answers, their networking preference. That is
the same information the People directory already shows every other attendee.

It restores **nothing privileged**. The session is stamped `assurance: "email_restored"` and three
places read that stamp:

- the lobby does not show VIP standing;
- the attendee's own stage status reports no capability;
- the video token is issued watch-only, with camera, microphone and screen share off.

Crew, operator and special-guest access never came from the attendee cookie in the first place, so
nothing there is reachable either.

A person who genuinely is a VIP re-enters the VIP code on the new device, exactly as they did the
first time. A person the crew put on stage is approved again on the new device. Privilege is
device-bound on purpose.

The path is rate-limited through the same gate limiter as the access codes, counting every attempt
whether it matched or not, so it cannot be used to find out who is attending.

## Changing the lifetime for one event

`runtime_events.attendee_session_days` (migration 0039) holds the number of days for a single
event. Leave it null and the event uses the platform default of 14. Every sentence a guest reads is
generated from the resolved value, so changing it changes the copy too. Valid range is 1 to 365.

The session cookie deliberately lives 60 days longer than the session itself. That is what makes
"your registration ran out" a thing the venue can say, instead of showing a stranger's blank form to
somebody who registered last month.

## What is not built

No emailed confirmation code. It would be stronger, and it is the right next step if an event ever
wants VIP or stage rights to travel between devices. It was left out here because it puts an inbox
round trip between a guest and a show that is already running, which is the moment people give up.
The trade taken instead is that an unverified email restores self-declared fields only.
