# Migration assurance — how a migration actually reaches production

## Since 6 Oct 2026 (Cloudflare D1)

- **One schema home:** `migrations-d1/0001…0006` (SQLite). A change is a NEW numbered file; D1 records
  each applied file in `d1_migrations` and never re-runs it, so an applied file is never edited.
- **Applied before the code ships:** `.github/workflows/deploy-cloudflare-worker.yml` runs on green
  `main` and does `npx wrangler d1 migrations apply west-peek-live --remote` *before*
  `npm run cf:deploy`. A failed apply stops the deploy in red on a workflow run anyone can see — the
  invisible push-to-main check run described below no longer exists.
- **Guards:** `npm run validate:d1-schema` (the SQL is SQLite, `lib/d1/schema.generated.ts` is current,
  every table/column the code names exists, apply-before-deploy order); `/api/runtime/health` checks
  every table and column in the generated map against the live database and answers **503** when any
  is missing; the post-deploy smoke stops on that 503 by name.
- **By hand:** `npx wrangler d1 migrations apply west-peek-live --remote` from the repo (never ad hoc SQL).

The Postgres-era process (17 Sep 2026: a Supabase GitHub integration, mirrored migration folders, a
SQL-editor manual step) is history: `docs/archive/manual-notes/migration-assurance-postgres-era.md`.
It is why the guards above exist; none of it applies now.
