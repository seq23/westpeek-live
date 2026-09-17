# Migration assurance — how a migration actually reaches production

17 Sep 2026. Written after three migrations were found unapplied in production on the same night,
each by accident.

---

## Is the Supabase GitHub integration connected? Yes — and it was already telling us

This was the open question, and the belief in the repo was wrong in **both** directions. The evidence
below is from the GitHub check-run API for this repository, not from inference.

| Question | Answer | Evidence |
| --- | --- | --- |
| Is the Supabase GitHub app installed? | **Yes** | App `supabase` (id 330661) posts a `Supabase Preview` check run on every commit to this repo. |
| Does it apply `supabase/migrations/` to the production project? | **Yes, on push to `main`** | Commit `25f256f` (16 Sep, 23:43 UTC): conclusion `success`. Commits `cf50aff` and `78f6847`: conclusion **`failure`**, with the SQL error in the check output. |
| Why is `Supabase Preview` SKIPPED on every PR then? | **Different feature.** The SKIPPED is Supabase *Branching* (preview databases), which is off. Its own summary says so: *"This git branch is not associated with any Supabase Branch."* Its details link goes to `/settings/integrations`, not to a run. | `gh pr view 63/64/65 --json statusCheckRollup` |
| So why did migrations go unapplied? | **The red was invisible, not absent.** | See below. |

### The two red runs nobody saw

`cf50aff` (23:10 UTC) and `78f6847` (23:27 UTC) both carry this check output verbatim:

```
ERROR: relation "public.request_event_intake" does not exist (SQLSTATE 42P01)
At statement: 0
...
alter table public.request_event_intake add column if not exists budget_range text
```

That is incident 3 exactly. `0023_request_event_intake.sql` had **no mirror** in
`supabase/migrations/`, so the base table was never created; `0036_plan_an_event_pipeline.sql` then
could not alter it; the integration aborted the whole apply; and everything after 0036 in filename
order — 0037, 0038 — never ran either. That single missing mirror is the common cause of two of the
three incidents.

The integration reported this correctly, twice, in red. **Nobody saw it, because a check run on a
push to `main` appears on no pull request, in no workflow run, and in no notification.** You have to
go looking at the commit on GitHub, or call the API, to know it happened.

**Conclusion: the automation is real and it works. What was missing was a place where its failure is
visible.** This branch adds that.

---

## The real process, as of today

### Adding a migration

1. Write the SQL in `db/migrations/NNNN_name.sql`. Keep it idempotent (`create table if not exists`,
   `add column if not exists`) — the integration may re-run it.
2. **Copy it byte-for-byte** to `supabase/migrations/<timestamp>_name.sql`. The timestamp must sort
   after every existing mirror. `npm run validate:migration-mirror-parity` fails if you forget, if
   the two drift, or if the timestamp sorts out of order.
3. **Do nothing to `RUNTIME_TABLE_MIGRATIONS` by hand and hope.** Run
   `npm run validate:migration-map-coverage`. It reads your SQL and tells you the exact entries to
   add to `types/runtimeEvent.ts` for every table you created and every column you added.
4. Open the PR. Both validators run inside `npm run validate` → `validate:deploy-parity`.

### After the merge to `main`

The **Supabase migration apply** workflow (`.github/workflows/supabase-migration-apply.yml`) reads
the Supabase check run for the merge commit and fails if it is anything but
green — and fails it too if the push changed `supabase/migrations/` and Supabase reported nothing at
all. That is the red signal, in the Actions tab and in the failure email.

### If it goes red — the manual step

This is a named, honest manual step, not a workaround. It is the same instruction the named stop on
`/app/events/new` already gives.

> Open the Supabase SQL editor for project **`lqxzpwtvolojashknseb`**
> (https://supabase.com/dashboard/project/lqxzpwtvolojashknseb/sql/new), paste the contents of the
> migration file named in the error, and run it. The migrations are idempotent, so running one that
> was already applied does nothing.

Apply them **in numeric order** from the lowest one the error names. An earlier failure blocks every
later migration, so one missing base table can leave several behind.

Then re-run the deploy's post-deploy smoke, or just load
`https://west-peek-live.seq-taylor.workers.dev/api/runtime/health` and check
`migrationCoverage.ok` is `true`.

---

## How a missing migration is caught now

| Where | What it catches | When |
| --- | --- | --- |
| `npm run validate:migration-map-coverage` | A migration whose tables/columns are not in `RUNTIME_TABLE_MIGRATIONS`, so the health probe would never look for them. Also a map entry no migration supplies. | Every PR, in `npm run validate`. |
| `npm run validate:migration-mirror-parity` | A `db/migrations/*.sql` from 0023 on with no byte-identical `supabase/migrations/` twin, or mirrors that sort out of order. | Every PR, in `npm run validate`. |
| `Supabase migration apply` → **Supabase applied the migrations** | The integration itself reporting failure, or silently skipping a push that changed migrations. `workflow_dispatch` can re-read any commit. | Every push to `main`. |
| `Supabase migration apply` → **The verdict rule still decides red from green** | The rule above rotting: all ten terminal states are replayed through `scripts/supabase_apply_verdict.js`. | Every pull request. |
| `/api/runtime/health` → `migrationCoverage` | The **live database** missing any object in the map, named with the migration file that supplies it. | On request, any time. |
| `npm run postdeploy:smoke` | The above, as a failing deploy step with the file to paste into the SQL editor. | Every deploy, in `Deploy Cloudflare Worker`. |

`migrationCoverage` checks **every** entry in the map — 53 tables and columns — with one PostgREST
read per table rather than one per object, so it costs 13 requests, not 53. It reports `ok: false`
when it checks zero objects, so an empty map or an unreachable database is a failure and never a
quiet pass.

## What is still true and worth knowing

- `0001`–`0022` were applied by hand against the live project before the integration existed. They
  are deliberately not mirrored, and both validators floor at `0023` for that reason.
- `0023` now **has** a mirror (`supabase/migrations/20260915180000_request_event_intake.sql`). It is
  idempotent and sorts ahead of 0024's, so a rebuild from an empty project would work.
- Supabase Branching (preview databases per PR) is **off**. Turning it on is optional; nothing in
  this repo depends on it, and the SKIPPED check it produces on PRs is not a problem to fix.
