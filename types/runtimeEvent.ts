import { D1_SCHEMA } from "@/lib/d1/schema.generated";
import type { EventStatus } from "@/types/core";
import type { RegistrationQuestion } from "@/types/attendeeRegistration";

export type RuntimeEventFormat = "stage" | "room";
export type RuntimeEventSource = "runtime" | "request" | "seed";

export interface RuntimeAccessCodes {
  crew: string;
  speaker: string;
  sponsor: string;
  vip: string;
  client: string;
}

export interface RuntimeEventSession {
  id: string;
  title: string;
  room: string;
  startAt: string;
  endAt: string;
}

export interface RuntimeEventBranding {
  logo?: string;
  hero?: string;
  theme?: string;
  primaryColor?: string;
}

export interface RuntimeEventRecord {
  id: string;
  slug: string;
  name: string;
  format: RuntimeEventFormat;
  eventType: string;
  status: EventStatus;
  statusBeforeArchive?: EventStatus;
  clientId?: string;
  clientName: string;
  clientSlug: string;
  description?: string;
  startAt: string;
  endAt: string;
  timezone: string;
  joinCode: string;
  accessCodes: RuntimeAccessCodes;
  registrationEnabled: boolean;
  /** The event's own "Tell us more" questions; undefined = the default four. */
  registrationQuestions?: RegistrationQuestion[];
  /** How many days an attendee session lasts on one browser for this event; undefined = the platform default. */
  attendeeSessionDays?: number;
  branding: RuntimeEventBranding;
  sessions: RuntimeEventSession[];
  source: RuntimeEventSource;
  createdBy: string;
  createdByLabel: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface RuntimeClientRecord {
  id: string;
  slug: string;
  name: string;
  industry?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  status: "active" | "prospect" | "paused" | "archived";
  createdBy: string;
  createdByLabel: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgencyMemberEntry {
  name: string;
  email: string;
  role: string;
}

export interface AgencySettingsRecord {
  id: string;
  agencyName: string;
  primaryColor: string;
  accentColor: string;
  members: AgencyMemberEntry[];
  updatedBy: string;
  updatedByLabel: string;
  updatedAt: string;
}

/** Thrown by the D1 store when a runtime table (or a column it reads) has not been created yet. */
export class RuntimeSchemaMissingError extends Error {
  readonly table: string;
  constructor(table: string, detail: string) {
    super(`Runtime table "${table}" is missing in D1: ${detail}`);
    this.name = "RuntimeSchemaMissingError";
    this.table = table;
  }
}

/**
 * The D1 migration file that creates each family of runtime tables. The Postgres history these
 * names come from (db/migrations 0023-0046) was flattened into migrations-d1/ on 6 Oct 2026.
 */
export const REQUEST_EVENT_INTAKE_MIGRATION_FILE = "migrations-d1/0003_runtime.sql";
export const RUNTIME_EVENTS_MIGRATION_FILE = "migrations-d1/0003_runtime.sql";
export const LIVE_CHAT_MODERATION_MIGRATION_FILE = "migrations-d1/0004_attendees_live.sql";
export const SPECIAL_GUEST_MIGRATION_FILE = "migrations-d1/0004_attendees_live.sql";
export const SPEED_NETWORKING_MIGRATION_FILE = "migrations-d1/0005_networking_email.sql";
export const SPEED_NETWORKING_RUNTIME_TABLES_MIGRATION_FILE = "migrations-d1/0005_networking_email.sql";
export const ATTENDEE_VISIBILITY_MIGRATION_FILE = "migrations-d1/0004_attendees_live.sql";
export const CONTACT_ARCHIVE_MIGRATION_FILE = "migrations-d1/0001_core.sql";
export const EVENT_ASSETS_MIGRATION_FILE = "migrations-d1/0003_runtime.sql";
export const EMAIL_SEND_LOG_MIGRATION_FILE = "migrations-d1/0005_networking_email.sql";
export const SUPPLIERS_MIGRATION_FILE = "migrations-d1/0003_runtime.sql";
export const LIVE_CHAT_SCALE_MIGRATION_FILE = "migrations-d1/0004_attendees_live.sql";
export const EVENT_TEMPLATES_MIGRATION_FILE = "migrations-d1/0003_runtime.sql";
export const PLAN_AN_EVENT_MIGRATION_FILE = "migrations-d1/0003_runtime.sql";
export const ATTENDEE_CLIENT_TELEMETRY_MIGRATION_FILE = "migrations-d1/0004_attendees_live.sql";
export const ATTENDEE_SESSION_LIFETIME_MIGRATION_FILE = "migrations-d1/0004_attendees_live.sql";
export const GROUP_EMAIL_MIGRATION_FILE = "migrations-d1/0005_networking_email.sql";
export const HOUSE_DEFAULTS_MIGRATION_FILE = "migrations-d1/0003_runtime.sql";
export const EVENT_BACKUP_ROOMS_MIGRATION_FILE = "migrations-d1/0003_runtime.sql";
export const SUPERSEDED_CODES_MIGRATION_FILE = "migrations-d1/0003_runtime.sql";

/**
 * Which D1 migration file creates each database object /api/runtime/health probes: a table as
 * `table`, a column as `table.column` — EVERY table and EVERY column in migrations-d1/, derived from
 * lib/d1/schema.generated.ts (itself generated from the SQL and checked by
 * `npm run validate:d1-schema`). Nothing here is hand-kept, so nothing can be left out: the
 * hand-kept Postgres-era version silently skipped seven migrations, three of them never applied.
 */
export const RUNTIME_TABLE_MIGRATIONS: Record<string, string> = Object.fromEntries(
  Object.entries(D1_SCHEMA).flatMap(([table, schema]) => [[table, schema.file], ...Object.keys(schema.columns).map((column) => [`${table}.${column}`, schema.file])]),
);

