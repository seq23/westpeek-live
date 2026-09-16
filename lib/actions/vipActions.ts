"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { grantVip, redeemVipCode, revokeVip, setVipInviteList, vipCodeFor } from "@/services/guests/vipGrantService";

function clean(value: FormDataEntryValue | null) {
  return String(value || "").trim();
}

function revalidateVipSurfaces(eventId: string) {
  for (const path of [`/venue/${eventId}/lobby`, `/venue/${eventId}/people`, `/crew/events/${eventId}`, "/app/owner", `/app/events/${eventId}/access`]) revalidatePath(path);
}

/**
 * "Make VIP" does not flip a flag: it issues the event's VIP code to that person and records who
 * issued it, when, and under which code version — so rotating the code takes the grant with it.
 * The crew member gets the code back to send.
 */
export async function makeVipAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const attendeeId = clean(formData.get("attendeeId"));
  const name = clean(formData.get("name")) || "Guest";
  if (!eventId || !attendeeId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_stage_access");
  if (!auth.ok) throw new Error(auth.error);
  const actor = auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
  await grantVip(eventId, { attendeeId, name, email: clean(formData.get("email")) || undefined, source: "crew_grant", grantedBy: actor });
  revalidateVipSurfaces(eventId);
}

export async function removeVipAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const attendeeId = clean(formData.get("attendeeId"));
  if (!eventId || !attendeeId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_stage_access");
  if (!auth.ok) throw new Error(auth.error);
  const actor = auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
  await revokeVip(eventId, attendeeId, actor);
  revalidateVipSurfaces(eventId);
}

/** The per-event invite list: a pre-authorisation of the code, redeemed at registration. */
export async function setVipInviteListAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  if (!eventId) return;
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_access_codes");
  if (!auth.ok) throw new Error(auth.error);
  const actor = auth.actorRole === "crew" ? `crew:${auth.crewRole}` : auth.actorRole;
  await setVipInviteList(eventId, clean(formData.get("emails")), actor);
  revalidateVipSurfaces(eventId);
}

/** The lobby card: a registered attendee types the VIP code and holds it from then on. */
export async function redeemVipCodeAction(formData: FormData) {
  const eventId = clean(formData.get("eventId"));
  const code = clean(formData.get("code"));
  if (!eventId || !code) return;
  const profile = await getCurrentAttendeeProfile(eventId);
  if (!profile) redirect(`/events/${eventId}/register?reason=vip`);
  const result = await redeemVipCode(eventId, code, { attendeeId: profile!.attendeeId, name: profile!.name, email: profile!.email });
  revalidateVipSurfaces(eventId);
  redirect(`/venue/${eventId}/lobby?vip=${result.ok ? "1" : "no"}`);
}

/** What the crew sends after "Make VIP" — the code itself, to the person they just admitted. */
export async function vipCodeForCrewAction(eventId: string) {
  const auth = await requireLiveEventControlAccessForRequest(eventId, "manage_stage_access");
  if (!auth.ok) return { ok: false as const, reason: auth.error };
  const code = await vipCodeFor(eventId);
  return code ? { ok: true as const, code } : { ok: false as const, reason: "This event has no VIP code." };
}
