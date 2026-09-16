import { cookies } from "next/headers";
import { randomId } from "@/lib/security/portableCrypto";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { EXPIRING_SOON_HOURS, attendeeSessionDaysFor, sessionExpiresAt, sessionMaxAgeSeconds } from "@/services/attendees/attendeeSessionPolicy";
import type { AttendeeProfile } from "@/types/attendeeRegistration";
import type { AttendeeSession, AttendeeSessionAssurance } from "@/types/attendeeSession";

export const ATTENDEE_SESSION_COOKIE = "wpl_attendee_session";

function cookieValue(eventId: string, sessionId: string) {
  return `${eventId}.${sessionId}`;
}

function parseCookie(value?: string) {
  if (!value) return undefined;
  const firstDot = value.indexOf(".");
  if (firstDot < 1) return undefined;
  return { eventId: value.slice(0, firstDot), sessionId: value.slice(firstDot + 1) };
}

/**
 * `assurance` is how this browser proved who it is, and it is the whole guard on the second-device
 * return path. "device_registered" means the person filled the form here. "email_restored" means
 * they typed an address that matched an existing registration and nothing more: they get back the
 * details they themselves supplied, and no privileged standing follows them across.
 */
export async function createAttendeeSession(profile: AttendeeProfile, options?: { assurance?: AttendeeSessionAssurance }) {
  const now = Date.now();
  const days = await attendeeSessionDaysFor(profile.eventId);
  const session: AttendeeSession = {
    sessionId: randomId("attendee-session"),
    attendeeId: profile.attendeeId,
    eventId: profile.eventId,
    role: "attendee",
    status: "active",
    assurance: options?.assurance || "device_registered",
    issuedAt: new Date(now).toISOString(),
    expiresAt: sessionExpiresAt(days, now),
  };
  await getRuntimeStore().upsertAttendeeSession(session);
  // The cookie deliberately outlives the session (sessionMaxAgeSeconds adds the hint window): an
  // expired return has to be recognisable, or the guest meets a blank form and reads it as a bug.
  (await cookies()).set(ATTENDEE_SESSION_COOKIE, cookieValue(session.eventId, session.sessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds(days),
  });
  return session;
}

/** The session this browser holds, expired or not. Callers that need a live session use getCurrentAttendeeSession. */
async function readSessionRecord(eventId: string) {
  const parsed = parseCookie((await cookies()).get(ATTENDEE_SESSION_COOKIE)?.value);
  if (!parsed || parsed.eventId !== eventId) return undefined;
  return getRuntimeStore().getAttendeeSession(eventId, parsed.sessionId).catch(() => undefined);
}

export async function getCurrentAttendeeSession(eventId: string) {
  const session = await readSessionRecord(eventId);
  if (!session || session.status !== "active") return undefined;
  if (new Date(session.expiresAt).getTime() < Date.now()) return undefined;
  return session;
}

export async function getCurrentAttendeeProfile(eventId: string) {
  const session = await getCurrentAttendeeSession(eventId);
  if (!session) return undefined;
  const profile = await getRuntimeStore().getAttendeeProfile(eventId, session.attendeeId).catch(() => undefined);
  if (!profile || profile.status !== "active") return undefined;
  return profile;
}

export async function getCurrentAttendeeIdentity(eventId: string) {
  const profile = await getCurrentAttendeeProfile(eventId);
  if (!profile) return undefined;
  return { attendeeId: profile.attendeeId, displayName: profile.name, company: profile.company, title: profile.title, role: "attendee" as const };
}

export type AttendeeReturnState = "none" | "active" | "expiring" | "expired";

export interface AttendeeSessionStanding {
  state: AttendeeReturnState;
  /** The event's configured lifetime, so copy never hard-codes a number. */
  days: number;
  assurance?: AttendeeSessionAssurance;
  expiresAt?: string;
  msLeft?: number;
  name?: string;
  /** The masked address to show on the way back in; never the raw one. */
  emailMasked?: string;
}

/**
 * What to say to whoever is holding this browser: nothing, you are in, you are nearly out, or you
 * ran out. "expired" is only reachable because the cookie outlives the session, and it is the state
 * that turns a blank registration form back into a one-field way in.
 */
export async function getAttendeeSessionStanding(eventId: string): Promise<AttendeeSessionStanding> {
  const days = await attendeeSessionDaysFor(eventId);
  const session = await readSessionRecord(eventId);
  if (!session || session.status !== "active") return { state: "none", days };
  const profile = await getRuntimeStore().getAttendeeProfile(eventId, session.attendeeId).catch(() => undefined);
  const identity = profile && profile.status === "active" ? { name: profile.name, emailMasked: profile.emailMasked } : {};
  const msLeft = new Date(session.expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return { state: "expired", days, assurance: session.assurance, expiresAt: session.expiresAt, msLeft: 0, ...identity };
  if (!profile || profile.status !== "active") return { state: "none", days };
  const state: AttendeeReturnState = msLeft <= EXPIRING_SOON_HOURS * 60 * 60 * 1000 ? "expiring" : "active";
  return { state, days, assurance: session.assurance, expiresAt: session.expiresAt, msLeft, ...identity };
}

/**
 * Privileged standing (VIP, stage publishing) is device-bound and never rides in on an unverified
 * email. A restored session is a real session for the same person's profile; it is simply not
 * evidence that they are that person, so anything a stranger would want stays behind.
 */
export async function currentAttendeeMayHoldPrivilege(eventId: string) {
  const session = await getCurrentAttendeeSession(eventId).catch(() => undefined);
  return Boolean(session) && session?.assurance !== "email_restored";
}
