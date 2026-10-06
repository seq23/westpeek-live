-- 0005_networking_email: D1 (SQLite) schema. Flattened from the Postgres migrations db/migrations/0001-0046
-- (last held at commit 984ea43); generated from their introspected shape, then reviewed.
-- Types: uuid/timestamptz -> TEXT (ISO-8601 UTC), jsonb/text[] -> TEXT CHECK(json_valid),
-- boolean -> INTEGER 0/1. Ids are minted in Worker code (crypto.randomUUID()).

CREATE TABLE IF NOT EXISTS networking_queue_entries (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  attendee_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  matched_at TEXT,
  match_id TEXT,
  matches_completed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  UNIQUE (event_id, attendee_id),
  CHECK ((status IN ('waiting', 'matched', 'done', 'left')))
);
CREATE INDEX IF NOT EXISTS networking_queue_entries_event_status_idx ON networking_queue_entries (event_id, status, joined_at);

CREATE TABLE IF NOT EXISTS networking_queue_matches (
  id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  attendee_a_id TEXT NOT NULL,
  attendee_b_id TEXT NOT NULL,
  normalized_pair_key TEXT NOT NULL,
  room_name TEXT NOT NULL,
  status TEXT NOT NULL,
  starts_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  ended_at TEXT,
  ended_reason TEXT,
  PRIMARY KEY (id),
  CHECK ((status IN ('active', 'ended', 'expired')))
);
CREATE INDEX IF NOT EXISTS networking_queue_matches_event_status_idx ON networking_queue_matches (event_id, status, starts_at DESC);
CREATE INDEX IF NOT EXISTS networking_queue_matches_pair_idx ON networking_queue_matches (event_id, normalized_pair_key);

CREATE TABLE IF NOT EXISTS runtime_email_sends (
  id TEXT NOT NULL,
  event_id TEXT,
  agency_id TEXT,
  client_id TEXT,
  workflow_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  action_url TEXT,
  failure_reason TEXT,
  sent_by TEXT,
  queued_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  sent_at TEXT,
  failed_at TEXT,
  group_send_id TEXT,
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS runtime_email_sends_event_idx ON runtime_email_sends (event_id, queued_at DESC);
CREATE INDEX IF NOT EXISTS runtime_email_sends_workflow_idx ON runtime_email_sends (workflow_type, queued_at DESC);
CREATE INDEX IF NOT EXISTS runtime_email_sends_group_idx ON runtime_email_sends (group_send_id);

CREATE TABLE IF NOT EXISTS runtime_email_group_sends (
  id TEXT NOT NULL,
  event_id TEXT,
  audience TEXT NOT NULL,
  audience_label TEXT NOT NULL DEFAULT '',
  workflow_type TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  suppressed_count INTEGER NOT NULL DEFAULT 0,
  sent_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS runtime_email_group_sends_event_idx ON runtime_email_group_sends (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS runtime_email_group_sends_created_idx ON runtime_email_group_sends (created_at DESC);

CREATE TABLE IF NOT EXISTS runtime_email_unsubscribes (
  email TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  unsubscribed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unsubscribed_source TEXT NOT NULL DEFAULT 'one_click',
  last_event_id TEXT,
  resubscribed_at TEXT,
  resubscribed_by TEXT,
  PRIMARY KEY (email)
);
CREATE INDEX IF NOT EXISTS runtime_email_unsubscribes_hash_idx ON runtime_email_unsubscribes (email_hash);
