-- Chat at scale: slow mode, the per-person flood guard, delta polling, and Clear chat.
--
-- A room of five hundred broke three ways that the moderation work (0025) did not touch:
--   * nothing paced a room — the crew could only lock it, which is all-or-nothing;
--   * nothing stopped one person (or one replayed form) posting a hundred times a minute;
--   * every open page refetched the whole window every few seconds, and "Clear chat" did not exist.
--
-- What this adds:
--   * live_chat_messages.archived_at / archived_by — Clear chat ARCHIVES a room. The rows stay for
--     the audit trail and any later export; they simply leave every view, crew included. There is
--     no delete path.
--   * two indexes that make the delta poll cheap: the room window by created_at, and the
--     "changed since" read by moderated_at / archived_at.
--   * live_chat_post_rates — one row per attendee per event holding their recent post timestamps
--     and any cooldown. The flood guard is enforced on the WRITE path, so it needs shared state:
--     a Worker isolate cannot remember the previous request.
--
-- Slow mode needs no column: it lives in the jsonb `state` of the existing scope='room' row in
-- live_chat_moderation_states, alongside the lock, and the writers merge rather than replace.
--
-- Safe additive migration. Does not enable/alter RLS policies. The app reaches these tables
-- through the service-role client only. Mirrored byte-for-byte under supabase/migrations/ so the
-- Supabase GitHub integration applies it on merge to main (guarded by validate:migration-mirror-parity
-- and validate:chat-at-scale-contract).

alter table public.live_chat_messages add column if not exists archived_at timestamptz;
alter table public.live_chat_messages add column if not exists archived_by text;

create index if not exists live_chat_messages_room_created_idx on public.live_chat_messages (event_id, room_kind, room_id, created_at);
create index if not exists live_chat_messages_moderated_idx on public.live_chat_messages (event_id, room_kind, room_id, moderated_at);
create index if not exists live_chat_messages_archived_idx on public.live_chat_messages (event_id, room_kind, room_id, archived_at);

create table if not exists public.live_chat_post_rates (
  key text primary key,
  event_id text not null,
  attendee_id text not null,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists live_chat_post_rates_event_idx on public.live_chat_post_rates (event_id);
