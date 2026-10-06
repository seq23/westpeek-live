import type { DbClient } from "@/lib/d1/query";
import type { LastMinuteChangeDecisionInput } from "@/lib/validation/productionOpsSchemas";
import type { DbLastMinuteChangeRequestRecord } from "@/types/persistence";
import { createAuditLog } from "@/services/audit";
import { mapLastMinuteChangeRecord } from "@/services/persistence/mapOperationalRecords";

export async function listPersistedLastMinuteChangesForEvent(client: DbClient, eventId: string) {
  const { data, error } = await client.from("last_minute_change_requests").select("*").eq("event_id", eventId).order("submitted_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as DbLastMinuteChangeRequestRecord[]).map(mapLastMinuteChangeRecord) };
}

export async function decideLastMinuteChange(client: DbClient, input: LastMinuteChangeDecisionInput, actorUserId: string) {
  const statusMap = { approve: "approved", approve_with_conditions: "approved_with_conditions", reject: "rejected", push_to_live: "pushed_to_live", rollback: "rolled_back" } as const;
  const now = new Date().toISOString();
  const payload = { status: statusMap[input.decision], decided_by_user_id: actorUserId, decided_at: now, pushed_to_live_at: input.decision === "push_to_live" ? now : null, rolled_back_at: input.decision === "rollback" ? now : null, updated_at: now, recommended_action: input.note ?? undefined };
  const { data, error } = await client.from("last_minute_change_requests").update(payload).eq("id", input.changeRequestId).eq("agency_id", input.agencyId).select("*").single();
  if (error) return { error: error.message };
  await createAuditLog({ agencyId: input.agencyId, clientId: input.clientId, eventId: input.eventId, actorUserId, actorRole: "producer", action: `last_minute_change_${input.decision}`, resourceType: "last_minute_change_request", resourceId: input.changeRequestId, visibility: "internal_agency" });
  return { data: mapLastMinuteChangeRecord(data as DbLastMinuteChangeRequestRecord) };
}
