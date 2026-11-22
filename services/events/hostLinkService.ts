import { hmacSha256Base64Url, randomId } from "@/lib/security/portableCrypto";
import { getV5AccessCookieSecret } from "@/lib/env";
import { appBaseUrl } from "@/lib/runtime/appBaseUrl";
import { mintAccessCodes } from "@/services/events/eventRepository";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { eventGuestStateKey, type EventGuestStateRecord } from "@/types/specialGuest";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";
import { codesMatch, displayCode } from "@/lib/access/accessCodes";
import { recordSupersededCode } from "@/services/events/supersededCodeService";
import type { SupersededCodeReason } from "@/types/supersededCode";

/**
 * "Changing host should be super easy." The host of an event is the executive_producer crew role
 * for that one event. A host link is the crew gate prefilled with the event code, that role, and
 * the event's HOST code — the person still presses Enter. Since 22 Nov 2026 the crew code never
 * opens the executive producer role (anyone with a crew link could pick it from the list): only
 * the host code does, and the host code reaches people only through a host link handed out by the
 * owner, the operator or the current host. It is an HMAC of the event id and the code version
 * under the access-cookie secret, so it is never stored, cannot be worked out without the secret,
 * and changes whenever the version bumps. Minting records who handed it out;
 * revoking rotates the event's crew code and bumps `codeVersion`, so every crew cookie minted
 * with the old code (the cookie carries the version it was minted at) is refused from then on.
 */
export interface HostLinkGrant {
  id: string;
  grantedBy: string;
  grantedAt: string;
  codeVersion: number;
  revokedAt?: string;
}

export interface HostLinkState {
  codeVersion: number;
  links: HostLinkGrant[];
  rotatedAt?: string;
  rotatedBy?: string;
}

const EMPTY: HostLinkState = { codeVersion: 0, links: [] };

export async function getHostLinkState(eventId: string): Promise<HostLinkState> {
  const record = await getRuntimeStore().getEventGuestState(eventGuestStateKey(eventId, "host_links")).catch(() => undefined);
  return (record?.state as HostLinkState | undefined) || EMPTY;
}

async function setHostLinkState(eventId: string, state: HostLinkState) {
  const record: EventGuestStateRecord<HostLinkState> = { key: eventGuestStateKey(eventId, "host_links"), eventId, kind: "host_links", state, updatedAt: new Date().toISOString() };
  await getRuntimeStore().setEventGuestState(record);
  return state;
}

const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const HOST_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** WPL-HOST-XXXXX-XXXXX for this event at this code version. Throws when the access secret is missing (the gates are shut then anyway). */
export async function hostCodeFor(eventId: string, codeVersion: number, secret = getV5AccessCookieSecret()) {
  if (!secret) throw new Error("V5_ACCESS_COOKIE_SECRET is missing, so no host code can be made.");
  const mac = await hmacSha256Base64Url(`west-peek-live host code v1|${eventId}|${codeVersion}`, secret);
  // 64 symbols onto 32: each maps to exactly two, so no letter is likelier than another.
  const chars = Array.from(mac.slice(0, 10), (char) => HOST_ALPHABET[BASE64URL.indexOf(char) % 32]).join("");
  return `WPL-HOST-${chars.slice(0, 5)}-${chars.slice(5)}`;
}

/** True when `typed` is this event's current host code. */
export async function matchesHostCode(eventId: string, typed: string | undefined) {
  if (!typed?.trim()) return false;
  const { codeVersion } = await getHostLinkState(eventId);
  return codesMatch(typed, await hostCodeFor(eventId, codeVersion));
}

/** The link itself: the crew gate, prefilled with the host code. Never auto-submits. */
export function hostLinkPath(event: Pick<RuntimeEventRecord, "joinCode">, hostCode: string) {
  return `/production-access/crew?event=${encodeURIComponent(displayCode(event.joinCode))}&role=executive_producer&code=${encodeURIComponent(hostCode)}`;
}

export async function hostLinkPathFor(event: Pick<RuntimeEventRecord, "id" | "joinCode">) {
  const { codeVersion } = await getHostLinkState(event.id);
  return hostLinkPath(event, await hostCodeFor(event.id, codeVersion));
}

export async function hostLinkUrl(event: Pick<RuntimeEventRecord, "id" | "joinCode">) {
  return `${await appBaseUrl()}${await hostLinkPathFor(event)}`;
}

/** Records a grant against the current code version and returns the state; the caller renders the link. */
export async function mintHostLink(eventId: string, grantedBy: string) {
  const state = await getHostLinkState(eventId);
  const grant: HostLinkGrant = { id: randomId("host-link"), grantedBy, grantedAt: new Date().toISOString(), codeVersion: state.codeVersion };
  return setHostLinkState(eventId, { ...state, links: [grant, ...state.links].slice(0, 20) });
}

/** Rotates the event's crew code, bumps the version, and marks every outstanding link revoked. */
/** `newCode`: a custom crew code chosen on the Access page; otherwise a fresh random one. Either way every link and cookie minted with the old code stops working. */
/**
 * This is the ONLY place the crew code is ever overwritten — the Access page's Set and Regenerate
 * come through `setEventAccessCode`, which delegates here, and "Revoke host link" calls it direct.
 * So the old value is recorded here rather than in the caller: recording upstream would have missed
 * the revoke button entirely and left a rotated crew code answering "that did not match" again.
 */
export async function revokeHostLinks(eventId: string, revokedBy: string, newCode?: string, reason: SupersededCodeReason = "rotate") {
  const store = getRuntimeStore();
  const event = await store.getRuntimeEvent(eventId);
  if (!event) throw new Error("Only a runtime-created event has a crew code to rotate.");
  await recordSupersededCode({ eventId, field: "crew", previousCode: event.accessCodes.crew, replacedBy: revokedBy, reason });
  const rotated: RuntimeEventRecord = { ...event, accessCodes: { ...event.accessCodes, crew: newCode || mintAccessCodes().crew }, updatedAt: new Date().toISOString() };
  await store.upsertRuntimeEvent(rotated);
  const state = await getHostLinkState(eventId);
  const now = new Date().toISOString();
  const next: HostLinkState = { codeVersion: state.codeVersion + 1, links: state.links.map((link) => (link.revokedAt ? link : { ...link, revokedAt: now })), rotatedAt: now, rotatedBy: revokedBy };
  await setHostLinkState(eventId, next);
  return { event: rotated, state: next };
}

/** Pure: a crew cookie minted with an event crew code is only good for the version it was minted at. */
export function crewCookieCurrent(cookieCodeVersion: number | undefined, currentCodeVersion: number) {
  if (cookieCodeVersion === undefined) return true; // global crew password login: never rotated
  return cookieCodeVersion >= currentCodeVersion;
}
