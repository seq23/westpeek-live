-- 0043 · the house defaults (16 Sep 2026)
--
-- Settings held four things: the agency name, two brand colours and a members roster. Everything
-- else that should be a house default was either hard-coded (hello@westpeek.live, America/Chicago,
-- the 14-day attendee session, the four "Tell us more" questions) or existed only per event (the
-- networking match length) or only in the environment (LIVEKIT_TIER). None of it was settable, so
-- the owner set the same things by hand on every event.
--
-- A SIBLING ROW, not a wider runtime_agency_settings. That row is identity — the name on the door,
-- the colours, the team — and it is read on the dashboard on every page load. These are operational
-- defaults read by the create path, the email provider and the capacity module, and the list will
-- keep growing. Keeping them apart holds the identity read narrow and lets each module read only
-- what governs it.
--
--   runtime_house_defaults
--     * from_email / reply_to_email — the addresses email leaves from and replies land at;
--     * logo_storage_path / logo_file_name — a logo in the private asset bucket, or the wordmark;
--     * default_timezone — what /app/events/new opens on;
--     * default_networking_match_minutes — inherited by each new event's networking settings;
--     * default_attendee_session_days — the house lifetime; the per-event override still wins;
--     * default_registration_questions — the "Tell us more" set a new event starts from;
--     * livekit_tier — '' means "whatever LIVEKIT_TIER says", so an unset row changes nothing;
--     * starter_templates_installed_at — set once, when the four starter templates were written.
--
-- Nothing secret lives here. Access codes and the master passwords stay in the owner-only audited
-- vault in the Owner Console; this row is reachable by any operator who can open Settings.
create table if not exists public.runtime_house_defaults (
  id text primary key,
  from_email text not null default '',
  reply_to_email text not null default '',
  logo_storage_path text not null default '',
  logo_file_name text not null default '',
  default_timezone text not null default '',
  default_networking_match_minutes integer not null default 0,
  default_attendee_session_days integer not null default 0,
  default_registration_questions jsonb not null default '[]'::jsonb,
  livekit_tier text not null default '',
  -- Null until the starter templates have been written. Once set it is never cleared: it is what
  -- makes those four ordinary rows the owner can delete rather than fixtures that grow back.
  starter_templates_installed_at timestamptz,
  updated_by text not null default '',
  updated_by_label text not null default '',
  updated_at timestamptz not null default now()
);
