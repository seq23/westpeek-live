"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ownerSignInRedirect } from "@/lib/auth/ownerAtEveryDoor";
import { requestIpHash, takeGateAttempt, UNKNOWN_EVENT_SCOPE } from "@/services/access/gateAttemptLimiter";
import { requireLiveEventControlAccessForRequest } from "@/lib/auth/liveControlRequestGuard";
import { getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { grantVip, redeemVipCode, revokeVip, setVipInviteList } from "@/services/guests/vipGrantService";

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
  // The redirect answers yes or no, so the card is a door like any gate: counted before the match,
  // against the event the attendee is registered for (never the form's text; no profile, one shared count).
  const { ip } = await requestIpHash({ headers: await headers() });
  const gate = await takeGateAttempt({ gate: "vip_redeem", scope: profile?.eventId ?? UNKNOWN_EVENT_SCOPE, ip });
  // The owner password works here too, read against this count (ownerAtEveryDoor): she lands in the lobby as the owner.
  await ownerSignInRedirect({ password: code, door: "vip_redeem", attempt: gate, next: `/venue/${encodeURIComponent(eventId)}/lobby` });
  if (!profile) redirect(`/events/${eventId}/register?reason=vip`);
  if (!gate.allowed) redirect(`/venue/${eventId}/lobby?vip=wait`);
  const result = await redeemVipCode(eventId, code, { attendeeId: profile!.attendeeId, name: profile!.name, email: profile!.email });
  revalidateVipSurfaces(eventId);
  redirect(`/venue/${eventId}/lobby?vip=${result.ok ? "1" : "no"}`);
}
