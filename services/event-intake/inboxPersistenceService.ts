import type { DbClient } from "@/lib/d1/query";
import type { ProductionInboxDecisionInput } from "@/lib/validation/productionOpsSchemas";
import type { DbProductionInboxItemRecord } from "@/types/persistence";
import { createAuditLog } from "@/services/audit";
import { mapProductionInboxRecord } from "@/services/persistence/mapOperationalRecords";

export async function listPersistedInboxItemsForEvent(client: DbClient, eventId: string) {
  const { data, error } = await client.from("production_inbox_items").select("*").eq("event_id", eventId).order("received_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as DbProductionInboxItemRecord[]).map(mapProductionInboxRecord) };
}

export async function updateProductionInboxItem(client: DbClient, input: ProductionInboxDecisionInput, actorUserId: string) {
  const payload = { status: input.nextStatus, linked_resource_type: input.linkedResourceType ?? null, linked_resource_id: input.linkedResourceId ?? null, next_action: input.nextAction ?? null, updated_at: new Date().toISOString(), converted_at: input.nextStatus.startsWith("converted") ? new Date().toISOString() : null, archived_at: input.nextStatus === "archived" ? new Date().toISOString() : null };
  const { data, error } = await client.from("production_inbox_items").update(payload).eq("id", input.inboxItemId).eq("agency_id", input.agencyId).select("*").single();
  if (error) return { error: error.message };
  await createAuditLog({ agencyId: input.agencyId, eventId: input.eventId, actorUserId, actorRole: "producer", action: `inbox_${input.nextStatus}`, resourceType: "production_inbox_item", resourceId: input.inboxItemId, visibility: "internal_agency" });
  return { data: mapProductionInboxRecord(data as DbProductionInboxItemRecord) };
}
