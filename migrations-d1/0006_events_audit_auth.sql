-- 0006_events_audit_auth: D1 (SQLite) schema. Flattened from the Postgres migrations db/migrations/0001-0046
-- (last held at commit 984ea43); generated from their introspected shape, then reviewed.
-- Types: uuid/timestamptz -> TEXT (ISO-8601 UTC), jsonb/text[] -> TEXT CHECK(json_valid),
-- boolean -> INTEGER 0/1. Ids are minted in Worker code (crypto.randomUUID()).

CREATE TABLE IF NOT EXISTS v5_access_attempt_events (
  id TEXT NOT NULL,
  event_id TEXT,
  access_kind TEXT NOT NULL,
  role TEXT,
  status TEXT NOT NULL,
  route TEXT,
  reason TEXT,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  CHECK ((access_kind IN ('attendee', 'crew', 'operator', 'owner', 'special_guest'))),
  CHECK ((status IN ('access_attempted', 'access_granted', 'access_denied', 'access_expired', 'access_revoked')))
);
CREATE INDEX IF NOT EXISTS v5_access_attempt_events_event_id_created_idx ON v5_access_attempt_events (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v5_analytics_events (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  subject_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS v5_analytics_events_event_kind_created_idx ON v5_analytics_events (event_id, kind, created_at DESC);

CREATE TABLE IF NOT EXISTS v5_runtime_fallback_events (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  room_type TEXT NOT NULL,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_role TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  CHECK ((action IN ('auto_switch', 'manual_switch', 'rollback', 'health_check'))),
  CHECK ((provider IN ('livekit', 'daily', 'zoom', 'google_meet')))
);
CREATE INDEX IF NOT EXISTS v5_runtime_fallback_events_room_created_idx ON v5_runtime_fallback_events (event_id, room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v6_email_events (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  template_key TEXT NOT NULL,
  recipient_segment TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  CHECK ((status IN ('queued', 'sent', 'blocked', 'failed')))
);
CREATE INDEX IF NOT EXISTS v6_email_events_event_template_idx ON v6_email_events (event_id, template_key, created_at DESC);

CREATE TABLE IF NOT EXISTS v6_incident_events (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  owner_role TEXT NOT NULL,
  details TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  CHECK ((severity IN ('low', 'medium', 'high', 'critical'))),
  CHECK ((status IN ('open', 'monitoring', 'resolved')))
);
CREATE INDEX IF NOT EXISTS v6_incident_events_event_status_idx ON v6_incident_events (event_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS v6_registration_events (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  attendee_email_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  display_name TEXT,
  company TEXT,
  title TEXT,
  personal_website TEXT,
  social_links TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(social_links)),
  reason_for_attending TEXT,
  interesting_fact TEXT,
  PRIMARY KEY (id),
  CHECK ((status IN ('submitted', 'confirmed', 'cancelled')))
);
CREATE INDEX IF NOT EXISTS v6_registration_events_event_idx ON v6_registration_events (event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v6_room_fallback_states (
  event_id TEXT NOT NULL,
  room_type TEXT NOT NULL,
  state TEXT NOT NULL CHECK (json_valid(state)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (event_id, room_type)
);

CREATE TABLE IF NOT EXISTS v6_run_of_show_runtime_events (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  segment_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  CHECK ((action IN ('mark_ready', 'mark_live', 'mark_complete', 'skip', 'delay', 'note')))
);
CREATE INDEX IF NOT EXISTS v6_run_of_show_runtime_events_event_idx ON v6_run_of_show_runtime_events (event_id, segment_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v6_support_requests (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  attendee_id TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  CHECK ((status IN ('open', 'triaged', 'resolved')))
);
CREATE INDEX IF NOT EXISTS v6_support_requests_event_status_idx ON v6_support_requests (event_id, status, created_at DESC);
-- App-owned self-serve login (replaces Supabase Auth). Passwords: PBKDF2-SHA256 via Web Crypto,
-- per-user random salt, iteration count stored per row so it can be raised later without a reset.
-- Sessions and reset tokens are stored only as SHA-256 hashes of the random value in the cookie/link.
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT NOT NULL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL CHECK (password_iterations >= 100000),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (email = lower(email))
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS auth_password_resets (
  token_hash TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_password_resets_user_id ON auth_password_resets (user_id);
