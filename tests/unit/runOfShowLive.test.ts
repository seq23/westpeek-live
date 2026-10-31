import { describe, expect, it } from "vitest";
import { computeShowProgress } from "@/services/run-of-show";
import { showSegmentsFor } from "@/services/run-of-show/eventShow";
import { RUN_OF_SHOW_VISIBILITY } from "@/types/runOfShowLive";
import { demoShowStartMs } from "@/lib/mock/demoSchedule";

/**
 * The live run of show for the demo summit, read the way every surface reads it. This file used to
 * pin "some segment is always current", which was only true because the old service hard-coded the
 * second segment as current. Now: before the show nothing is on; during it the clock's segment is.
 */
describe("live run of show service", () => {
  const segments = showSegmentsFor("event-summit", new Map());

  it("builds the demo's segments with times and rooms", () => {
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(new Date(segment.endAt).getTime()).toBeGreaterThan(new Date(segment.startAt).getTime());
      expect(segment.room).toBeTruthy();
    }
  });

  it("the demo alias reads the same show", () => {
    expect(showSegmentsFor("demo", new Map()).map((segment) => segment.id)).toEqual(segments.map((segment) => segment.id));
  });

  it("nothing is current before the show starts, and nothing is delayed", () => {
    const before = computeShowProgress(segments, [], demoShowStartMs() - 60 * 60_000);
    expect(before.current).toBeUndefined();
    expect(before.next?.segment.id).toBe(segments[0].id);
    expect(before.delay).toBeUndefined();
  });

  it("returns current and next from the clock during the show", () => {
    const during = computeShowProgress(segments, [], new Date(segments[1].startAt).getTime() + 60_000);
    expect(during.current?.segment.id).toBe(segments[1].id);
    expect(during.next?.segment.id).toBe(segments[2].id);
    expect(during.completedCount).toBe(1);
  });

  it("separates client visibility", () => {
    expect(RUN_OF_SHOW_VISIBILITY.agency.canSeeInternalNotes).toBe(true);
    expect(RUN_OF_SHOW_VISIBILITY.client.canSeeInternalNotes).toBe(false);
    expect(RUN_OF_SHOW_VISIBILITY.agency.canControlLiveStatus).toBe(true);
    expect(RUN_OF_SHOW_VISIBILITY.crew.canControlLiveStatus).toBe(false);
  });
});
