-- 0004_attendees_live: D1 (SQLite) schema. Flattened from the Postgres migrations db/migrations/0001-0046
-- (last held at commit 984ea43); generated from their introspected shape, then reviewed.
-- Types: uuid/timestamptz -> TEXT (ISO-8601 UTC), jsonb/text[] -> TEXT CHECK(json_valid),
-- boolean -> INTEGER 0/1. Ids are minted in Worker code (crypto.randomUUID()).

CREATE TABLE IF NOT EXISTS attendee_profiles (
  attendee_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email_masked TEXT,
  company TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  personal_website TEXT,
  social_links TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(social_links)),
  reason_for_attending TEXT,
  interesting_fact TEXT,
  topics_of_interest TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(topics_of_interest)),
  networking_goals TEXT,
  networking_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (networking_opt_in IN (0, 1)),
  role TEXT NOT NULL DEFAULT 'attendee',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  hidden_from_directory INTEGER NOT NULL DEFAULT 0 CHECK (hidden_from_directory IN (0, 1)),
  email TEXT,
  extra_answers TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(extra_answers)),
  PRIMARY KEY (event_id, attendee_id),
  UNIQUE (event_id, email_hash),
  CHECK ((role = 'attendee')),
  CHECK ((status IN ('active', 'revoked', 'expired')))
);
CREATE INDEX IF NOT EXISTS attendee_profiles_event_updated_idx ON attendee_profiles (event_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS attendee_profiles_event_visible_idx ON attendee_profiles (event_id, hidden_from_directory);
CREATE INDEX IF NOT EXISTS attendee_profiles_email_idx ON attendee_profiles (email);

CREATE TABLE IF NOT EXISTS attendee_sessions (
  session_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'attendee',
  status TEXT NOT NULL DEFAULT 'active',
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  client_build_id TEXT,
  client_browser TEXT,
  client_connection_quality TEXT,
  client_subscribed_tracks INTEGER,
  client_surface TEXT,
  last_chat_poll_at TEXT,
  PRIMARY KEY (event_id, session_id),
  CHECK ((role = 'attendee')),
  CHECK ((status IN ('active', 'revoked', 'expired')))
);
CREATE INDEX IF NOT EXISTS attendee_sessions_event_attendee_idx ON attendee_sessions (event_id, attendee_id);
CREATE INDEX IF NOT EXISTS attendee_sessions_event_last_seen_idx ON attendee_sessions (event_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS attendee_permissions (
  id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  permission_kind TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 0 CHECK (granted IN (0, 1)),
  granted_by TEXT,
  reason TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  UNIQUE (event_id, attendee_id, permission_kind)
);
CREATE INDEX IF NOT EXISTS attendee_permissions_event_attendee_idx ON attendee_permissions (event_id, attendee_id);

CREATE TABLE IF NOT EXISTS attendee_live_capabilities (
  key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  room_kind TEXT NOT NULL,
  room_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  capability TEXT NOT NULL CHECK (json_valid(capability)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS attendee_live_control_states (
  key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  room_kind TEXT NOT NULL,
  room_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (json_valid(state)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (key)
);

CREATE TABLE IF NOT EXISTS attendee_agenda_intents (
  id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  planned_session_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(planned_session_ids)),
  planned_breakout_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(planned_breakout_ids)),
  planned_sponsor_booth_ids TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(planned_sponsor_booth_ids)),
  wants_session_reminders INTEGER NOT NULL DEFAULT 0 CHECK (wants_session_reminders IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  UNIQUE (event_id, attendee_id)
);

CREATE TABLE IF NOT EXISTS special_guest_profiles (
  guest_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  role TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  email TEXT,
  PRIMARY KEY (event_id, guest_id),
  CHECK ((role IN ('speaker', 'sponsor', 'vip', 'client')))
);
CREATE INDEX IF NOT EXISTS special_guest_profiles_event_role_idx ON special_guest_profiles (event_id, role, created_at DESC);

CREATE TABLE IF NOT EXISTS event_guest_states (
  key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  guest_id TEXT,
  state TEXT NOT NULL CHECK (json_valid(state)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (key)
);
CREATE INDEX IF NOT EXISTS event_guest_states_event_kind_idx ON event_guest_states (event_id, kind);

CREATE TABLE IF NOT EXISTS sponsor_lead_opt_ins (
  id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  sponsor_booth_id TEXT NOT NULL,
  allowed_fields TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(allowed_fields)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS sponsor_lead_opt_ins_event_sponsor_idx ON sponsor_lead_opt_ins (event_id, sponsor_booth_id, created_at DESC);

CREATE TABLE IF NOT EXISTS stage_stream_states (
  event_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (json_valid(state)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (event_id, stage_id)
);

CREATE TABLE IF NOT EXISTS stage_stream_events (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  stage_id TEXT NOT NULL,
  signal TEXT NOT NULL,
  state_event TEXT NOT NULL CHECK (json_valid(state_event)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS live_chat_messages (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  room_kind TEXT NOT NULL,
  room_id TEXT NOT NULL,
  attendee_id TEXT,
  display_name TEXT NOT NULL,
  company TEXT,
  message TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  moderated_by TEXT,
  moderated_at TEXT,
  archived_at TEXT,
  archived_by TEXT,
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS live_chat_messages_room_idx ON live_chat_messages (event_id, room_kind, room_id, created_at);
CREATE INDEX IF NOT EXISTS live_chat_messages_room_created_idx ON live_chat_messages (event_id, room_kind, room_id, created_at);
CREATE INDEX IF NOT EXISTS live_chat_messages_moderated_idx ON live_chat_messages (event_id, room_kind, room_id, moderated_at);
CREATE INDEX IF NOT EXISTS live_chat_messages_archived_idx ON live_chat_messages (event_id, room_kind, room_id, archived_at);

CREATE TABLE IF NOT EXISTS live_chat_moderation_states (
  key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  room_kind TEXT NOT NULL,
  room_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  attendee_id TEXT,
  state TEXT NOT NULL CHECK (json_valid(state)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (key),
  CHECK ((scope IN ('room', 'attendee')))
);
CREATE INDEX IF NOT EXISTS live_chat_moderation_states_event_idx ON live_chat_moderation_states (event_id, room_kind, room_id);

CREATE TABLE IF NOT EXISTS live_chat_post_rates (
  key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  state TEXT NOT NULL CHECK (json_valid(state)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (key)
);
CREATE INDEX IF NOT EXISTS live_chat_post_rates_event_idx ON live_chat_post_rates (event_id);
