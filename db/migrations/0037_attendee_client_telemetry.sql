-- 0037 · what the attendee's own browser tells us (16 Sep 2026)
--
-- "I can't see the stream" used to be unanswerable. LiveKit's RoomService says who is connected and
-- what is being published, but it does NOT expose connection quality or what a viewer is SUBSCRIBED
-- to — both live on the client. Without the client's half, the three failures that look identical
-- to the person complaining stay identical to us:
--
--   never connected                       → no LiveKit participant for their identity
--   connected but subscribed to nothing   → participant present, zero subscribed tracks (our bug)
--   subscribed but poor connection        → tracks subscribed, quality 'poor' (their network)
--
-- So the stage player reports its own state on the heartbeat it already sends, and it lands here on
-- the attendee's session row. Nothing identifying is added: the browser/device is stored as the
-- DERIVED label the panel prints ("Chrome 140 on macOS"), never the raw user-agent string, and
-- there is no IP and no location column here on purpose — the panel must not show them, so we do
-- not keep them.
--
-- Idempotent: safe to run twice.
alter table public.attendee_sessions add column if not exists client_build_id text;
alter table public.attendee_sessions add column if not exists client_browser text;
alter table public.attendee_sessions add column if not exists client_connection_quality text;
alter table public.attendee_sessions add column if not exists client_subscribed_tracks integer;
alter table public.attendee_sessions add column if not exists client_surface text;
alter table public.attendee_sessions add column if not exists last_chat_poll_at timestamptz;

create index if not exists attendee_sessions_event_last_seen_idx on public.attendee_sessions (event_id, last_seen_at desc);
