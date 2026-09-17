-- 0045 · the two bottom rungs of the ladder, set by a person instead of by a deploy (17 Sep 2026)
--
-- The show-day ladder has five rungs and the bottom two could not be set up at all. Zoom read a
-- meeting number out of TIER4_ZOOM_MEETING_NUMBER and Google Meet read a URL out of
-- GOOGLE_MEET_MANAGED_FALLBACK_URL, both Worker variables, both fixed at deploy time. So in the one
-- situation those rungs exist for — the feed is down, the show is running, the crew is walking down
-- the ladder — there was no way to put a meeting in. The owner: "we should make zoom and google meet
-- configurable in the back end by a crew member or owner".
--
--   event_backup_rooms — one row per event and stage, written by the owner, an operator, or crew
--     holding go_live, from the crew deck or the event's Video page.
--     * event_id + stage_id — the key. A multi-stage event configures each stage separately;
--       everything today writes 'main-stage'.
--     * zoom_meeting_number — digits only, stored without the spaces people paste from an invite.
--       Its presence is what makes the Zoom rung "configured": the ladder reads this row, not the
--       environment, so a rung with no meeting on it still refuses the move and says why.
--     * zoom_passcode — optional, because plenty of meetings have none. It is a meeting passcode,
--       not an access code: it is not a West Peek credential and it never appears in the manual.
--     * google_meet_url — the full https://meet.google.com/... link. This is the one rung that
--       takes attendees off our page, so it is stored whole and shown to them in a panel.
--     * updated_by — the ROLE that saved it ('owner', 'operator', 'crew:producer'), never a person's
--       name, and updated_at.
--
-- This is deliberately its own table rather than more columns on stage_stream_states. That row is
-- the live state machine and "Reset primary" rebuilds it from defaults; a meeting the crew typed in
-- during a show must not be thrown away by a reset in the middle of the same show.
--
-- Idempotent: safe to run twice.
create table if not exists public.event_backup_rooms (
  event_id text not null,
  stage_id text not null default 'main-stage',
  zoom_meeting_number text,
  zoom_passcode text,
  google_meet_url text,
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (event_id, stage_id)
);

create index if not exists event_backup_rooms_event_idx on public.event_backup_rooms (event_id);
