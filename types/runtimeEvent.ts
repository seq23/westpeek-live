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

/** Thrown by the Supabase store when a runtime table has not been created yet. */
export class RuntimeSchemaMissingError extends Error {
  readonly table: string;
  constructor(table: string, detail: string) {
    super(`Runtime table "${table}" is missing in Supabase: ${detail}`);
    this.name = "RuntimeSchemaMissingError";
    this.table = table;
  }
}

export const REQUEST_EVENT_INTAKE_MIGRATION_FILE = "db/migrations/0023_request_event_intake.sql";
export const RUNTIME_EVENTS_MIGRATION_FILE = "db/migrations/0024_runtime_events.sql";
export const LIVE_CHAT_MODERATION_MIGRATION_FILE = "db/migrations/0025_live_chat_moderation.sql";
export const SPECIAL_GUEST_MIGRATION_FILE = "db/migrations/0026_special_guest_identity_and_state.sql";
export const SPEED_NETWORKING_MIGRATION_FILE = "db/migrations/0027_speed_networking.sql";
export const SPEED_NETWORKING_RUNTIME_TABLES_MIGRATION_FILE = "db/migrations/0028_speed_networking_runtime_tables.sql";
export const ATTENDEE_VISIBILITY_MIGRATION_FILE = "db/migrations/0029_attendee_profile_visibility.sql";
export const CONTACT_ARCHIVE_MIGRATION_FILE = "db/migrations/0030_contact_archive.sql";
export const EVENT_ASSETS_MIGRATION_FILE = "db/migrations/0031_event_assets.sql";
export const EMAIL_SEND_LOG_MIGRATION_FILE = "db/migrations/0032_email_send_log.sql";
export const SUPPLIERS_MIGRATION_FILE = "db/migrations/0033_contractors_and_vendors.sql";
export const LIVE_CHAT_SCALE_MIGRATION_FILE = "db/migrations/0034_live_chat_scale_controls.sql";
export const EVENT_TEMPLATES_MIGRATION_FILE = "db/migrations/0035_event_templates.sql";
export const PLAN_AN_EVENT_MIGRATION_FILE = "db/migrations/0036_plan_an_event_pipeline.sql";
export const ATTENDEE_CLIENT_TELEMETRY_MIGRATION_FILE = "db/migrations/0037_attendee_client_telemetry.sql";
export const ATTENDEE_SESSION_LIFETIME_MIGRATION_FILE = "db/migrations/0038_attendee_session_lifetime.sql";

/**
 * Which SQL file introduces each database object /api/runtime/health probes: a table as `table`, a
 * column as `table.column`.
 *
 * This map is no longer maintained by hand and by memory. `npm run validate:migration-map-coverage`
 * reads db/migrations/ and fails the build if a table created or a column added by migration 0023 or
 * later is not here, pointing at the migration that introduces it. It is written that way because
 * the hand-maintained version silently skipped 0023, 0030, 0031, 0032, 0035, 0037 and 0038, and three
 * of those turned out never to have been applied in production - found by accident, one of them the
 * base table of the entire Plan-an-event feature.
 *
 * Do not edit this object to make a validator quiet. Add the entry the migration actually needs.
 */
export const RUNTIME_TABLE_MIGRATIONS: Record<string, string> = {
  // 0023 - the base table of Plan-an-event. It did not exist in production at all until 17 Sep 2026,
  // which is also why 0036 could not apply on top of it.
  request_event_intake: REQUEST_EVENT_INTAKE_MIGRATION_FILE,

  // 0024 - the runtime-first event store.
  runtime_events: RUNTIME_EVENTS_MIGRATION_FILE,
  runtime_clients: RUNTIME_EVENTS_MIGRATION_FILE,
  runtime_agency_settings: RUNTIME_EVENTS_MIGRATION_FILE,

  // 0025 - crew chat moderation.
  live_chat_moderation_states: LIVE_CHAT_MODERATION_MIGRATION_FILE,
  "live_chat_messages.moderated_by": LIVE_CHAT_MODERATION_MIGRATION_FILE,
  "live_chat_messages.moderated_at": LIVE_CHAT_MODERATION_MIGRATION_FILE,

  // 0026 - special-guest identity and state.
  special_guest_profiles: SPECIAL_GUEST_MIGRATION_FILE,
  event_guest_states: SPECIAL_GUEST_MIGRATION_FILE,

  // 0027 - the speed-networking queue the venue page reads.
  networking_queue_entries: SPEED_NETWORKING_MIGRATION_FILE,
  networking_queue_matches: SPEED_NETWORKING_MIGRATION_FILE,

  // 0028 - the replacements for the 0010 tables of the same name, which 0028 renames aside first.
  speed_networking_entries: SPEED_NETWORKING_RUNTIME_TABLES_MIGRATION_FILE,
  speed_networking_matches: SPEED_NETWORKING_RUNTIME_TABLES_MIGRATION_FILE,

  // 0029 - attendee directory visibility, the cross-event contact, and per-event questions.
  contacts: ATTENDEE_VISIBILITY_MIGRATION_FILE,
  "attendee_profiles.hidden_from_directory": ATTENDEE_VISIBILITY_MIGRATION_FILE,
  "attendee_profiles.email": ATTENDEE_VISIBILITY_MIGRATION_FILE,
  "attendee_profiles.extra_answers": ATTENDEE_VISIBILITY_MIGRATION_FILE,
  "runtime_events.registration_questions": ATTENDEE_VISIBILITY_MIGRATION_FILE,

  // 0030 - the column "Archive test rows" presses against. Unapplied, the button silently did nothing.
  "contacts.archived_at": CONTACT_ARCHIVE_MIGRATION_FILE,

  // 0031 - event asset uploads.
  event_assets: EVENT_ASSETS_MIGRATION_FILE,

  // 0032 - the record of every workflow email that was queued or sent.
  runtime_email_sends: EMAIL_SEND_LOG_MIGRATION_FILE,

  // 0033 - contractors and vendors, and which events they are on.
  suppliers: SUPPLIERS_MIGRATION_FILE,
  supplier_event_links: SUPPLIERS_MIGRATION_FILE,

  // 0034 - chat at scale: the post-rate window and the archive columns the crew deck sweeps with.
  live_chat_post_rates: LIVE_CHAT_SCALE_MIGRATION_FILE,
  "live_chat_messages.archived_at": LIVE_CHAT_SCALE_MIGRATION_FILE,
  "live_chat_messages.archived_by": LIVE_CHAT_SCALE_MIGRATION_FILE,

  // 0035 - reusable event templates.
  runtime_event_templates: EVENT_TEMPLATES_MIGRATION_FILE,

  // 0036 - Plan an event end to end. Every one of these columns is a step the owner or the client
  // takes; a missing one breaks the path at exactly that step and nowhere earlier.
  how_it_works_pages: PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.budget_range": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.state": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.scope_summary": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.price_amount_cents": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.price_currency": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.confirm_token": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.event_id": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.approved_at": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.approved_by": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.confirmed_at": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.paid_at": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.paid_by": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.settlement_method": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.settlement_reference": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.instructions_sent_at": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.declined_at": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.decline_reason": PLAN_AN_EVENT_MIGRATION_FILE,
  "request_event_intake.updated_at": PLAN_AN_EVENT_MIGRATION_FILE,

  // 0037 - the attendee client heartbeat the Diagnose panel reads. Unapplied, the panel would quietly
  // show "Not reported" for everyone instead of saying the column is missing (the 0030 lesson).
  "attendee_sessions.client_build_id": ATTENDEE_CLIENT_TELEMETRY_MIGRATION_FILE,
  "attendee_sessions.client_browser": ATTENDEE_CLIENT_TELEMETRY_MIGRATION_FILE,
  "attendee_sessions.client_connection_quality": ATTENDEE_CLIENT_TELEMETRY_MIGRATION_FILE,
  "attendee_sessions.client_subscribed_tracks": ATTENDEE_CLIENT_TELEMETRY_MIGRATION_FILE,
  "attendee_sessions.client_surface": ATTENDEE_CLIENT_TELEMETRY_MIGRATION_FILE,
  "attendee_sessions.last_chat_poll_at": ATTENDEE_CLIENT_TELEMETRY_MIGRATION_FILE,

  // 0038 - how many days one browser's attendee session lasts for this event.
  "runtime_events.attendee_session_days": ATTENDEE_SESSION_LIFETIME_MIGRATION_FILE,
};

