import { describe, expect, it } from "vitest";
import { mergeAttendeeProfile, tellUsMoreProgress, visibleInDirectory } from "@/services/attendees/attendeeProfileMerge";
import type { AttendeeProfile } from "@/types/attendeeRegistration";

/** "Tell us more" merge: unsent fields stay, sent-empty clears, lists split, website gets its scheme; progress and directory visibility. */
const base: AttendeeProfile = { attendeeId: "a1", eventId: "e1", emailHash: "h", name: "Ada", company: "Engines", title: "", socialLinks: [], topicsOfInterest: [], networkingOptIn: true, role: "attendee", status: "active", createdAt: "2026-09-16T00:00:00.000Z", updatedAt: "2026-09-16T00:00:00.000Z" };

describe("attendee profile merge", () => {
  it("leaves unsent fields alone and fills sent ones; a bare domain gets https", () => {
    const merged = mergeAttendeeProfile({ ...base, interestingFact: "kept" }, { title: "Founder", personalWebsite: "mysite.com", topicsOfInterest: "AI, fundraising\nhiring" }, "2026-09-16T01:00:00.000Z");
    expect(merged).toMatchObject({ title: "Founder", personalWebsite: "https://mysite.com", topicsOfInterest: ["AI", "fundraising", "hiring"], interestingFact: "kept", name: "Ada", updatedAt: "2026-09-16T01:00:00.000Z" });
  });
  it("a sent empty field clears it; name and company never go empty", () => {
    const merged = mergeAttendeeProfile({ ...base, title: "Founder", networkingGoals: "meet CTOs" }, { title: "", networkingGoals: "", name: "", company: " " });
    expect(merged.title).toBe("");
    expect(merged.networkingGoals).toBeUndefined();
    expect(merged.name).toBe("Ada");
    expect(merged.company).toBe("Engines");
  });
  it("the hide-me switch and networking opt-in are only touched when sent", () => {
    expect(mergeAttendeeProfile(base, {}).hiddenFromDirectory).toBe(false);
    expect(mergeAttendeeProfile(base, { hiddenFromDirectory: true }).hiddenFromDirectory).toBe(true);
    expect(mergeAttendeeProfile({ ...base, hiddenFromDirectory: true }, { title: "x" }).hiddenFromDirectory).toBe(true);
    expect(mergeAttendeeProfile(base, { networkingOptIn: false }).networkingOptIn).toBe(false);
  });
  it("progress counts the seven tell-us-more fields", () => {
    expect(tellUsMoreProgress(base)).toEqual({ filled: 0, total: 7 });
    expect(tellUsMoreProgress({ ...base, title: "Founder", topicsOfInterest: ["AI"] })).toEqual({ filled: 2, total: 7 });
  });
  it("the People directory lists active attendees unless they hid themselves", () => {
    expect(visibleInDirectory(base)).toBe(true);
    expect(visibleInDirectory({ ...base, hiddenFromDirectory: true })).toBe(false);
    expect(visibleInDirectory({ ...base, status: "revoked" })).toBe(false);
  });
});
