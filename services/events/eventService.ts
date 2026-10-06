import type { DbClient } from "@/lib/d1/query";
import { eventInputSchema, normalizeOptional, type EventInput } from "@/lib/validation/clientEventSchemas";
import { createAuditLog } from "@/services/audit";
import type { DbEventRecord } from "@/types/persistence";
import { mapEventRecord } from "@/services/persistence/mapRecords";

export async function listEventsForAgency(client: DbClient, agencyId: string) {
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("agency_id", agencyId)
    .is("deleted_at", null)
    .order("start_at", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: ((data ?? []) as DbEventRecord[]).map(mapEventRecord) };
}

export async function listEventsForClient(client: DbClient, clientId: string) {
  const { data, error } = await client
    .from("events")
    .select("*")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .order("start_at", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: ((data ?? []) as DbEventRecord[]).map(mapEventRecord) };
}

export async function getEventById(client: DbClient, eventId: string) {
  const { data, error } = await client.from("events").select("*").eq("id", eventId).maybeSingle();
  if (error) return { error: error.message };
  return { data: data ? mapEventRecord(data as DbEventRecord) : undefined };
}

export async function createEventRecord(client: DbClient, input: EventInput, actorUserId: string) {
  const parsed = eventInputSchema.parse(input);
  const payload = toEventPayload(parsed, actorUserId);
  const { data, error } = await client.from("events").insert(payload).select("*").single();
  if (error) return { error: error.message };

  await createAuditLog({
    agencyId: parsed.agencyId,
    clientId: parsed.clientId,
    eventId: (data as DbEventRecord).id,
    actorUserId,
    actorRole: "agency_owner",
    action: "event_created",
    resourceType: "event",
    resourceId: (data as DbEventRecord).id,
    visibility: "internal_agency",
  });

  return { data: mapEventRecord(data as DbEventRecord) };
}

export async function updateEventRecord(client: DbClient, eventId: string, input: EventInput, actorUserId: string) {
  const parsed = eventInputSchema.parse(input);
  const payload = {
    ...toEventPayload(parsed, actorUserId),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("events").update(payload).eq("id", eventId).eq("agency_id", parsed.agencyId).select("*").single();
  if (error) return { error: error.message };

  await createAuditLog({
    agencyId: parsed.agencyId,
    clientId: parsed.clientId,
    eventId,
    actorUserId,
    actorRole: "agency_owner",
    action: "event_status_changed",
    resourceType: "event",
    resourceId: eventId,
    visibility: "internal_agency",
  });

  return { data: mapEventRecord(data as DbEventRecord) };
}

function toEventPayload(parsed: EventInput, actorUserId: string) {
  return {
    agency_id: parsed.agencyId,
    client_id: parsed.clientId,
    name: parsed.name,
    slug: parsed.slug,
    event_type: parsed.eventType,
    status: parsed.status,
    start_at: normalizeOptional(parsed.startAt),
    end_at: normalizeOptional(parsed.endAt),
    timezone: parsed.timezone,
    description: normalizeOptional(parsed.description),
    internal_goal: normalizeOptional(parsed.internalGoal),
    client_facing_goal: normalizeOptional(parsed.clientFacingGoal),
    primary_producer_user_id: normalizeOptional(parsed.primaryProducerUserId),
    project_manager_user_id: normalizeOptional(parsed.projectManagerUserId),
    registration_enabled: parsed.registrationEnabled,
    venue_enabled: parsed.venueEnabled,
    replay_enabled: parsed.replayEnabled,
    reporting_enabled: parsed.reportingEnabled,
    created_by_user_id: actorUserId,
    updated_by_user_id: actorUserId,
  };
}
