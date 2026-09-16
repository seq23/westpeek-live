import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { findEventIndexRecord, getAttendeeConfig, getEventConfig, getEventConfigPackage, getEventIndex } from "@/services/events/eventConfigRepository";
import { createAuditLog } from "@/services/audit";
import { RUNTIME_EVENTS_MIGRATION_FILE, RuntimeSchemaMissingError, type RuntimeAccessCodes, type RuntimeClientRecord, type RuntimeEventFormat, type RuntimeEventRecord, type RuntimeEventSession } from "@/types/runtimeEvent";
import type { EventStatus } from "@/types/core";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * The one event source every surface reads.
 *
 * Order of truth: the runtime store (Supabase in production, the file store in
 * local/e2e) first, then the compiled JSON seed events under data/events/*.
 * Seed events keep working — CI and the deployed proofs depend on `demo` — but
 * they are marked `source: "seed"` so the owner's lists can hide them.
 */

const SEED_START_AT: Record<string, string> = {
  "event-summit": "2026-06-12T15:00:00.000Z",
  "event-webinar": "2026-05-20T16:00:00.000Z",
  "event-demo-day": "2026-07-09T17:00:00.000Z",
  "event-expo": "2026-06-25T15:00:00.000Z",
  "event-workshop": "2026-04-30T15:00:00.000Z",
};

function seedEventRecord(slug: string): RuntimeEventRecord | undefined {
  const index = findEventIndexRecord(slug);
  const config = getEventConfig(slug);
  if (!index || !config) return undefined;
  const pkg = getEventConfigPackage(config.slug);
  const attendee = getAttendeeConfig(config.slug);
  const startAt = SEED_START_AT[config.id] || "2026-06-12T15:00:00.000Z";
  const endAt = new Date(new Date(startAt).getTime() + 1000 * 60 * 60 * 5).toISOString();
  return {
    id: config.id,
    slug: config.slug,
    name: config.name,
    format: "stage",
    eventType: "virtual_summit",
    status: (index.status || config.state) as EventStatus,
    clientName: config.client,
    clientSlug: config.clientSlug || "client",
    description: `${config.name} — compiled demo/seed event from ${index.configPath}.`,
    startAt,
    endAt,
    timezone: config.timezone,
    joinCode: config.publicCode,
    accessCodes: { crew: "", speaker: "", sponsor: "", vip: "", client: "" },
    registrationEnabled: Boolean(attendee?.joinStates.includes("registration_required")),
    branding: { logo: pkg.branding.logo, hero: pkg.branding.hero, theme: pkg.branding.theme },
    sessions: pkg.agenda.sessions.map((session, position) => ({
      id: String(session.id || `${config.id}-session-${position + 1}`),
      title: String(session.title || `Session ${position + 1}`),
      room: String(session.room || "Main Stage"),
      startAt,
      endAt,
    })),
    source: "seed",
    createdBy: "seed",
    createdByLabel: "Compiled seed event",
    createdAt: startAt,
    updatedAt: startAt,
  };
}

export function listSeedEventRecords(): RuntimeEventRecord[] {
  return getEventIndex().map((record) => seedEventRecord(record.slug)).filter((record): record is RuntimeEventRecord => Boolean(record));
}

export function isSeedEventId(idOrSlug: string | undefined) {
  if (!idOrSlug) return false;
  return Boolean(findEventIndexRecord(idOrSlug));
}

export function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomCode(length: number) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = "";
  for (let index = 0; index < length; index += 1) out += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
  return out;
}

/** Join codes are short, lower-case, and typeable from a phone: `wpl-k7m2` style. */
export function mintJoinCode() {
  return `wpl-${randomCode(4).toLowerCase()}${randomCode(2).toLowerCase()}`;
}

export function mintAccessCodes(): RuntimeAccessCodes {
  return {
    crew: `CREW-${randomCode(6)}`,
    speaker: `SPK-${randomCode(6)}`,
    sponsor: `SPN-${randomCode(6)}`,
    vip: `VIP-${randomCode(6)}`,
    client: `CLT-${randomCode(6)}`,
  };
}

export interface CreateEventInput {
  name: string;
  when: "now" | "later";
  format?: RuntimeEventFormat;
  eventType?: string;
  clientId?: string;
  clientName?: string;
  startAt?: string;
  timezone?: string;
  description?: string;
  source?: "runtime" | "request";
}

export interface EventListOptions {
  includeSeed?: boolean;
  includeArchived?: boolean;
}

export interface RuntimeSchemaStatus {
  ok: boolean;
  store: "supabase" | "file";
  missingTables: string[];
  migrationFile: string;
  detail?: string;
}

function storeKind(): "supabase" | "file" {
  return getRuntimeStore().kind;
}

export async function findEventRecord(codeOrSlugOrId: string | undefined): Promise<RuntimeEventRecord | undefined> {
  const key = codeOrSlugOrId?.trim().toLowerCase();
  if (!key) return undefined;
  try {
    const runtime = await getRuntimeStore().getRuntimeEvent(key);
    if (runtime) return runtime;
  } catch (error) {
    if (!(error instanceof RuntimeSchemaMissingError)) throw error;
    // Table not migrated yet: seed events must keep resolving.
  }
  return seedEventRecord(key);
}

export async function listEventRecords(options: EventListOptions = {}): Promise<RuntimeEventRecord[]> {
  let runtime: RuntimeEventRecord[] = [];
  try {
    runtime = await getRuntimeStore().listRuntimeEvents();
  } catch (error) {
    if (!(error instanceof RuntimeSchemaMissingError)) throw error;
  }
  const seeds = options.includeSeed ? listSeedEventRecords() : [];
  const all = [...runtime, ...seeds];
  return options.includeArchived ? all : all.filter((event) => event.status !== "archived");
}

async function uniqueSlug(base: string) {
  const store = getRuntimeStore();
  let candidate = base || "event";
  if (isSeedEventId(candidate)) candidate = `${candidate}-${randomCode(3).toLowerCase()}`;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await store.getRuntimeEvent(candidate);
    if (!existing) return candidate;
    candidate = `${base}-${randomCode(3).toLowerCase()}`;
  }
  return `${base}-${randomCode(6).toLowerCase()}`;
}

function defaultSessions(eventId: string, name: string, format: RuntimeEventFormat, startAt: string, endAt: string): RuntimeEventSession[] {
  return [{ id: `${eventId}-main-stage`, title: format === "room" ? `${name} room` : "Main stage", room: format === "room" ? "Room" : "Main Stage", startAt, endAt }];
}

export async function createEventRecord(input: CreateEventInput, actor: WorkspaceActor): Promise<RuntimeEventRecord> {
  const name = input.name.trim();
  if (!name) throw new Error("Event name is required.");
  const now = new Date();
  const startAt = input.when === "now" || !input.startAt ? now.toISOString() : new Date(input.startAt).toISOString();
  const endAt = new Date(new Date(startAt).getTime() + 1000 * 60 * 60 * 2).toISOString();
  const format: RuntimeEventFormat = input.format === "room" ? "room" : "stage";
  const slug = await uniqueSlug(slugify(name));
  const client = await resolveClientForEvent(input, actor);
  const record: RuntimeEventRecord = {
    id: slug,
    slug,
    name,
    format,
    eventType: input.eventType?.trim() || (format === "room" ? "community_event" : "webinar"),
    status: input.when === "now" ? "live" : "draft",
    clientId: client?.id,
    clientName: client?.name || "West Peek",
    clientSlug: client?.slug || "west-peek",
    description: input.description?.trim() || undefined,
    startAt,
    endAt,
    timezone: input.timezone?.trim() || "America/Chicago",
    joinCode: mintJoinCode(),
    accessCodes: mintAccessCodes(),
    registrationEnabled: false,
    branding: { logo: "west-peek-live", hero: name, theme: "west-peek-live" },
    sessions: defaultSessions(slug, name, format, startAt, endAt),
    source: input.source || "runtime",
    createdBy: actor.id,
    createdByLabel: actor.label,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
  await getRuntimeStore().upsertRuntimeEvent(record);
  await createAuditLog({
    agencyId: "west-peek",
    clientId: record.clientId,
    eventId: record.id,
    actorUserId: actor.id,
    actorRole: actor.role,
    action: "event_created",
    newValue: { status: record.status, when: input.when },
    resourceType: "event",
    resourceId: record.id,
    visibility: "internal_agency",
  }).catch(() => undefined);
  return record;
}

async function resolveClientForEvent(input: CreateEventInput, actor: WorkspaceActor): Promise<RuntimeClientRecord | undefined> {
  if (input.clientId?.trim()) {
    const existing = await findClientRecord(input.clientId.trim());
    if (existing) return existing;
  }
  const clientName = input.clientName?.trim();
  if (!clientName || clientName.toLowerCase() === "west peek") return undefined;
  const existingByName = (await listClientRecords()).find((client) => client.name.toLowerCase() === clientName.toLowerCase());
  if (existingByName) return existingByName;
  return createClientRecord({ name: clientName }, actor);
}

export type EventPatch = Partial<Pick<RuntimeEventRecord, "name" | "eventType" | "description" | "startAt" | "endAt" | "timezone" | "registrationEnabled" | "branding" | "sessions" | "clientName" | "clientSlug" | "clientId" | "format">>;

async function requireRuntimeEvent(id: string) {
  const event = await getRuntimeStore().getRuntimeEvent(id);
  if (!event) throw new Error(`Runtime event ${id} was not found. Seed/demo events are compiled and cannot be edited here.`);
  return event;
}

export async function updateEventRecord(id: string, patch: EventPatch, actor: WorkspaceActor) {
  const event = await requireRuntimeEvent(id);
  const updated: RuntimeEventRecord = { ...event, ...patch, updatedAt: new Date().toISOString() };
  await getRuntimeStore().upsertRuntimeEvent(updated);
  await createAuditLog({ agencyId: "west-peek", clientId: updated.clientId, eventId: updated.id, actorUserId: actor.id, actorRole: actor.role, action: "event_updated", resourceType: "event", resourceId: updated.id, visibility: "internal_agency" }).catch(() => undefined);
  return updated;
}

export async function setEventStatus(id: string, status: EventStatus, actor: WorkspaceActor) {
  const event = await requireRuntimeEvent(id);
  const updated: RuntimeEventRecord = { ...event, status, updatedAt: new Date().toISOString() };
  if (status === "live" && new Date(event.startAt).getTime() > Date.now()) updated.startAt = new Date().toISOString();
  await getRuntimeStore().upsertRuntimeEvent(updated);
  await createAuditLog({ agencyId: "west-peek", clientId: updated.clientId, eventId: updated.id, actorUserId: actor.id, actorRole: actor.role, action: "event_status_changed", previousValue: event.status, newValue: status, resourceType: "event", resourceId: updated.id, visibility: "internal_agency" }).catch(() => undefined);
  return updated;
}

export async function archiveEventRecord(id: string, actor: WorkspaceActor) {
  const event = await requireRuntimeEvent(id);
  if (event.status === "archived") return event;
  const updated: RuntimeEventRecord = { ...event, status: "archived", statusBeforeArchive: event.status, archivedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await getRuntimeStore().upsertRuntimeEvent(updated);
  await createAuditLog({ agencyId: "west-peek", clientId: updated.clientId, eventId: updated.id, actorUserId: actor.id, actorRole: actor.role, action: "event_archived", resourceType: "event", resourceId: updated.id, visibility: "internal_agency" }).catch(() => undefined);
  return updated;
}

export async function restoreEventRecord(id: string, actor: WorkspaceActor) {
  const event = await requireRuntimeEvent(id);
  if (event.status !== "archived") return event;
  const restoredStatus: EventStatus = event.statusBeforeArchive && event.statusBeforeArchive !== "archived" ? event.statusBeforeArchive : "draft";
  const updated: RuntimeEventRecord = { ...event, status: restoredStatus, statusBeforeArchive: undefined, archivedAt: undefined, updatedAt: new Date().toISOString() };
  await getRuntimeStore().upsertRuntimeEvent(updated);
  await createAuditLog({ agencyId: "west-peek", clientId: updated.clientId, eventId: updated.id, actorUserId: actor.id, actorRole: actor.role, action: "event_restored", resourceType: "event", resourceId: updated.id, visibility: "internal_agency" }).catch(() => undefined);
  return updated;
}

// Clients ---------------------------------------------------------------

export interface CreateClientInput {
  name: string;
  industry?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
}

export async function listClientRecords(): Promise<RuntimeClientRecord[]> {
  try {
    return await getRuntimeStore().listRuntimeClients();
  } catch (error) {
    if (error instanceof RuntimeSchemaMissingError) return [];
    throw error;
  }
}

export async function findClientRecord(idOrSlug: string): Promise<RuntimeClientRecord | undefined> {
  const key = idOrSlug.trim().toLowerCase();
  if (!key) return undefined;
  return (await listClientRecords()).find((client) => client.id.toLowerCase() === key || client.slug.toLowerCase() === key);
}

export async function createClientRecord(input: CreateClientInput, actor: WorkspaceActor): Promise<RuntimeClientRecord> {
  const name = input.name.trim();
  if (!name) throw new Error("Client name is required.");
  const base = slugify(name) || "client";
  const existing = await listClientRecords();
  let slug = base;
  let attempt = 2;
  while (existing.some((client) => client.slug === slug)) slug = `${base}-${attempt++}`;
  const now = new Date().toISOString();
  const record: RuntimeClientRecord = {
    id: slug,
    slug,
    name,
    industry: input.industry?.trim() || undefined,
    primaryContactName: input.primaryContactName?.trim() || undefined,
    primaryContactEmail: input.primaryContactEmail?.trim() || undefined,
    status: "active",
    createdBy: actor.id,
    createdByLabel: actor.label,
    createdAt: now,
    updatedAt: now,
  };
  await getRuntimeStore().upsertRuntimeClient(record);
  await createAuditLog({ agencyId: "west-peek", clientId: record.id, actorUserId: actor.id, actorRole: actor.role, action: "client_created", resourceType: "client", resourceId: record.id, visibility: "internal_agency" }).catch(() => undefined);
  return record;
}

// Schema readiness ------------------------------------------------------

/**
 * Reports whether the runtime tables exist. Used by the workspace to turn a
 * missing migration into a named, visible stop instead of a silent failure.
 */
export async function getRuntimeSchemaStatus(): Promise<RuntimeSchemaStatus> {
  const store = getRuntimeStore();
  const missing: string[] = [];
  let detail: string | undefined;
  const probes: Array<[string, () => Promise<unknown>]> = [
    ["runtime_events", () => store.listRuntimeEvents()],
    ["runtime_clients", () => store.listRuntimeClients()],
    ["runtime_agency_settings", () => store.getAgencySettings("west-peek")],
  ];
  for (const [table, probe] of probes) {
    try {
      await probe();
    } catch (error) {
      if (error instanceof RuntimeSchemaMissingError) missing.push(table);
      else detail = error instanceof Error ? error.message : String(error);
    }
  }
  return { ok: missing.length === 0 && !detail, store: storeKind(), missingTables: missing, migrationFile: RUNTIME_EVENTS_MIGRATION_FILE, detail };
}

export function isRuntimeSchemaMissing(error: unknown): error is RuntimeSchemaMissingError {
  return error instanceof RuntimeSchemaMissingError;
}
