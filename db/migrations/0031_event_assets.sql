-- 0031 · real event assets (16 Sep 2026)
--
-- The Assets page rendered seed fixtures and had no way to upload anything. Files now live in
-- Supabase Storage (bucket `event-assets`, private) and every file has a row here:
--
--   event_assets
--     * id, event_id — the event the file belongs to;
--     * file_name, mime_type, size_bytes — what was uploaded;
--     * storage_path — the object in the bucket; null for a link-only asset (external_url set);
--     * external_url — when production pastes a link instead of a file;
--     * uploaded_by_kind / uploaded_by_label — owner, operator, crew, speaker, sponsor, and who;
--     * visibility — 'internal' (crew only) or 'client_facing' (the client sees it);
--     * status — uploaded → in_review → approved, plus 'changes_requested';
--     * archived_at — archiving is the only removal; nothing is ever hard-deleted.
--
-- Idempotent: safe to run twice.
create table if not exists public.event_assets (
  id text primary key,
  event_id text not null,
  file_name text not null,
  mime_type text not null default '',
  size_bytes bigint not null default 0,
  storage_path text,
  external_url text,
  uploaded_by_kind text not null default 'operator',
  uploaded_by_label text not null default '',
  visibility text not null default 'internal',
  status text not null default 'uploaded',
  note text,
  reviewed_by text,
  reviewed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_assets_event_idx on public.event_assets (event_id, created_at desc);
create index if not exists event_assets_archived_idx on public.event_assets (archived_at);
