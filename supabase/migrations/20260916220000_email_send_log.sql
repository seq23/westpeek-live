-- 0032 · the email send log (16 Sep 2026)
--
-- The Email page printed "Live-send capable through Resend." under eleven workflow names and knew
-- nothing about what had actually been sent. Every send now writes a row here, so the crew can see
-- what went out for an event, to whom, when, and whether it failed.
--
--   runtime_email_sends — a NEW table, not the pre-runtime public.email_send_logs from 0017: that one
--     keys on uuids and references public.events, while runtime events are text slugs. Creating a
--     table of the same name would have been a silent no-op against another shape (the 0027
--     lesson), so this one has its own name.
--     * id, event_id, workflow_type — what was sent and for which event;
--     * recipient_email / recipient_name / subject — who got it;
--     * provider ('resend' or 'mock'), provider_message_id, status, failure_reason;
--     * sent_by — the crew member or owner who pressed Send (a role, never a person's name);
--     * queued_at / sent_at / failed_at.
--
-- Idempotent: safe to run twice.
create table if not exists public.runtime_email_sends (
  id text primary key,
  event_id text,
  agency_id text,
  client_id text,
  workflow_type text not null,
  recipient_email text not null,
  recipient_name text,
  subject text not null default '',
  provider text not null default 'resend',
  provider_message_id text,
  status text not null default 'queued',
  action_url text,
  failure_reason text,
  sent_by text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz
);

create index if not exists runtime_email_sends_event_idx on public.runtime_email_sends (event_id, queued_at desc);
create index if not exists runtime_email_sends_workflow_idx on public.runtime_email_sends (workflow_type, queued_at desc);
