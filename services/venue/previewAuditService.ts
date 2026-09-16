import { createAuditLog } from "@/services/audit/createAuditLog";

export type PreviewAuditAction = "attendee_diagnosed" | "attendee_view_mirrored";

/**
 * Looking at a named person's state is a thing we record. Who diagnosed or mirrored whom, and when
 * — the attendee id and nothing else. NEVER an IP and never a location: the panel does not show
 * them, so the log has no business holding them either.
 *
 * Fail-soft on purpose. A producer answering "I can't see it" mid-show must not be blocked because
 * the audit table is unreachable; the diagnosis is the urgent half, the record is the durable half.
 */
export async function recordPreviewAudit(input: { eventId: string; attendeeId: string; viewerRole: string; action: PreviewAuditAction }) {
  await createAuditLog({
    agencyId: "west-peek",
    eventId: input.eventId,
    actorUserId: input.viewerRole,
    actorRole: input.viewerRole,
    action: input.action,
    resourceType: "attendee",
    resourceId: input.attendeeId,
    visibility: "internal_agency",
  }).catch(() => undefined);
}
