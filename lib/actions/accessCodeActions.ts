"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { adoptReadableCodes, setEventAccessCode } from "@/services/events/accessCodeService";
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


/**
 * "Adopt the readable scheme" / "Rotate the whole stem". One action, two intentions: adopt leaves a
 * hand-set code alone, rotate-everything replaces all six and warns first in the UI.
 */
export async function adoptReadableCodesAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") || "").trim();
  if (!eventId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_access_codes");
  if (!auth.ok) throw new Error(auth.error);
  const actor = auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
  const includeCustom = String(formData.get("includeCustom") || "") === "true";
  const newStem = String(formData.get("newStem") || "") === "true";
  const result = await adoptReadableCodes(eventId, actor, { includeCustom, newStem });
  await createAuditLog({ agencyId: "west-peek", eventId, actorUserId: actor, actorRole: actor, action: "access_code_rotated", resourceType: "event", resourceId: `${eventId}:scheme`, visibility: "internal_agency" }).catch(() => undefined);
  for (const path of [`/app/events/${eventId}/access`, `/app/events/${eventId}`, "/app/owner", "/app/events"]) revalidatePath(path);
  if (!result.ok) redirect(`/app/events/${eventId}/access?codeError=${encodeURIComponent(result.reason || "The codes could not be changed.")}`);
  redirect(`/app/events/${eventId}/access?codeSaved=scheme`);
}
