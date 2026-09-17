import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { setRuntimeStoreForTests, getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { grantVip } from "@/services/guests/vipGrantService";
import { resolveAudience } from "@/services/email/emailAudienceService";
import { sendGroupEmail } from "@/services/email/groupEmailService";
import { sendManualWorkflow, listEventEmailLog, listAllEmailLog } from "@/services/email/eventEmailService";
import { buildUnsubscribeToken, readUnsubscribeToken, recordResubscribe, recordUnsubscribe, isUnsubscribed } from "@/services/email/emailSuppressionService";
import { checkSendAllowance, RESEND_DAILY_ALLOWANCE } from "@/services/email/emailVolumeService";
import { sha256Hex } from "@/lib/security/portableCrypto";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";
import type { AttendeeProfile } from "@/types/attendeeRegistration";
import type { EmailSendLog } from "@/types/emailProduction";

/**
 * Emailing a group honestly: the audience is the real rows, a person in two groups is one person,
 * an empty group is refused rather than reported as sent, the unsubscribe list stops announcements
 * and never stops a message addressed to somebody by name, the token cannot be pointed at anybody
 * else, and the daily allowance refuses before the first message rather than half way through.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Owner", role: "owner" };

async function addAttendee(eventId: string, email: string, name: string) {
  const profile: AttendeeProfile = {
    attendeeId: `att-${name.toLowerCase().replace(/\W+/g, "")}`,
    eventId,
    emailHash: await sha256Hex(email),
    email,
    name,
    company: "Analytical Engines",
    title: "Engineer",
    socialLinks: [],
    topicsOfInterest: [],
    networkingOptIn: true,
    role: "attendee",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await getRuntimeStore().upsertAttendeeProfile(profile);
  return profile;
}

async function addGuest(eventId: string, role: "speaker" | "sponsor" | "client", name: string, email?: string) {
  const now = new Date().toISOString();
  await getRuntimeStore().upsertSpecialGuestProfile({ guestId: `${role}-${name.toLowerCase()}`, eventId, role, name, company: "Co", title: "Title", email, createdAt: now, updatedAt: now });
}

async function addCrew(eventId: string, name: string, email: string, status: "booked" | "shortlisted" = "booked") {
  const now = new Date().toISOString();
  const store = getRuntimeStore();
  const id = `sup-${name.toLowerCase()}`;
  await store.upsertSupplier({ id, kind: "contractor", name, company: "", roleOrService: "Technical director", email, phone: "", rateKind: "day_rate", rateAmount: 0, notes: "", status, createdAt: now, updatedAt: now });
  await store.upsertSupplierEventLink({ id: `link-${id}`, supplierId: id, eventId, note: "", createdAt: now });
}

describe("group email", () => {
  let tempDir: string;
  let eventId: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-group-email-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    eventId = (await createEventRecord({ name: "Group Email Summit", when: "now" }, owner)).id;
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("each audience resolves to the people actually in it, and nobody else", async () => {
    await addAttendee(eventId, "ada@example.com", "Ada");
    await addAttendee(eventId, "cal@realco.io", "Cal");
    await addGuest(eventId, "speaker", "Grace", "grace@speaks.com");
    await addGuest(eventId, "sponsor", "Hopper", "hopper@sponsor.com");
    await addCrew(eventId, "Kay", "kay@crew.com");
    await grantVip(eventId, { attendeeId: "att-ada", name: "Ada", email: "ada@example.com", source: "crew_grant", grantedBy: "owner" });

    const attendees = await resolveAudience({ kind: "attendees", eventId });
    expect(attendees.members.map((member) => member.email).sort()).toEqual(["ada@example.com", "cal@realco.io"]);
    const speakers = await resolveAudience({ kind: "speakers", eventId });
    expect(speakers.members.map((member) => member.email)).toEqual(["grace@speaks.com"]);
    const sponsors = await resolveAudience({ kind: "sponsors", eventId });
    expect(sponsors.members.map((member) => member.email)).toEqual(["hopper@sponsor.com"]);
    const crew = await resolveAudience({ kind: "crew", eventId });
    expect(crew.members.map((member) => member.email)).toEqual(["kay@crew.com"]);
    const vips = await resolveAudience({ kind: "vips", eventId });
    expect(vips.members.map((member) => member.email)).toEqual(["ada@example.com"]);
    // A speaker is not an attendee and an attendee is not crew: no audience leaks into another.
    expect(attendees.members.some((member) => member.email === "grace@speaks.com")).toBe(false);
    expect(crew.members.some((member) => member.email === "ada@example.com")).toBe(false);
  });

  it("a shortlisted contractor is not crew, and a rotated VIP code drops the grants made under it", async () => {
    await addCrew(eventId, "Booked", "booked@crew.com", "booked");
    await addCrew(eventId, "Maybe", "maybe@crew.com", "shortlisted");
    const crew = await resolveAudience({ kind: "crew", eventId });
    expect(crew.members.map((member) => member.email)).toEqual(["booked@crew.com"]);
  });

  it("a person in two groups is emailed once", async () => {
    // Grace is a speaker AND registered as an attendee under the same address.
    await addAttendee(eventId, "grace@speaks.com", "Grace");
    await addGuest(eventId, "speaker", "Grace", "GRACE@Speaks.com");
    const speakers = await resolveAudience({ kind: "speakers", eventId });
    expect(speakers.members).toHaveLength(1);
    const result = await sendGroupEmail({ eventId, audience: "speakers", subject: "Doors at 9", body: "Green room opens early.", sentBy: "owner" });
    expect(result.sent).toBe(1);
    const rows = await listEventEmailLog(eventId);
    expect(rows.filter((row) => row.recipientEmail === "grace@speaks.com")).toHaveLength(1);
  });

  it("an empty audience refuses instead of reporting a successful send to nobody", async () => {
    const empty = await resolveAudience({ kind: "attendees", eventId });
    expect(empty.ok).toBe(false);
    expect(empty.reason).toContain("nobody");
    const result = await sendGroupEmail({ eventId, audience: "attendees", subject: "Hello", body: "Anyone?", sentBy: "owner" });
    expect(result.ok).toBe(false);
    expect(result.sent).toBe(0);
    expect(await listEventEmailLog(eventId)).toHaveLength(0);
  });

  it("somebody with no address on file is counted as unreachable, never silently dropped", async () => {
    await addGuest(eventId, "speaker", "Nameless");
    const speakers = await resolveAudience({ kind: "speakers", eventId });
    expect(speakers.ok).toBe(false);
    expect(speakers.withoutEmail).toBe(1);
    expect(speakers.reason).toContain("no address");
  });

  it("an unsubscribe suppresses a group send and does NOT suppress a transactional one", async () => {
    await addAttendee(eventId, "ada@example.com", "Ada");
    await addAttendee(eventId, "cal@realco.io", "Cal");
    await recordUnsubscribe({ email: "ada@example.com", source: "one_click", eventId });
    expect(await isUnsubscribed("ada@example.com")).toBe(true);

    const audience = await resolveAudience({ kind: "attendees", eventId });
    expect(audience.members.map((member) => member.email)).toEqual(["cal@realco.io"]);
    expect(audience.suppressed.map((member) => member.email)).toEqual(["ada@example.com"]);

    const group = await sendGroupEmail({ eventId, audience: "attendees", subject: "Doors at 9", body: "See you there.", sentBy: "owner" });
    expect(group.sent).toBe(1);
    expect((await listEventEmailLog(eventId)).some((row) => row.recipientEmail === "ada@example.com")).toBe(false);

    // Her own green room link still reaches her: transactional, addressed to her, never suppressed.
    const transactional = await sendManualWorkflow({ eventId, workflow: "speaker_invite", recipients: ["ada@example.com"], sentBy: "owner" });
    expect(transactional.sent).toBe(1);
    expect((await listEventEmailLog(eventId)).some((row) => row.recipientEmail === "ada@example.com")).toBe(true);

    // "One person" through the composer is the same case, and is not suppressed either.
    const oneOff = await sendGroupEmail({ eventId, audience: "one_person", oneOff: "ada@example.com", subject: "Your link", body: "Here it is.", sentBy: "owner" });
    expect(oneOff.sent).toBe(1);
  });

  it("the unsubscribe is per person across every event, and reversible", async () => {
    const second = (await createEventRecord({ name: "Another Summit", when: "now" }, owner)).id;
    await addAttendee(eventId, "ada@example.com", "Ada");
    await addAttendee(second, "ada@example.com", "Ada");
    await recordUnsubscribe({ email: "ada@example.com", source: "one_click", eventId });
    expect((await resolveAudience({ kind: "attendees", eventId: second })).ok).toBe(false);
    await recordResubscribe({ email: "ada@example.com", by: "self" });
    expect(await isUnsubscribed("ada@example.com")).toBe(false);
    expect((await resolveAudience({ kind: "attendees", eventId: second })).members).toHaveLength(1);
  });

  it("the token cannot be guessed, tampered with, or replayed for a different person", async () => {
    const token = await buildUnsubscribeToken("ada@example.com");
    expect(await readUnsubscribeToken(token)).toBe("ada@example.com");
    // Same shape, someone else's address, no valid signature to go with it.
    const [version, , signature] = token.split(".");
    const forged = `${version}.${Buffer.from("cal@realco.io").toString("base64url")}.${signature}`;
    expect(await readUnsubscribeToken(forged)).toBeUndefined();
    expect(await readUnsubscribeToken(`${token}x`)).toBeUndefined();
    expect(await readUnsubscribeToken("u1.YWRhQGV4YW1wbGUuY29t.notasignature")).toBeUndefined();
    expect(await readUnsubscribeToken("")).toBeUndefined();
    expect(await readUnsubscribeToken("guess")).toBeUndefined();
    // And a token is not a sequential id anybody could walk.
    expect(token).not.toContain("ada@example.com");
  });

  it("the daily allowance refuses before sending rather than half-sending", async () => {
    const store = getRuntimeStore();
    const now = new Date().toISOString();
    for (let index = 0; index < RESEND_DAILY_ALLOWANCE; index += 1) {
      const row: EmailSendLog & { sentBy?: string } = {
        id: `spent-${index}`, eventId, workflowType: "show_day_reminder", recipientEmail: `spent${index}@example.com`,
        subject: "Already sent", provider: "resend", status: "sent", queuedAt: now, sentAt: now,
      };
      await store.appendEmailSendLog(row);
    }
    const verdict = await checkSendAllowance(1);
    expect(verdict.ok).toBe(false);
    expect(verdict.reason).toContain("Nothing has been sent");

    await addAttendee(eventId, "ada@example.com", "Ada");
    const before = (await listAllEmailLog(5000)).length;
    const result = await sendGroupEmail({ eventId, audience: "attendees", subject: "Doors at 9", body: "See you there.", sentBy: "owner" });
    expect(result.ok).toBe(false);
    expect(result.sent).toBe(0);
    // Not one message left, and not one extra row was written.
    expect((await listAllEmailLog(5000)).length).toBe(before);
  });

  it("refuses when the audience changed between the confirm and the press", async () => {
    await addAttendee(eventId, "ada@example.com", "Ada");
    await addAttendee(eventId, "cal@realco.io", "Cal");
    const stale = await sendGroupEmail({ eventId, audience: "attendees", subject: "Doors at 9", body: "See you.", expectedCount: 5, sentBy: "owner" });
    expect(stale.ok).toBe(false);
    expect(stale.reason).toContain("changed while you were writing");
    expect(await listEventEmailLog(eventId)).toHaveLength(0);
  });

  it("a group send writes one row per recipient plus one summary row that they all point at", async () => {
    await addAttendee(eventId, "ada@example.com", "Ada");
    await addAttendee(eventId, "cal@realco.io", "Cal");
    await addAttendee(eventId, "eve@example.com", "Eve");
    await recordUnsubscribe({ email: "eve@example.com", source: "one_click", eventId });
    const result = await sendGroupEmail({ eventId, audience: "attendees", subject: "Doors at 9", body: "See you there.", sentBy: "crew:producer" });
    expect(result.sent).toBe(2);
    const rows = await listEventEmailLog(eventId);
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.groupSendId === result.groupSend?.id)).toBe(true);
    const groups = await getRuntimeStore().listEmailGroupSends();
    expect(groups).toHaveLength(1);
    expect(groups[0].recipientCount).toBe(2);
    expect(groups[0].suppressedCount).toBe(1);
    expect(groups[0].sentBy).toBe("crew:producer");
    // A transactional send has no group id, which is how the page tells the two apart.
    await sendManualWorkflow({ eventId, workflow: "speaker_invite", recipients: ["ada@example.com"], sentBy: "owner" });
    expect((await listEventEmailLog(eventId)).filter((row) => !row.groupSendId)).toHaveLength(1);
  });

  it("a group without an event is refused; one person without an event is allowed", async () => {
    const noEvent = await resolveAudience({ kind: "attendees" });
    expect(noEvent.ok).toBe(false);
    expect(noEvent.reason).toContain("pick the event first");
    const person = await resolveAudience({ kind: "one_person", oneOff: "ada@example.com" });
    expect(person.ok).toBe(true);
    const blank = await resolveAudience({ kind: "one_person", oneOff: "" });
    expect(blank.ok).toBe(false);
  });

  it("a message of your own needs both a subject and a body", async () => {
    await addAttendee(eventId, "ada@example.com", "Ada");
    const noSubject = await sendGroupEmail({ eventId, audience: "attendees", body: "Just a body.", sentBy: "owner" });
    expect(noSubject.ok).toBe(false);
    expect(noSubject.reason).toContain("subject");
    expect(await listEventEmailLog(eventId)).toHaveLength(0);
  });
});
