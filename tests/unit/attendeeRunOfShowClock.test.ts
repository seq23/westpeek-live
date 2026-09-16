import { describe, expect, it, vi } from "vitest";

/**
 * "Now" must come from the real segment clock. The producer snapshot decides it by index (the
 * second row is always "current"), which is fine for a producer watching a board and wrong for an
 * attendee reading what is on at this minute.
 */
const SEGMENTS = [
  { id: "a", publicTitle: "Doors", startAt: "2026-09-16T14:00:00.000Z", endAt: "2026-09-16T14:30:00.000Z", room: "Main stage", clientFacingDescription: "" },
  { id: "b", publicTitle: "Talk", startAt: "2026-09-16T14:30:00.000Z", endAt: "2026-09-16T15:30:00.000Z", room: "Main stage", clientFacingDescription: "" },
  { id: "c", publicTitle: "Networking", startAt: "2026-09-16T15:30:00.000Z", endAt: "2026-09-16T16:00:00.000Z", room: "Lounge", clientFacingDescription: "" },
];

vi.mock("@/services/run-of-show/liveRunOfShowService", () => ({
  getLiveRunOfShowSegments: () => SEGMENTS,
}));

describe("the attendee run of show reads the real segment clock", () => {
  // Imported inside the suite so the module picks up the mock above.
  const load = async () => (await import("@/services/run-of-show/attendeeRunOfShow")).attendeeRunOfShowView;
  it("picks now and next from the instant, not from an index", async () => {
    const attendeeRunOfShowView = await load();
    const during = attendeeRunOfShowView("evt", Date.parse("2026-09-16T14:45:00.000Z"));
    expect(during.now?.title).toBe("Talk");
    expect(during.next?.title).toBe("Networking");
    expect(during.position).toBe(2);
    // A networking block is flagged so the strip can point straight at the queue.
    expect(during.next?.networking).toBe(true);
  });

  it("before the first segment there is no now, only a next", async () => {
    const attendeeRunOfShowView = await load();
    const before = attendeeRunOfShowView("evt", Date.parse("2026-09-16T13:00:00.000Z"));
    expect(before.now).toBeUndefined();
    expect(before.next?.title).toBe("Doors");
    expect(before.finished).toBe(false);
  });

  it("after the last segment the show is over and says so", async () => {
    const attendeeRunOfShowView = await load();
    const after = attendeeRunOfShowView("evt", Date.parse("2026-09-16T17:00:00.000Z"));
    expect(after.finished).toBe(true);
    expect(after.now).toBeUndefined();
    expect(after.next).toBeUndefined();
  });

  it("the last segment has nothing after it, and nothing is invented to fill the row", async () => {
    const attendeeRunOfShowView = await load();
    const last = attendeeRunOfShowView("evt", Date.parse("2026-09-16T15:45:00.000Z"));
    expect(last.now?.title).toBe("Networking");
    expect(last.next).toBeUndefined();
  });

  it("carries only guest-facing fields", async () => {
    const attendeeRunOfShowView = await load();
    const view = attendeeRunOfShowView("evt", Date.parse("2026-09-16T14:45:00.000Z"));
    expect(Object.keys(view.now || {}).sort()).toEqual(["description", "endAt", "id", "networking", "room", "startAt", "title"]);
  });
});
