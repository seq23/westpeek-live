-- 0033 · event templates you can actually use (16 Sep 2026)
--
-- The Templates page rendered three seed fixtures as read-only cards and nothing consumed them:
-- /app/events/new never offered a template. A template is a starting point for an event, so it now
-- lives in the runtime store and carries exactly what the create form reads.
--
--   runtime_event_templates
--     * id, name, description — what it is and when to reach for it;
--     * format ('stage' | 'room'), event_type, duration_minutes;
--     * sessions — the agenda it starts you with (jsonb array of {title, minutes});
--     * registration_questions — the "Tell us more" questions it carries (jsonb array);
--     * created_by_label / created_at / updated_at — who saved it.
--
-- A new table name on purpose: nothing before this stored templates, and the seed `eventTemplates`
-- fixtures were compiled JSON, not a table.
create table if not exists public.runtime_event_templates (
  id text primary key,
  name text not null,
  description text not null default '',
  format text not null default 'stage',
  event_type text not null default 'webinar',
  duration_minutes integer not null default 60,
  sessions jsonb not null default '[]'::jsonb,
  registration_questions jsonb not null default '[]'::jsonb,
  created_by_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists runtime_event_templates_updated_idx on public.runtime_event_templates (updated_at desc);
