# Manual notes: plan an event, end to end

Paragraphs for `docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md`. Written here rather than in the manual
because several agents are editing the repo today and the manual has one owner.

**Target section: §10, "Clients who want us to run their event."**

---

## 1. DELETE the status callout in §10

§10 currently ends with:

> **Status:** the `/how-it-works/*` pages and the approve → price → pay → instructions flow are in
> the build queue as of 16 Sep 2026. Until they ship, send the client the scoping email manually and
> point crew at §6 of this manual.

**That block can now be deleted.** All of it shipped. The five pages exist, the flow exists, and the
workaround it describes is no longer the procedure.

---

## 2. REPLACE "What the client does" in §10 with this

### What the client does

1. **`westpeek.live/request-event`** — Plan an event. Name, email, company, event type, target date,
   audience size, and a **budget range**, which is required. It does not create an account and it
   does not expose billing.
2. West Peek scopes it and sends back an **approval with a price**.
3. The client **confirms the scope and the price** on their own link, then pays.
4. On payment, the instructions go out, and every instruction is a **web page we can update**, not a
   PDF frozen at send time.

---

## 3. ADD to §10, after the instruction-pages table

### What West Peek does, and where

Everything below happens on **`/app/requests`**, which is in the workspace sidebar as **Requests**.
Owner and operator can both reach it.

**A request arrives.** It lands on that page with its budget range and everything the visitor typed.
A draft event is created for it at the same time, so the codes in the instructions later are that
event's real codes rather than something new.

**You price it.** Type the price and write the client two sentences saying what we are doing. Press
**Approve and send the client their link**. That does three things at once: it attaches the price,
it mints the client's link, and it emails them. There is deliberately no "save a price for later":
a price the client has never seen is a thing to forget about.

The page tells you whether the email actually left. If this deployment has no Resend key it says
"recorded but not actually mailed", in those words, rather than looking like a delivery.

**Re-pricing** an approved request keeps the link the client already has, so their first email does
not go dead. It also clears their confirmation, because a new price is a new offer.

**The client confirms.** They open their link, read the scope and the price, and press the button.
That is all it does. It takes no payment and asks for no card details, and the page says so.

**You invoice, and they pay by transfer.** There is no payment provider on this site and none is
implied anywhere the client can see.

**You mark it paid.** When the money is in, the request shows **Mark paid and send the instructions**.
Put the bank reference in if you have one, then type the addresses for each audience: their crew,
their speakers, their sponsors, their attendees. The client's own address is always included whether
or not you type it.

Pressing it does two things and records both: it marks the settlement, and it sends every address
its own instruction email. Each one is in the email log at `/app/email` with who it went to and
whether it landed.

**Nothing on this path sends by itself.** Approve sends, and Mark paid sends. Nothing else does, and
nothing sends on a timer. The client confirming mails nobody.

**Marking paid is refused before the client has confirmed.** That is on purpose: it stops the
instructions going out for a scope nobody agreed to.

### Editing an instruction page

Open any `/how-it-works/...` page while you are signed in as owner or operator and use **Edit this
page** at the bottom. Everyone who was ever sent the link reads the page, including people mailed
months ago, so a correction reaches all of them without re-sending anything.

The five pages ship with real first drafts, so they are never blank. Once you edit one, your version
is what everyone sees.

### One line about money, for §15 if it fits better there

Settlement is recorded by hand today. The state that records it, and the instruction send that
follows it, are the same ones a payment provider would drive, so wiring a provider later changes
nothing about this procedure.
