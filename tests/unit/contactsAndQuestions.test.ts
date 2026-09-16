import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileRuntimeStore } from "@/services/runtime/fileRuntimeStore";
import { getRuntimeStore, setRuntimeStoreForTests } from "@/services/runtime/runtimeStoreFactory";
import { registerOrUpdateAttendee } from "@/services/attendees/attendeeRegistrationService";
import { contactsCsv, listContacts, mergeContact } from "@/services/attendees/contactsService";
import { answerFor, applyAnswers, parseQuestionLines, questionsForEvent, tellUsMoreProgressFor } from "@/services/attendees/registrationQuestions";
import { DEFAULT_REGISTRATION_QUESTIONS } from "@/types/attendeeRegistration";

/**
 * The attendee database gaps the owner found (16 Sep 2026): the raw email is stored; the same
 * person at the same event is one row updated, at a second event two attendee rows but ONE contact
 * with two events; per-event "Tell us more" questions default to the legacy four and answers keep
 * the legacy columns in step.
 */
describe("contacts across events", () => {
  let tempDir: string;
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "wpl-contacts-"));
    process.env.AGENCY_EVENT_OS_RUNTIME_STORE = "file";
    setRuntimeStoreForTests(new FileRuntimeStore(path.join(tempDir, "runtime.json")));
  });
  afterEach(() => { setRuntimeStoreForTests(undefined); fs.rmSync(tempDir, { recursive: true, force: true }); });

  it("stores the raw email; same event → one row updated; second event → two attendee rows, one contact with two events", async () => {
    const first = await registerOrUpdateAttendee({ eventId: "event-a", name: "Ada Lovelace", email: " Ada@Example.com ", company: "Engines" });
    expect(first.duplicateBehavior).toBe("created");
    expect(first.profile.email).toBe("ada@example.com");
    expect(first.profile.title).toBe("");
    const again = await registerOrUpdateAttendee({ eventId: "event-a", name: "Ada Lovelace", email: "ada@example.com", company: "Analytical Engines", title: "Founder" });
    expect(again.duplicateBehavior).toBe("updated_existing_email");
    expect(again.profile.attendeeId).toBe(first.profile.attendeeId);
    expect((await getRuntimeStore().listAttendeeProfiles("event-a", 10))).toHaveLength(1);
    const second = await registerOrUpdateAttendee({ eventId: "event-b", name: "Ada Lovelace", email: "ADA@example.com", company: "Analytical Engines" });
    expect(second.duplicateBehavior).toBe("created");
    expect(second.profile.attendeeId).not.toBe(first.profile.attendeeId);
    expect((await getRuntimeStore().listAttendeeProfiles("event-b", 10))).toHaveLength(1);
    const contacts = await listContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({ email: "ada@example.com", name: "Ada Lovelace", company: "Analytical Engines", title: "Founder" });
    expect(contacts[0].eventsAttended.sort()).toEqual(["event-a", "event-b"]);
    expect(contactsCsv(contacts)).toContain('"Ada Lovelace","ada@example.com","Analytical Engines","Founder","2","false"');
  });

  it("mergeContact keeps earlier details when the new registration leaves them out", () => {
    const base = { attendeeId: "x", eventId: "e2", emailHash: "h", email: "a@b.co", name: "A", company: "", title: "", socialLinks: [], topicsOfInterest: [], networkingOptIn: true, role: "attendee" as const, status: "active" as const, createdAt: "", updatedAt: "" };
    const merged = mergeContact({ email: "a@b.co", name: "A", company: "Old Co", title: "CEO", socialLinks: ["x"], topicsOfInterest: ["ai"], hiddenFromDirectory: false, eventsAttended: ["e1"], firstSeenAt: "2026-01-01T00:00:00.000Z", lastSeenAt: "2026-01-01T00:00:00.000Z", updatedAt: "" }, base, "2026-09-16T00:00:00.000Z");
    expect(merged).toMatchObject({ company: "Old Co", title: "CEO", socialLinks: ["x"], eventsAttended: ["e1", "e2"], firstSeenAt: "2026-01-01T00:00:00.000Z", lastSeenAt: "2026-09-16T00:00:00.000Z" });
    expect(mergeContact(undefined, { ...base, email: undefined })).toBeUndefined();
  });
});

describe("per-event registration questions", () => {
  it("an event without its own list gets the legacy four, in order", () => {
    expect(questionsForEvent(undefined)).toEqual(DEFAULT_REGISTRATION_QUESTIONS);
    expect(questionsForEvent({ registrationQuestions: [] })).toEqual(DEFAULT_REGISTRATION_QUESTIONS);
    expect(DEFAULT_REGISTRATION_QUESTIONS.map((q) => q.key)).toEqual(["reasonForAttending", "interestingFact", "topicsOfInterest", "networkingGoals"]);
  });
  it("parses the editor's lines, keeps legacy keys for legacy labels, caps at eight, and round-trips answers into the legacy columns", () => {
    const questions = parseQuestionLines("What brings you here | textarea\nFavourite tool | text\nTopics you care about | tags\n\nOne interesting fact");
    expect(questions.map((q) => [q.key, q.type])).toEqual([["reasonForAttending", "textarea"], ["favourite_tool", "text"], ["topicsOfInterest", "tags"], ["interestingFact", "textarea"]]);
    expect(parseQuestionLines(Array.from({ length: 12 }, (_, i) => `Q${i}`).join("\n"))).toHaveLength(8);
    const profile = { attendeeId: "x", eventId: "e", emailHash: "h", name: "A", company: "C", title: "", socialLinks: [], topicsOfInterest: [], networkingOptIn: true, role: "attendee" as const, status: "active" as const, createdAt: "", updatedAt: "" };
    const answered = applyAnswers(profile, { reasonForAttending: "Learning", favourite_tool: "vim", topicsOfInterest: "AI, hiring" });
    expect(answered.reasonForAttending).toBe("Learning");
    expect(answered.topicsOfInterest).toEqual(["AI", "hiring"]);
    expect(answered.extraAnswers).toEqual({ reasonForAttending: "Learning", favourite_tool: "vim", topicsOfInterest: "AI, hiring" });
    expect(answerFor(answered, questions[1])).toBe("vim");
    expect(answerFor({ ...profile, interestingFact: "legacy" }, questions[3])).toBe("legacy");
    expect(tellUsMoreProgressFor(answered, questions)).toEqual({ filled: 3, total: 7 });
  });
});
