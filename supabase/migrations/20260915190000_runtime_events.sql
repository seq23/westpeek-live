-- Runtime-created events, clients, and agency settings.
--
-- Until this migration, every event the app could serve came from compiled JSON
-- under data/events/* (five seed events) and creating one meant a PR plus a
-- redeploy. /app/events/new now writes one row here and every event surface
-- (/join, /events/[slug], /venue/[eventId]/*, run-of-show, crew and special-guest
-- gates, the /app workspace) reads this table first and the compiled JSON second.
--
-- Deliberately self-contained: text ids (the event slug is the id, matching the
-- text event_id every v5/v6 runtime table already uses), no foreign keys into
-- the 0001 agency/client/profile schema (which needs Supabase Auth users the
-- owner's cookie-based path never creates), and application-supplied ids so the
-- audit log and the row agree.
--
-- Safe additive migration. Does not enable/alter RLS policies. The app reaches
-- these tables through the service-role client only.

create table if not exists public.runtime_events (
  id text primary key,
  slug text not null unique,
  name text not null,
  format text not null default 'stage' check (format in ('stage', 'room')),
  event_type text not null default 'webinar',
  status text not null default 'draft' check (status in ('draft', 'published', 'registration_open', 'pre_event', 'live', 'ended', 'replay_available', 'archived')),
  status_before_archive text,
  client_id text,
  client_name text not null default 'West Peek',
  client_slug text not null default 'west-peek',
  description text,
  start_at timestamptz,
  end_at timestamptz,
  timezone text not null default 'America/Chicago',
  join_code text not null unique,
  crew_code text not null,
  speaker_code text not null,
  sponsor_code text not null,
  vip_code text not null,
  client_code text not null,
  registration_enabled boolean not null default false,
  branding jsonb not null default '{}'::jsonb,
  sessions jsonb not null default '[]'::jsonb,
  source text not null default 'runtime' check (source in ('runtime', 'request')),
  created_by text not null,
  created_by_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_runtime_events_status on public.runtime_events(status);
create index if not exists idx_runtime_events_client_id on public.runtime_events(client_id);
create index if not exists idx_runtime_events_created_at on public.runtime_events(created_at desc);

create table if not exists public.runtime_clients (
  id text primary key,
  slug text not null unique,
  name text not null,
  industry text,
  primary_contact_name text,
  primary_contact_email text,
  status text not null default 'active' check (status in ('active', 'prospect', 'paused', 'archived')),
  created_by text not null,
  created_by_label text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.runtime_agency_settings (
  id text primary key,
  agency_name text not null,
  primary_color text not null,
  accent_color text not null,
  members jsonb not null default '[]'::jsonb,
  updated_by text not null,
  updated_by_label text not null,
  updated_at timestamptz not null default now()
);
