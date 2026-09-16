import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined), set: (name: string, value: string) => { jar.set(name, value); } }) }));

import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { registerOrUpdateAttendee } from "@/services/attendees/attendeeRegistrationService";
import { restoreAttendeeOnThisDevice } from "@/services/attendees/attendeeReturnService";
import { ATTENDEE_SESSION_COOKIE, createAttendeeSession, currentAttendeeMayHoldPrivilege, getAttendeeSessionStanding, getCurrentAttendeeProfile } from "@/services/attendees/attendeeSessionService";
import { DEFAULT_ATTENDEE_SESSION_DAYS, RETURN_HINT_DAYS, clampSessionDays, dayWord, registeredForWords, remainingWords, sessionMaxAgeSeconds } from "@/services/attendees/attendeeSessionPolicy";
import { grantVip, isVip } from "@/services/guests/vipGrantService";
import { resetGateAttemptsForTests, ATTEMPT_LIMIT } from "@/services/access/gateAttemptLimiter";
import { sha256Hex } from "@/lib/security/portableCrypto";
import type { AttendeeProfile } from "@/types/attendeeRegistration";

/**
 * The owner, from her own show on a phone (17 Sep 2026): "what if i registered already and was out,
 * do i have to register again when i come back, how long does my registration last if i exit? both
 * on mobile and desktop?"
 *
 * The answers this file holds to: the same browser keeps you for the event's configured lifetime; a
 * second device needs only the email; an expired session gets the one-field way back instead of a
 * blank form; and nothing privileged travels on an email nobody verified.
 */
const EVENT = "event-continuity";

/** A second device is simply a browser with no cookie; the store is the same. */
function newDevice() {
  jar.clear();
}

/** What submitEventRegistration does: write the profile, then issue this browser its session. */
async function registerHere(email: string, extra: Record<string, unknown> = {}) {
  const result = await registerOrUpdateAttendee({ eventId: EVENT, email, name: "Ada Lovelace", company: "Analytical Engines", title: "Founder", reasonForAttending: "To see the engine run", ...extra });
  await createAttendeeSession(result.profile);
  return result;
}

describe("registration continuity: one browser, the next device, and the way back", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-continuity-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    resetGateAttemptsForTests();
    jar.clear();
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetGateAttemptsForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("the same browser after a restart is still recognised, and is told for how long", async () => {
    await registerHere("ada@example.com");
    // The cookie is all a restarted browser brings back; nothing else is re-sent.
    expect(jar.get(ATTENDEE_SESSION_COOKIE)).toContain(`${EVENT}.`);
    expect((await getCurrentAttendeeProfile(EVENT))?.name).toBe("Ada Lovelace");
    const standing = await getAttendeeSessionStanding(EVENT);
    expect(standing.state).toBe("active");
    expect(standing.days).toBe(DEFAULT_ATTENDEE_SESSION_DAYS);
    expect(registeredForWords(standing.days)).toBe("You are registered for this event on this device for the next 14 days.");
  });

  it("a second device restores from the email alone, with every field the person supplied", async () => {
    const first = await registerHere("ada@example.com", { networkingGoals: "Meet two engineers" });
    newDevice();
    expect(await getCurrentAttendeeProfile(EVENT)).toBeUndefined();

    const outcome = await restoreAttendeeOnThisDevice({ eventId: EVENT, email: "  ADA@Example.com ", ip: "203.0.113.9" });
    expect(outcome.status).toBe("restored");
    const profile = await getCurrentAttendeeProfile(EVENT);
    expect(profile?.attendeeId).toBe(first.profile.attendeeId);
    expect(profile).toMatchObject({ name: "Ada Lovelace", company: "Analytical Engines", title: "Founder", reasonForAttending: "To see the engine run", networkingGoals: "Meet two engineers" });
  });

  it("no privileged state crosses an unverified email: the VIP grant survives, the restored device may not hold it", async () => {
    const first = await registerHere("ada@example.com");
    await grantVip(EVENT, { attendeeId: first.profile.attendeeId, name: "Ada Lovelace", source: "entered_code" });
    expect(await isVip(EVENT, first.profile.attendeeId)).toBe(true);
    // The device that registered here holds it.
    expect(await currentAttendeeMayHoldPrivilege(EVENT)).toBe(true);

    newDevice();
    await restoreAttendeeOnThisDevice({ eventId: EVENT, email: "ada@example.com", ip: "203.0.113.9" });
    const session = await getRuntimeStore().getAttendeeSession(EVENT, String(jar.get(ATTENDEE_SESSION_COOKIE)).split(".").slice(1).join("."));
    expect(session?.assurance).toBe("email_restored");
    // The grant is untouched (it belongs to the person); this device simply may not act on it.
    expect(await isVip(EVENT, first.profile.attendeeId)).toBe(true);
    expect(await currentAttendeeMayHoldPrivilege(EVENT)).toBe(false);
  });

  it("an unknown email is not told it is unknown: it falls through to registration with the address kept", async () => {
    await registerHere("ada@example.com");
    newDevice();
    const outcome = await restoreAttendeeOnThisDevice({ eventId: EVENT, email: "Stranger@Example.com", ip: "203.0.113.9" });
    expect(outcome).toEqual({ status: "no_match", email: "stranger@example.com" });
    // Nothing was created and no session was issued: a miss leaves no trace of the guess.
    expect(jar.get(ATTENDEE_SESSION_COOKIE)).toBeUndefined();
    expect(await getRuntimeStore().getAttendeeProfileByEmailHash(EVENT, await sha256Hex("stranger@example.com"))).toBeUndefined();
    expect(JSON.stringify(outcome)).not.toMatch(/not registered|unknown|no such/i);
  });

  it("an expired session gets the way back, not a blank form", async () => {
    const result = await registerHere("ada@example.com");
    const sessionId = String(jar.get(ATTENDEE_SESSION_COOKIE)).split(".").slice(1).join(".");
    const live = await getRuntimeStore().getAttendeeSession(EVENT, sessionId);
    // Time passes. The cookie outlives the session on purpose, which is what makes this state visible.
    await getRuntimeStore().upsertAttendeeSession({ ...live!, expiresAt: new Date(Date.now() - 60_000).toISOString() });
    expect(await getCurrentAttendeeProfile(EVENT)).toBeUndefined();
    const standing = await getAttendeeSessionStanding(EVENT);
    expect(standing.state).toBe("expired");
    expect(standing.name).toBe("Ada Lovelace");
    expect(sessionMaxAgeSeconds(standing.days)).toBe((standing.days + RETURN_HINT_DAYS) * 24 * 60 * 60);
    // And the one field still works from that state.
    const outcome = await restoreAttendeeOnThisDevice({ eventId: EVENT, email: "ada@example.com", ip: "203.0.113.9" });
    expect(outcome.status).toBe("restored");
    expect((await getCurrentAttendeeProfile(EVENT))?.attendeeId).toBe(result.profile.attendeeId);
  });

  it("the near-expiry warning comes before the expiry, not after", async () => {
    await registerHere("ada@example.com");
    const sessionId = String(jar.get(ATTENDEE_SESSION_COOKIE)).split(".").slice(1).join(".");
    const live = await getRuntimeStore().getAttendeeSession(EVENT, sessionId);
    await getRuntimeStore().upsertAttendeeSession({ ...live!, expiresAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString() });
    const standing = await getAttendeeSessionStanding(EVENT);
    expect(standing.state).toBe("expiring");
    expect(remainingWords(standing.msLeft || 0)).toBe("in 9 hours");
  });

  it("the return path cannot be used to enumerate who registered", async () => {
    await registerHere("ada@example.com");
    newDevice();
    const probe = (n: number) => restoreAttendeeOnThisDevice({ eventId: EVENT, email: `guess${n}@example.com`, ip: "198.51.100.4" });
    for (let i = 0; i < ATTEMPT_LIMIT - 1; i += 1) expect((await probe(i)).status).toBe("no_match");
    expect((await probe(99)).status).toBe("rate_limited");
    // The cooldown is blind to whether the next guess would have been right.
    const real = await restoreAttendeeOnThisDevice({ eventId: EVENT, email: "ada@example.com", ip: "198.51.100.4" });
    expect(real.status).toBe("rate_limited");
    // Another place is unaffected: the limit is per origin, not a global lockout of the event.
    expect((await restoreAttendeeOnThisDevice({ eventId: EVENT, email: "ada@example.com", ip: "203.0.113.9" })).status).toBe("restored");
  });

  it("a legacy row with only a hash is matched and healed, exactly as registering heals it", async () => {
    const hash = await sha256Hex("cal@example.com");
    const legacy: AttendeeProfile = { attendeeId: "legacy-cal", eventId: EVENT, emailHash: hash, name: "Cal Legacy", company: "Legacy Co", title: "Producer", socialLinks: [], topicsOfInterest: [], networkingOptIn: true, role: "attendee", status: "active", createdAt: "2026-09-10T10:00:00.000Z", updatedAt: "2026-09-10T10:00:00.000Z" };
    await getRuntimeStore().upsertAttendeeProfile(legacy);
    expect((await getRuntimeStore().getAttendeeProfileByEmailHash(EVENT, hash))?.email).toBeUndefined();

    const outcome = await restoreAttendeeOnThisDevice({ eventId: EVENT, email: "Cal@Example.com", ip: "203.0.113.9" });
    expect(outcome).toMatchObject({ status: "restored", healedEmail: true });
    const healed = await getRuntimeStore().getAttendeeProfileByEmailHash(EVENT, hash);
    expect(healed?.email).toBe("cal@example.com");
    expect(healed?.emailMasked).toBe("ca***@example.com");
    expect((await getCurrentAttendeeProfile(EVENT))?.name).toBe("Cal Legacy");
  });

  it("the lifetime is a named default with a per-event override, and the copy reads the resolved number", async () => {
    expect(clampSessionDays(30)).toBe(30);
    expect(clampSessionDays(0)).toBeUndefined();
    expect(clampSessionDays(9999)).toBeUndefined();
    expect(clampSessionDays("not a number")).toBeUndefined();
    expect(dayWord(1)).toBe("1 day");
    expect(registeredForWords(30)).toContain("the next 30 days");
    // No sentence anywhere may carry the number itself.
    const service = fs.readFileSync(path.join(process.cwd(), "services/attendees/attendeeSessionService.ts"), "utf8");
    expect(service).not.toMatch(/SESSION_DAYS\s*=\s*14/);
  });
});
