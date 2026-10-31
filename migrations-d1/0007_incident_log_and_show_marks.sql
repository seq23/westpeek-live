-- 0007_incident_log_and_show_marks: the per-event incident log becomes a real log (30 Oct 2026).
-- Additive only: four nullable/defaulted columns on v6_incident_events. Rows written before this
-- migration read as source 'manual', with no reporter and no resolution time, and keep working.
--   source       'manual' (a person logged it) or 'automatic' (the app did: the stage stream moved to
--                a backup path, or a video health check failed)
--   reported_by  who logged it, in words
--   updated_at   the last change of status
--   resolved_at  when it was marked resolved
-- The producer's run-of-show marks already have their table (v6_run_of_show_runtime_events, 0006);
-- what changed is that the app now reads them (services/run-of-show/showProgress.ts).
ALTER TABLE v6_incident_events ADD COLUMN source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE v6_incident_events ADD COLUMN reported_by TEXT;
ALTER TABLE v6_incident_events ADD COLUMN updated_at TEXT;
ALTER TABLE v6_incident_events ADD COLUMN resolved_at TEXT;
CREATE INDEX IF NOT EXISTS v6_incident_events_event_created_idx ON v6_incident_events (event_id, created_at DESC);
