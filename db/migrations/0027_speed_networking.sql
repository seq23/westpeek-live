-- Real speed networking: the queue and the 1:1 matches.
--
-- Until now "Join queue" only recorded an analytics event; the pure matcher
-- (services/speed-networking/speedNetworkingEngine.ts) was never called and no 1:1 room existed.
-- This migration adds the two rows the runtime store keeps:
--
--   * speed_networking_entries — one row per registered attendee per event who joined the
--     queue (waiting / matched / done / left), with when they joined and their current match;
--   * speed_networking_matches — one row per 1:1 match: the two attendees, the normalized pair
--     key (no repeats within an event), the LiveKit room name <eventId>-net-<matchId>, the
--     4-minute (crew-configurable) window, and how it ended.
--
-- Networking settings (open / closed, minutes per match) live in event_guest_states as kind
-- "networking_settings"; no new table is needed for them.
--
-- Safe additive migration. Does not enable/alter RLS policies. The app reaches these tables
-- through the service-role client only. Mirrored byte-for-byte under supabase/migrations/ so
-- the Supabase GitHub integration applies it on merge to main (guarded by
-- validate:speed-networking-real-contract).

create table if not exists public.speed_networking_entries (
  id text primary key,
  event_id text not null,
  attendee_id text not null,
  display_name text not null,
  company text not null default '',
  title text not null default '',
  status text not null check (status in ('waiting', 'matched', 'done', 'left')),
  joined_at timestamptz not null default now(),
  matched_at timestamptz,
  match_id text,
  matches_completed integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (event_id, attendee_id)
);

create index if not exists speed_networking_entries_event_status_idx on public.speed_networking_entries (event_id, status, joined_at);

create table if not exists public.speed_networking_matches (
  id text primary key,
  event_id text not null,
  attendee_a_id text not null,
  attendee_b_id text not null,
  normalized_pair_key text not null,
  room_name text not null,
  status text not null check (status in ('active', 'ended', 'expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_reason text
);

create index if not exists speed_networking_matches_event_status_idx on public.speed_networking_matches (event_id, status, starts_at desc);
create index if not exists speed_networking_matches_pair_idx on public.speed_networking_matches (event_id, normalized_pair_key);
