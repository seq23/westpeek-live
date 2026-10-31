import { describe, expect, it } from "vitest";
import { attendeeRunOfShowFromShow } from "@/services/run-of-show/attendeeRunOfShow";
import { computeShowProgress, type ShowMark } from "@/services/run-of-show/showProgress";
import type { ShowSegment } from "@/services/run-of-show/eventShow";

/**
 * "Now" for an attendee comes from the same reading as the producer's tracker: the clock, unless
 * the producer has marked a segment, in which case the mark wins. Before 30 Oct 2026 the tracker
 * decided by index (the second row was always "current") while the lobby read the clock, and the
 * two disagreed mid-show.
 */
const segment = (id: string, title: string, startAt: string, endAt: string, room = "Main stage"): ShowSegment => ({ id, title, startAt, endAt, room, description: "", durationMinutes: 30, speakerIds: [], speakers: [], cueNotes: "producer only: cue the bumper" });
const SEGMENTS = [
  segment("a", "Doors", "2026-09-16T14:00:00.000Z", "2026-09-16T14:30:00.000Z"),
  segment("b", "Talk", "2026-09-16T14:30:00.000Z", "2026-09-16T15:30:00.000Z"),
  segment("c", "Networking", "2026-09-16T15:30:00.000Z", "2026-09-16T16:00:00.000Z", "Lounge"),
];
const view = (at: string, marks: ShowMark[] = []) => attendeeRunOfShowFromShow(computeShowProgress(SEGMENTS, marks, Date.parse(at)));

describe("the attendee run of show reads the shared show clock", () => {
  it("picks now and next from the instant, not from an index", () => {
    const during = view("2026-09-16T14:45:00.000Z");
    expect(during.now?.title).toBe("Talk");
    expect(during.next?.title).toBe("Networking");
    expect(during.position).toBe(2);
    // A networking block is flagged so the strip can point straight at the queue.
    expect(during.next?.networking).toBe(true);
  });

  it("before the first segment there is no now, only a next", () => {
    const before = view("2026-09-16T13:00:00.000Z");
    expect(before.now).toBeUndefined();
    expect(before.next?.title).toBe("Doors");
    expect(before.finished).toBe(false);
  });

  it("after the last segment the show is over and says so", () => {
    const after = view("2026-09-16T17:00:00.000Z");
    expect(after.finished).toBe(true);
    expect(after.now).toBeUndefined();
    expect(after.next).toBeUndefined();
  });

  it("the last segment has nothing after it, and nothing is invented to fill the row", () => {
    const last = view("2026-09-16T15:45:00.000Z");
    expect(last.now?.title).toBe("Networking");
    expect(last.next).toBeUndefined();
  });

  it("follows the producer's mark over the clock, exactly as the tracker does", () => {
    // The talk is running long: the clock is in the networking slot, but nobody has moved on.
    const marks: ShowMark[] = [{ segmentId: "b", action: "mark_live", createdAt: "2026-09-16T14:31:00.000Z" }];
    const running = view("2026-09-16T15:40:00.000Z", marks);
    expect(running.now?.title).toBe("Talk");
    expect(running.next?.title).toBe("Networking");
    expect(running.segments.map((s) => s.state)).toEqual(["finished", "now", "later"]);
  });

  it("leaves a skipped segment out of the guest's running order", () => {
    const skipped = view("2026-09-16T14:10:00.000Z", [{ segmentId: "b", action: "skip", createdAt: "2026-09-16T14:05:00.000Z" }]);
    expect(skipped.segments.map((s) => s.title)).toEqual(["Doors", "Networking"]);
    expect(skipped.total).toBe(2);
  });

  it("carries only guest-facing fields", () => {
    const during = view("2026-09-16T14:45:00.000Z");
    expect(Object.keys(during.now || {}).sort()).toEqual(["description", "endAt", "id", "networking", "room", "startAt", "state", "title"]);
    expect(JSON.stringify(during)).not.toContain("producer only");
  });
});
