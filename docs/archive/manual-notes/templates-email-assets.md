# Manual notes — templates, the Email tab, Assets documents, and house defaults

16 Sep 2026. Five changes the operator manual should absorb. Written here rather than into
`docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md` because that file is edited by one hand at a time.

## 1. Templates: the shelf arrives stocked

A clean install now has four templates the first time anyone opens Templates or New event:

| Template | Format | Type | Length | Agenda |
| --- | --- | --- | --- | --- |
| West Peek Room | Room | Community event | 45 min | One main stage |
| 45-minute workshop | Stage | Paid workshop | 45 min | Welcome 5 · Teach 20 · Work it through 12 · Questions 8 |
| Client webinar | Stage | Webinar | 75 min | Welcome 5 · Main talk 40 · Q&A 20 · Close 10 |
| Demo day | Stage | Demo day | 180 min | Open 10 · Pitches 120 · Investor Q&A 35 · Close 15 |

The lengths are the ones this product has run — the webinar is Leadership Reset's 75 minutes, the
demo day is Seed Demo Day's 180 — not invented numbers.

**They are ordinary rows.** Edit them, rename them, delete the ones you do not run. A deleted one
stays deleted: the install is stamped once on the house-defaults row and never runs again. They are
not seed fixtures and they are not on any seed-data exemption list.

**New event shows the picker first.** `/app/events/new` opens with "Start from a template" above the
Now/Later choice. Picking one fills the format, the type, the length, the agenda and the
registration questions, and the form says what it filled. With no templates at all it says so and
links to the Templates page, instead of rendering nothing.

## 2. The Email tab sends for real

`/app/email` now leads with a sender: pick the event, pick the message, type the addresses, Send
now. It posts to the **same server action** the event's Communications page posts to — same
permission gate, same service, same log row — so a send from the Email tab and a send from the
event page are the same send. There is no second path to drift.

The Resend test is still there, collapsed, labelled as a deliverability check. It mails one address
to prove the provider works. It is not attached to an event and writes no log row.

## 3. One communications panel

`/app/events/{id}/communications` used to stack two panels writing to two different logs. The older
one ("Resend status · Send / log status · Send log") is deleted, along with its action and services.
The one thing it had that the new panel did not — the **crew call sheet** — is now the eighth
workflow, alongside speaker invite, sponsor setup, client invite, tech check reminder, asset
reminder, show day reminder and report ready.

## 4. West Peek documents live in Assets

`/app/assets` opens with a **West Peek documents** group: the operator manual and the five
`/how-it-works/*` instruction pages (client, crew, speaker, sponsor, attendee). Each row offers
**Download .md**.

An instruction download is **generated from the live page at the moment you click it**. An
instruction email carries the link and never the text, precisely so a correction reaches everyone
who was ever sent it; a download had to work the same way or it would hand somebody the stale copy.

These are documents, not uploads, and the separation is structural: they are not asset records, they
touch no event, so there is nothing to archive, nothing to delete through the asset actions, and
nothing that can move an event's file count. The manual download runs the same access-code check
that guards the manual file and the in-app copy — one shared list in `lib/manual/accessCodeShapes.ts`
— and refuses to serve rather than hand out a file with a code in it.

## 5. Settings holds the house defaults

A new **House defaults** panel on `/app/settings`, stored on its own row (`runtime_house_defaults`,
migration 0043) rather than widening the agency settings row. Agency settings is identity — the name
on the door, the two colours, the team — and it is read on the dashboard on every page load. These
are operational defaults read by the create path, the email provider and the capacity module, and
the list will keep growing.

| Setting | What reads it |
| --- | --- |
| From address | Every message that leaves. Resend only sends from a domain verified with it — the panel says so at the field, rather than failing at send time. |
| Reply-to address | Every message, and the banner on the Email page. |
| Default timezone | The zone `/app/events/new` opens on, and the zone a new event is stamped with. |
| Networking match length | Written onto each new event's networking settings as it is created. |
| Attendee session lifetime | Stamped on a new event. The per-event override still wins. |
| Default registration questions | What New event opens with. The per-event editor still overrides. |
| LiveKit tier | The plan `/app/capacity` measures against. Blank means "follow `LIVEKIT_TIER`". |

Every field falls back to what the code or the environment already did, so an install that never
opens Settings behaves exactly as before.

**Logo.** Uploaded through the same signed-upload path Assets uses — the browser PUTs the bytes
straight to Supabase Storage, the Worker never carries the file. It replaces the wordmark on the
workspace, the New event form, the request page and a client's proposal. Emails keep the wordmark:
the logo sits in the private bucket behind a link that expires, and an expired image in a month-old
email is worse than no image.

**Nothing secret is on this page.** Access codes and the master passwords stay in the owner-only,
audited vault in the Owner Console; Settings is operator-reachable, and the validator fails if a
code or password ever appears on it.

**Billing copy.** "Billing is not configured in this baseline and has no panel here" is gone. The
page now points at `/app/capacity`, which is where LiveKit Ship, Workers Paid and Cloudflare Stream
pay-as-you-go are actually visible.

## What guards this

`npm run validate:shelf-email-assets-house-defaults`
(`scripts/validate_shelf_email_assets_and_house_defaults.js`), admitted in
`_validator_admission_register.json` and chained into `validate:deploy-parity`. It fails if it reads
fewer than 35 files, so an empty loop cannot pass. Behaviour is proved by
`tests/unit/shelfEmailAssetsAndHouseDefaults.test.ts`.
