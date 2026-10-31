import { describe, expect, it } from "vitest";
import { buildEventReport } from "@/services/reports/eventReport";
import { computeShowProgress } from "@/services/run-of-show/showProgress";
import { emptyRuntimeSnapshot } from "@/services/runtime/runtimeStore";
import type { ShowSegment } from "@/services/run-of-show/eventShow";

/**
 * The post-event report (30 Oct 2026): only what the event recorded, counted one way for the
 * producer and the client. It used to show three counts; it must never show an invented one.
 */
const E = "evt";
const seg = (id: string, start: string, end: string): ShowSegment => ({ id, title: id, startAt: `2026-10-30T${start}:00.000Z`, endAt: `2026-10-30T${end}:00.000Z`, durationMinutes: 10, room: "Main", description: "", speakerIds: [], speakers: [] });
const SEGMENTS = [seg("welcome", "18:00", "18:10"), seg("panel", "18:10", "18:30"), seg("close", "18:30", "18:40")];
const values = (report: ReturnType<typeof buildEventReport>) => Object.fromEntries(report.sections.flatMap((section) => section.figures.map((item) => [item.id, item.value])));

describe("the post-event report", () => {
  it("an event that recorded nothing has no data and reports no engagement", () => {
    const show = computeShowProgress(SEGMENTS, [], Date.parse("2026-10-29T00:00:00.000Z"));
    const report = buildEventReport(E, emptyRuntimeSnapshot(), show, []);
    expect(report.hasData).toBe(false);
    expect(report.sections.find((section) => section.id === "engagement")?.figures).toEqual([]);
  });

  it("counts only this event's rows, people once, and segments from the producer's marks", () => {
    const snapshot = emptyRuntimeSnapshot();
    const t = "2026-10-30T18:05:00.000Z";
    snapshot.attendeeProfiles = [
      { attendeeId: "a1", eventId: E } as never, { attendeeId: "a2", eventId: E } as never, { attendeeId: "a3", eventId: E } as never,
      { attendeeId: "x", eventId: "other" } as never,
    ];
    snapshot.registrations = [{ id: "r1", eventId: E, attendeeEmailHash: "h1", status: "confirmed", createdAt: t }];
    snapshot.attendeeSessions = [
      { sessionId: "s1", attendeeId: "a1", eventId: E, lastSeenAt: t } as never,
      { sessionId: "s2", attendeeId: "a1", eventId: E, lastSeenAt: t } as never,
      { sessionId: "s3", attendeeId: "a2", eventId: E } as never,
    ];
    snapshot.analyticsEvents = [
      { id: "1", eventId: E, kind: "attendee_joined_lobby", createdAt: t }, { id: "2", eventId: E, kind: "attendee_joined_lobby", createdAt: t },
      { id: "3", eventId: E, kind: "question_asked", createdAt: t }, { id: "4", eventId: E, kind: "attendee_visited_sponsor_booth", createdAt: t },
      { id: "5", eventId: "other", kind: "question_asked", createdAt: t },
    ];
    snapshot.attendeeLiveCapabilities = [
      { eventId: E, attendeeId: "a1", requestStatus: "approved", requestedAt: t } as never,
      { eventId: E, attendeeId: "a2", requestStatus: "declined", requestedAt: t } as never,
      { eventId: E, attendeeId: "a3" } as never,
    ];
    const marks = [
      { segmentId: "welcome", action: "mark_live" as const, createdAt: "2026-10-30T18:00:30.000Z" },
      { segmentId: "panel", action: "mark_live" as const, createdAt: "2026-10-30T18:15:00.000Z" },
      { segmentId: "panel", action: "mark_complete" as const, createdAt: "2026-10-30T18:30:00.000Z" },
      { segmentId: "close", action: "skip" as const, createdAt: "2026-10-30T18:30:10.000Z" },
    ];
    const show = computeShowProgress(SEGMENTS, marks, Date.parse("2026-10-30T19:00:00.000Z"));
    const incidents = [
      { id: "i1", eventId: E, title: "Audio", severity: "high" as const, status: "resolved" as const, ownerRole: "crew", details: "", createdAt: t },
      { id: "i2", eventId: E, title: "Slides", severity: "low" as const, status: "open" as const, ownerRole: "crew", details: "", createdAt: t },
    ];
    const report = buildEventReport(E, snapshot, show, incidents);
    const v = values(report);
    expect(report.hasData).toBe(true);
    expect(v).toMatchObject({ registered: 3, "seen-in-venue": 1, "lobby-joins": 2, "stage-joins": 0, questions: 1, "stage-requests": 2, "stage-approved": 1, "booth-visits": 1, analytics: 4 });
    expect(v).toMatchObject({ segments: 3, "on-time": 1, late: 1, skipped: 1, incidents: 2, "incidents-serious": 1, "incidents-open": 1 });
    // Nothing that is not recorded appears; zero engagement lines are left out.
    expect(v).not.toHaveProperty("peak");
    expect(v).not.toHaveProperty("chat");
    expect(v).not.toHaveProperty("not-timed");
    expect(report.segments.map((segment) => segment.timing)).toEqual(["on_time", "late", "skipped"]);
  });
});
