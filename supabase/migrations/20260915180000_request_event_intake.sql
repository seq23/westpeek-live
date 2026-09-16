-- Public event-request intake for westpeek.live/request-event.
--
-- This surface had no table. It wrote a JSON file through require("fs"), which
-- cannot persist on the Cloudflare Worker the site is deployed to, while the
-- visitor was shown "Request received" regardless. This is the durable
-- destination for those submissions.
--
-- Safe additive migration. Does not enable/alter RLS policies.
--
-- Note the deliberate absence of foreign keys: this is an anonymous public
-- front door, so a request arrives before any agency, client or event row
-- exists to point at. The id is supplied by the application rather than
-- defaulted here, because the audit log records that same id and the two have
-- to agree.

create table if not exists public.request_event_intake (
  id text primary key,
  name text not null,
  email text not null,
  company text,
  event_type text,
  event_date text,
  audience_size text,
  livestream_needs text,
  networking_needs text,
  sponsor_expo_needs text,
  speaker_count text,
  support_level text,
  notes text,
  created_at timestamptz not null default now()
);

-- The only read pattern is "newest requests first".
create index if not exists idx_request_event_intake_created_at
  on public.request_event_intake(created_at desc);

-- Supports looking up every request from one requester.
create index if not exists idx_request_event_intake_email
  on public.request_event_intake(email);
