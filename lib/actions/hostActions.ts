"use server";
import { revalidatePath } from "next/cache";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { mintHostLink, revokeHostLinks } from "@/services/events/hostLinkService";
import { createAuditLog } from "@/services/audit";

function revalidateHostSurfaces(eventId: string) {
  for (const path of [`/crew/events/${eventId}`, `/app/events/${eventId}`, `/app/events/${eventId}/access`, `/venue/${eventId}/lobby`]) revalidatePath(path);
}

/** Owner, operator, or the executive producer (`manage_host`) hands out a host link for this one event. */
export async function mintHostLinkAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") || "").trim();
  if (!eventId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_host");
  if (!auth.ok) throw new Error(auth.error);
  const actor = auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
  await mintHostLink(eventId, actor);
  await createAuditLog({ agencyId: "west-peek", eventId, actorUserId: actor, actorRole: actor, action: "host_link_minted", resourceType: "event", resourceId: eventId, visibility: "internal_agency" }).catch(() => undefined);
  revalidateHostSurfaces(eventId);
}

/** Rotates the event's crew code: every outstanding host link (and every crew cookie minted with the old code) stops working. */
export async function revokeHostLinksAction(formData: FormData): Promise<void> {
  const eventId = String(formData.get("eventId") || "").trim();
  if (!eventId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_host");
  if (!auth.ok) throw new Error(auth.error);
  const actor = auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
  await revokeHostLinks(eventId, actor);
  await createAuditLog({ agencyId: "west-peek", eventId, actorUserId: actor, actorRole: actor, action: "host_link_revoked", resourceType: "event", resourceId: eventId, visibility: "internal_agency" }).catch(() => undefined);
  revalidateHostSurfaces(eventId);
}
