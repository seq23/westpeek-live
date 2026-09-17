import { codeKey, displayCode, type AccessCodeField } from "@/lib/access/accessCodes";
import { randomId } from "@/lib/security/portableCrypto";
import { getHostLinkState } from "@/services/events/hostLinkService";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { supersededCodeIsLive, type SupersededCodeReason, type SupersededCodeRecord } from "@/types/supersededCode";
import type { RuntimeEventRecord } from "@/types/runtimeEvent";

/**
 * The memory a replaced code now has (17 Sep 2026). See types/supersededCode.ts for why it exists;
 * this is the reading and writing of it.
 *
 * Every write goes through `recordSupersededCode`, which is called from one place —
 * `setEventAccessCode` — because Adopt and Rotate both end up there. That is deliberate: a second
 * path that changes a code without recording the old one would recreate the original bug and look
 * exactly like working software.
 *
 * Reads never throw. An unmigrated database, or a seed event, must degrade to "no history", which
 * is the behaviour that existed before this table — never to a broken join page.
 */

export interface SupersededCodeHit {
  record: SupersededCodeRecord;
  event: RuntimeEventRecord;
}

/** Records what a code used to be, just before the new value is written. Never throws on the caller. */
export async function recordSupersededCode(input: { eventId: string; field: AccessCodeField; previousCode: string; replacedBy?: string; reason: SupersededCodeReason }): Promise<SupersededCodeRecord | undefined> {
  const key = codeKey(input.previousCode);
  if (!key) return undefined;
  const record: SupersededCodeRecord = {
    id: randomId("code-history"),
    eventId: input.eventId,
    field: input.field,
    code: input.previousCode,
    codeKey: key,
    replacedAt: new Date().toISOString(),
    replacedBy: input.replacedBy,
    reason: input.reason,
  };
  // A code change must not fail because its history row could not be written; the change is the
  // thing the owner pressed for. A lost row costs an old link its explanation, not the rotation.
  return getRuntimeStore().appendSupersededCode(record).catch(() => undefined);
}

/**
 * The old code somebody just typed, if we know it and the window is still open. Returns the event
 * too, because every caller needs it: the attendee path to land them on it, the privileged path to
 * name the producer's event in the refusal.
 */
export async function findSupersededCode(raw: string | undefined, now: Date = new Date()): Promise<SupersededCodeHit | undefined> {
  const key = codeKey(raw);
  if (!key) return undefined;
  const store = getRuntimeStore();
  const record = await store.findSupersededCode(key).catch(() => undefined);
  if (!record || !supersededCodeIsLive(record, now)) return undefined;
  const event = await store.getRuntimeEvent(record.eventId).catch(() => undefined);
  if (!event) return undefined;
  return { record, event };
}

/** The same lookup narrowed to one field: the privileged gates must not answer for the join code. */
export async function findSupersededCodeForField(raw: string | undefined, field: AccessCodeField, eventId?: string, now: Date = new Date()): Promise<SupersededCodeHit | undefined> {
  const hit = await findSupersededCode(raw, now);
  if (!hit || hit.record.field !== field) return undefined;
  if (eventId && hit.record.eventId !== eventId) return undefined;
  return hit;
}

/** Every code this event has retired, newest first, window and all — the Owner Console's read. */
export async function listSupersededCodes(eventId: string): Promise<SupersededCodeRecord[]> {
  return getRuntimeStore().listSupersededCodes(eventId).catch(() => []);
}

/**
 * What pressing Adopt or Rotate will actually cost, in numbers the system genuinely holds.
 *
 * The old confirm said "links already handed out stop working" and left the owner to guess whether
 * that meant nobody or an audience. Where a number is knowable it is stated; where it is not — we
 * never recorded how many speaker or sponsor links were copied out of the Access page — it says so
 * plainly rather than inventing a figure. A guessed number on this dialog is worse than none.
 */
export interface CodeChangeImpact {
  /** People who have registered for this event. Every one of them holds the event code. */
  registered: number;
  /** Attendee sessions open right now — the audience mid-show, the number that matters live. */
  liveSessions: number;
  /** Host links minted and not yet revoked. Rotating the crew code ends all of them. */
  outstandingHostLinks: number;
  /** Guests with a profile on this event: speakers, sponsors, VIPs, the client. */
  namedGuests: number;
  /** One line per field, ready to drop into the confirm. */
  lines: Record<AccessCodeField, string>;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

export async function describeCodeChangeImpact(eventId: string): Promise<CodeChangeImpact> {
  const store = getRuntimeStore();
  const [profiles, sessions, hostLinks, guests] = await Promise.all([
    store.listAttendeeProfiles(eventId).catch(() => []),
    store.listAttendeeSessions(eventId).catch(() => []),
    getHostLinkState(eventId).catch(() => ({ codeVersion: 0, links: [] })),
    store.listSpecialGuestProfiles(eventId).catch(() => []),
  ]);
  const registered = profiles.length;
  const liveSessions = sessions.filter((session) => session.status === "active").length;
  const outstandingHostLinks = hostLinks.links.filter((link) => !link.revokedAt).length;
  const namedGuests = guests.length;
  // The event code is the one we can be exact about: a registration is a person holding the link.
  const joinLine = registered
    ? `${plural(registered, "registered attendee", "registered attendees")}${liveSessions ? ` and ${plural(liveSessions, "person", "people")} in the venue right now` : ""} hold the old event code.`
    : "Nobody has registered yet, so no event-code link is in anyone's hands.";
  const crewLine = outstandingHostLinks
    ? `${plural(outstandingHostLinks, "host link", "host links")} still outstanding; rotating ends every one of them and every crew session.`
    : "No host link is outstanding. Any crew member holding the code is signed out.";
  // The role gates never recorded who copied a link, so there is no count to give. Say that.
  const guestLine = namedGuests
    ? `${plural(namedGuests, "named guest", "named guests")} on this event. We do not record how many role links were copied out, so the real number may be higher.`
    : "We do not record how many role links were copied out, so there is no count to give.";
  return {
    registered,
    liveSessions,
    outstandingHostLinks,
    namedGuests,
    lines: { join: joinLine, crew: crewLine, speaker: guestLine, sponsor: guestLine, vip: guestLine, client: guestLine },
  };
}

/** The old codes an event still answers for, for the Access page's own summary. */
export async function liveSupersededCodesFor(eventId: string, now: Date = new Date()) {
  const records = await listSupersededCodes(eventId);
  return records.filter((record) => supersededCodeIsLive(record, now)).map((record) => ({ ...record, code: displayCode(record.code) }));
}
