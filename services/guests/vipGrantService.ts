import { codesMatch } from "@/lib/access/accessCodes";
import { getAccessCodeVersions } from "@/services/events/accessCodeService";
import { findEventRecord } from "@/services/events/eventRepository";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { eventGuestStateKey, type EventGuestStateRecord, type VipGrantSource, type VipGrantState, type VipInviteListState } from "@/types/specialGuest";

/**
 * VIP is code-bound. Nobody is a VIP because a boolean was set: they hold the event's VIP code,
 * and every grant records which code VERSION they hold it under. Rotate the VIP code and every
 * grant made under the old one stops being current — a crew grant is no more permanent than a code
 * somebody typed, which is the point.
 *
 * Three ways in, all the same underneath:
 *   · the person entered the VIP code (the gate, or the lobby card);
 *   · the crew issued it to them ("Make VIP" hands the crew the code to send);
 *   · their address was on the event's invite list and registration issued it.
 */
function now() {
  return new Date().toISOString();
}

async function vipCodeVersion(eventId: string) {
  const versions = await getAccessCodeVersions(eventId).catch(() => ({}) as Record<string, number>);
  return Number(versions.vip || 0);
}

export async function listVipGrants(eventId: string): Promise<VipGrantState[]> {
  const records = await getRuntimeStore().listEventGuestStates(eventId, "vip_grant").catch(() => [] as EventGuestStateRecord[]);
  return records.map((record) => record.state as VipGrantState).filter((grant) => Boolean(grant?.attendeeId));
}

export interface VipStanding extends VipGrantState {
  /** False when the VIP code has been rotated since this grant, or the grant was revoked. */
  current: boolean;
  reason: string;
}

function standingFor(grant: VipGrantState, currentVersion: number): VipStanding {
  if (grant.revokedAt) return { ...grant, current: false, reason: `Removed by ${grant.revokedBy || "the crew"}.` };
  if (grant.codeVersion < currentVersion) return { ...grant, current: false, reason: "The VIP code was rotated after this was issued." };
  const how = grant.source === "crew_grant" ? `Issued by ${grant.grantedBy || "the crew"}` : grant.source === "invite_list" ? "On the VIP invite list" : "Entered the VIP code";
  return { ...grant, current: true, reason: how };
}

export async function listVipStanding(eventId: string): Promise<VipStanding[]> {
  const version = await vipCodeVersion(eventId);
  return (await listVipGrants(eventId)).map((grant) => standingFor(grant, version)).sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
}

export async function vipStandingFor(eventId: string, attendeeId: string): Promise<VipStanding | undefined> {
  const record = await getRuntimeStore().getEventGuestState(eventGuestStateKey(eventId, "vip_grant", attendeeId)).catch(() => undefined);
  const grant = record?.state as VipGrantState | undefined;
  if (!grant) return undefined;
  return standingFor(grant, await vipCodeVersion(eventId));
}

export async function isVip(eventId: string, attendeeId: string) {
  return Boolean((await vipStandingFor(eventId, attendeeId))?.current);
}

async function writeGrant(eventId: string, grant: VipGrantState) {
  await getRuntimeStore().setEventGuestState({ key: eventGuestStateKey(eventId, "vip_grant", grant.attendeeId), eventId, kind: "vip_grant", guestId: grant.attendeeId, state: grant, updatedAt: now() });
  return grant;
}

/** The one way a grant is ever created. `codeVersion` comes from the event, never from the caller. */
export async function grantVip(eventId: string, input: { attendeeId: string; name: string; email?: string; source: VipGrantSource; grantedBy?: string }) {
  const codeVersion = await vipCodeVersion(eventId);
  return writeGrant(eventId, {
    attendeeId: input.attendeeId,
    name: input.name,
    email: input.email?.trim().toLowerCase() || undefined,
    source: input.source,
    grantedBy: input.source === "crew_grant" ? input.grantedBy : undefined,
    grantedAt: now(),
    codeVersion,
  });
}

export async function revokeVip(eventId: string, attendeeId: string, by: string) {
  const record = await getRuntimeStore().getEventGuestState(eventGuestStateKey(eventId, "vip_grant", attendeeId)).catch(() => undefined);
  const grant = record?.state as VipGrantState | undefined;
  if (!grant) return undefined;
  return writeGrant(eventId, { ...grant, revokedAt: now(), revokedBy: by });
}

/** The code the crew hands to the person they just made a VIP. Nothing is a VIP without it. */
export async function vipCodeFor(eventId: string) {
  const event = await findEventRecord(eventId);
  return event?.accessCodes?.vip;
}

/** The lobby card and the gate both land here: the code has to actually match. */
export async function redeemVipCode(eventId: string, typedCode: string, attendee: { attendeeId: string; name: string; email?: string }) {
  const expected = await vipCodeFor(eventId);
  if (!expected) return { ok: false as const, reason: "This event has no VIP code." };
  if (!codesMatch(typedCode, expected)) return { ok: false as const, reason: "That is not this event's VIP code." };
  const grant = await grantVip(eventId, { attendeeId: attendee.attendeeId, name: attendee.name, email: attendee.email, source: "entered_code" });
  return { ok: true as const, grant };
}

// ---- the invite list: a pre-authorisation of the code, never a bypass ------------------------

export async function getVipInviteList(eventId: string): Promise<VipInviteListState> {
  const record = await getRuntimeStore().getEventGuestState(eventGuestStateKey(eventId, "vip_invites")).catch(() => undefined);
  return (record?.state as VipInviteListState | undefined) || { emails: [], updatedBy: "", updatedAt: "" };
}

export function parseVipInviteList(raw: string) {
  return Array.from(new Set(String(raw || "").split(/[\s,;]+/).map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.includes("@")))).slice(0, 500);
}

export async function setVipInviteList(eventId: string, raw: string, updatedBy: string) {
  const state: VipInviteListState = { emails: parseVipInviteList(raw), updatedBy, updatedAt: now() };
  await getRuntimeStore().setEventGuestState({ key: eventGuestStateKey(eventId, "vip_invites"), eventId, kind: "vip_invites", state, updatedAt: state.updatedAt });
  return state;
}

/** Called at registration: an invited address is issued the code under the version in force today. */
export async function admitInvitedVip(eventId: string, attendee: { attendeeId: string; name: string; email?: string }) {
  const email = attendee.email?.trim().toLowerCase();
  if (!email) return undefined;
  const list = await getVipInviteList(eventId);
  if (!list.emails.includes(email)) return undefined;
  return grantVip(eventId, { attendeeId: attendee.attendeeId, name: attendee.name, email, source: "invite_list" });
}
