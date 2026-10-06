-- 0001_core: D1 (SQLite) schema. Flattened from the Postgres migrations db/migrations/0001-0046
-- (last held at commit 984ea43); generated from their introspected shape, then reviewed.
-- Types: uuid/timestamptz -> TEXT (ISO-8601 UTC), jsonb/text[] -> TEXT CHECK(json_valid),
-- boolean -> INTEGER 0/1. Ids are minted in Worker code (crypto.randomUUID()).

CREATE TABLE IF NOT EXISTS agencies (
  id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  legal_name TEXT,
  website_url TEXT,
  logo_url TEXT,
  primary_color TEXT,
  owner_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  PRIMARY KEY (id),
  UNIQUE (slug),
  CHECK ((status IN ('active', 'paused', 'archived', 'deleted')))
);

CREATE TABLE IF NOT EXISTS agency_members (
  id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  invited_by_user_id TEXT,
  invited_at TEXT,
  joined_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  UNIQUE (agency_id, user_id),
  CHECK ((status IN ('invited', 'active', 'disabled', 'removed'))),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by_user_id) REFERENCES profiles(id),
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  UNIQUE (email),
  CHECK ((status IN ('active', 'invited', 'disabled', 'deleted')))
);

CREATE TABLE IF NOT EXISTS clients (
  id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  industry TEXT,
  website_url TEXT,
  logo_url TEXT,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  internal_notes TEXT,
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  PRIMARY KEY (id),
  UNIQUE (agency_id, slug),
  CHECK ((status IN ('active', 'prospect', 'paused', 'archived', 'deleted'))),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES profiles(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_clients_agency ON clients (agency_id);

CREATE TABLE IF NOT EXISTS contacts (
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  personal_website TEXT,
  social_links TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(social_links)),
  topics_of_interest TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(topics_of_interest)),
  networking_goals TEXT,
  hidden_from_directory INTEGER NOT NULL DEFAULT 0 CHECK (hidden_from_directory IN (0, 1)),
  events_attended TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(events_attended)),
  first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  archived_at TEXT,
  PRIMARY KEY (email)
);
CREATE INDEX IF NOT EXISTS contacts_archived_at_idx ON contacts (archived_at);

CREATE TABLE IF NOT EXISTS events (
  id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  start_at TEXT,
  end_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  description TEXT,
  internal_goal TEXT,
  client_facing_goal TEXT,
  primary_producer_user_id TEXT,
  project_manager_user_id TEXT,
  registration_enabled INTEGER NOT NULL DEFAULT 0 CHECK (registration_enabled IN (0, 1)),
  venue_enabled INTEGER NOT NULL DEFAULT 1 CHECK (venue_enabled IN (0, 1)),
  replay_enabled INTEGER NOT NULL DEFAULT 1 CHECK (replay_enabled IN (0, 1)),
  reporting_enabled INTEGER NOT NULL DEFAULT 1 CHECK (reporting_enabled IN (0, 1)),
  created_by_user_id TEXT,
  updated_by_user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  PRIMARY KEY (id),
  UNIQUE (agency_id, slug),
  CHECK ((status IN ('draft', 'published', 'registration_open', 'pre_event', 'live', 'ended', 'replay_available', 'archived'))),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES profiles(id),
  FOREIGN KEY (primary_producer_user_id) REFERENCES profiles(id),
  FOREIGN KEY (project_manager_user_id) REFERENCES profiles(id),
  FOREIGN KEY (updated_by_user_id) REFERENCES profiles(id)
);
CREATE INDEX IF NOT EXISTS idx_events_agency_client ON events (agency_id, client_id);
CREATE INDEX IF NOT EXISTS idx_events_status_start ON events (status, start_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  client_id TEXT,
  event_id TEXT,
  actor_user_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  previous_value_json TEXT CHECK (json_valid(previous_value_json)),
  new_value_json TEXT CHECK (json_valid(new_value_json)),
  visibility TEXT NOT NULL DEFAULT 'internal_agency',
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id)
  -- No foreign keys: the runtime writes audit rows for runtime events (text slugs such as
  -- "west-peek"), which never exist in agencies/events. In Postgres the uuid type and these keys
  -- made every such write fail, silently, behind a .catch.
);
CREATE INDEX IF NOT EXISTS idx_audit_agency_event_created ON audit_logs (agency_id, event_id, created_at);

CREATE TABLE IF NOT EXISTS role_assignments (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT,
  agency_id TEXT,
  client_id TEXT,
  event_id TEXT,
  assigned_by_user_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES profiles(id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_role_assignments_user_scope ON role_assignments (user_id, scope_type, scope_id);

CREATE TABLE IF NOT EXISTS client_contacts (
  id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  title TEXT,
  role TEXT NOT NULL DEFAULT 'client_reviewer',
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS contractor_assignments (
  id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  contractor_id TEXT NOT NULL,
  user_id TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'invited',
  call_time_at TEXT,
  end_time_at TEXT,
  assigned_by_user_id TEXT,
  assignment_notes TEXT,
  shared_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES profiles(id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS vendor_assignments (
  id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  vendor_id TEXT NOT NULL,
  service_category TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  assigned_by_user_id TEXT,
  due_at TEXT,
  internal_notes TEXT,
  shared_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by_user_id) REFERENCES profiles(id),
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS speaker_profiles (
  id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  title TEXT,
  company TEXT,
  email TEXT NOT NULL,
  bio TEXT,
  readiness_status TEXT NOT NULL DEFAULT 'invited',
  tech_check_status TEXT NOT NULL DEFAULT 'not_scheduled',
  internal_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  PRIMARY KEY (id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS sponsors (
  id TEXT NOT NULL,
  agency_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  name TEXT NOT NULL,
  website_url TEXT,
  tier TEXT,
  status TEXT NOT NULL DEFAULT 'prospect',
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  internal_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at TEXT,
  booth_headline TEXT,
  booth_description TEXT,
  cta_label TEXT,
  cta_url TEXT,
  lead_routing_email TEXT,
  booth_status TEXT NOT NULL DEFAULT 'draft',
  ready_room_status TEXT NOT NULL DEFAULT 'not_ready',
  PRIMARY KEY (id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
