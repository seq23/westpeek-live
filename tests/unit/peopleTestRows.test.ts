import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { resetOverlayForTests } from "@/services/events/runtimeEventOverlay";
import { createEventRecord } from "@/services/events/eventRepository";
import { registerOrUpdateAttendee } from "@/services/attendees/attendeeRegistrationService";
import { contactsCsv } from "@/services/attendees/contactsService";
import { archiveTestPeople, peopleDirectory } from "@/services/attendees/peopleDirectoryService";
import { contactIsTestRow, isTestEmail, isTestEvent } from "@/services/attendees/testRowClassifier";
import type { WorkspaceActor } from "@/lib/auth/workspaceActor";

/**
 * The owner opened /app/people and found 40 people, 34 of them OUR fixtures. Real people are the
 * page now; the fixtures are counted separately, shown only on request, and archived (never
 * deleted) on demand — and a row from a real event is never touched by that archive.
 */
const owner: WorkspaceActor = { kind: "owner", id: "owner", label: "Sequoia Taylor / owner", role: "owner" };

describe("test rows are not the owner's network", () => {
  let tempDir: string;
  let realEvent: string;
  let testEvent: string;
  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-test-rows-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
    resetOverlayForTests();
    realEvent = (await createEventRecord({ name: "Sequoia's first Room", when: "now" }, owner)).id;
    testEvent = (await createEventRecord({ name: "Playwright fixture room", when: "now" }, owner)).id;
    await getRuntimeStore().upsertRuntimeEvent({ ...(await getRuntimeStore().getRuntimeEvent(testEvent))!, id: testEvent, slug: `playwright-${testEvent}` });
    // Three real people at the real event, five of ours: three at test addresses, two at the fixture event.
    for (const [name, email] of [["Sequoia Taylor", "sequoia@joinwestpeek.com"], ["Cal Real", "cal@realcompany.io"], ["Scooter Real", "scooter@joinwestpeek.com"]]) {
      await registerOrUpdateAttendee({ eventId: realEvent, name, email, company: "West Peek" });
    }
    for (const [name, email] of [["Outcome Attendee", "outcome-1@example.com"], ["Outcome Attendee", "outcome-2@example.com"], ["Tier 4 Browser Event Goer", "tier4@example.invalid"]]) {
      await registerOrUpdateAttendee({ eventId: realEvent, name, email, company: "Fixtures" });
    }
    for (const [name, email] of [["Playwright Attendee", "pw-1@westpeek.test"], ["Duplicate E2E 2", "pw-2@westpeek.test"]]) {
      await registerOrUpdateAttendee({ eventId: testEvent, name, email, company: "Fixtures" });
    }
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); resetOverlayForTests(); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("classifies by domain and by event, never by name", () => {
    expect(isTestEmail("outcome-1@example.com")).toBe(true);
    expect(isTestEmail("tier4@example.invalid")).toBe(true);
    expect(isTestEmail("sequoia@joinwestpeek.com")).toBe(false);
    expect(isTestEvent({ id: "playwright-abc", name: "Playwright fixture room", source: "runtime", createdBy: "owner" })).toBe(true);
    expect(isTestEvent({ id: "sequoias-first-room", name: "Sequoia's first Room", source: "runtime", createdBy: "owner" })).toBe(false);
    expect(isTestEvent({ id: "event-summit", name: "Nova Founder Summit", source: "seed", createdBy: "seed" })).toBe(true);
    // A real person at a real event is never a test row, whatever they are called.
    expect(contactIsTestRow({ email: "playwright.smith@realco.com", eventsAttended: ["sequoias-first-room"] }, { testEventIds: new Set(["playwright-abc"]) })).toBe(false);
  });

  it("the default view is the three real people; the five of ours are counted apart and exported apart", async () => {
    const directory = await peopleDirectory();
    expect(directory.realCount).toBe(3);
    expect(directory.testCount).toBe(5);
    expect(directory.real.contacts.map((contact) => contact.name).sort()).toEqual(["Cal Real", "Scooter Real", "Sequoia Taylor"]);
    expect(contactsCsv(directory.real.contacts, directory.real.hashOnly).trim().split("\n")).toHaveLength(4);
    expect(contactsCsv([...directory.real.contacts, ...directory.test.contacts], []).trim().split("\n")).toHaveLength(9);
  });

  it("archiving the test rows leaves the three real people and their attendee rows untouched", async () => {
    const result = await archiveTestPeople("Sequoia Taylor / owner");
    expect(result.archivedContacts).toBe(5);
    expect(result.archivedProfiles).toBeGreaterThanOrEqual(5);
    const after = await peopleDirectory();
    expect(after.realCount).toBe(3);
    expect(after.testCount).toBe(0);
    // Archived, not deleted: the rows are still in the store.
    expect((await getRuntimeStore().listContacts()).length).toBe(8);
    const realProfiles = await getRuntimeStore().listAttendeeProfiles(realEvent, 50);
    expect(realProfiles.map((profile) => profile.name).sort()).toEqual(["Cal Real", "Scooter Real", "Sequoia Taylor"]);
  });
});
