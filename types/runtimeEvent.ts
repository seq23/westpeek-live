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

/** Thrown by the Supabase store when a runtime table has not been created yet. */
export class RuntimeSchemaMissingError extends Error {
  readonly table: string;
  constructor(table: string, detail: string) {
    super(`Runtime table "${table}" is missing in Supabase: ${detail}`);
    this.name = "RuntimeSchemaMissingError";
    this.table = table;
  }
}

export const RUNTIME_EVENTS_MIGRATION_FILE = "db/migrations/0024_runtime_events.sql";
export const LIVE_CHAT_MODERATION_MIGRATION_FILE = "db/migrations/0025_live_chat_moderation.sql";
export const SPECIAL_GUEST_MIGRATION_FILE = "db/migrations/0026_special_guest_identity_and_state.sql";
export const SPEED_NETWORKING_MIGRATION_FILE = "db/migrations/0027_speed_networking.sql";
export const ATTENDEE_VISIBILITY_MIGRATION_FILE = "db/migrations/0029_attendee_profile_visibility.sql";
export const PLAN_AN_EVENT_MIGRATION_FILE = "db/migrations/0036_plan_an_event_pipeline.sql";
export const SUPPLIERS_MIGRATION_FILE = "db/migrations/0033_contractors_and_vendors.sql";

/** Which SQL file creates each runtime table the health probe checks. */
export const RUNTIME_TABLE_MIGRATIONS: Record<string, string> = {
  runtime_events: RUNTIME_EVENTS_MIGRATION_FILE,
  runtime_clients: RUNTIME_EVENTS_MIGRATION_FILE,
  runtime_agency_settings: RUNTIME_EVENTS_MIGRATION_FILE,
  live_chat_moderation_states: LIVE_CHAT_MODERATION_MIGRATION_FILE,
  "live_chat_messages.moderated_by": LIVE_CHAT_MODERATION_MIGRATION_FILE,
  special_guest_profiles: SPECIAL_GUEST_MIGRATION_FILE,
  event_guest_states: SPECIAL_GUEST_MIGRATION_FILE,
  networking_queue_entries: SPEED_NETWORKING_MIGRATION_FILE,
  networking_queue_matches: SPEED_NETWORKING_MIGRATION_FILE,
  "attendee_profiles.hidden_from_directory": ATTENDEE_VISIBILITY_MIGRATION_FILE,
  contacts: ATTENDEE_VISIBILITY_MIGRATION_FILE,
  how_it_works_pages: PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.state": PLAN_AN_EVENT_MIGRATION_FILE,
  suppliers: SUPPLIERS_MIGRATION_FILE,
  supplier_event_links: SUPPLIERS_MIGRATION_FILE,
};
