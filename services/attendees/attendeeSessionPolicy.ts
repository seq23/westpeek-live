import { findEventRecord } from "@/services/events/eventRepository";
import { DEFAULT_ATTENDEE_SESSION_DAYS, MAX_ATTENDEE_SESSION_DAYS, MIN_ATTENDEE_SESSION_DAYS } from "@/types/attendeeSession";

/**
 * How long a registration lasts, and how we say so.
 *
 * It used to be `SESSION_DAYS = 14` inside the session service: nobody outside that file could see
 * it, the owner could not change it, and the product never told a guest what it was. Now it is a
 * named default, an optional per-event override (runtime_events.attendee_session_days, migration
 * 0039), and every sentence the guest reads is generated from the resolved number instead of
 * hard-coding "14".
 *
 * Registration stays per event and per browser. The cookie is the device, which is why it outlives
 * the session by RETURN_HINT_DAYS: once the session has run out we still want to recognise the
 * browser well enough to say "this ran out" and offer the one-field way back, rather than showing
 * a blank form to somebody who registered last month.
 */
export { DEFAULT_ATTENDEE_SESSION_DAYS, MIN_ATTENDEE_SESSION_DAYS, MAX_ATTENDEE_SESSION_DAYS } from "@/types/attendeeSession";

/** How much longer the cookie lives than the session, so an expired return is recognised instead of blank. */
export const RETURN_HINT_DAYS = 60;

/** Inside this much of the end, the venue says so before it happens rather than after. */
export const EXPIRING_SOON_HOURS = 24;

export function clampSessionDays(value: unknown): number | undefined {
  const days = Math.floor(Number(value));
  if (!Number.isFinite(days) || days < MIN_ATTENDEE_SESSION_DAYS || days > MAX_ATTENDEE_SESSION_DAYS) return undefined;
  return days;
}

/** The event's own lifetime if it set one, otherwise the platform default. Never throws: copy must always render. */
export async function attendeeSessionDaysFor(eventId: string): Promise<number> {
  const event = await findEventRecord(eventId).catch(() => undefined);
  return clampSessionDays(event?.attendeeSessionDays) ?? DEFAULT_ATTENDEE_SESSION_DAYS;
}

export function sessionMaxAgeSeconds(days: number) {
  return Math.round((days + RETURN_HINT_DAYS) * 24 * 60 * 60);
}

export function sessionExpiresAt(days: number, from = Date.now()) {
  return new Date(from + days * 24 * 60 * 60 * 1000).toISOString();
}

export function dayWord(days: number) {
  return days === 1 ? "1 day" : `${days} days`;
}

/** "in 9 hours" / "in 3 days" — whichever a person would actually say out loud. */
export function remainingWords(msLeft: number) {
  const hours = Math.max(0, Math.round(msLeft / (60 * 60 * 1000)));
  if (hours <= 1) return "in under an hour";
  if (hours < 48) return `in ${hours} hours`;
  return `in ${Math.round(hours / 24)} days`;
}

/** The quiet line a registered guest sees in the identity area. Plain words, the resolved number, no marketing. */
export function registeredForWords(days: number) {
  return `You are registered for this event on this device for the next ${dayWord(days)}.`;
}

export const SECOND_DEVICE_WORDS = "On another phone or computer, open the same link and enter this email. Your details come back with you.";
