import { randomId } from "@/lib/security/portableCrypto";
import { appBaseUrl } from "@/lib/runtime/appBaseUrl";
import { mintAccessCodes } from "@/services/events/eventRepository";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { eventGuestStateKey, type EventGuestStateRecord } from "@/types/specialGuest";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";
import { displayCode } from "@/lib/access/accessCodes";

/**
 * "Changing host should be super easy." The host of an event is the executive_producer crew role
 * for that one event. A host link is the crew gate prefilled with the event code, that role, and
 * the event's crew code — the person still presses Enter. Minting records who handed it out;
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

/** The link itself: the crew gate, prefilled. Pure on the event row; never auto-submits. */
export function hostLinkPath(event: Pick<RuntimeEventRecord, "joinCode" | "accessCodes">) {
  return `/production-access/crew?event=${encodeURIComponent(displayCode(event.joinCode))}&role=executive_producer&code=${encodeURIComponent(displayCode(event.accessCodes.crew))}`;
}

export async function hostLinkUrl(event: Pick<RuntimeEventRecord, "joinCode" | "accessCodes">) {
  return `${await appBaseUrl()}${hostLinkPath(event)}`;
}

/** Records a grant against the current code version and returns the state; the caller renders the link. */
export async function mintHostLink(eventId: string, grantedBy: string) {
  const state = await getHostLinkState(eventId);
  const grant: HostLinkGrant = { id: randomId("host-link"), grantedBy, grantedAt: new Date().toISOString(), codeVersion: state.codeVersion };
  return setHostLinkState(eventId, { ...state, links: [grant, ...state.links].slice(0, 20) });
}

/** Rotates the event's crew code, bumps the version, and marks every outstanding link revoked. */
/** `newCode`: a custom crew code chosen on the Access page; otherwise a fresh random one. Either way every link and cookie minted with the old code stops working. */
export async function revokeHostLinks(eventId: string, revokedBy: string, newCode?: string) {
  const store = getRuntimeStore();
  const event = await store.getRuntimeEvent(eventId);
  if (!event) throw new Error("Only a runtime-created event has a crew code to rotate.");
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
