-- 0029 · lighter registration, "Tell us more", the attendee's email, contacts across events,
--        per-event registration questions (16 Sep 2026)
--
-- Registration is three required fields (name, email, company) plus an optional title; everything
-- else is filled in later from the "Tell us more about you" card. Changes:
--
--   attendee_profiles
--     * title may be empty (it was required);
--     * hidden_from_directory — the attendee's own "Hide me from the People directory" switch,
--       default false (visible). Hidden attendees stay visible to crew on the roster and still
--       network if they join the queue; they are left out of the People page and sponsor lead views.
--     * email — the raw address, lowercased and trimmed. Until now only email_hash + email_masked
--       were kept, so the owner could not get an attendee email list or follow up. BACKFILL IS
--       IMPOSSIBLE for existing rows (the hash is one-way): they keep email = null and are filled
--       the next time that person registers. The hash stays the lookup key.
--     * extra_answers — jsonb answers to the event's registration questions, keyed by question
--       key. The four legacy columns (reason_for_attending, interesting_fact, topics_of_interest,
--       networking_goals) stay populated when the keys match so existing UI keeps working.
--
--   contacts — one row per person across events, keyed by lowercased email: name, company,
--     title, first/last seen, events_attended (jsonb array of event ids), last-updated profile
--     fields. Upserted on every registration, so a person re-registering at a new event updates
--     cleanly instead of duplicating. Per-event rows stay unique on (event_id, email_hash).
--
--   runtime_events.registration_questions — jsonb array of {key, label, type, required}; null
--     means the default set (the legacy four), so nothing changes for existing events.
--
-- Safe additive migration; no RLS changes. Mirrored byte-for-byte under supabase/migrations/.

alter table public.attendee_profiles alter column title set default '';
alter table public.attendee_profiles add column if not exists hidden_from_directory boolean not null default false;
alter table public.attendee_profiles add column if not exists email text;
alter table public.attendee_profiles add column if not exists extra_answers jsonb not null default '{}'::jsonb;
create index if not exists attendee_profiles_event_visible_idx on public.attendee_profiles (event_id, hidden_from_directory);
create index if not exists attendee_profiles_email_idx on public.attendee_profiles (email);

create table if not exists public.contacts (
  email text primary key,
  name text not null,
  company text not null default '',
  title text not null default '',
  personal_website text,
  social_links jsonb not null default '[]'::jsonb,
  topics_of_interest jsonb not null default '[]'::jsonb,
  networking_goals text,
  hidden_from_directory boolean not null default false,
  events_attended jsonb not null default '[]'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.runtime_events add column if not exists registration_questions jsonb;
