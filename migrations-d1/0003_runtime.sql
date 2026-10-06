-- 0003_runtime: D1 (SQLite) schema. Flattened from the Postgres migrations db/migrations/0001-0046
-- (last held at commit 984ea43); generated from their introspected shape, then reviewed.
-- Types: uuid/timestamptz -> TEXT (ISO-8601 UTC), jsonb/text[] -> TEXT CHECK(json_valid),
-- boolean -> INTEGER 0/1. Ids are minted in Worker code (crypto.randomUUID()).

CREATE TABLE IF NOT EXISTS runtime_events (
  id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'stage',
  event_type TEXT NOT NULL DEFAULT 'webinar',
  status TEXT NOT NULL DEFAULT 'draft',
  status_before_archive TEXT,
  client_id TEXT,
  client_name TEXT NOT NULL DEFAULT 'West Peek',
  client_slug TEXT NOT NULL DEFAULT 'west-peek',
  description TEXT,
  start_at TEXT,
  end_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  join_code TEXT NOT NULL,
  crew_code TEXT NOT NULL,
  speaker_code TEXT NOT NULL,
  sponsor_code TEXT NOT NULL,
  vip_code TEXT NOT NULL,
  client_code TEXT NOT NULL,
  registration_enabled INTEGER NOT NULL DEFAULT 0 CHECK (registration_enabled IN (0, 1)),
  branding TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(branding)),
  sessions TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(sessions)),
  source TEXT NOT NULL DEFAULT 'runtime',
  created_by TEXT NOT NULL,
  created_by_label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  archived_at TEXT,
  registration_questions TEXT CHECK (json_valid(registration_questions)),
  attendee_session_days INTEGER,
  PRIMARY KEY (id),
  UNIQUE (join_code),
  UNIQUE (slug),
  CHECK ((format IN ('stage', 'room'))),
  CHECK ((source IN ('runtime', 'request'))),
  CHECK ((status IN ('draft', 'published', 'registration_open', 'pre_event', 'live', 'ended', 'replay_available', 'archived')))
);
CREATE INDEX IF NOT EXISTS idx_runtime_events_status ON runtime_events (status);
CREATE INDEX IF NOT EXISTS idx_runtime_events_client_id ON runtime_events (client_id);
CREATE INDEX IF NOT EXISTS idx_runtime_events_created_at ON runtime_events (created_at DESC);

CREATE TABLE IF NOT EXISTS runtime_clients (
  id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  industry TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_by_label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  UNIQUE (slug),
  CHECK ((status IN ('active', 'prospect', 'paused', 'archived')))
);

CREATE TABLE IF NOT EXISTS runtime_agency_settings (
  id TEXT NOT NULL,
  agency_name TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  members TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(members)),
  updated_by TEXT NOT NULL,
  updated_by_label TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS runtime_event_templates (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT 'stage',
  event_type TEXT NOT NULL DEFAULT 'webinar',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  sessions TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(sessions)),
  registration_questions TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(registration_questions)),
  created_by_label TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS runtime_event_templates_updated_idx ON runtime_event_templates (updated_at DESC);

CREATE TABLE IF NOT EXISTS runtime_house_defaults (
  id TEXT NOT NULL,
  from_email TEXT NOT NULL DEFAULT '',
  reply_to_email TEXT NOT NULL DEFAULT '',
  logo_storage_path TEXT NOT NULL DEFAULT '',
  logo_file_name TEXT NOT NULL DEFAULT '',
  default_timezone TEXT NOT NULL DEFAULT '',
  default_networking_match_minutes INTEGER NOT NULL DEFAULT 0,
  default_attendee_session_days INTEGER NOT NULL DEFAULT 0,
  default_registration_questions TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(default_registration_questions)),
  livekit_tier TEXT NOT NULL DEFAULT '',
  starter_templates_installed_at TEXT,
  updated_by TEXT NOT NULL DEFAULT '',
  updated_by_label TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS request_event_intake (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  event_type TEXT,
  event_date TEXT,
  audience_size TEXT,
  livestream_needs TEXT,
  networking_needs TEXT,
  sponsor_expo_needs TEXT,
  speaker_count TEXT,
  support_level TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  budget_range TEXT,
  state TEXT NOT NULL DEFAULT 'requested',
  scope_summary TEXT,
  price_amount_cents INTEGER,
  price_currency TEXT,
  confirm_token TEXT,
  event_id TEXT,
  approved_at TEXT,
  approved_by TEXT,
  confirmed_at TEXT,
  paid_at TEXT,
  paid_by TEXT,
  settlement_method TEXT,
  settlement_reference TEXT,
  instructions_sent_at TEXT,
  declined_at TEXT,
  decline_reason TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_request_event_intake_created_at ON request_event_intake (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_event_intake_email ON request_event_intake (email);
CREATE UNIQUE INDEX IF NOT EXISTS request_event_intake_confirm_token_idx ON request_event_intake (confirm_token) WHERE (confirm_token IS NOT NULL);
CREATE INDEX IF NOT EXISTS request_event_intake_state_idx ON request_event_intake (state, created_at DESC);

CREATE TABLE IF NOT EXISTS how_it_works_pages (
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_by_label TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (slug)
);

CREATE TABLE IF NOT EXISTS event_assets (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  storage_path TEXT,
  external_url TEXT,
  uploaded_by_kind TEXT NOT NULL DEFAULT 'operator',
  uploaded_by_label TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'internal',
  status TEXT NOT NULL DEFAULT 'uploaded',
  note TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS event_assets_event_idx ON event_assets (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_assets_archived_idx ON event_assets (archived_at);

CREATE TABLE IF NOT EXISTS event_backup_rooms (
  event_id TEXT NOT NULL,
  stage_id TEXT NOT NULL DEFAULT 'main-stage',
  zoom_meeting_number TEXT,
  zoom_passcode TEXT,
  google_meet_url TEXT,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (event_id, stage_id)
);
CREATE INDEX IF NOT EXISTS event_backup_rooms_event_idx ON event_backup_rooms (event_id);

CREATE TABLE IF NOT EXISTS event_code_history (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  field TEXT NOT NULL,
  code TEXT NOT NULL,
  code_key TEXT NOT NULL,
  replaced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  replaced_by TEXT,
  reason TEXT NOT NULL DEFAULT 'rotate',
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS event_code_history_code_key_idx ON event_code_history (code_key);
CREATE INDEX IF NOT EXISTS event_code_history_event_idx ON event_code_history (event_id, field);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'contractor',
  name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  role_or_service TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  rate_kind TEXT NOT NULL DEFAULT 'day_rate',
  rate_amount REAL NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'shortlisted',
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS suppliers_kind_idx ON suppliers (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS suppliers_status_idx ON suppliers (status);
CREATE INDEX IF NOT EXISTS suppliers_archived_idx ON suppliers (archived_at);

CREATE TABLE IF NOT EXISTS supplier_event_links (
  id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS supplier_event_links_pair_idx ON supplier_event_links (supplier_id, event_id);
CREATE INDEX IF NOT EXISTS supplier_event_links_event_idx ON supplier_event_links (event_id, created_at DESC);
