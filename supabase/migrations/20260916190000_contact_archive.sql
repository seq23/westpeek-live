-- 0030 · archiving our own test rows out of the People list (16 Sep 2026)
--
-- /app/people showed 40 people, 34 of them Playwright and Tier-4 fixtures. The page now defaults
-- to real people and the owner can archive the test rows. Archiving never deletes:
--
--   contacts.archived_at — set when the owner archives a test row; the People page and the CSV
--     export leave archived rows out. Null for everyone else. The attendee_profiles rows behind
--     them are archived with the existing status column (status = 'revoked'), not deleted.
--
-- Idempotent: safe to run twice, and safe on a database that never had the column.
alter table if exists public.contacts add column if not exists archived_at timestamptz;
create index if not exists contacts_archived_at_idx on public.contacts (archived_at);
