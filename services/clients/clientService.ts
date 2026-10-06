import type { DbClient } from "@/lib/d1/query";
import { clientInputSchema, normalizeOptional, type ClientInput } from "@/lib/validation/clientEventSchemas";
import { createAuditLog } from "@/services/audit";
import type { DbClientRecord } from "@/types/persistence";
import { mapClientRecord } from "@/services/persistence/mapRecords";

export async function listClientsForAgency(client: DbClient, agencyId: string) {
  const { data, error } = await client
    .from("clients")
    .select("*")
    .eq("agency_id", agencyId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) return { error: error.message, data: [] };
  return { data: ((data ?? []) as DbClientRecord[]).map(mapClientRecord) };
}

export async function getClientById(client: DbClient, clientId: string) {
  const { data, error } = await client.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (error) return { error: error.message };
  return { data: data ? mapClientRecord(data as DbClientRecord) : undefined };
}

export async function createClientRecord(client: DbClient, input: ClientInput, actorUserId: string) {
  const parsed = clientInputSchema.parse(input);
  const payload = {
    agency_id: parsed.agencyId,
    name: parsed.name,
    slug: parsed.slug,
    industry: normalizeOptional(parsed.industry),
    website_url: normalizeOptional(parsed.websiteUrl),
    logo_url: normalizeOptional(parsed.logoUrl),
    primary_contact_name: normalizeOptional(parsed.primaryContactName),
    primary_contact_email: normalizeOptional(parsed.primaryContactEmail),
    status: parsed.status,
    internal_notes: normalizeOptional(parsed.internalNotes),
    created_by_user_id: actorUserId,
    updated_by_user_id: actorUserId,
  };

  const { data, error } = await client.from("clients").insert(payload).select("*").single();
  if (error) return { error: error.message };

  await createAuditLog({
    agencyId: parsed.agencyId,
    actorUserId,
    actorRole: "agency_owner",
    action: "event_created",
    resourceType: "client",
    resourceId: (data as DbClientRecord).id,
    visibility: "internal_agency",
  });

  return { data: mapClientRecord(data as DbClientRecord) };
}

export async function updateClientRecord(client: DbClient, clientId: string, input: ClientInput, actorUserId: string) {
  const parsed = clientInputSchema.parse(input);
  const payload = {
    name: parsed.name,
    slug: parsed.slug,
    industry: normalizeOptional(parsed.industry),
    website_url: normalizeOptional(parsed.websiteUrl),
    logo_url: normalizeOptional(parsed.logoUrl),
    primary_contact_name: normalizeOptional(parsed.primaryContactName),
    primary_contact_email: normalizeOptional(parsed.primaryContactEmail),
    status: parsed.status,
    internal_notes: normalizeOptional(parsed.internalNotes),
    updated_by_user_id: actorUserId,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("clients").update(payload).eq("id", clientId).eq("agency_id", parsed.agencyId).select("*").single();
  if (error) return { error: error.message };

  await createAuditLog({
    agencyId: parsed.agencyId,
    clientId,
    actorUserId,
    actorRole: "agency_owner",
    action: "event_status_changed",
    resourceType: "client",
    resourceId: clientId,
    visibility: "internal_agency",
  });

  return { data: mapClientRecord(data as DbClientRecord) };
}
