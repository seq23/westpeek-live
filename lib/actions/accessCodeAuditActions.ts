"use server";

import { getWorkspaceActor } from "@/lib/auth/workspaceActor";
import { createAuditLog } from "@/services/audit";

/**
 * Who looked at (or copied) which code, and when. The value itself is never in the audit row —
 * only the event and the field. Owner only; a failure to write is never a failure to show.
 */
export async function recordCodeVaultViewAction(eventId: string, field: string, kind: "reveal" | "copy") {
  const actor = await getWorkspaceActor();
  if (actor?.kind !== "owner") return { ok: false };
  await createAuditLog({
    agencyId: "west-peek",
    eventId,
    actorUserId: actor.id,
    actorRole: "owner",
    action: kind === "reveal" ? "access_code_revealed" : "access_code_copied",
    resourceType: "event",
    resourceId: `${eventId}:${field}`,
    visibility: "internal_agency",
  }).catch(() => undefined);
  return { ok: true };
}
