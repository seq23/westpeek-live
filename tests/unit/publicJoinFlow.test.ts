import { describe, expect, it } from "vitest";
import { resolveEventJoinCode } from "@/services/events/eventStateResolver";

describe("public join flow", () => {
  it("rejects an invalid code with a friendly denial", async () => {
    const result = await resolveEventJoinCode("not-a-real-event");
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invalid_code");
    expect(result.message).toContain("could not find");
  });

  it("resolves the demo public code through repo config", async () => {
    const result = await resolveEventJoinCode("demo");
    expect(result.ok).toBe(true);
    expect(result.eventId).toBe("event-summit");
    expect(result.destination).toBe("/events/demo");
  });
});
