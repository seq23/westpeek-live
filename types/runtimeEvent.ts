import type { EventStatus } from "@/types/core";

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
