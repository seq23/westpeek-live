-- Live chat moderation (crew hide / restore, per-attendee silence, room lock).
--
-- The first production e2e (15/16 Sep 2026) proved chat works and that nothing
-- could moderate it: live_chat_messages.moderation_status existed but nothing
-- set it, and there was nowhere to record "this attendee is silenced" or "this
-- room is locked". This migration adds the two missing pieces:
--
--   * who hid a message and when (the crew sees "hidden by <role>");
--   * one row per standing decision: a locked room (scope 'room') or a silenced
--     attendee (scope 'attendee'), keyed event:roomKind:roomId[:attendeeId].
--
-- Safe additive migration. Does not enable/alter RLS policies. The app reaches
-- these tables through the service-role client only. Mirrored byte-for-byte
-- under supabase/migrations/ so the Supabase GitHub integration applies it on
-- merge to main (guarded by validate:live-chat-moderation-contract).

alter table public.live_chat_messages add column if not exists moderated_by text;
alter table public.live_chat_messages add column if not exists moderated_at timestamptz;

create table if not exists public.live_chat_moderation_states (
  key text primary key,
  event_id text not null,
  room_kind text not null,
  room_id text not null,
  scope text not null check (scope in ('room', 'attendee')),
  attendee_id text,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists live_chat_moderation_states_event_idx on public.live_chat_moderation_states (event_id, room_kind, room_id);
