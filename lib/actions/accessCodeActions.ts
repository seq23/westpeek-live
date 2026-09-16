"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { setEventAccessCode } from "@/services/events/accessCodeService";
import { createAuditLog } from "@/services/audit";
import type { AccessCodeField } from "@/lib/access/accessCodes";

const FIELDS: AccessCodeField[] = ["join", "crew", "speaker", "sponsor", "vip", "client"];

/**
 * Set a custom code or regenerate one (owner, operator, executive producer, producer). A change is
 * a rotation: the old code stops working at the gate; crew cookies and guest cookies minted with
 * the old code are refused. Lands back on the Access page with the outcome named.
 */
export async function setEventAccessCodeAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") || "").trim();
  const field = String(formData.get("field") || "") as AccessCodeField;
  if (!eventId || !FIELDS.includes(field)) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_access_codes");
  if (!auth.ok) throw new Error(auth.error);
  const actor = auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
  const regenerate = String(formData.get("regenerate") || "") === "true";
  const result = await setEventAccessCode(eventId, field, { value: String(formData.get("value") || ""), regenerate }, actor);
  const base = `/app/events/${eventId}/access`;
  if (!result.ok) redirect(`${base}?codeError=${encodeURIComponent(result.reason)}&codeField=${field}`);
  await createAuditLog({ agencyId: "west-peek", eventId, actorUserId: actor, actorRole: actor, action: "access_code_rotated", resourceType: "event", resourceId: `${eventId}:${field}`, visibility: "internal_agency" }).catch(() => undefined);
  for (const path of [base, `/app/events/${eventId}`, `/crew/events/${eventId}`, `/venue/${eventId}/lobby`, "/app/events"]) revalidatePath(path);
  // A changed join code changes the event's public address; the row's id (slug) does not.
  redirect(`${base}?codeSaved=${field}`);
}
