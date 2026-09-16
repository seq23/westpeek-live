# Manual notes — branch `work/templates-real` (templates that do something)

The manual file itself is untouched on this branch (siblings are running). Fold these in where noted.

## §3 (owner) — after "Start a Room right now", or wherever templates get a mention

> **Templates are starting points.** A template carries the format, the type, how long the event
> runs, the sessions it opens with and the questions it asks at registration — and nothing else,
> because those are the only things the New event form reads. Save one from an event that worked
> (**Templates → Save an event as a template**) or write one by hand. Then **Use this template** on
> `/app/templates` opens New event already filled in: change the name and the date and you are done.
> The new event's agenda is the template's sessions, laid end to end from the start time.

## §4 (operator) — the same two lines, since operators reach `/app/templates` too

> Templates live in the runtime store now, not in the code. Anything you save is available to
> everyone with workspace access immediately, and deleting one never touches the events made from it.

## Route note for the ledger section, if the manual lists routes

`/app/templates` is operator-reachable (it was owner-only by omission).
