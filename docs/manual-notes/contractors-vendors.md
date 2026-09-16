# Manual note — Contractors and vendors

**For the coordinator:** fold the section below into `docs/WEST_PEEK_LIVE_OPERATOR_MANUAL_V3.md` as a
**new section between §9 (Files and assets) and §10 (Clients who want us to run their event)**, so it
becomes §10 and everything after it shifts by one. Add the line
`- [10. The people and companies you pay](#10-the-people-and-companies-you-pay)` to the table of
contents at §22, in position.

Two smaller edits in existing sections are at the bottom of this file.

---

## 10. The people and companies you pay

Two lists, one address book. A **contractor** is a *person* you pay for a role on a show — a
moderator, a technical director, a camera op. A **vendor** is a *company* supplying a service —
catering, AV hire, captioning. They are kept the same way, on the same fields, because they are the
same job: someone outside West Peek who has to be found, booked and paid.

**The two global lists.** `/app/contractors` and `/app/vendors` are everyone you have ever added,
across every event. Each row carries the name, the company, the role or service, the email and
phone, the rate, the notes, and the events that person or company is on.

**A record is a person, not a booking.** The same camera op on four shows is one row attached to
four events, never four rows. Correct her number or her day rate once and it is corrected on every
show she is on — that is the whole reason the list is global.

**Rates say what they are.** A contractor is normally a **day rate** and a vendor a **quote for the
job**; the row shows which. A rate you have not agreed yet is left blank, and the row reads *No rate
agreed* — never `$0`, which would look like free.

**Status is three words:** **Shortlisted → Booked → Paid**. It moves in either direction, so a
mis-click is corrected in place rather than by making a second row. Nothing in the product pays
anyone; **Paid** is your record that you did.

**Putting someone on an event.** Open the event and go to **Contractors** (under Talent) or
**Vendors**. Pick someone already on file from the dropdown and say what they are doing on this
show ("2nd cam, hall B"), or add a brand-new person right there — created from an event page, they
land on that event straight away. **Remove from this event** detaches them: the person stays on
file with every other event they have worked.

**Filtering and the CSV.** Both global lists filter by status and by event, and the filter is in the
URL. **Download CSV** exports **exactly the rows on screen** — the same filter, the same order, the
same event list. A "Booked only" page can never hand back a spreadsheet with the people you did not
hire in it.

**Empty means empty.** A list with nothing in it says what to add and why. There are no example
rows, and there never were any real ones hiding behind them.

**Archive, never delete.** Archiving takes someone off the list and leaves the record and every
event they worked intact.

---

### Smaller edits to existing sections

**§15 "Rules that do not bend"** — add one bullet:

> - **No invented rows.** No page in the workspace shows example data as though it were yours. A
>   list with nothing in it says so, and says what to add. The build fails if a page goes back to
>   fixtures.

**§14 "Troubleshooting"** — add one row/entry:

> **"The Contractors or Vendors page says the tables are not in this database yet."** Migration 0033
> has not been applied. It reaches production through `supabase/migrations`, applied when the branch
> merges to `main`; until then the page says so in words rather than showing a blank list.
