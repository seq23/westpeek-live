import { randomId } from "@/lib/security/portableCrypto";
import { appBaseUrl } from "@/lib/runtime/appBaseUrl";
import { mintAccessCodes } from "@/services/events/eventRepository";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { eventGuestStateKey, type EventGuestStateRecord } from "@/types/specialGuest";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";
import { displayCode } from "@/lib/access/accessCodes";
import { recordSupersededCode } from "@/services/events/supersededCodeService";
import type { SupersededCodeReason } from "@/types/supersededCode";

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

export const ACCESS_UNAVAILABLE_MESSAGE = "Can't check access right now. Try again in a minute.";

/**
 * The store could not say which code version is current, so no cookie can be checked against it.
 * The message is the plain line people may see; the store's own text stays in `cause` and the server log.
 */
export class AccessStateUnavailableError extends Error {
  constructor(what: string, eventId: string, cause: unknown) {
    super(ACCESS_UNAVAILABLE_MESSAGE, { cause });
    this.name = "AccessStateUnavailableError";
    console.error(`[access] ${what} for ${eventId} could not be read:`, cause instanceof Error ? cause.message : cause);
  }
}

/** No record means version 0. A FAILED read throws: read as version 0, every revoked crew cookie would pass. */
export async function getHostLinkState(eventId: string): Promise<HostLinkState> {
  let record: EventGuestStateRecord | undefined;
  try {
    record = await getRuntimeStore().getEventGuestState(eventGuestStateKey(eventId, "host_links"));
  } catch (error) {
    throw new AccessStateUnavailableError("host-link state", eventId, error);
  }
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
/**
 * This is the ONLY place the crew code is ever overwritten — the Access page's Set and Regenerate
 * come through `setEventAccessCode`, which delegates here, and "Revoke host link" calls it direct.
 * So the old value is recorded here rather than in the caller: recording upstream would have missed
 * the revoke button entirely and left a rotated crew code answering "that did not match" again.
 */
export async function revokeHostLinks(eventId: string, revokedBy: string, newCode?: string, reason: SupersededCodeReason = "rotate") {
  const store = getRuntimeStore();
  // Read the version before anything is written: a failed read stops the revoke here, instead of
  // writing version 1 over a higher one and letting older revoked cookies back in.
  const state = await getHostLinkState(eventId);
  const event = await store.getRuntimeEvent(eventId);
  if (!event) throw new Error("Only a runtime-created event has a crew code to rotate.");
  // Save the new version BEFORE rotating the code: if the rotation then fails, every old cookie is
  // already refused (a half-done revoke errs shut); the other order would leave them working.
  const now = new Date().toISOString();
  const next: HostLinkState = { codeVersion: state.codeVersion + 1, links: state.links.map((link) => (link.revokedAt ? link : { ...link, revokedAt: now })), rotatedAt: now, rotatedBy: revokedBy };
  await setHostLinkState(eventId, next);
  await recordSupersededCode({ eventId, field: "crew", previousCode: event.accessCodes.crew, replacedBy: revokedBy, reason });
  const rotated: RuntimeEventRecord = { ...event, accessCodes: { ...event.accessCodes, crew: newCode || mintAccessCodes().crew }, updatedAt: new Date().toISOString() };
  await store.upsertRuntimeEvent(rotated);
  return { event: rotated, state: next };
}

/** Pure: a crew cookie minted with an event crew code is only good for the version it was minted at. */
export function crewCookieCurrent(cookieCodeVersion: number | undefined, currentCodeVersion: number) {
  if (cookieCodeVersion === undefined) return true; // global crew password login: never rotated
  return cookieCodeVersion >= currentCodeVersion;
}
