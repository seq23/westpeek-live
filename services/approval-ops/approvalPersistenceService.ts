import type { DbClient } from "@/lib/d1/query";
import type { ApprovalDecisionInput } from "@/lib/validation/productionOpsSchemas";
import type { DbApprovalRequestRecord } from "@/types/persistence";
import { createAuditLog } from "@/services/audit";
import { mapApprovalRequestRecord } from "@/services/persistence/mapOperationalRecords";

export async function listPersistedApprovalsForEvent(client: DbClient, eventId: string) {
  const { data, error } = await client.from("approval_requests").select("*").eq("event_id", eventId).is("deleted_at", null).order("created_at", { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as DbApprovalRequestRecord[]).map(mapApprovalRequestRecord) };
}

export async function decideApprovalRequest(client: DbClient, input: ApprovalDecisionInput, actorUserId: string) {
  const statusMap = { approve: "approved", request_changes: "changes_requested", lock: "locked", archive: "archived" } as const;
  const payload = {
    status: statusMap[input.decision],
    locked: input.decision === "lock",
    approved_at: input.decision === "approve" || input.decision === "lock" ? new Date().toISOString() : null,
    approved_by_user_id: input.decision === "approve" || input.decision === "lock" ? actorUserId : null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await client.from("approval_requests").update(payload).eq("id", input.approvalRequestId).eq("agency_id", input.agencyId).select("*").single();
  if (error) return { error: error.message };
  if (input.comment) {
    await client.from("approval_comments").insert({ agency_id: input.agencyId, client_id: input.clientId, event_id: input.eventId, approval_request_id: input.approvalRequestId, author_user_id: actorUserId, body: input.comment, visibility: "internal_agency" });
  }
  await createAuditLog({ agencyId: input.agencyId, clientId: input.clientId, eventId: input.eventId, actorUserId, actorRole: "producer", action: `approval_${input.decision}`, resourceType: "approval_request", resourceId: input.approvalRequestId, visibility: "internal_agency" });
  return { data: mapApprovalRequestRecord(data as DbApprovalRequestRecord) };
}
