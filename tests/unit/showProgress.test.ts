import { describe, expect, it } from "vitest";
import { computeShowProgress, LATE_AFTER_MINUTES, segmentTiming, type ShowMark } from "@/services/run-of-show/showProgress";

/**
 * The run-of-show tracker's state logic (30 Oct 2026). Before this, the tracker set segment 1 done,
 * segment 2 current and the second-to-last "delayed 8 min" by POSITION, whatever the time; during
 * a real show it said "Welcome" was on while the clock said the investor panel was.
 */
const T = (hhmm: string) => `2026-10-30T${hhmm}:00.000Z`;
const at = (hhmm: string) => Date.parse(T(hhmm));
const SEGMENTS = [
  { id: "welcome", startAt: T("18:00"), endAt: T("18:10") },
  { id: "keynote", startAt: T("18:10"), endAt: T("18:30") },
  { id: "panel", startAt: T("18:30"), endAt: T("18:50") },
  { id: "qa", startAt: T("18:50"), endAt: T("19:05") },
  { id: "close", startAt: T("19:05"), endAt: T("19:15") },
];
const mark = (segmentId: string, action: ShowMark["action"], hhmm: string): ShowMark => ({ segmentId, action, createdAt: T(hhmm) });
const states = (progress: ReturnType<typeof computeShowProgress>) => progress.segments.map((run) => run.state);

describe("clock only (no producer marks)", () => {
  it("before the show nothing is done or on, the first segment is next, and nothing is late", () => {
    const p = computeShowProgress(SEGMENTS, [], at("17:30"));
    expect(p.current).toBeUndefined();
    expect(p.next?.segment.id).toBe("welcome");
    expect(p.completedCount).toBe(0);
    expect(states(p)).toEqual(["upcoming", "upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(p.delay).toBeUndefined();
    expect(p.started).toBe(false);
  });

  it("during the show the clock's segment is on — the case the old tracker got wrong", () => {
    const p = computeShowProgress(SEGMENTS, [], at("18:35"));
    expect(p.current?.segment.id).toBe("panel");
    expect(p.current?.decidedBy).toBe("clock");
    expect(p.next?.segment.id).toBe("qa");
    expect(p.previous?.segment.id).toBe("keynote");
    expect(states(p)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
    expect(p.completedCount).toBe(2);
    expect(p.position).toBe(3);
  });

  it("the clock alone never calls the show late, at any minute", () => {
    for (let minute = 0; minute < 120; minute += 1) {
      expect(computeShowProgress(SEGMENTS, [], at("17:45") + minute * 60_000).delay).toBeUndefined();
    }
  });

  it("after the last segment the show is finished", () => {
    const p = computeShowProgress(SEGMENTS, [], at("19:30"));
    expect(p.finished).toBe(true);
    expect(p.current).toBeUndefined();
    expect(p.next).toBeUndefined();
    expect(p.completedCount).toBe(5);
  });

  it("an empty timeline is neither started nor finished", () => {
    const p = computeShowProgress([], [], at("18:00"));
    expect(p.total).toBe(0);
    expect(p.finished).toBe(false);
    expect(p.current).toBeUndefined();
  });
});

describe("a producer's mark overrides the clock", () => {
  it("a segment marked live stays on after its slot ends, and the next one waits", () => {
    const p = computeShowProgress(SEGMENTS, [mark("panel", "mark_live", "18:30")], at("18:55"));
    expect(p.current?.segment.id).toBe("panel");
    expect(p.current?.decidedBy).toBe("mark");
    expect(p.next?.segment.id).toBe("qa");
    expect(states(p)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
  });

  it("marking a later segment live closes everything before it", () => {
    const p = computeShowProgress(SEGMENTS, [mark("qa", "mark_live", "18:20")], at("18:21"));
    expect(p.current?.segment.id).toBe("qa");
    expect(states(p)).toEqual(["done", "done", "done", "current", "upcoming"]);
  });

  it("marking the clock's segment complete early leaves nothing on until the clock or a mark moves on", () => {
    const p = computeShowProgress(SEGMENTS, [mark("keynote", "mark_live", "18:10"), mark("keynote", "mark_complete", "18:25")], at("18:27"));
    expect(p.current).toBeUndefined();
    expect(p.next?.segment.id).toBe("panel");
    expect(p.previous?.segment.id).toBe("keynote");
    // And once the clock reaches the next slot, the clock takes over again.
    const later = computeShowProgress(SEGMENTS, [mark("keynote", "mark_live", "18:10"), mark("keynote", "mark_complete", "18:25")], at("18:31"));
    expect(later.current?.segment.id).toBe("panel");
    expect(later.current?.decidedBy).toBe("clock");
  });

  it("the most recent live mark wins when two segments were marked live", () => {
    const p = computeShowProgress(SEGMENTS, [mark("keynote", "mark_live", "18:10"), mark("panel", "mark_live", "18:31")], at("18:32"));
    expect(p.current?.segment.id).toBe("panel");
    expect(states(p).filter((state) => state === "current")).toHaveLength(1);
  });

  it("a skipped segment is skipped, not done, and is never next", () => {
    const p = computeShowProgress(SEGMENTS, [mark("keynote", "mark_live", "18:10"), mark("panel", "skip", "18:20")], at("18:25"));
    expect(p.current?.segment.id).toBe("keynote");
    expect(p.next?.segment.id).toBe("qa");
    expect(p.skippedCount).toBe(1);
    expect(states(p)[2]).toBe("skipped");
  });

  it("marks for a segment no longer on the timeline are ignored", () => {
    const p = computeShowProgress(SEGMENTS, [mark("deleted-segment", "mark_live", "18:00")], at("18:35"));
    expect(p.current?.segment.id).toBe("panel");
  });

  it("only live, complete and skip move the show; ready, delay and note do not", () => {
    const p = computeShowProgress(SEGMENTS, [mark("qa", "mark_ready", "18:00"), mark("qa", "note", "18:01"), mark("qa", "delay", "18:02")], at("18:35"));
    expect(p.current?.segment.id).toBe("panel");
    expect(p.current?.decidedBy).toBe("clock");
  });
});

describe("delayed appears only when it is true", () => {
  it("on time: marked live at its start, nothing late", () => {
    const p = computeShowProgress(SEGMENTS, [mark("panel", "mark_live", "18:31")], at("18:40"));
    expect(p.delay).toBeUndefined();
    expect(p.current?.startedLateMinutes).toBe(0);
  });

  it(`under ${LATE_AFTER_MINUTES} minutes is not late`, () => {
    const p = computeShowProgress(SEGMENTS, [mark("panel", "mark_live", "18:30")], at("18:51"));
    expect(p.delay).toBeUndefined();
  });

  it("a segment marked live late says how late", () => {
    const p = computeShowProgress(SEGMENTS, [mark("panel", "mark_live", "18:36")], at("18:40"));
    expect(p.current?.startedLateMinutes).toBe(6);
    expect(p.delay).toMatchObject({ minutes: 6, segmentId: "panel" });
    expect(p.delay?.reason).toContain("started 6 min late");
  });

  it("a segment still on after its slot is running over, and the next one is waiting", () => {
    const p = computeShowProgress(SEGMENTS, [mark("panel", "mark_live", "18:30")], at("18:58"));
    expect(p.current?.overranMinutes).toBe(8);
    // The Q&A was due at 18:50: eight minutes ago — the largest true lateness is reported once.
    expect(p.delay?.minutes).toBe(8);
  });

  it("the show catches up: once the late segment is complete and the next is marked live on time, the delay is gone", () => {
    const marks = [mark("panel", "mark_live", "18:36"), mark("panel", "mark_complete", "18:50"), mark("qa", "mark_live", "18:50")];
    const p = computeShowProgress(SEGMENTS, marks, at("18:55"));
    expect(p.current?.segment.id).toBe("qa");
    expect(p.delay).toBeUndefined();
  });

  it("no delay is ever attached to a segment by its position", () => {
    // The old tracker always said the second-to-last segment was 8 minutes late.
    for (const hhmm of ["17:00", "18:05", "18:45", "19:10", "20:00"]) {
      const p = computeShowProgress(SEGMENTS, [], at(hhmm));
      expect(p.segments.every((run) => run.startedLateMinutes === 0 && run.overranMinutes === 0)).toBe(true);
    }
  });
});

describe("report timing per segment", () => {
  it("on time, late, skipped, not timed and not run", () => {
    const marks = [
      mark("welcome", "mark_live", "18:00"), mark("welcome", "mark_complete", "18:10"),
      mark("keynote", "mark_live", "18:14"), mark("keynote", "mark_complete", "18:30"),
      mark("panel", "skip", "18:30"),
    ];
    const p = computeShowProgress(SEGMENTS, marks, at("18:52"));
    const timing = Object.fromEntries(p.segments.map((run) => [run.segment.id, segmentTiming(run)]));
    expect(timing).toEqual({ welcome: "on_time", keynote: "late", panel: "skipped", qa: "not_timed", close: "not_run" });
  });

  it("a segment that ended well past its slot is late even if it started on time", () => {
    const p = computeShowProgress(SEGMENTS, [mark("welcome", "mark_live", "18:00"), mark("welcome", "mark_complete", "18:16")], at("18:17"));
    expect(p.segments[0].overranMinutes).toBe(6);
    expect(segmentTiming(p.segments[0])).toBe("late");
  });
});

describe("a stale live mark", () => {
  it("is superseded when the producer marks a later segment after it", () => {
    // Welcome was marked live and never closed; the producer then completed the keynote.
    const marks = [mark("welcome", "mark_live", "18:00"), mark("keynote", "mark_live", "18:10"), mark("keynote", "mark_complete", "18:30")];
    const p = computeShowProgress(SEGMENTS, marks, at("18:40"));
    expect(p.segments[0].state).toBe("done");
    expect(p.current?.segment.id).toBe("panel");
    expect(p.current?.decidedBy).toBe("clock");
    expect(p.delay).toBeUndefined();
  });
});

describe("skipping ahead of time", () => {
  it("a segment skipped in advance changes the plan, not where the show is", () => {
    const p = computeShowProgress(SEGMENTS, [mark("qa", "skip", "18:00")], at("18:15"));
    expect(p.current?.segment.id).toBe("keynote");
    expect(states(p)).toEqual(["done", "current", "upcoming", "skipped", "upcoming"]);
  });

  it("the clock never lands on a skipped segment", () => {
    const p = computeShowProgress(SEGMENTS, [mark("panel", "skip", "18:00")], at("18:35"));
    expect(p.current).toBeUndefined();
    expect(p.next?.segment.id).toBe("qa");
  });
});
