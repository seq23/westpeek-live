import { describe, expect, it } from "vitest";
import { resolveEventJoinCode } from "@/services/events/eventStateResolver";

describe("public join flow", () => {
  it("rejects an invalid code with a friendly denial", async () => {
    const result = await resolveEventJoinCode("not-a-real-event");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid_code");
    expect(result.message).toContain("could not find");
  });

  /**
   * The demo summit runs on the viewer's own clock and is therefore always live, so its code
   * resolves the way a live event's code resolves: straight into the show, not onto the landing
   * page. That is the point of the demo — somebody typing the code is shown the product running.
   */
  it("resolves the demo public code through repo config, into the live show", async () => {
    const result = await resolveEventJoinCode("demo");
    expect(result.ok).toBe(true);
    expect(result.eventId).toBe("event-summit");
    expect(result.publicState).toBe("live");
    expect(result.destination).toBe("/venue/event-summit/stage");
  });

  it("still lands an event that has not started on its own page rather than in an empty venue", async () => {
    const result = await resolveEventJoinCode("leadership-reset-webinar");
    expect(result.ok).toBe(true);
    expect(result.destination).toBe("/events/leadership-reset-webinar");
  });
});
