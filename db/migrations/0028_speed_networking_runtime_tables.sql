-- 0028 · runtime speed networking tables replace the legacy uuid ones (16 Sep 2026)
--
-- 0027 used `create table if not exists`, and 0010 had already created
-- speed_networking_entries / speed_networking_matches with uuid ids and foreign keys into the
-- auth-bound 0001 schema. The create was a no-op, and the runtime store then wrote slugs into
-- uuid columns: every crew page and networking page 500'd ("invalid input syntax for type
-- uuid") during Scooter's live workshop. The legacy tables were never written to; they are moved
-- aside under _legacy_v1 (kept, not dropped) and the runtime tables created under the real names.

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'speed_networking_matches'
       and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table public.speed_networking_matches rename to speed_networking_matches_legacy_v1;
  end if;
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'speed_networking_entries'
       and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table public.speed_networking_entries rename to speed_networking_entries_legacy_v1;
  end if;
end $$;

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

create index if not exists speed_networking_entries_event_status_idx on public.speed_networking_entries (event_id, status, joined_at);
create index if not exists speed_networking_matches_event_status_idx on public.speed_networking_matches (event_id, status, starts_at desc);
create index if not exists speed_networking_matches_pair_idx on public.speed_networking_matches (event_id, normalized_pair_key);
