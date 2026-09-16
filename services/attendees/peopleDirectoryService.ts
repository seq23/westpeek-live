import { listEventRecords } from "@/services/events/eventRepository";
import { excludePreviewIdentities } from "@/lib/auth/previewIdentity";
import { sha256Hex } from "@/lib/security/portableCrypto";
import { getRuntimeStore } from "@/services/runtime/runtimeStoreFactory";
import { listContacts, listHashOnlyPeople, type HashOnlyPerson } from "@/services/attendees/contactsService";
import { contactIsTestRow, hashOnlyIsTestRow, isTestEvent, profileIsTestRow, type TestRowContext } from "@/services/attendees/testRowClassifier";
import type { AttendeeProfile, ContactRecord } from "@/types/attendeeRegistration";

/**
 * The People page's one read. It answers with the owner's real network first: our own Playwright
 * and Tier-4 fixtures (test domains, seed/automation events) are counted separately and shown only
 * when she asks. Nothing is hidden permanently and nothing is deleted — archiving is a flag.
 */
export interface PeopleDirectory {
  eventNames: Record<string, string>;
  testEventIds: string[];
  real: { contacts: ContactRecord[]; hashOnly: HashOnlyPerson[] };
  test: { contacts: ContactRecord[]; hashOnly: HashOnlyPerson[] };
  realCount: number;
  testCount: number;
}

export async function testRowContext(): Promise<TestRowContext & { eventNames: Record<string, string> }> {
  const events = await listEventRecords({ includeArchived: true, includeSeed: true }).catch(() => []);
  const eventNames: Record<string, string> = {};
  const testEventIds = new Set<string>();
  const seedIds = new Set(events.filter((event) => event.source === "seed").map((event) => event.id));
  for (const event of events) {
    eventNames[event.id] = event.name;
    if (isTestEvent(event, seedIds)) testEventIds.add(event.id);
  }
  return { eventNames, testEventIds };
}

export async function peopleDirectory(): Promise<PeopleDirectory> {
  const { eventNames, testEventIds } = await testRowContext();
  const context = { testEventIds };
  const contacts = excludePreviewIdentities(await listContacts().catch(() => [] as ContactRecord[]), (contact) => contact.email);
  const hashOnly = excludePreviewIdentities(await listHashOnlyPeople(eventNames).catch(() => [] as HashOnlyPerson[]), (person) => person.emailHash);
  const realContacts = contacts.filter((contact) => !contactIsTestRow(contact, context));
  const testContacts = contacts.filter((contact) => contactIsTestRow(contact, context));
  const realHashOnly = hashOnly.filter((person) => !hashOnlyIsTestRow(person, context));
  const testHashOnly = hashOnly.filter((person) => hashOnlyIsTestRow(person, context));
  return {
    eventNames,
    testEventIds: Array.from(testEventIds),
    real: { contacts: realContacts, hashOnly: realHashOnly },
    test: { contacts: testContacts, hashOnly: testHashOnly },
    realCount: realContacts.length + realHashOnly.length,
    testCount: testContacts.length + testHashOnly.length,
  };
}

/**
 * Archive our own test rows: the contact gets archived_at, the attendee_profiles rows behind it are
 * marked revoked. A row from a real event is never touched, whatever it is called.
 */
export async function archiveTestPeople(actorLabel: string) {
  const { testEventIds } = await testRowContext();
  const context = { testEventIds };
  const testEventIdList = Array.from(testEventIds);
  const store = getRuntimeStore();
  const now = new Date().toISOString();
  const contacts = await listContacts().catch(() => [] as ContactRecord[]);
  const archivedContacts: string[] = [];
  for (const contact of contacts) {
    if (!contactIsTestRow(contact, context)) continue;
    // No swallowing: if contacts.archived_at is missing (migration 0030 not applied) the owner must
    // see it, not press a button that does nothing.
    await store.upsertContact({ ...contact, archivedAt: now, updatedAt: now });
    archivedContacts.push(contact.email);
  }
  // Read back: an upsert that "succeeded" against a table without the column archives nothing.
  const readBack = await listContacts(true).catch(() => [] as ContactRecord[]);
  const stillActive = archivedContacts.filter((email) => readBack.some((row) => row.email === email && !row.archivedAt));
  if (archivedContacts.length && stillActive.length === archivedContacts.length) {
    throw new Error("The archive did not stick: contacts.archived_at is missing. Apply db/migrations/0030_contact_archive.sql (mirrored at supabase/migrations/20260916190000_contact_archive.sql) and try again.");
  }
  // The hash is deterministic, so every attendee row for an archived contact is reachable without
  // scanning: archive the test ones, and never touch a row that belongs to a real event.
  let archivedProfiles = 0;
  const seen = new Set<string>();
  for (const email of archivedContacts) {
    const hash = await sha256Hex(email);
    for (const row of await store.listAttendeeProfilesByEmailHash(hash).catch(() => [] as AttendeeProfile[])) {
      if (row.status !== "active" || !profileIsTestRow(row, context)) continue;
      await store.upsertAttendeeProfile({ ...row, status: "revoked", updatedAt: now }).catch(() => undefined);
      seen.add(`${row.eventId}:${row.attendeeId}`);
      archivedProfiles += 1;
    }
  }
  // Hash-only rows (no contact to archive) at a test address or a test event go too.
  for (const row of await store.listAttendeeProfilesWithoutEmail().catch(() => [] as AttendeeProfile[])) {
    if (row.status !== "active" || seen.has(`${row.eventId}:${row.attendeeId}`) || !profileIsTestRow(row, context)) continue;
    await store.upsertAttendeeProfile({ ...row, status: "revoked", updatedAt: now }).catch(() => undefined);
    seen.add(`${row.eventId}:${row.attendeeId}`);
    archivedProfiles += 1;
  }
  for (const eventId of testEventIdList) {
    for (const row of await store.listAttendeeProfiles(eventId, 1000).catch(() => [] as AttendeeProfile[])) {
      if (row.status !== "active" || seen.has(`${row.eventId}:${row.attendeeId}`)) continue;
      await store.upsertAttendeeProfile({ ...row, status: "revoked", updatedAt: now }).catch(() => undefined);
      archivedProfiles += 1;
    }
  }
  void actorLabel;
  return { archivedContacts: archivedContacts.length, archivedProfiles };
}
