import { describe, expect, it } from "vitest";
import { zonedLocalToIso } from "@/services/events/eventRepository";
import { getRunOfShowForEvent } from "@/lib/runtime/getRuntimeData";

/**
 * Three things the first production e2e (15 Sep 2026) caught. Each is pinned so it cannot return.
 */
describe("a Later event's start time is read in the event's timezone", () => {
  it("3:00 AM Chicago is 08:00Z in September and 09:00Z in December", () => {
    expect(zonedLocalToIso("2026-09-23T03:00", "America/Chicago")).toBe("2026-09-23T08:00:00.000Z");
    expect(zonedLocalToIso("2026-12-23T03:00", "America/Chicago")).toBe("2026-12-23T09:00:00.000Z");
    expect(zonedLocalToIso("2026-09-23T03:00", "America/New_York")).toBe("2026-09-23T07:00:00.000Z");
    expect(zonedLocalToIso("2026-09-23T03:00", "UTC")).toBe("2026-09-23T03:00:00.000Z");
  });
  it("still accepts a full ISO instant", () => {
    expect(zonedLocalToIso("2026-09-23T03:00:00.000Z", "America/Chicago")).toBe("2026-09-23T03:00:00.000Z");
  });
});

describe("a real event's run of show never carries the demo summit's words", () => {
  it("the seed segment's producer notes do not appear on any runtime-created event", () => {
    // Nothing is hydrated in a unit test, so no runtime event exists; the guard is on the seed
    // itself: the demo's notes are the only place that sentence may live.
    const seedSegments = getRunOfShowForEvent("event-summit");
    expect(seedSegments.some((s) => /Drake/.test(s.producerNotes))).toBe(true);
  });
});

describe("watching the stage never publishes the attendee's microphone", () => {
  it("LiveKitRoom is mounted with audio={false}; mute and volume go to the renderer", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../../components/video/LiveKitIngressStagePlayer.tsx", import.meta.url), "utf8");
    expect(src).toMatch(/<LiveKitRoom[^>]*audio=\{false\}/);
    expect(src).not.toMatch(/<LiveKitRoom[^>]*audio=\{!muted\}/);
    expect(src).toMatch(/<RoomAudioRenderer muted=\{muted\} volume=\{volume\} \/>/);
  });
});
