import { codeKey } from "@/lib/access/accessCodes";
import type { AccessCodeField } from "@/lib/access/accessCodes";

/**
 * What a code used to be (17 Sep 2026).
 *
 * Somebody pressed "Adopt the readable codes" on the 45 minute AI workshop and its event code went
 * from WPL-GE43TU to WPL-45MINU. The product did what it said it would — the confirm warned that
 * links already handed out would stop working — but the person who then followed the old link was
 * told "That code did not match an event. Check it against your invitation", which is the same
 * answer a typo gets. They could not tell that the event existed, that the code had moved, or what
 * to do next. There was nowhere in the system that remembered the old value at all.
 *
 * So every replaced code is now kept against its event with when it went and why. Two different
 * answers come out of that history, and the difference between them is the whole point:
 *
 *   · The attendee event code is an invitation, not a credential. Someone holding an old one is
 *     taken to the event anyway, with a line saying the code changed. The change was ours.
 *   · A crew, speaker, sponsor, client or VIP code IS the credential, and ending somebody's access
 *     is the reason to rotate one. An old privileged code refuses — but it says why and when, so
 *     the holder knows to ask the producer rather than believing they typed it wrong.
 */
export type SupersededCodeReason = "adopt" | "rotate" | "custom";

export interface SupersededCodeRecord {
  id: string;
  eventId: string;
  /** Which code this used to be: "join" for the attendee event code, otherwise the role. */
  field: AccessCodeField;
  /** The old value in its stored form, kept readable so the owner can recognise it. */
  code: string;
  /** The same value flattened for lookup — uppercase, letters and digits only. */
  codeKey: string;
  replacedAt: string;
  /** The ROLE that replaced it ("owner", "operator", "crew:producer"), never a person's name. */
  replacedBy?: string;
  reason: SupersededCodeReason;
}

/**
 * How long an old code keeps answering. The owner rotates codes yearly by design, so this is not a
 * retention policy — it is how long an invitation is worth honouring after the code under it moved.
 * Ninety days covers an invitation sent a season ahead and a replay watched a month late, and it
 * ends well before the next year's rotation, so last year's crew code cannot still be explaining
 * itself when this year's event runs.
 */
export const SUPERSEDED_CODE_WINDOW_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Pure: is this old code still inside the window, measured from when it was replaced? */
export function supersededCodeIsLive(record: Pick<SupersededCodeRecord, "replacedAt">, now: Date = new Date()) {
  const replaced = new Date(record.replacedAt).getTime();
  if (Number.isNaN(replaced)) return false;
  return now.getTime() - replaced < SUPERSEDED_CODE_WINDOW_DAYS * DAY_MS;
}

/** The lookup form. A phone's capitals, spaces and dropped hyphens all flatten to the same key. */
export function supersededCodeKey(raw: string | undefined | null) {
  return codeKey(raw);
}

/**
 * "16 September" — the date in the refusal. Deliberately no year and no time: the holder needs to
 * know which change this was, and a timestamp reads like an error code rather than an explanation.
 */
export function supersededOnLabel(isoDate: string) {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long" }).format(parsed);
}

const ROLE_WORD: Record<Exclude<AccessCodeField, "join">, string> = {
  crew: "crew",
  speaker: "speaker",
  sponsor: "sponsor",
  vip: "VIP",
  client: "client",
};

/**
 * What a privileged holder is told. Never the generic not-found, and never the current code: it
 * names the credential, the day it was replaced, and the one person who can hand out the new one.
 */
export function supersededPrivilegedMessage(field: Exclude<AccessCodeField, "join">, replacedAt: string) {
  const on = supersededOnLabel(replacedAt);
  const role = ROLE_WORD[field];
  return `This ${role} code was replaced${on ? ` on ${on}` : ""}. Ask the producer for the current one.`;
}

/** What an attendee is told, once, on the page they were actually invited to. */
export function supersededAttendeeMessage(oldCode: string) {
  const shown = String(oldCode || "").trim().toUpperCase();
  return `The event code changed after your invitation went out${shown ? ` — ${shown} is the old one` : ""}. This is the right event, and you are in the right place.`;
}
