import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { registerOrUpdateAttendee } from "@/services/attendees/attendeeRegistrationService";
import { contactsCsv, groupHashOnlyProfiles, listContacts, listHashOnlyPeople, upsertContactFromProfile } from "@/services/attendees/contactsService";
import { mergeAttendeeProfile } from "@/services/attendees/attendeeProfileMerge";
import { sha256Hex } from "@/lib/security/portableCrypto";
import type { AttendeeProfile } from "@/types/attendeeRegistration";

/**
 * The owner's bug (16 Sep 2026, 16:59): people who registered before the raw email was kept have
 * email null, so no contact was ever built and /app/people showed nobody from before. Now: they are
 * listed grouped by hash across events (masked email, "not captured"), counted, exported with a
 * blank email; and the moment the same address registers or saves anywhere, every hash-only row
 * is backfilled and ONE contact carries the union of their events with the earliest first_seen.
 */
function legacyRow(eventId: string, emailHash: string, createdAt: string, extra: Partial<AttendeeProfile> = {}): AttendeeProfile {
  return { attendeeId: `legacy-${eventId}`, eventId, emailHash, emailMasked: "ca***@example.com", name: "Cal Legacy", company: "Legacy Co", title: "", socialLinks: [], topicsOfInterest: [], networkingOptIn: true, role: "attendee", status: "active", createdAt, updatedAt: createdAt, ...extra };
}

describe("hash-only people: listed, then healed on the next match", () => {
  let tempDir: string;
  let hash: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-hash-only-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    hash = await sha256Hex("cal@example.com");
    await getRuntimeStore().upsertAttendeeProfile(legacyRow("event-old-1", hash, "2026-09-10T10:00:00.000Z"));
    await getRuntimeStore().upsertAttendeeProfile(legacyRow("event-old-2", hash, "2026-09-12T10:00:00.000Z", { title: "Producer", updatedAt: "2026-09-12T11:00:00.000Z" }));
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("two hash-only rows across two events are one grouped person with 2 events, a masked email and no contact", async () => {
    expect(await listContacts()).toHaveLength(0);
    const people = await listHashOnlyPeople({ "event-old-1": "Workshop one", "event-old-2": "Workshop two" });
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ emailHash: hash, emailMasked: "ca***@example.com", name: "Cal Legacy", title: "Producer", firstSeenAt: "2026-09-10T10:00:00.000Z" });
    expect(people[0].events.map((event) => event.name).sort()).toEqual(["Workshop one", "Workshop two"]);
    const csv = contactsCsv([], people);
    expect(csv.trim().split("\n")).toHaveLength(2);
    expect(csv).toContain('"Cal Legacy","","Legacy Co","Producer","2","false","2026-09-10T10:00:00.000Z"');
  });

  it("registering with the matching email backfills both rows and builds one contact with three events and the earliest first_seen", async () => {
    const result = await registerOrUpdateAttendee({ eventId: "event-new", name: "Cal Legacy", email: "Cal@Example.com", company: "Legacy Co" });
    expect(result.duplicateBehavior).toBe("created");
    const store = getRuntimeStore();
    for (const eventId of ["event-old-1", "event-old-2"]) {
      const row = await store.getAttendeeProfileByEmailHash(eventId, hash);
      expect(row?.email).toBe("cal@example.com");
    }
    expect(await listHashOnlyPeople()).toHaveLength(0);
    const contacts = await listContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].eventsAttended.sort()).toEqual(["event-new", "event-old-1", "event-old-2"]);
    expect(contacts[0].firstSeenAt).toBe("2026-09-10T10:00:00.000Z");
    // Export: one contact row, no hash-only rows.
    expect(contactsCsv(contacts, await listHashOnlyPeople()).trim().split("\n")).toHaveLength(2);
  });

  it("a profile save (the merge path) heals the same way — one store method behind both", async () => {
    const fresh: AttendeeProfile = { ...legacyRow("event-new", hash, "2026-09-16T17:00:00.000Z"), attendeeId: "att-new", email: "cal@example.com" };
    await getRuntimeStore().upsertAttendeeProfile(fresh);
    const saved = await upsertContactFromProfile(mergeAttendeeProfile(fresh, { title: "Showrunner" }));
    expect(saved?.healedRows).toBe(2);
    const contacts = await listContacts();
    expect(contacts[0].eventsAttended).toHaveLength(3);
    expect((await getRuntimeStore().listAttendeeProfilesByEmailHash(hash)).every((row) => row.email === "cal@example.com")).toBe(true);
  });

  it("groupHashOnlyProfiles ignores rows that have an email and keeps the latest details per hash", () => {
    const rows = [legacyRow("a", "h1", "2026-09-01T00:00:00.000Z", { name: "Old Name" }), legacyRow("b", "h1", "2026-09-02T00:00:00.000Z", { name: "New Name", updatedAt: "2026-09-03T00:00:00.000Z" }), legacyRow("c", "h2", "2026-09-04T00:00:00.000Z", { email: "x@y.z" })];
    const people = groupHashOnlyProfiles(rows);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ name: "New Name", firstSeenAt: "2026-09-01T00:00:00.000Z", lastSeenAt: "2026-09-03T00:00:00.000Z" });
    expect(people[0].events.map((event) => event.id)).toEqual(["a", "b"]);
  });
});
