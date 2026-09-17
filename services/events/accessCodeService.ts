import { cookies } from "next/headers";
import { codeStem, codesMatch, codeKey, displayCode, isDerivedCode, isLegacyGeneratedCode, stemForEvent, stemFromCode, validateCustomCode, type AccessCodeField } from "@/lib/access/accessCodes";
import { readV5AccessCookie } from "@/lib/auth/productionAccess";
import { getEnv, getV5AccessCookieNames, getV5AccessCookieSecret } from "@/lib/env";
import { codesFromStem, freeCodeStem, mintAccessCodes, mintJoinCode } from "@/services/events/eventRepository";
import { revokeHostLinks } from "@/services/events/hostLinkService";
import { recordSupersededCode } from "@/services/events/supersededCodeService";
import type { SupersededCodeReason } from "@/types/supersededCode";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { eventGuestStateKey, type EventGuestStateRecord } from "@/types/specialGuest";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";
import type { V4SpecialGuestRole } from "@/types/v4";

/**
 * Custom and rotated access codes (16 Sep 2026). The owner / operator / producer can set any code
 * by hand on the Access page — join code and each role code — or regenerate one. A change is a
 * rotation: the old code stops working at the gate at once; for the crew code the host-link
 * version bumps (every crew cookie minted with the old code is refused); for a guest role the
 * role's code version bumps and a special-guest cookie minted with the old code is sent back to
 * the gate by the area layout. Versions live in event_guest_states (kind access_code_versions).
 */
export type GuestCodeRole = Exclude<V4SpecialGuestRole, "crew_lite">;
export type AccessCodeVersions = Record<GuestCodeRole, number>;

const ZERO: AccessCodeVersions = { speaker: 0, sponsor: 0, vip: 0, client: 0 };

export async function getAccessCodeVersions(eventId: string): Promise<AccessCodeVersions> {
  const record = await getRuntimeStore().getEventGuestState(eventGuestStateKey(eventId, "access_code_versions")).catch(() => undefined);
  return { ...ZERO, ...((record?.state as Partial<AccessCodeVersions> | undefined) || {}) };
}

async function bumpAccessCodeVersion(eventId: string, role: GuestCodeRole) {
  const current = await getAccessCodeVersions(eventId);
  const next = { ...current, [role]: current[role] + 1 };
  const record: EventGuestStateRecord<AccessCodeVersions> = { key: eventGuestStateKey(eventId, "access_code_versions"), eventId, kind: "access_code_versions", state: next, updatedAt: new Date().toISOString() };
  await getRuntimeStore().setEventGuestState(record);
  return next;
}

/** Pure: is a code, in its stored form, free for this field? Join codes are unique across every event; role codes within the event. */
export function codeIsFree(input: { field: AccessCodeField; stored: string; event: RuntimeEventRecord; allEvents: RuntimeEventRecord[] }) {
  const key = codeKey(input.stored);
  if (input.field === "join") return !input.allEvents.some((other) => other.id !== input.event.id && codeKey(other.joinCode) === key) && !Object.values(input.event.accessCodes).some((code) => codeKey(code) === key);
  const taken = [input.event.joinCode, ...Object.entries(input.event.accessCodes).filter(([role]) => role !== input.field).map(([, code]) => code)];
  return !taken.some((code) => codeKey(code) === key);
}

export type SetCodeResult = { ok: true; event: RuntimeEventRecord; field: AccessCodeField; code: string } | { ok: false; reason: string };

/**
 * Set (or regenerate) one code. Rotates whatever depended on the old one, and — since 17 Sep 2026 —
 * remembers what the old one WAS before overwriting it.
 *
 * Every way a code changes comes through here: Rotate, a hand-set custom code, and each field
 * "Adopt the readable codes" replaces. That is why the history is written here and nowhere else. A
 * new path that writes `joinCode` or `accessCodes` directly would silently skip the record and put
 * the product straight back to answering an old link with "that code did not match an event", so a
 * validator holds this funnel shut.
 *
 * `reason` says which press it was, for the owner reading the history later.
 */
export async function setEventAccessCode(eventId: string, field: AccessCodeField, input: { value?: string; regenerate?: boolean; reason?: SupersededCodeReason }, actor: string): Promise<SetCodeResult> {
  const store = getRuntimeStore();
  const event = await store.getRuntimeEvent(eventId);
  if (!event) return { ok: false, reason: "Only a runtime-created event has codes to change." };
  let stored: string;
  if (input.regenerate || !input.value?.trim()) {
    stored = field === "join" ? mintJoinCode() : mintAccessCodes()[field];
  } else {
    const validated = validateCustomCode(input.value, field);
    if (!validated.ok) return { ok: false, reason: validated.reason };
    stored = validated.stored;
  }
  const current = field === "join" ? event.joinCode : event.accessCodes[field];
  if (codeKey(current) === codeKey(stored)) return { ok: true, event, field, code: displayCode(stored) };
  const allEvents = await store.listRuntimeEvents();
  if (!codeIsFree({ field, stored, event, allEvents })) return { ok: false, reason: field === "join" ? "Another event already uses that join code." : "This event already uses that code for another role." };
  const reason = input.reason || (input.regenerate ? "rotate" : "custom");
  // The crew code is overwritten inside revokeHostLinks and nowhere else, so that is where its
  // history row is written; recording it here as well would double it.
  if (field === "crew") {
    const { event: rotated } = await revokeHostLinks(eventId, actor, stored, reason);
    return { ok: true, event: rotated, field, code: displayCode(stored) };
  }
  // Written before the overwrite, and only once the change is certain to go ahead: a code refused
  // for a collision has not been replaced and must not appear in the history as though it had.
  await recordSupersededCode({ eventId, field, previousCode: current, replacedBy: actor, reason });
  const updated: RuntimeEventRecord = field === "join" ? { ...event, joinCode: stored, updatedAt: new Date().toISOString() } : { ...event, accessCodes: { ...event.accessCodes, [field]: stored }, updatedAt: new Date().toISOString() };
  await store.upsertRuntimeEvent(updated);
  if (field !== "join") await bumpAccessCodeVersion(eventId, field);
  return { ok: true, event: updated, field, code: displayCode(stored) };
}

/** Pure: a special-guest cookie minted with a role code is good only for the version it was minted at. */
export function guestCookieCurrent(cookieVersion: number | undefined, currentVersion: number) {
  if (cookieVersion === undefined) return true; // minted before versions existed, or a seed event
  return cookieVersion >= currentVersion;
}

/** For the guest-area layouts: true when the caller's special-guest cookie for this event was minted with a code that has since changed. */
export async function guestAccessStale(eventId: string): Promise<boolean> {
  try {
    const env = getEnv();
    const payload = await readV5AccessCookie((await cookies()).get(getV5AccessCookieNames(env).specialGuestCookieName)?.value, getV5AccessCookieSecret(env));
    if (payload?.kind !== "special_guest" || payload.codeVersion === undefined || payload.role === "crew_lite") return false;
    if (payload.eventId !== eventId) return false;
    const versions = await getAccessCodeVersions(eventId);
    return !guestCookieCurrent(payload.codeVersion, versions[payload.role]);
  } catch {
    return false;
  }
}


/**
 * Adopt the readable scheme for one event, or rotate the whole stem at once. Both do the same
 * thing — give every role the code its stem implies — and both kill every link and cookie minted
 * under the old codes, which is the point of rotating. A code a producer set by hand is left alone
 * unless `includeCustom` says otherwise: a custom code is a decision, not an accident.
 */
export interface AdoptCodesResult {
  ok: boolean;
  stem?: string;
  changed?: AccessCodeField[];
  kept?: AccessCodeField[];
  reason?: string;
}

export async function adoptReadableCodes(eventId: string, actor: string, options: { includeCustom?: boolean; newStem?: boolean } = {}): Promise<AdoptCodesResult> {
  const store = getRuntimeStore();
  const event = await store.getRuntimeEvent(eventId);
  if (!event) return { ok: false, reason: "Only a runtime-created event has codes to change." };
  const all = await store.listRuntimeEvents().catch(() => [] as RuntimeEventRecord[]);
  const currentStem = stemForEvent(event.joinCode, event.name, event.id);
  const stem = options.newStem || !currentStem ? await freeCodeStem(event.name, event.id, all) : currentStem;
  const target = codesFromStem(stem);
  const changed: AccessCodeField[] = [];
  const kept: AccessCodeField[] = [];
  const fields: AccessCodeField[] = ["join", "crew", "speaker", "sponsor", "vip", "client"];
  for (const field of fields) {
    const current = field === "join" ? event.joinCode : event.accessCodes[field];
    const next = field === "join" ? target.joinCode : target.accessCodes[field];
    if (codesMatch(current, next)) { kept.push(field); continue; }
    // A hand-set code is kept unless the owner asked for everything.
    // Ours to replace: the derived code for another stem, or one of the old generated shapes.
    const custom = !isLegacyGeneratedCode(current, field) && (currentStem ? !isDerivedCode(current, currentStem, field) : !stemFromCode(current));
    if (custom && !options.includeCustom) { kept.push(field); continue; }
    const result = await setEventAccessCode(eventId, field, { value: next, reason: "adopt" }, actor);
    if (result.ok) changed.push(field); else kept.push(field);
  }
  return { ok: true, stem, changed, kept };
}

/** What the vault shows per event: the stem, whether each code is the derived one, and what it would be. */
export function codeSchemeSummary(event: RuntimeEventRecord) {
  const stem = stemForEvent(event.joinCode, event.name, event.id) || codeStem(event.name, event.id);
  const target = codesFromStem(stem);
  const fields: AccessCodeField[] = ["join", "crew", "speaker", "sponsor", "vip", "client"];
  return {
    stem,
    onScheme: fields.every((field) => codesMatch(field === "join" ? event.joinCode : event.accessCodes[field], field === "join" ? target.joinCode : target.accessCodes[field])),
    rows: fields.map((field) => ({
      field,
      current: displayCode(field === "join" ? event.joinCode : event.accessCodes[field]),
      derived: displayCode(field === "join" ? target.joinCode : target.accessCodes[field]),
      custom: !codesMatch(field === "join" ? event.joinCode : event.accessCodes[field], field === "join" ? target.joinCode : target.accessCodes[field]),
    })),
  };
}
