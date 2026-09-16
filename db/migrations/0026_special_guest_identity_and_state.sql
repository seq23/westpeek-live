-- Special-guest identity and event-scoped guest state (speakers, sponsors, VIPs, clients).
--
-- The special-guest gate (event code + role code) was real; everything behind it was mock:
-- the speaker pages rendered a hard-coded speaker-drake with a fixed checklist and the demo
-- summit's run of show, no LiveKit token was ever issued to a speaker, and sponsor / VIP /
-- client portals were the same pattern. This migration adds the two missing pieces:
--
--   * who the guest is (one row per person per event, given once on first entry and bound to
--     the browser by the wpl_guest_identity cookie);
--   * one row per standing decision or document, keyed event:kind[:guest]: a speaker's stage
--     state (backstage / invited / on stage), their recorded tech check, their cue deck
--     (approved + pending versions), a live cue pushed by the producer, the producer's notes
--     to speakers, a sponsor's booth, and the VIP room state.
--
-- Safe additive migration. Does not enable/alter RLS policies. The app reaches these tables
-- through the service-role client only. Mirrored byte-for-byte under supabase/migrations/ so
-- the Supabase GitHub integration applies it on merge to main (guarded by
-- validate:speaker-green-room-contract).

create table if not exists public.special_guest_profiles (
  guest_id text not null,
  event_id text not null,
  role text not null check (role in ('speaker', 'sponsor', 'vip', 'client')),
  name text not null,
  company text not null default '',
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, guest_id)
);

create index if not exists special_guest_profiles_event_role_idx on public.special_guest_profiles (event_id, role, created_at desc);

create table if not exists public.event_guest_states (
  key text primary key,
  event_id text not null,
  kind text not null,
  guest_id text,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists event_guest_states_event_kind_idx on public.event_guest_states (event_id, kind);
