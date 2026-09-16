import { sha256Hex } from "@/lib/security/portableCrypto";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { maskEmail, upsertContactFromProfile } from "@/services/attendees/contactsService";
import { createAttendeeSession } from "@/services/attendees/attendeeSessionService";
import { checkGateAttempts, gateAttemptKeyFor, recordGateFailure } from "@/services/access/gateAttemptLimiter";
import type { AttendeeProfile } from "@/types/attendeeRegistration";

/**
 * The second device. Somebody registered on a laptop at 9am, picks up their phone at 11 and opens
 * the same link: registration is per browser, so without this they meet an empty form and read it
 * as a bug (the owner, from her own show, 17 Sep 2026).
 *
 * They type one thing — the email they used — and the registration they already made comes back.
 *
 * WHAT AN UNVERIFIED EMAIL MAY CLAIM. Only what the person themselves typed into the registration
 * form: name, company, title, website, socials, their answers, their networking preference. The
 * session it creates is stamped `assurance: "email_restored"`, and every privileged surface reads
 * that stamp: VIP standing is not shown, stage publishing is refused, and no video token is issued
 * with publish rights. Crew, operator and special-guest access never touched the attendee cookie in
 * the first place. Privilege is device-bound; to hold it here they enter the VIP code or ask the
 * crew again, exactly as they did the first time.
 *
 * WHY NOT A CODE BY EMAIL. It would be stronger, and it is the right next step for an event that
 * wants privilege to travel. It is not right for the first version of this: it puts an inbox round
 * trip between a guest and a show that is already running, which is the moment they give up. The
 * trade taken here is that an unverified email restores only self-declared profile fields, which is
 * the same information the People directory already shows every other attendee.
 *
 * ENUMERATION. Every attempt from one place counts against one bucket whether it matched or not, so
 * the gate cools down after a handful of tries; and a miss never says "that email is not
 * registered", it falls through to registration with the address filled in. Someone walking a list
 * of addresses learns nothing they could not learn by guessing at the registration form itself.
 */
export type AttendeeReturnOutcome =
  | { status: "restored"; profile: AttendeeProfile; healedEmail: boolean }
  | { status: "no_match"; email: string }
  | { status: "rate_limited"; retryInSeconds: number }
  | { status: "invalid" };

export function normalizeReturnEmail(value: string | undefined | null) {
  return String(value || "").trim().toLowerCase();
}

/** Fills in the raw address on a row that predates migration 0029, the same way registration does. */
function healedProfile(profile: AttendeeProfile, email: string, now: string): AttendeeProfile {
  return { ...profile, email, emailMasked: profile.emailMasked || maskEmail(email), updatedAt: now };
}

export async function restoreAttendeeOnThisDevice(input: { eventId: string; email: string; ip?: string }): Promise<AttendeeReturnOutcome> {
  const email = normalizeReturnEmail(input.email);
  if (!input.eventId || !email.includes("@")) return { status: "invalid" };

  const attemptKey = gateAttemptKeyFor({ ip: input.ip, eventCode: input.eventId, gate: "attendee_return" });
  const gate = checkGateAttempts(attemptKey);
  if (!gate.allowed) return { status: "rate_limited", retryInSeconds: gate.retryInSeconds };
  // Counted whether or not it matches: a bucket that only counts misses is a free oracle for hits.
  const limit = recordGateFailure(attemptKey);
  if (limit.cooling) return { status: "rate_limited", retryInSeconds: limit.retryInSeconds };

  const store = getRuntimeStore();
  const emailHash = await sha256Hex(email);
  // The hash is still the lookup key: rows from before the raw email was kept have only the hash.
  const existing = await store.getAttendeeProfileByEmailHash(input.eventId, emailHash).catch(() => undefined);
  if (!existing || existing.status !== "active") return { status: "no_match", email };

  const healedEmail = !existing.email;
  const profile = healedEmail ? healedProfile(existing, email, new Date().toISOString()) : existing;
  if (healedEmail) {
    await store.upsertAttendeeProfile(profile);
    // One writer heals every hash-only row for this address across events and builds the contact.
    await upsertContactFromProfile(profile).catch(() => undefined);
  }
  await createAttendeeSession(profile, { assurance: "email_restored" });
  return { status: "restored", profile, healedEmail };
}
