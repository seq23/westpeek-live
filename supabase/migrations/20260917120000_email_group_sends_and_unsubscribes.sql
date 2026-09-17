-- 0044 · group email: the unsubscribe list, and the grouped send (17 Sep 2026)
--
-- Until now every email in this product went to one named person, pressed one at a time. The owner
-- could not email attendees, VIPs, speakers, sponsors, crew or the client as a group at all. The
-- moment she can, it is bulk email and the domain's reputation is on the line, so the unsubscribe
-- list lands in the same migration as the group send — never one without the other.
--
--   runtime_email_unsubscribes — one row per PERSON, keyed by lowercased email. This is West Peek's
--     list, not one event's: unsubscribing from a summit announcement suppresses the person on every
--     future group send for every event. Resubscribing is a column, not a delete, so "I did that by
--     mistake" is reversible and the history survives.
--     * email (pk, lowercased), email_hash — the hash matches attendee_profiles.email_hash, so a
--       hash-only attendee row can still be checked against the list;
--     * unsubscribed_at / unsubscribed_source ('one_click', 'crew') / last_event_id — where it came from;
--     * resubscribed_at — set when the person (or the crew) puts them back. A row with
--       resubscribed_at later than unsubscribed_at is NOT suppressed.
--
--   runtime_email_group_sends — one row per group send, so a 47-person send is one line on the Email
--     page that expands into its 47 logged messages rather than 47 unexplained lines.
--     * id, event_id (nullable: a message to contacts across events has no event), audience,
--       audience_label, workflow_type, subject;
--     * recipient_count / sent_count / failed_count / suppressed_count — what was resolved, what left,
--       what bounced off the unsubscribe list;
--     * sent_by — the role that pressed the button (never a person's name), created_at.
--
--   special_guest_profiles.email — the reason "Email speakers" could not exist before today. A
--     speaker's identity carried name, company and title and no address, so the only speaker group
--     that could be resolved was an empty one. The guest identity form now asks for it the same way
--     it asks for the company, and a guest who has not given one is reported as unreachable rather
--     than quietly dropped.
--
--   runtime_email_sends.group_send_id — the join. Null for the seven transactional sends, which is
--     exactly how the page tells a group send from a message to one named person.
--
-- Idempotent: safe to run twice.
create table if not exists public.runtime_email_unsubscribes (
  email text primary key,
  email_hash text not null,
  unsubscribed_at timestamptz not null default now(),
  unsubscribed_source text not null default 'one_click',
  last_event_id text,
  resubscribed_at timestamptz,
  resubscribed_by text
);

create index if not exists runtime_email_unsubscribes_hash_idx on public.runtime_email_unsubscribes (email_hash);

create table if not exists public.runtime_email_group_sends (
  id text primary key,
  event_id text,
  audience text not null,
  audience_label text not null default '',
  workflow_type text not null,
  subject text not null default '',
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  suppressed_count integer not null default 0,
  sent_by text,
  created_at timestamptz not null default now()
);

create index if not exists runtime_email_group_sends_event_idx on public.runtime_email_group_sends (event_id, created_at desc);
create index if not exists runtime_email_group_sends_created_idx on public.runtime_email_group_sends (created_at desc);

alter table public.special_guest_profiles add column if not exists email text;

alter table public.runtime_email_sends add column if not exists group_send_id text;
create index if not exists runtime_email_sends_group_idx on public.runtime_email_sends (group_send_id);
